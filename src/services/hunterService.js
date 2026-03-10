const { supabase } = require("../lib/supabase");
const { RANKS, RANK_THRESHOLDS, normalizeRank } = require("../utils/constants");
const { xpRequired } = require("../utils/math");

function inferRank(level) {
  let current = "E-Rank";
  for (const rank of RANKS) {
    if (level >= RANK_THRESHOLDS[rank]) current = rank;
  }
  return current;
}

function normalizeHunterRecord(hunter) {
  if (!hunter) return hunter;
  return {
    ...hunter,
    inventory: Array.isArray(hunter.inventory) ? hunter.inventory : [],
    cooldowns:
      hunter.cooldowns && typeof hunter.cooldowns === "object" && !Array.isArray(hunter.cooldowns)
        ? hunter.cooldowns
        : {},
  };
}

async function getHunter(userId, guildId) {
  const { data, error } = await supabase
    .from("hunters")
    .select("*")
    .eq("user_id", userId)
    .eq("guild_id", guildId)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    const normalized = normalizeRank(data.rank);
    if (normalized !== data.rank) {
      const updated = await supabase
        .from("hunters")
        .update({ rank: normalized, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("guild_id", guildId)
        .select("*")
        .single();
      if (!updated.error) return normalizeHunterRecord(updated.data);
      data.rank = normalized;
    }
  }
  return normalizeHunterRecord(data);
}

async function createHunter({ userId, guildId }) {
  const payload = {
    user_id: userId,
    guild_id: guildId,
    level: 1,
    exp: 0,
    rank: "E-Rank",
    gold: 150,
    mana: 100,
    strength: 5,
    agility: 5,
    intelligence: 5,
    vitality: 5,
    stat_points: 0,
    shadow_slots: 1,
    inventory: [],
    cooldowns: {},
  };

  let attemptPayload = { ...payload };

  for (let i = 0; i < 6; i += 1) {
    const { data, error } = await supabase.from("hunters").insert(attemptPayload).select("*").single();
    if (!error) return normalizeHunterRecord(data);

    // Race: another request created this hunter already — return existing
    if (error.code === "23505") {
      const existing = await getHunter(userId, guildId);
      if (existing) return existing;
      throw error;
    }

    const isMissingColumn = error.code === "PGRST204" && typeof error.message === "string";
    if (!isMissingColumn) throw error;

    const match = error.message.match(/'([^']+)' column/);
    const missingColumn = match && match[1];
    if (!missingColumn || !(missingColumn in attemptPayload)) throw error;

    delete attemptPayload[missingColumn];
  }

  throw new Error("Failed to create hunter due to unresolved schema mismatch.");
}

async function ensureHunter({ userId, guildId }) {
  const existing = await getHunter(userId, guildId);
  if (existing) return existing;
  return createHunter({ userId, guildId });
}

async function addXpAndGold(userId, guildId, xpGain, goldGain) {
  const hunter = await getHunter(userId, guildId);
  if (!hunter) throw new Error("Hunter not found");

  const previousLevel = hunter.level;
  const previousRank = normalizeRank(hunter.rank);
  let level = hunter.level;
  let exp = hunter.exp + xpGain;
  let statPoints = hunter.stat_points;
  let levelsGained = 0;

  while (exp >= xpRequired(level) && levelsGained < 25) {
    exp -= xpRequired(level);
    level += 1;
    levelsGained += 1;
    statPoints += 3;
  }

  const rank = inferRank(level);
  const { data, error } = await supabase
    .from("hunters")
    .update({
      exp,
      level,
      rank,
      stat_points: statPoints,
      gold: hunter.gold + goldGain,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("guild_id", guildId)
    .select("*")
    .single();

  if (error) throw error;
  return {
    hunter: normalizeHunterRecord(data),
    levelsGained,
    previousLevel,
    newLevel: data.level,
    previousRank,
    newRank: data.rank,
    rankChanged: previousRank !== data.rank,
  };
}

async function spendGold(userId, guildId, amount) {
  const hunter = await getHunter(userId, guildId);
  if (!hunter) throw new Error("Hunter not found");
  if (hunter.gold < amount) return { ok: false, hunter };

  const { data, error } = await supabase
    .from("hunters")
    .update({ gold: hunter.gold - amount, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("guild_id", guildId)
    .select("*")
    .single();
  if (error) throw error;
  return { ok: true, hunter: normalizeHunterRecord(data) };
}

async function allocateStat(userId, guildId, statKey, amount = 1) {
  const validStats = ["strength", "agility", "intelligence", "vitality"];
  if (!validStats.includes(statKey)) throw new Error("Invalid stat");

  const hunter = await getHunter(userId, guildId);
  if (!hunter) throw new Error("Hunter not found");
  if (hunter.stat_points < amount) return { ok: false, hunter };

  const { data, error } = await supabase
    .from("hunters")
    .update({
      stat_points: hunter.stat_points - amount,
      [statKey]: hunter[statKey] + amount,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("guild_id", guildId)
    .select("*")
    .single();

  if (error) throw error;
  return { ok: true, hunter: normalizeHunterRecord(data) };
}

module.exports = {
  getHunter,
  createHunter,
  ensureHunter,
  addXpAndGold,
  allocateStat,
  spendGold,
  xpRequired,
};