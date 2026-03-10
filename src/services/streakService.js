/**
 * streakService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Daily login streak tracking for hunters.
 *
 * Members get increasing bonus rewards for each consecutive day they play.
 * Streak breaks if they miss a calendar day (UTC).
 *
 * Error reasons:
 *   already_claimed    — already claimed streak today
 *   db_unavailable     — DB not reachable (in-memory fallback)
 */

const { supabase } = require("../lib/supabase");

let _dbMissing = false;
const _memStreaks = /** @type {Map<string, object>} */ (new Map());

function isMissingTable(err) {
  return (
    err?.code === "42P01" ||
    err?.code === "PGRST205" ||
    (err?.code === "PGRST204" && typeof err?.message === "string")
  );
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ── Streak day rewards ────────────────────────────────────────────────────────
// Each entry defines rewards for a streak milestone OR a range.
// Matching: find the last entry whose minDay <= currentStreak.
const STREAK_REWARDS = [
  { minDay:  1, xp:  30, gold:  40, bonus: "",                   emoji: "🔥" },
  { minDay:  3, xp:  60, gold:  80, bonus: "",                   emoji: "🔥🔥" },
  { minDay:  7, xp: 120, gold: 150, bonus: "item:mana_potion",   emoji: "🔥🔥🔥" },
  { minDay: 14, xp: 200, gold: 250, bonus: "material:gate_crystal", emoji: "⚡" },
  { minDay: 21, xp: 300, gold: 400, bonus: "material:shadow_essence", emoji: "💠" },
  { minDay: 30, xp: 500, gold: 600, bonus: "item:stat_reset_token",   emoji: "👑" },
];

function getStreakReward(streak) {
  let tier = STREAK_REWARDS[0];
  for (const r of STREAK_REWARDS) {
    if (streak >= r.minDay) tier = r;
  }
  return tier;
}

// ── DB helpers ────────────────────────────────────────────────────────────────
function memKey(userId, guildId) { return `${userId}:${guildId}`; }

async function fetchStreak(userId, guildId) {
  const k = memKey(userId, guildId);
  if (_dbMissing) return _memStreaks.get(k) || null;
  const { data, error } = await supabase
    .from("hunter_streaks")
    .select("*")
    .eq("user_id", userId)
    .eq("guild_id", guildId)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) { _dbMissing = true; return _memStreaks.get(k) || null; }
    throw error;
  }
  if (data) _memStreaks.set(k, data);
  return data || null;
}

async function saveStreak(row) {
  const k = memKey(row.user_id, row.guild_id);
  _memStreaks.set(k, row);
  if (_dbMissing) return row;
  const { error } = await supabase
    .from("hunter_streaks")
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "user_id,guild_id" });
  if (error) {
    if (isMissingTable(error)) { _dbMissing = true; return row; }
    throw error;
  }
  return row;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get current streak info for a user.
 * Returns { currentStreak, longestStreak, lastClaimKey, claimedToday, nextReward }
 */
async function getStreakStatus(userId, guildId) {
  const today = todayKey();
  const row = await fetchStreak(userId, guildId);
  const currentStreak = Number(row?.current_streak || 0);
  const longestStreak = Number(row?.longest_streak || 0);
  const lastClaimKey  = row?.last_claim_key || null;
  const claimedToday  = lastClaimKey === today;
  const nextReward    = getStreakReward(currentStreak + (claimedToday ? 0 : 1));
  return { currentStreak, longestStreak, lastClaimKey, claimedToday, nextReward };
}

/**
 * Claim the daily streak for today.
 * Returns { ok, reason?, newStreak, reward, broken }
 */
async function claimStreak(userId, guildId) {
  const today     = todayKey();
  const yesterday = yesterdayKey();
  const row = await fetchStreak(userId, guildId);
  const lastKey    = row?.last_claim_key || null;

  // Already claimed today?
  if (lastKey === today) return { ok: false, reason: "already_claimed" };

  // Compute new streak
  const prev    = Number(row?.current_streak || 0);
  const longest = Number(row?.longest_streak || 0);
  const broken  = lastKey !== null && lastKey !== yesterday;
  const newStreak = broken ? 1 : prev + 1;

  const reward = getStreakReward(newStreak);

  const updated = {
    user_id:        userId,
    guild_id:       guildId,
    current_streak: newStreak,
    longest_streak: Math.max(longest, newStreak),
    last_claim_key: today,
    updated_at:     new Date().toISOString(),
  };
  await saveStreak(updated);

  return {
    ok: true,
    newStreak,
    broken,
    reward,
    xp:    reward.xp,
    gold:  reward.gold,
    bonus: reward.bonus,
    emoji: reward.emoji,
  };
}

module.exports = { getStreakStatus, claimStreak, getStreakReward, STREAK_REWARDS };
