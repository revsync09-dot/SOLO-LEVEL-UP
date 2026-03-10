/**
 * dailySpinService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Daily reward system for members.
 *
 * Every UTC day each user gets ONE free reward claim. The result is one of several
 * weighted reward tiers ranging from consolation prizes to grand chests.
 *
 * Error reasons returned:
 *   already_spun        — user already used their spin today
 *   db_unavailable      — Supabase unreachable, spin disabled
 */

const { supabase } = require("../lib/supabase");
const { randomInt } = require("../utils/math");

let _dbMissing = false;

function isMissingTable(err) {
  return (
    err?.code === "42P01" ||
    err?.code === "PGRST205" ||
    (err?.code === "PGRST204" && typeof err?.message === "string")
  );
}

// ── UTC date key ──────────────────────────────────────────────────────────────
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ── Spin Slots ────────────────────────────────────────────────────────────────
// Each entry: { label, emoji, weight (relative), xp, gold, item|null }
// Higher weight = more common.
const SPIN_SLOTS = [
  // ── Common ──────────────────────────────────────────────────
  { label: "Mana Shard",       emoji: "💧", weight: 25, xp:  20, gold:  30, item: null },
  { label: "Hunter Coin",      emoji: "🪙", weight: 22, xp:  10, gold:  60, item: null },
  { label: "Shadow Dust",      emoji: "🌫️", weight: 20, xp:  35, gold:  25, item: null },
  // ── Uncommon ─────────────────────────────────────────────────
  { label: "Potion Bonus",     emoji: "⚗️", weight: 12, xp:  50, gold:  80, item: "item:mana_potion" },
  { label: "XP Burst",         emoji: "✨", weight: 10, xp: 120, gold:  50, item: null },
  { label: "Gold Chest",       emoji: "💰", weight:  5, xp:  40, gold: 200, item: null },
  // ── Rare ─────────────────────────────────────────────────────
  { label: "Gate Crystal",     emoji: "💎", weight:  3, xp:  80, gold: 120, item: "material:gate_crystal" },
  { label: "Shadow Essence",   emoji: "🌑", weight:  2, xp:  60, gold:  90, item: "material:shadow_essence" },
  // ── Legendary Reward ───────────────────────────────────────────
  { label: "MONARCH'S CHEST", emoji: "👑", weight: 1, xp: 400, gold: 800, item: null },
];

const TOTAL_WEIGHT = SPIN_SLOTS.reduce((s, slot) => s + slot.weight, 0);

function rollSpin() {
  let rand = randomInt(1, TOTAL_WEIGHT);
  for (const slot of SPIN_SLOTS) {
    rand -= slot.weight;
    if (rand <= 0) return slot;
  }
  return SPIN_SLOTS[0]; // fallback
}

// rarity label based on weight
function spinRarity(slot) {
  if (slot.weight >= 20) return "Common";
  if (slot.weight >= 10) return "Uncommon";
  if (slot.weight >= 3)  return "Rare";
  if (slot.weight >= 2)  return "Epic";
  return "Legendary";
}

// ── Memory fallback (in case DB table missing) ────────────────────────────────
const _memSpun = new Set(); // "userId:guildId:dateKey"

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check if the user has already spun today (without consuming).
 * @returns {{ spun: boolean, dateKey: string }}
 */
async function getSpinStatus(userId, guildId) {
  const dateKey = todayKey();
  const memK = `${userId}:${guildId}:${dateKey}`;
  if (_memSpun.has(memK)) return { spun: true, dateKey };

  if (_dbMissing) return { spun: false, dateKey };

  try {
    const { data, error } = await supabase
      .from("daily_spin")
      .select("spun")
      .eq("user_id", userId)
      .eq("guild_id", guildId)
      .eq("date_key", dateKey)
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) { _dbMissing = true; return { spun: false, dateKey }; }
      throw error;
    }
    return { spun: !!(data?.spun), dateKey };
  } catch (err) {
    console.error("[dailySpinService] getSpinStatus error:", err?.message);
    return { spun: false, dateKey };
  }
}

/**
 * Execute a daily spin for the user.
 * Returns the slot result + any item granted.
 *
 * @returns {{ ok: boolean, reason?: string, slot?: object, rarity?: string }}
 */
async function performSpin(userId, guildId) {
  const dateKey = todayKey();
  const memK = `${userId}:${guildId}:${dateKey}`;

  // Already spun?
  const status = await getSpinStatus(userId, guildId);
  if (status.spun) return { ok: false, reason: "already_spun" };

  // Roll
  const slot = rollSpin();
  const rarity = spinRarity(slot);
  const rewardJson = JSON.stringify({ label: slot.label, xp: slot.xp, gold: slot.gold, item: slot.item });

  // Mark as spun
  _memSpun.add(memK);

  if (!_dbMissing) {
    try {
      const { error } = await supabase.from("daily_spin").upsert({
        user_id:     userId,
        guild_id:    guildId,
        date_key:    dateKey,
        spun:        true,
        result:      rewardJson,
        reward_xp:   slot.xp,
        reward_gold: slot.gold,
        updated_at:  new Date().toISOString(),
      }, { onConflict: "user_id,guild_id,date_key" });
      if (error && isMissingTable(error)) { _dbMissing = true; }
      else if (error) throw error;
    } catch (err) {
      console.error("[dailySpinService] performSpin DB error:", err?.message);
    }
  }

  return {
    ok: true,
    slot,
    rarity,
    xp:   slot.xp,
    gold: slot.gold,
    item: slot.item,
  };
}

module.exports = { performSpin, getSpinStatus, SPIN_SLOTS, rollSpin, spinRarity };
