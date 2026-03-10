const { supabase } = require("../lib/supabase");
const { ensureHunter } = require("./hunterService");
const { addXpAndGold } = require("./hunterService");

let dbUnavailable = false;
const memory = {
  guilds: new Map(),
  members: new Map(),
};

function nowIso() {
  return new Date().toISOString();
}

function memberKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function guildKey(guildId, clanId) {
  return `${guildId}:${clanId}`;
}

function missingTable(error) {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    (error?.code === "PGRST204" && typeof error?.message === "string")
  );
}

function makeClanId(name) {
  const base = String(name || "guild")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "guild";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

async function getClanByOwner(discordGuildId, ownerUserId) {
  if (dbUnavailable) {
    for (const clan of memory.guilds.values()) {
      if (String(clan.discord_guild_id) === String(discordGuildId) && String(clan.owner_user_id) === String(ownerUserId)) {
        return clan;
      }
    }
    return null;
  }
  const { data, error } = await supabase
    .from("guild_clans")
    .select("*")
    .eq("discord_guild_id", discordGuildId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (error) {
    if (missingTable(error)) {
      dbUnavailable = true;
      return getClanByOwner(discordGuildId, ownerUserId);
    }
    throw error;
  }
  return data || null;
}

async function getClanByMember(discordGuildId, userId) {
  if (dbUnavailable) {
    const m = memory.members.get(memberKey(discordGuildId, userId));
    if (!m) return null;
    return memory.guilds.get(guildKey(discordGuildId, m.clan_id)) || null;
  }
  const { data: member, error: e1 } = await supabase
    .from("guild_clan_members")
    .select("*")
    .eq("discord_guild_id", discordGuildId)
    .eq("user_id", userId)
    .maybeSingle();
  if (e1) {
    if (missingTable(e1)) {
      dbUnavailable = true;
      return getClanByMember(discordGuildId, userId);
    }
    throw e1;
  }
  if (!member) return null;
  const { data: clan, error: e2 } = await supabase
    .from("guild_clans")
    .select("*")
    .eq("discord_guild_id", discordGuildId)
    .eq("clan_id", member.clan_id)
    .maybeSingle();
  if (e2) throw e2;
  return clan || null;
}

async function createClan({ discordGuildId, ownerUserId, name, logoUrl = "", minLevel = 20 }) {
  const hunter = await ensureHunter({ userId: ownerUserId, guildId: discordGuildId });
  if (Number(hunter.level || 1) < Number(minLevel || 20)) {
    return { ok: false, reason: "level_too_low", requiredLevel: minLevel };
  }
  const exists = await getClanByMember(discordGuildId, ownerUserId);
  if (exists) return { ok: false, reason: "already_in_clan" };

  const clan = {
    discord_guild_id: discordGuildId,
    clan_id: makeClanId(name),
    name: String(name || "Guild").slice(0, 40),
    logo_url: String(logoUrl || "").slice(0, 500),
    description: "",
    owner_user_id: ownerUserId,
    min_level: minLevel,
    score: 0,
    wins: 0,
    losses: 0,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  const member = {
    discord_guild_id: discordGuildId,
    clan_id: clan.clan_id,
    user_id: ownerUserId,
    role: "owner",
    joined_at: nowIso(),
    updated_at: nowIso(),
  };

  memory.guilds.set(guildKey(discordGuildId, clan.clan_id), clan);
  memory.members.set(memberKey(discordGuildId, ownerUserId), member);
  if (dbUnavailable) return { ok: true, clan };

  const { error: e1 } = await supabase.from("guild_clans").insert(clan);
  if (e1) {
    if (missingTable(e1)) {
      dbUnavailable = true;
      return { ok: true, clan };
    }
    throw e1;
  }
  const { error: e2 } = await supabase.from("guild_clan_members").insert(member);
  if (e2) throw e2;
  return { ok: true, clan };
}

async function joinClan({ discordGuildId, userId, clanId }) {
  const hunter = await ensureHunter({ userId, guildId: discordGuildId });
  if (Number(hunter.level || 1) < 20) return { ok: false, reason: "level_too_low", requiredLevel: 20 };
  const existing = await getClanByMember(discordGuildId, userId);
  if (existing) return { ok: false, reason: "already_in_clan" };

  let clan = null;
  if (dbUnavailable) {
    clan = memory.guilds.get(guildKey(discordGuildId, clanId)) || null;
  } else {
    const { data, error } = await supabase
      .from("guild_clans")
      .select("*")
      .eq("discord_guild_id", discordGuildId)
      .eq("clan_id", clanId)
      .maybeSingle();
    if (error) throw error;
    clan = data || null;
  }
  if (!clan) return { ok: false, reason: "clan_missing" };

  const member = {
    discord_guild_id: discordGuildId,
    clan_id: clan.clan_id,
    user_id: userId,
    role: "member",
    joined_at: nowIso(),
    updated_at: nowIso(),
  };
  memory.members.set(memberKey(discordGuildId, userId), member);
  if (!dbUnavailable) {
    const { error } = await supabase.from("guild_clan_members").upsert(member, { onConflict: "discord_guild_id,user_id" });
    if (error) throw error;
  }
  return { ok: true, clan };
}

async function leaveClan({ discordGuildId, userId }) {
  const current = await getClanByMember(discordGuildId, userId);
  if (!current) return { ok: false, reason: "not_in_clan" };
  if (String(current.owner_user_id) === String(userId)) return { ok: false, reason: "owner_cannot_leave" };
  memory.members.delete(memberKey(discordGuildId, userId));
  if (!dbUnavailable) {
    await supabase
      .from("guild_clan_members")
      .delete()
      .eq("discord_guild_id", discordGuildId)
      .eq("user_id", userId);
  }
  return { ok: true, clan: current };
}

async function updateClanConfig({ discordGuildId, ownerUserId, patch }) {
  const clan = await getClanByOwner(discordGuildId, ownerUserId);
  if (!clan) return { ok: false, reason: "not_owner" };
  const next = { ...clan, ...patch, updated_at: nowIso() };
  memory.guilds.set(guildKey(discordGuildId, clan.clan_id), next);
  if (!dbUnavailable) {
    await supabase
      .from("guild_clans")
      .update(next)
      .eq("discord_guild_id", discordGuildId)
      .eq("clan_id", clan.clan_id);
  }
  return { ok: true, clan: next };
}

async function listClanMembers(discordGuildId, clanId) {
  if (dbUnavailable) {
    const out = [];
    for (const m of memory.members.values()) {
      if (String(m.discord_guild_id) === String(discordGuildId) && String(m.clan_id) === String(clanId)) out.push(m);
    }
    return out;
  }
  const { data, error } = await supabase
    .from("guild_clan_members")
    .select("*")
    .eq("discord_guild_id", discordGuildId)
    .eq("clan_id", clanId);
  if (error) throw error;
  return data || [];
}

async function computeClanPower(discordGuildId, clanId) {
  const members = await listClanMembers(discordGuildId, clanId);
  let power = 0;
  for (const m of members) {
    const h = await ensureHunter({ userId: m.user_id, guildId: discordGuildId });
    power +=
      Number(h.strength || 0) * 2 +
      Number(h.agility || 0) * 1.3 +
      Number(h.intelligence || 0) * 1.1 +
      Number(h.vitality || 0) * 1.4 +
      Number(h.level || 1) * 4;
  }
  return { members, power: Math.floor(power) };
}

async function guildBattle({ discordGuildId, attackerOwnerId, defenderOwnerId }) {
  const attacker = await getClanByOwner(discordGuildId, attackerOwnerId);
  const defender = await getClanByOwner(discordGuildId, defenderOwnerId);
  if (!attacker || !defender) return { ok: false, reason: "clan_missing" };
  if (String(attacker.clan_id) === String(defender.clan_id)) return { ok: false, reason: "same_clan" };

  const a = await computeClanPower(discordGuildId, attacker.clan_id);
  const d = await computeClanPower(discordGuildId, defender.clan_id);
  const aRoll = a.power + Math.floor(Math.random() * 300);
  const dRoll = d.power + Math.floor(Math.random() * 300);
  const winner = aRoll >= dRoll ? attacker : defender;
  const loser = aRoll >= dRoll ? defender : attacker;

  for (const m of (winner.clan_id === attacker.clan_id ? a.members : d.members)) {
    await addXpAndGold(m.user_id, discordGuildId, 140, 160);
  }
  for (const m of (loser.clan_id === attacker.clan_id ? a.members : d.members)) {
    await addXpAndGold(m.user_id, discordGuildId, 50, 40);
  }

  const wNext = { ...winner, wins: Number(winner.wins || 0) + 1, score: Number(winner.score || 0) + 50, updated_at: nowIso() };
  const lNext = { ...loser, losses: Number(loser.losses || 0) + 1, updated_at: nowIso() };
  memory.guilds.set(guildKey(discordGuildId, wNext.clan_id), wNext);
  memory.guilds.set(guildKey(discordGuildId, lNext.clan_id), lNext);
  if (!dbUnavailable) {
    await supabase.from("guild_clans").upsert([wNext, lNext], { onConflict: "discord_guild_id,clan_id" });
  }

  return {
    ok: true,
    attacker,
    defender,
    winner: wNext,
    loser: lNext,
    attackerPower: a.power,
    defenderPower: d.power,
  };
}

module.exports = {
  createClan,
  joinClan,
  leaveClan,
  updateClanConfig,
  getClanByMember,
  getClanByOwner,
  listClanMembers,
  guildBattle,
};

