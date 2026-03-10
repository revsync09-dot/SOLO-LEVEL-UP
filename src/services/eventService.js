const { supabase } = require("../lib/supabase");

const FACTIONS = ["Shadow Legion", "Radiant Order", "Abyss Walkers"];
const PG_INT_MAX = 2147483647;
const memory = {
  stats: new Map(),
  daily: new Map(),
  weekly: new Map(),
  factions: new Map(),
};
let dbUnavailable = false;

function isoNow() {
  return new Date().toISOString();
}

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

function dateKeyUtc(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function weekKeyUtc(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function isMissingTable(error) {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    (error?.code === "PGRST204" && typeof error?.message === "string")
  );
}

function defaultStats(guildId, userId) {
  return {
    guild_id: guildId,
    user_id: userId,
    combat_power: 0,
    top_gold: 0,
    dungeon_clears: 0,
    damage_dealt: 0,
    highest_damage: 0,
    heals_done: 0,
    extreme_gate_clears: 0,
    weekly_score: 0,
    prestige: 0,
    updated_at: isoNow(),
  };
}

async function getStats(guildId, userId) {
  const k = key(guildId, userId);
  if (dbUnavailable) return memory.stats.get(k) || defaultStats(guildId, userId);
  const { data, error } = await supabase
    .from("event_user_stats")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) {
      dbUnavailable = true;
      return memory.stats.get(k) || defaultStats(guildId, userId);
    }
    throw error;
  }
  const row = data || defaultStats(guildId, userId);
  memory.stats.set(k, row);
  return row;
}

async function patchStats(guildId, userId, patch) {
  const k = key(guildId, userId);
  const prev = await getStats(guildId, userId);
  const next = { ...prev, ...patch, updated_at: isoNow() };
  memory.stats.set(k, next);
  if (dbUnavailable) return next;
  const { data, error } = await supabase
    .from("event_user_stats")
    .upsert(next, { onConflict: "guild_id,user_id" })
    .select("*")
    .single();
  if (error) {
    if (isMissingTable(error)) {
      dbUnavailable = true;
      return next;
    }
    throw error;
  }
  memory.stats.set(k, data);
  return data;
}

async function addToStats(guildId, userId, delta) {
  const prev = await getStats(guildId, userId);
  const cap = (v) => Math.max(0, Math.min(PG_INT_MAX, Number(v || 0)));
  const next = {
    ...prev,
    combat_power: cap(Number(prev.combat_power || 0) + Number(delta.combat_power || 0)),
    top_gold: cap(Math.max(Number(prev.top_gold || 0), Number(delta.top_gold || prev.top_gold || 0))),
    dungeon_clears: cap(Number(prev.dungeon_clears || 0) + Number(delta.dungeon_clears || 0)),
    damage_dealt: cap(Number(prev.damage_dealt || 0) + Number(delta.damage_dealt || 0)),
    highest_damage: cap(Math.max(Number(prev.highest_damage || 0), Number(delta.highest_damage || 0))),
    heals_done: cap(Number(prev.heals_done || 0) + Number(delta.heals_done || 0)),
    extreme_gate_clears: cap(Number(prev.extreme_gate_clears || 0) + Number(delta.extreme_gate_clears || 0)),
    weekly_score: cap(Number(prev.weekly_score || 0) + Number(delta.weekly_score || 0)),
    prestige: cap(Number(prev.prestige || 0) + Number(delta.prestige || 0)),
  };
  return patchStats(guildId, userId, next);
}

async function getFaction(guildId, userId) {
  const k = key(guildId, userId);
  if (dbUnavailable) return memory.factions.get(k) || null;
  const { data, error } = await supabase
    .from("event_factions")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) {
      dbUnavailable = true;
      return memory.factions.get(k) || null;
    }
    throw error;
  }
  if (data) memory.factions.set(k, data);
  return data || null;
}

async function setFaction(guildId, userId, faction) {
  if (!FACTIONS.includes(faction)) {
    return { ok: false, reason: "invalid_faction" };
  }
  const row = {
    guild_id: guildId,
    user_id: userId,
    faction,
    weekly_score: 0,
    updated_at: isoNow(),
  };
  memory.factions.set(key(guildId, userId), row);
  if (dbUnavailable) return { ok: true, row };
  const { data, error } = await supabase
    .from("event_factions")
    .upsert(row, { onConflict: "guild_id,user_id" })
    .select("*")
    .single();
  if (error) {
    if (isMissingTable(error)) {
      dbUnavailable = true;
      return { ok: true, row };
    }
    throw error;
  }
  memory.factions.set(key(guildId, userId), data);
  return { ok: true, row: data };
}

async function addFactionScore(guildId, userId, points) {
  const amount = Number(points || 0);
  if (!amount) return;
  const existing = await getFaction(guildId, userId);
  if (!existing) return;
  const next = { ...existing, weekly_score: Number(existing.weekly_score || 0) + amount, updated_at: isoNow() };
  memory.factions.set(key(guildId, userId), next);
  if (dbUnavailable) return;
  await supabase
    .from("event_factions")
    .upsert(next, { onConflict: "guild_id,user_id" });
}

async function listFactionStandings(guildId) {
  if (dbUnavailable) {
    const totals = new Map(FACTIONS.map((f) => [f, 0]));
    for (const row of memory.factions.values()) {
      if (String(row.guild_id) !== String(guildId)) continue;
      totals.set(row.faction, Number(totals.get(row.faction) || 0) + Number(row.weekly_score || 0));
    }
    return Array.from(totals.entries()).map(([faction, score]) => ({ faction, score })).sort((a, b) => b.score - a.score);
  }
  const { data, error } = await supabase
    .from("event_factions")
    .select("faction,weekly_score")
    .eq("guild_id", guildId);
  if (error) {
    if (isMissingTable(error)) {
      dbUnavailable = true;
      return listFactionStandings(guildId);
    }
    throw error;
  }
  const totals = new Map(FACTIONS.map((f) => [f, 0]));
  for (const row of data || []) {
    totals.set(row.faction, Number(totals.get(row.faction) || 0) + Number(row.weekly_score || 0));
  }
  return Array.from(totals.entries()).map(([faction, score]) => ({ faction, score })).sort((a, b) => b.score - a.score);
}

async function getFactionXpBoost(guildId, userId) {
  const mine = await getFaction(guildId, userId);
  if (!mine) return { multiplier: 1, leader: null, faction: null };
  const standings = await listFactionStandings(guildId);
  const leader = standings[0] || null;
  if (!leader || !leader.faction) return { multiplier: 1, leader: null, faction: mine.faction };
  const winner = String(leader.faction) === String(mine.faction);
  return { multiplier: winner ? 1.1 : 1, leader: leader.faction, faction: mine.faction };
}

async function getDaily(guildId, userId) {
  const dKey = dateKeyUtc();
  const k = `${guildId}:${userId}:${dKey}`;
  const base = {
    guild_id: guildId,
    user_id: userId,
    date_key: dKey,
    hunts: 0,
    dungeons: 0,
    gold_spent: 0,
    claimed: false,
    updated_at: isoNow(),
  };
  if (dbUnavailable) return memory.daily.get(k) || base;
  const { data, error } = await supabase
    .from("event_daily_quests")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .eq("date_key", dKey)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) {
      dbUnavailable = true;
      return memory.daily.get(k) || base;
    }
    throw error;
  }
  const row = data || base;
  memory.daily.set(k, row);
  return row;
}

async function patchDaily(guildId, userId, patch) {
  const prev = await getDaily(guildId, userId);
  const next = { ...prev, ...patch, updated_at: isoNow() };
  const k = `${guildId}:${userId}:${next.date_key}`;
  memory.daily.set(k, next);
  if (dbUnavailable) return next;
  await supabase.from("event_daily_quests").upsert(next, { onConflict: "guild_id,user_id,date_key" });
  return next;
}

async function getWeekly(guildId, userId) {
  const wKey = weekKeyUtc();
  const k = `${guildId}:${userId}:${wKey}`;
  const base = {
    guild_id: guildId,
    user_id: userId,
    week_key: wKey,
    damage: 0,
    heals: 0,
    extreme_gate: 0,
    claimed: false,
    updated_at: isoNow(),
  };
  if (dbUnavailable) return memory.weekly.get(k) || base;
  const { data, error } = await supabase
    .from("event_weekly_quests")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .eq("week_key", wKey)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) {
      dbUnavailable = true;
      return memory.weekly.get(k) || base;
    }
    throw error;
  }
  const row = data || base;
  memory.weekly.set(k, row);
  return row;
}

async function patchWeekly(guildId, userId, patch) {
  const prev = await getWeekly(guildId, userId);
  const next = { ...prev, ...patch, updated_at: isoNow() };
  const k = `${guildId}:${userId}:${next.week_key}`;
  memory.weekly.set(k, next);
  if (dbUnavailable) return next;
  await supabase.from("event_weekly_quests").upsert(next, { onConflict: "guild_id,user_id,week_key" });
  return next;
}

function dailyComplete(d) {
  return Number(d.hunts || 0) >= 3 && Number(d.dungeons || 0) >= 1 && Number(d.gold_spent || 0) >= 100;
}

function weeklyComplete(w) {
  return Number(w.damage || 0) >= 10000 && Number(w.heals || 0) >= 5 && Number(w.extreme_gate || 0) >= 1;
}

async function recordHunt(guildId, userId) {
  const d = await getDaily(guildId, userId);
  await patchDaily(guildId, userId, { hunts: Number(d.hunts || 0) + 1 });
  await addFactionScore(guildId, userId, 5);
}

async function recordDungeonClear(guildId, userId) {
  const d = await getDaily(guildId, userId);
  await patchDaily(guildId, userId, { dungeons: Number(d.dungeons || 0) + 1 });
  await addToStats(guildId, userId, { dungeon_clears: 1, weekly_score: 20 });
  await addFactionScore(guildId, userId, 20);
}

async function recordGoldSpent(guildId, userId, amount) {
  const d = await getDaily(guildId, userId);
  await patchDaily(guildId, userId, { gold_spent: Number(d.gold_spent || 0) + Math.max(0, Number(amount || 0)) });
}

async function recordDamage(guildId, userId, damage) {
  const dmg = Math.max(0, Number(damage || 0));
  if (!dmg) return;
  const w = await getWeekly(guildId, userId);
  await patchWeekly(guildId, userId, { damage: Number(w.damage || 0) + dmg });
  await addToStats(guildId, userId, {
    damage_dealt: dmg,
    highest_damage: dmg,
    weekly_score: Math.floor(dmg / 100),
  });
  await addFactionScore(guildId, userId, Math.floor(dmg / 100));
}

async function recordHeal(guildId, userId, heals = 1) {
  const count = Math.max(0, Number(heals || 0));
  if (!count) return;
  const w = await getWeekly(guildId, userId);
  await patchWeekly(guildId, userId, { heals: Number(w.heals || 0) + count });
  await addToStats(guildId, userId, { heals_done: count, weekly_score: count * 4 });
  await addFactionScore(guildId, userId, count * 4);
}

async function recordExtremeGateClear(guildId, userId) {
  const w = await getWeekly(guildId, userId);
  await patchWeekly(guildId, userId, { extreme_gate: Number(w.extreme_gate || 0) + 1 });
  await addToStats(guildId, userId, { extreme_gate_clears: 1, weekly_score: 30 });
  await addFactionScore(guildId, userId, 30);
}

async function claimDailyRewards(guildId, userId) {
  const d = await getDaily(guildId, userId);
  if (d.claimed) return { ok: false, reason: "already_claimed", daily: d };
  if (!dailyComplete(d)) return { ok: false, reason: "not_complete", daily: d };
  const updated = await patchDaily(guildId, userId, { claimed: true });
  return {
    ok: true,
    rewards: {
      xp: 220,
      gold: 180,
      buffToken: `buff:xp_boost_until:${Date.now() + 24 * 60 * 60 * 1000}`,
    },
    daily: updated,
  };
}

async function claimWeeklyRewards(guildId, userId) {
  const w = await getWeekly(guildId, userId);
  if (w.claimed) return { ok: false, reason: "already_claimed", weekly: w };
  if (!weeklyComplete(w)) return { ok: false, reason: "not_complete", weekly: w };
  const updated = await patchWeekly(guildId, userId, { claimed: true });
  return {
    ok: true,
    rewards: {
      xp: 1200,
      gold: 1200,
      buffToken: `buff:xp_boost_until:${Date.now() + 7 * 24 * 60 * 60 * 1000}`,
    },
    weekly: updated,
  };
}

async function getLeaderboards(guildId) {
  const empty = { combatPower: [], topGold: [], dungeonClears: [], highestDamage: [] };
  if (dbUnavailable) {
    const rows = [];
    for (const row of memory.stats.values()) {
      if (String(row.guild_id) === String(guildId)) rows.push(row);
    }
    const sortTop = (field) => [...rows].sort((a, b) => Number(b[field] || 0) - Number(a[field] || 0)).slice(0, 10);
    return {
      combatPower: sortTop("combat_power"),
      topGold: sortTop("top_gold"),
      dungeonClears: sortTop("dungeon_clears"),
      highestDamage: sortTop("highest_damage"),
    };
  }
  const { data, error } = await supabase
    .from("event_user_stats")
    .select("*")
    .eq("guild_id", guildId)
    .limit(500);
  if (error) {
    if (isMissingTable(error)) {
      dbUnavailable = true;
      return getLeaderboards(guildId);
    }
    throw error;
  }
  const rows = data || [];
  const sortTop = (field) => [...rows].sort((a, b) => Number(b[field] || 0) - Number(a[field] || 0)).slice(0, 10);
  return {
    combatPower: sortTop("combat_power"),
    topGold: sortTop("top_gold"),
    dungeonClears: sortTop("dungeon_clears"),
    highestDamage: sortTop("highest_damage"),
  };
}

async function getQuestStatus(guildId, userId) {
  const [daily, weekly] = await Promise.all([getDaily(guildId, userId), getWeekly(guildId, userId)]);
  return {
    daily,
    weekly,
    dailyDone: dailyComplete(daily),
    weeklyDone: weeklyComplete(weekly),
  };
}

async function addPrestige(guildId, userId) {
  await addToStats(guildId, userId, { prestige: 1 });
}

module.exports = {
  FACTIONS,
  getFaction,
  setFaction,
  listFactionStandings,
  getLeaderboards,
  getStats,
  getQuestStatus,
  getFactionXpBoost,
  claimDailyRewards,
  claimWeeklyRewards,
  recordHunt,
  recordDungeonClear,
  recordGoldSpent,
  recordDamage,
  recordHeal,
  recordExtremeGateClear,
  patchStats,
  addPrestige,
};
