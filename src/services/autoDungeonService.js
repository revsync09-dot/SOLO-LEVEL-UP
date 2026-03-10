const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
} = require("discord.js");
const { supabase } = require("../lib/supabase");
const { DUNGEON_DIFFICULTIES } = require("../utils/constants");
const {
  createLobby,
  summary,
  startRaid,
  getSession,
  removeSession,
  handleRoundTimeout,
} = require("./raidDungeonService");
const { buildBattlePayload, buildDefeatedPayload, buildRewardsPayload } = require("../utils/raidV2Renderer");

const memoryConfig = new Map();
const spawnJoinState = new Map();
let dbUnavailable = false;
let loopHandle = null;
let inTick = false;
const SPAWN_JOIN_COOLDOWN_MS = 20_000;
const SPAWN_JOIN_TTL_MS = 3 * 60 * 60 * 1000;
const AUTO_DUNGEON_BANNER_URL =
  "https://media.discordapp.net/attachments/1477018034169188362/1477023604771127327/a12065b307fca0a2b2018efc702d7a3b.gif?ex=69a340ed&is=69a1ef6d&hm=40e559eeef308b2082adcb3152e8bde539bbd56d79637b67416a70c730f547c5&=";
const DUNGEON_PING_ROLE_ID = process.env.DUNGEON_PING_ROLE_ID || "1477381208773230604";
const AUTO_LOBBY_START_MS = 30_000;
const AUTO_ROUND_TIMEOUT_MS = 30_000;
const lobbyAutoStartHandles = new Map();
const autoRoundTimeoutHandles = new Map();

const DUNGEON_TEMPLATES = [
  "Double Gate Ruins",
  "Demon Castle Depths",
  "Jeju Breach Tunnel",
  "High Orc Fortress",
  "Shadow Crypt",
  "Ice Elf Canyon",
  "Architect Trial Hall",
  "Monarch Echo Gate",
];

function nowIso() {
  return new Date().toISOString();
}

function pruneSpawnJoinState() {
  const now = Date.now();
  for (const [key, state] of spawnJoinState.entries()) {
    const last = Number(state.lastAttemptAt || 0);
    if (now - last > SPAWN_JOIN_TTL_MS) {
      spawnJoinState.delete(key);
    }
  }
}

function clearLobbyAutoStart(sessionId) {
  const key = String(sessionId || "");
  const handle = lobbyAutoStartHandles.get(key);
  if (handle) clearTimeout(handle);
  lobbyAutoStartHandles.delete(key);
}

function clearAutoRoundTimeout(sessionId) {
  const key = String(sessionId || "");
  const handle = autoRoundTimeoutHandles.get(key);
  if (handle) clearTimeout(handle);
  autoRoundTimeoutHandles.delete(key);
}

function clearAllAutoRaidTimers(sessionId) {
  clearLobbyAutoStart(sessionId);
  clearAutoRoundTimeout(sessionId);
}

function scheduleAutoRoundTimeout({ client, guildId, channelId, messageId, sessionId, waitMs = AUTO_ROUND_TIMEOUT_MS }) {
  clearAutoRoundTimeout(sessionId);
  const key = String(sessionId || "");
  const handle = setTimeout(async () => {
    try {
      const result = await handleRoundTimeout(key);
      if (!result.ok) {
        if (result.reason === "too_early") {
          scheduleAutoRoundTimeout({
            client,
            guildId,
            channelId,
            messageId,
            sessionId: key,
            waitMs: Math.max(1000, Number(result.retryAfterMs || 1000)),
          });
        }
        return;
      }

      const view = summary(result.session);
      const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
      if (!guild) return;
      const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
      if (!channel || !channel.isTextBased()) return;
      const message = await channel.messages.fetch(messageId).catch(() => null);
      if (message) {
        await message.edit(buildBattlePayload(view, "auto"));
      }

      if (result.ended) {
        if (view.defeated.length) {
          await channel.send(buildDefeatedPayload(view));
        }
        const won = Boolean(result.finalResult && result.finalResult.won);
        await channel.send(buildRewardsPayload(view, won));
        clearAllAutoRaidTimers(key);
        removeSession(key);
        return;
      }

      if (result.progressedRound) {
        scheduleAutoRoundTimeout({ client, guildId, channelId, messageId, sessionId: key });
      }
    } catch {
      // noop
    }
  }, Math.max(1000, Number(waitMs || AUTO_ROUND_TIMEOUT_MS)));
  autoRoundTimeoutHandles.set(key, handle);
}

function scheduleLobbyAutoStart({ client, guildId, channelId, messageId, sessionId }) {
  clearLobbyAutoStart(sessionId);
  const key = String(sessionId || "");
  const handle = setTimeout(async () => {
    try {
      const session = getSession(key);
      if (!session || session.state !== "lobby") return;

      const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
      if (!guild) return;
      const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
      if (!channel || !channel.isTextBased()) return;
      const message = await channel.messages.fetch(messageId).catch(() => null);

      const started = await startRaid(key, "auto");
      if (!started.ok) {
        if (started.reason === "empty") {
          await channel.send("No hunters joined in 30 seconds. Spawn closed.");
          clearAllAutoRaidTimers(key);
          removeSession(key);
        }
        return;
      }

      const view = summary(started.session);
      if (message) {
        await message.edit(buildBattlePayload(view, "auto"));
      }
      scheduleAutoRoundTimeout({ client, guildId, channelId, messageId, sessionId: key });
    } catch {
      // noop
    } finally {
      lobbyAutoStartHandles.delete(key);
    }
  }, AUTO_LOBBY_START_MS);
  lobbyAutoStartHandles.set(key, handle);
}

function isMissingSettingsTable(error) {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    (error?.code === "PGRST204" && typeof error?.message === "string" && error.message.includes("guild_settings"))
  );
}

function normalizeConfig(row) {
  return {
    guild_id: row.guild_id,
    dungeon_channel_id: row.dungeon_channel_id || null,
    dungeon_interval_minutes: Number(row.dungeon_interval_minutes || 15),
    dungeon_enabled: row.dungeon_enabled !== false,
    dungeon_ping_role_id: row.dungeon_ping_role_id || null,
    last_dungeon_at: row.last_dungeon_at || null,
    updated_at: row.updated_at || nowIso(),
  };
}

async function getDungeonPingRoleId(guildId) {
  if (!guildId) return DUNGEON_PING_ROLE_ID || null;
  const cfg = await getDungeonConfig(guildId).catch(() => null);
  return cfg?.dungeon_ping_role_id || DUNGEON_PING_ROLE_ID || null;
}

async function setDungeonPingRoleId(guildId, roleId) {
  const normalizedRoleId = roleId ? String(roleId) : null;
  const old = memoryConfig.get(guildId) || { guild_id: guildId };
  const next = { ...old, dungeon_ping_role_id: normalizedRoleId, updated_at: nowIso() };
  memoryConfig.set(guildId, next);

  if (dbUnavailable) return next;

  const patch = { dungeon_ping_role_id: normalizedRoleId, updated_at: nowIso() };
  let attempt = { ...patch };
  for (let i = 0; i < 4; i += 1) {
    const { error } = await supabase
      .from("guild_settings")
      .update(attempt)
      .eq("guild_id", guildId);
    if (!error) return next;
    if (isMissingSettingsTable(error)) {
      dbUnavailable = true;
      return next;
    }
    const isMissingColumn = error.code === "PGRST204" && typeof error.message === "string";
    if (!isMissingColumn) throw error;
    const match = error.message.match(/'([^']+)' column/);
    const missing = match && match[1];
    if (!missing || !(missing in attempt)) throw error;
    delete attempt[missing];
  }

  return next;
}

async function upsertDungeonConfig({ guildId, channelId, intervalMinutes = 15, enabled = true }) {
  const payload = normalizeConfig({
    guild_id: guildId,
    dungeon_channel_id: channelId,
    dungeon_interval_minutes: Math.max(1, Number(intervalMinutes || 15)),
    dungeon_enabled: !!enabled,
    updated_at: nowIso(),
  });

  if (dbUnavailable) {
    const old = memoryConfig.get(guildId) || {};
    const merged = { ...old, ...payload };
    memoryConfig.set(guildId, merged);
    return merged;
  }

  let attempt = { ...payload };
  for (let i = 0; i < 6; i += 1) {
    const { data, error } = await supabase
      .from("guild_settings")
      .upsert(attempt, { onConflict: "guild_id" })
      .select("*")
      .single();

    if (!error) {
      const normalized = normalizeConfig(data);
      memoryConfig.set(guildId, normalized);
      return normalized;
    }

    if (isMissingSettingsTable(error)) {
      dbUnavailable = true;
      const old = memoryConfig.get(guildId) || {};
      const merged = { ...old, ...payload };
      memoryConfig.set(guildId, merged);
      return merged;
    }

    const isMissingColumn = error.code === "PGRST204" && typeof error.message === "string";
    if (!isMissingColumn) throw error;
    const match = error.message.match(/'([^']+)' column/);
    const missing = match && match[1];
    if (!missing || !(missing in attempt)) throw error;
    delete attempt[missing];
  }

  const old = memoryConfig.get(guildId) || {};
  const merged = { ...old, ...payload };
  memoryConfig.set(guildId, merged);
  return merged;
}

async function listDungeonConfigs() {
  if (dbUnavailable) {
    return Array.from(memoryConfig.values());
  }

  const { data, error } = await supabase.from("guild_settings").select("*").eq("dungeon_enabled", true);
  if (!error) {
    const normalized = (data || []).map(normalizeConfig);
    for (const cfg of normalized) memoryConfig.set(cfg.guild_id, cfg);
    return normalized;
  }

  if (isMissingSettingsTable(error)) {
    dbUnavailable = true;
    return Array.from(memoryConfig.values()).filter((x) => x.dungeon_enabled);
  }

  throw error;
}

async function getDungeonConfig(guildId) {
  if (!guildId) return null;
  if (dbUnavailable) {
    return memoryConfig.get(guildId) || null;
  }

  const { data, error } = await supabase.from("guild_settings").select("*").eq("guild_id", guildId).maybeSingle();
  if (!error) {
    if (!data) return memoryConfig.get(guildId) || null;
    const normalized = normalizeConfig(data);
    memoryConfig.set(guildId, normalized);
    return normalized;
  }

  if (isMissingSettingsTable(error)) {
    dbUnavailable = true;
    return memoryConfig.get(guildId) || null;
  }

  throw error;
}

async function markDungeonPosted(guildId, atIso) {
  const old = memoryConfig.get(guildId) || { guild_id: guildId };
  const next = { ...old, last_dungeon_at: atIso, updated_at: nowIso() };
  memoryConfig.set(guildId, next);

  if (dbUnavailable) return;

  const { error } = await supabase
    .from("guild_settings")
    .update({ last_dungeon_at: atIso, updated_at: nowIso() })
    .eq("guild_id", guildId);
  if (error && isMissingSettingsTable(error)) dbUnavailable = true;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomDungeon() {
  const difficultyKey = randomChoice(Object.keys(DUNGEON_DIFFICULTIES));
  const difficulty = DUNGEON_DIFFICULTIES[difficultyKey];
  const name = randomChoice(DUNGEON_TEMPLATES);
  return { name, difficultyKey, difficulty };
}

function dueForSpawn(config, nowMs) {
  if (!config?.dungeon_enabled || !config?.dungeon_channel_id) return false;
  const intervalMs = Math.max(1, Number(config.dungeon_interval_minutes || 15)) * 60 * 1000;
  const lastMs = config.last_dungeon_at ? new Date(config.last_dungeon_at).getTime() : 0;
  if (!lastMs) return true;
  return nowMs - lastMs >= intervalMs;
}

async function postDungeonSpawn(client, config) {
  const guild = client.guilds.cache.get(config.guild_id) || (await client.guilds.fetch(config.guild_id).catch(() => null));
  if (!guild) return;
  const channel = guild.channels.cache.get(config.dungeon_channel_id) || (await guild.channels.fetch(config.dungeon_channel_id).catch(() => null));
  if (!channel || !channel.isTextBased()) return;

  const spawn = pickRandomDungeon();
  const lobby = createLobby({
    guildId: config.guild_id,
    channelId: channel.id,
    ownerId: "auto",
    difficultyKey: spawn.difficultyKey,
  });
  const view = summary(lobby);
  const dangerMap = {
    easy: "Low",
    normal: "Moderate",
    hard: "High",
    elite: "Severe",
    raid: "Catastrophic",
  };
  const threat = dangerMap[spawn.difficultyKey] || "Moderate";
  const detailText = [
    "**Auto Dungeon Spawn**",
    `Gate: **${spawn.name}**`,
    `Difficulty: **${view.difficultyLabel}**`,
    `Threat: **${threat}**`,
    `Rounds: **${view.maxRounds}**`,
    "",
    "Press **Join** to enter this raid.",
    "Raid starts automatically in **30 seconds**.",
    "Boss HP, defeated list, and rewards are live updated in the lobby view.",
    "Rounds progress automatically during battle.",
  ].join("\n");

  const container = new ContainerBuilder()
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(AUTO_DUNGEON_BANNER_URL))
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(detailText));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`raid_join:${view.id}`).setStyle(ButtonStyle.Success).setLabel("Join"),
    new ButtonBuilder().setCustomId(`raid_cancel:${view.id}`).setStyle(ButtonStyle.Secondary).setLabel("Cancel")
  );
  container.addActionRowComponents(row);

  const pingRoleId = await getDungeonPingRoleId(config.guild_id);
  if (pingRoleId) {
    await channel.send({
      content: `<@&${pingRoleId}> Boss Spawned`,
      allowedMentions: { roles: [pingRoleId] },
    });
  }

  const sent = await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });

  scheduleLobbyAutoStart({
    client,
    guildId: config.guild_id,
    channelId: channel.id,
    messageId: sent.id,
    sessionId: view.id,
  });

  await markDungeonPosted(config.guild_id, nowIso());
}

async function postManualDungeonSpawn(client, { guildId, channelId }) {
  const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
  if (!guild) return { ok: false, reason: "guild_missing" };
  const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
  if (!channel || !channel.isTextBased()) return { ok: false, reason: "channel_missing" };

  const spawn = pickRandomDungeon();
  const lobby = createLobby({
    guildId,
    channelId: channel.id,
    ownerId: "auto",
    difficultyKey: spawn.difficultyKey,
  });
  const view = summary(lobby);
  const dangerMap = {
    easy: "Low",
    normal: "Moderate",
    hard: "High",
    elite: "Severe",
    raid: "Catastrophic",
  };
  const threat = dangerMap[spawn.difficultyKey] || "Moderate";
  const detailText = [
    "**Auto Dungeon Spawn**",
    `Gate: **${spawn.name}**`,
    `Difficulty: **${view.difficultyLabel}**`,
    `Threat: **${threat}**`,
    `Rounds: **${view.maxRounds}**`,
    "",
    "Press **Join** to enter this raid.",
    "Raid starts automatically in **30 seconds**.",
  ].join("\n");

  const container = new ContainerBuilder()
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(AUTO_DUNGEON_BANNER_URL))
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(detailText));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`raid_join:${view.id}`).setStyle(ButtonStyle.Success).setLabel("Join"),
    new ButtonBuilder().setCustomId(`raid_cancel:${view.id}`).setStyle(ButtonStyle.Secondary).setLabel("Cancel")
  );
  container.addActionRowComponents(row);

  const pingRoleId = await getDungeonPingRoleId(guildId);
  if (pingRoleId) {
    await channel.send({
      content: `<@&${pingRoleId}> Boss Spawned`,
      allowedMentions: { roles: [pingRoleId] },
    });
  }

  const sent = await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });

  scheduleLobbyAutoStart({
    client,
    guildId,
    channelId: channel.id,
    messageId: sent.id,
    sessionId: view.id,
  });

  return { ok: true };
}

async function autoDungeonTick(client) {
  if (inTick) return;
  inTick = true;
  try {
    const configs = await listDungeonConfigs();
    const nowMs = Date.now();
    for (const config of configs) {
      if (!dueForSpawn(config, nowMs)) continue;
      try {
        await postDungeonSpawn(client, config);
      } catch (error) {
        console.error("[auto-dungeon:post]", config.guild_id, error);
      }
    }
  } finally {
    inTick = false;
  }
}

function startAutoDungeonLoop(client) {
  if (loopHandle) clearInterval(loopHandle);
  setTimeout(() => autoDungeonTick(client).catch((e) => console.error("[auto-dungeon:init]", e)), 12000);
  loopHandle = setInterval(() => autoDungeonTick(client).catch((e) => console.error("[auto-dungeon:tick]", e)), 60 * 1000);
}

function reserveSpawnJoin(spawnId, userId) {
  pruneSpawnJoinState();
  const sid = String(spawnId || "");
  const uid = String(userId || "");
  if (!sid || !uid) {
    return { ok: false, reason: "invalid_spawn", retryAfterMs: 0 };
  }
  const key = `${sid}:${uid}`;
  const now = Date.now();
  const existing = spawnJoinState.get(key);
  if (existing?.used) {
    return { ok: false, reason: "already_joined", retryAfterMs: 0 };
  }
  if (existing?.processing) {
    return { ok: false, reason: "processing", retryAfterMs: SPAWN_JOIN_COOLDOWN_MS };
  }
  if (existing?.lastAttemptAt && now - existing.lastAttemptAt < SPAWN_JOIN_COOLDOWN_MS) {
    return { ok: false, reason: "cooldown", retryAfterMs: SPAWN_JOIN_COOLDOWN_MS - (now - existing.lastAttemptAt) };
  }

  spawnJoinState.set(key, { lastAttemptAt: now, processing: true, used: false });
  return { ok: true, reason: "ok", retryAfterMs: 0 };
}

function finishSpawnJoin(spawnId, userId, success) {
  const key = `${String(spawnId || "")}:${String(userId || "")}`;
  const existing = spawnJoinState.get(key);
  if (!existing) return;
  if (success) {
    spawnJoinState.set(key, {
      lastAttemptAt: existing.lastAttemptAt || Date.now(),
      processing: false,
      used: true,
    });
    return;
  }
  spawnJoinState.set(key, {
    lastAttemptAt: Date.now(),
    processing: false,
    used: false,
  });
}

module.exports = {
  upsertDungeonConfig,
  getDungeonConfig,
  getDungeonPingRoleId,
  setDungeonPingRoleId,
  postManualDungeonSpawn,
  startAutoDungeonLoop,
  reserveSpawnJoin,
  finishSpawnJoin,
};


