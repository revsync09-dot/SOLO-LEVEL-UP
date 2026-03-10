/**
 * rateLimitService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Anti-abuse rate limiting with per-user, per-command, per-minute buckets.
 * Falls back to in-memory map if the DB table doesn't exist yet.
 *
 * Error codes returned in { ok: false, reason, retryAfterSeconds }
 *   RATE_GLOBAL_FLOOD  — user fired > MAX_GLOBAL_PER_MINUTE any-commands in 1 min
 *   RATE_CMD_FLOOD     — user fired > limit for THIS command in 1 min
 */

const { supabase } = require("../lib/supabase");

// ── In-memory fallback when the SQL table is missing ─────────────────────────
const _mem = /** @type {Map<string, number>} */ (new Map());
let _dbMissing = false;

// ── Limits (calls per minute per user) ───────────────────────────────────────
const GLOBAL_MAX_PER_MIN = 30;          // hard cap across ALL commands
const CMD_LIMITS = {
  hunt:         5,
  gate_risk:    4,
  spin:         1,   // daily spin — DB date-key already prevents >1/day; this stops spam-DM
  lootbox:      6,
  streak:       1,
  battle:       4,
  dungeon:      2,
  shop:         10,
  guild_salary: 1,
  training:     6,
  expedition:   2,
  boss:         2,
  weekly:       2,
  meditate:     3,
  challenge:    2,
  eventstatus:  5,
  event:        5,
  default:      15,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function bucketKey() {
  // Minute-level bucket: "YYYY-MM-DDTHH:MM"
  return new Date().toISOString().slice(0, 16);
}

function memKey(userId, guildId, cmd, bucket) {
  return `${userId}:${guildId}:${cmd}:${bucket}`;
}

function globalMemKey(userId, guildId, bucket) {
  return `${userId}:${guildId}:*:${bucket}`;
}

function isFunctionMissing(error) {
  const msg = typeof error?.message === "string" ? error.message : "";
  return (
    error?.code === "42883" ||
    error?.code === "P0001" ||
    msg.includes("rate_limit_increment") ||
    msg.includes("schema cache")
  );
}

function isMissingTable(error) {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    (error?.code === "PGRST204" && typeof error?.message === "string")
  );
}

// ── Core ──────────────────────────────────────────────────────────────────────
/**
 * Increment the counter for (userId, guildId, cmdKey) in the current minute
 * and check if they are over the limit.
 *
 * @returns {{ ok: boolean, reason?: string, retryAfterSeconds?: number, count: number }}
 */
async function checkAndIncrement(userId, guildId, cmdKey = "default") {
  // Owner bypass
  if (userId === "795466540140986368") return { ok: true, count: 0 };

  const bucket = bucketKey();
  const cmdLimit = CMD_LIMITS[cmdKey] ?? CMD_LIMITS.default;

  // ── In-memory path ────────────────────────────────────────────────────────
  if (_dbMissing) {
    const gKey = globalMemKey(userId, guildId, bucket);
    const cKey = memKey(userId, guildId, cmdKey, bucket);
    const globalCount = (_mem.get(gKey) || 0) + 1;
    const cmdCount    = (_mem.get(cKey) || 0) + 1;
    _mem.set(gKey, globalCount);
    _mem.set(cKey, cmdCount);
    if (globalCount > GLOBAL_MAX_PER_MIN) return { ok: false, reason: "RATE_GLOBAL_FLOOD", retryAfterSeconds: 60, count: globalCount };
    if (cmdCount    > cmdLimit)           return { ok: false, reason: "RATE_CMD_FLOOD",    retryAfterSeconds: 60, count: cmdCount };
    return { ok: true, count: cmdCount };
  }

  // ── DB path ──────────────────────────────────────────────────────────────
  try {
    // Per-command counter
    const payload = {
      user_id:    userId,
      guild_id:   guildId,
      cmd_key:    cmdKey,
      bucket_key: bucket,
      count:      1,
      updated_at: new Date().toISOString(),
    };

    // Try upsert with increment
    const { data, error: upsertErr } = await supabase.rpc("rate_limit_increment", {
      p_user_id:    userId,
      p_guild_id:   guildId,
      p_cmd_key:    cmdKey,
      p_bucket_key: bucket,
    }).single();

    // If the stored procedure doesn't exist we fall back to a simple upsert
    if (upsertErr) {
      if (isFunctionMissing(upsertErr)) {
        // Function not defined or not in schema cache – do manual upsert (increment via raw or fallback to in-memory)
        _dbMissing = true;
        return checkAndIncrement(userId, guildId, cmdKey);
      }
      if (isMissingTable(upsertErr)) {
        _dbMissing = true;
        return checkAndIncrement(userId, guildId, cmdKey);
      }
      throw upsertErr;
    }

    const cmdCount = Number((data && data.count != null) ? data.count : 1);

    // Global counter (use "_global_" as cmd_key)
    const { data: gd, error: ge } = await supabase.rpc("rate_limit_increment", {
      p_user_id:    userId,
      p_guild_id:   guildId,
      p_cmd_key:    "_global_",
      p_bucket_key: bucket,
    }).single();
    const globalCount = Number((gd && gd.count != null) ? gd.count : 1);

    if (ge && (isFunctionMissing(ge) || isMissingTable(ge))) { _dbMissing = true; return checkAndIncrement(userId, guildId, cmdKey); }

    if (globalCount > GLOBAL_MAX_PER_MIN) return { ok: false, reason: "RATE_GLOBAL_FLOOD", retryAfterSeconds: 60, count: globalCount };
    if (cmdCount    > cmdLimit)           return { ok: false, reason: "RATE_CMD_FLOOD",    retryAfterSeconds: 60, count: cmdCount };
    return { ok: true, count: cmdCount };

  } catch (err) {
    if (isMissingTable(err)) {
      _dbMissing = true;
      return checkAndIncrement(userId, guildId, cmdKey);
    }
    // On unexpected DB error: fail open (allow) but log
    console.error("[rateLimitService] DB error (fail-open):", err?.message || err);
    return { ok: true, count: 0 };
  }
}

/**
 * Human-readable error message for a rate limit result.
 */
function rateLimitMessage(result) {
  if (result.reason === "RATE_GLOBAL_FLOOD") {
    return `⚠️ **Slow down!** You're sending commands too fast. Please wait **60 seconds** before trying again.`;
  }
  if (result.reason === "RATE_CMD_FLOOD") {
    return `⚠️ **Command limit reached.** You've used this command too many times this minute. Try again in **${result.retryAfterSeconds || 60}s**.`;
  }
  return `⚠️ **Rate limited.** Please wait a moment before trying again.`;
}

module.exports = { checkAndIncrement, rateLimitMessage, CMD_LIMITS, GLOBAL_MAX_PER_MIN };
