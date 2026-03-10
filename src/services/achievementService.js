/**
 * achievementService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hunter achievement / badge system.
 *
 * Achievements are checked automatically after actions (hunt, dungeon, pvp…).
 * Newly unlocked ones are returned so the bot can announce them in Discord.
 *
 * Design:
 *   Each achievement has a key, title, emoji, description and an optional
 *   one-time reward (xp + gold) that is granted when first unlocked.
 *
 * Error reasons:
 *   already_unlocked   — hunter already has this achievement
 *   db_unavailable     — fallback to in-memory set
 */

const { supabase } = require("../lib/supabase");

let _dbMissing = false;
// In-memory fallback: Map<"userId:guildId", Set<key>>
const _mem = /** @type {Map<string,Set<string>>} */ (new Map());

function isMissingTable(err) {
  return (
    err?.code === "42P01" ||
    err?.code === "PGRST205" ||
    (err?.code === "PGRST204" && typeof err?.message === "string")
  );
}

// ── Achievement Definitions ───────────────────────────────────────────────────
const ACHIEVEMENTS = [
  // ── Hunting ──────────────────────────────────────────────────────────
  { key: "first_hunt",      emoji: "🗡️",  title: "First Blood",         desc: "Complete your first hunt.",                   xp:  20, gold:  30 },
  { key: "hunt_10",         emoji: "🏹",  title: "Relentless Hunter",    desc: "Complete 10 hunts.",                          xp:  50, gold:  60 },
  { key: "hunt_50",         emoji: "⚔️",  title: "Veteran Hunter",       desc: "Complete 50 hunts.",                          xp: 120, gold: 120 },
  { key: "hunt_100",        emoji: "🌟",  title: "Elite Hunter",         desc: "Complete 100 hunts.",                         xp: 300, gold: 300 },

  // ── Dungeon ───────────────────────────────────────────────────────────
  { key: "first_raid",      emoji: "🏰",  title: "Into the Dungeon",     desc: "Survive your first raid.",                    xp:  40, gold:  50 },
  { key: "dungeon_10",      emoji: "🔥",  title: "Dungeon Crawler",      desc: "Clear 10 dungeons.",                          xp:  80, gold:  80 },
  { key: "dungeon_boss_kill",emoji: "💀", title: "Boss Slayer",          desc: "Deal the killing blow in a raid.",            xp: 150, gold: 200 },

  // ── Gate ──────────────────────────────────────────────────────────────
  { key: "first_gate",      emoji: "🌀",  title: "Gate Breaker",         desc: "Win your first Extreme Gate.",                xp:  60, gold:  80 },
  { key: "gate_5",          emoji: "💠",  title: "Gate Champion",        desc: "Win 5 Extreme Gates.",                        xp: 150, gold: 200 },

  // ── PvP ───────────────────────────────────────────────────────────────
  { key: "first_pvp",       emoji: "🥊",  title: "First Fight",          desc: "Participate in your first PvP battle.",       xp:  30, gold:  40 },
  { key: "pvp_win",         emoji: "🏆",  title: "Gladiator",            desc: "Win a PvP battle.",                           xp:  60, gold:  80 },
  { key: "pvp_10_wins",     emoji: "👊",  title: "Combat Machine",       desc: "Win 10 PvP battles.",                         xp: 200, gold: 250 },

  // ── Rank ──────────────────────────────────────────────────────────────
  { key: "rank_s",          emoji: "🔴",  title: "S-Rank Hunter",        desc: "Achieve S-Rank.",                             xp: 300, gold: 500 },
  { key: "rank_national",   emoji: "🟠",  title: "National Level",       desc: "Reach National Level rank.",                  xp: 500, gold: 800 },
  { key: "rank_shadow_monarch",emoji:"👑",title: "Shadow Monarch",       desc: "Achieve Shadow Monarch rank.",                xp:1000, gold:2000 },

  // ── Wealth ────────────────────────────────────────────────────────────
  { key: "gold_1000",       emoji: "💰",  title: "Coin Collector",       desc: "Accumulate 1,000 Gold.",                      xp:  40, gold:   0 },
  { key: "gold_10000",      emoji: "💎",  title: "Wealthy Hunter",       desc: "Accumulate 10,000 Gold.",                     xp: 100, gold:   0 },


  // ── Streak ────────────────────────────────────────────────────────────
  { key: "streak_3",        emoji: "🔥",  title: "On Fire",              desc: "Maintain a 3-day login streak.",              xp:  30, gold:  50 },
  { key: "streak_7",        emoji: "🔥🔥", title: "Week Warrior",        desc: "Maintain a 7-day login streak.",              xp:  80, gold: 120 },
  { key: "streak_30",       emoji: "⭐",  title: "Dedicated Hunter",     desc: "Maintain a 30-day login streak.",             xp: 400, gold: 500 },

  // ── Prestige ──────────────────────────────────────────────────────────
  { key: "prestige_1",      emoji: "💫",  title: "Reborn",               desc: "Prestige for the first time.",                xp: 500, gold: 500 },

  // ── Daily Reward ───────────────────────────────────────────────────────
  { key: "first_daily_reward", emoji: "🎁", title: "Early Bird",         desc: "Claim your first daily reward.",              xp:  10, gold:  20 },
  { key: "legendary_reward", emoji: "🎊", title: "Monarch's Favor",      desc: "Claim a Legendary reward from the daily system.", xp: 300, gold: 600 },

  // ── Guild ─────────────────────────────────────────────────────────────
  { key: "guild_join",      emoji: "🤝",  title: "Guild Member",         desc: "Join a Hunter Guild.",                        xp:  20, gold:  30 },
  { key: "guild_win",       emoji: "⚔️",  title: "Guild Warrior",        desc: "Win a Guild Battle.",                         xp: 100, gold: 150 },
];

// Quick lookup map
const ACH_MAP = new Map(ACHIEVEMENTS.map((a) => [a.key, a]));

// ── Memory helpers ────────────────────────────────────────────────────────────
function memKey(userId, guildId) { return `${userId}:${guildId}`; }

function getMemSet(userId, guildId) {
  const k = memKey(userId, guildId);
  if (!_mem.has(k)) _mem.set(k, new Set());
  return _mem.get(k);
}

// ── DB helpers ────────────────────────────────────────────────────────────────
async function fetchUnlocked(userId, guildId) {
  if (_dbMissing) return new Set(getMemSet(userId, guildId));
  const { data, error } = await supabase
    .from("hunter_achievements")
    .select("achievement_key")
    .eq("user_id", userId)
    .eq("guild_id", guildId);
  if (error) {
    if (isMissingTable(error)) { _dbMissing = true; return getMemSet(userId, guildId); }
    throw error;
  }
  const keys = new Set((data || []).map((r) => r.achievement_key));
  _mem.set(memKey(userId, guildId), keys);
  return keys;
}

async function writeUnlock(userId, guildId, key) {
  getMemSet(userId, guildId).add(key);
  if (_dbMissing) return;
  const { error } = await supabase.from("hunter_achievements").insert({
    user_id:         userId,
    guild_id:        guildId,
    achievement_key: key,
    unlocked_at:     new Date().toISOString(),
  });
  if (error) {
    if (error.code === "23505") return; // duplicate — already exists, fine
    if (isMissingTable(error)) { _dbMissing = true; return; }
    throw error;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get all achievements for a user with unlock status.
 * @returns {{ achievement: object, unlocked: boolean, unlockedAt?: string }[]}
 */
async function getUserAchievements(userId, guildId) {
  const unlocked = await fetchUnlocked(userId, guildId);
  return ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: unlocked.has(a.key),
  }));
}

/**
 * Unlock a single achievement. Returns the achievement or null if already unlocked.
 * @returns {{ achievement: object, isNew: boolean }}
 */
async function unlockAchievement(userId, guildId, key) {
  const def = ACH_MAP.get(key);
  if (!def) return { achievement: null, isNew: false };
  const unlocked = await fetchUnlocked(userId, guildId);
  if (unlocked.has(key)) return { achievement: def, isNew: false };
  await writeUnlock(userId, guildId, key);
  return { achievement: def, isNew: true };
}

/**
 * Check multiple keys at once.
 * Returns a list of newly unlocked achievements.
 * @param {string[]} keys
 * @returns {Promise<object[]>}
 */
async function checkUnlocks(userId, guildId, keys) {
  const unlocked = await fetchUnlocked(userId, guildId);
  const newOnes = [];
  for (const key of keys) {
    if (!unlocked.has(key) && ACH_MAP.has(key)) {
      await writeUnlock(userId, guildId, key);
      newOnes.push(ACH_MAP.get(key));
    }
  }
  return newOnes;
}

/**
 * Build achievement keys to check based on current hunter state.
 * Call this after major actions (hunt, dungeon, gate, pvp, rankup…).
 */
function buildCheckKeys(hunter, context = {}) {
  const keys = [];
  const { gold = 0, rank = "E-Rank", level = 1, prestige = 0 } = hunter;

  // Rank achievements
  if (["S-Rank","National Level","Monarch Level","Ruler Level","Shadow Monarch"].includes(rank)) keys.push("rank_s");
  if (["National Level","Monarch Level","Ruler Level","Shadow Monarch"].includes(rank)) keys.push("rank_national");
  if (rank === "Shadow Monarch") keys.push("rank_shadow_monarch");

  // Wealth
  if (Number(gold || 0) >= 1000)  keys.push("gold_1000");
  if (Number(gold || 0) >= 10000) keys.push("gold_10000");

  // Context-based
  if (context.firstHunt)      keys.push("first_hunt");
  if (context.huntCount >= 10) keys.push("hunt_10");
  if (context.huntCount >= 50) keys.push("hunt_50");
  if (context.huntCount >= 100) keys.push("hunt_100");

  if (context.firstRaid)      keys.push("first_raid");
  if (context.dungeonClears >= 10) keys.push("dungeon_10");
  if (context.bossDealKill)   keys.push("dungeon_boss_kill");

  if (context.firstGate)      keys.push("first_gate");
  if (context.gateWins >= 5)  keys.push("gate_5");

  if (context.firstPvp)       keys.push("first_pvp");
  if (context.pvpWin)         keys.push("pvp_win");
  if (context.pvpWins >= 10)  keys.push("pvp_10_wins");

  if (context.streak >= 3)    keys.push("streak_3");
  if (context.streak >= 7)    keys.push("streak_7");
  if (context.streak >= 30)   keys.push("streak_30");

  if (context.prestige >= 1)  keys.push("prestige_1");
  if (context.firstSpin)      keys.push("first_spin");
  if (context.spinJackpot)    keys.push("spin_jackpot");
  if (context.guildJoin)      keys.push("guild_join");
  if (context.guildWin)       keys.push("guild_win");

  return [...new Set(keys)];
}

module.exports = {
  ACHIEVEMENTS,
  getUserAchievements,
  unlockAchievement,
  checkUnlocks,
  buildCheckKeys,
};
