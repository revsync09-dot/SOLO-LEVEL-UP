const { randomInt, clamp } = require("../utils/math");
const { DUNGEON_DIFFICULTIES } = require("../utils/constants");
const { computePower } = require("./combatService");
const { ensureHunter, addXpAndGold } = require("./hunterService");
const { getEquippedShadows } = require("./shadowService");
const { getBattleBonus, tryGrantSingleCard } = require("./cardsService");
const { updateUser } = require("./database");
const { recordDamage, recordDungeonClear, recordHeal } = require("./eventService");

const sessions = new Map();
const ROUND_ACTION_TIMEOUT_MS = 30_000;

const DEFAULT_ROUND_BANNERS = [
  "https://media.discordapp.net/attachments/1477018034169188362/1477412590534787122/sung-jin-woo-spinning-solo-leveling-episode-12-9p9rleq0o9kx8qyy.webp?ex=69a4ab32&is=69a359b2&hm=6f79fcae8bf77d9f62ed62ed92895d81051164b9227cfe2e3f58ce760028ed35&=&animated=true",
  "https://media.discordapp.net/attachments/1477018034169188362/1477412591092633630/solo-leveling-sung-jin-woo.gif?ex=69a4ab32&is=69a359b2&hm=5308d6f264b28b31462b53f0785aa1a95fe9b7fb47d15ad0b104f10587049817&=",
  "https://media.discordapp.net/attachments/1477018034169188362/1477412591574974645/222254.gif?ex=69a4ab32&is=69a359b2&hm=fe417bda5d5eed4e8ff4bf67595a13c721fb27e5550ccdbc8c32a2a870fc41d1&=",
  "https://media.discordapp.net/attachments/1477018034169188362/1477412591981695088/wmp4naz677qc1.gif?ex=69a4ab32&is=69a359b2&hm=e31099880b730192ee2f8139c5f13192d48e3455f9bb916c033d7c4e796be2bf&=",
  "https://media.discordapp.net/attachments/1477018034169188362/1477412592304525342/digging-digg.gif?ex=69a4ab33&is=69a359b3&hm=4fcede3c57c30a62615cd620ad40fa48c4146e04a83d61771202305f8b010421&=",
];
const ROUND_BANNERS_ENV = process.env.RAID_ROUND_BANNERS || process.env.DUNGEON_ROUND_BANNERS || "";

function normalizeDiscordBannerUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (!/discordapp\.com$/i.test(parsed.hostname) && !/discordapp\.net$/i.test(parsed.hostname)) {
      return raw;
    }
    if (parsed.hostname === "cdn.discordapp.com") {
      parsed.hostname = "media.discordapp.net";
    }
    if (!/\.gif$/i.test(parsed.pathname)) {
      parsed.searchParams.set("format", "gif");
    }
    return parsed.toString();
  } catch {
    return raw;
  }
}

function parseRoundBanners(raw) {
  const list = String(raw || "")
    .split(/[\n,]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
  if (!list.length) return DEFAULT_ROUND_BANNERS.map(normalizeDiscordBannerUrl);
  return list.map(normalizeDiscordBannerUrl);
}

const ROUND_BANNERS = parseRoundBanners(ROUND_BANNERS_ENV);

const SOLO_LEVELING_BOSSES = [
  { name: "Cerberus", baseHp: 3200, attack: 150 },
  { name: "Metus", baseHp: 3300, attack: 152 },
  { name: "Baruka", baseHp: 3500, attack: 165 },
  { name: "Baran", baseHp: 3600, attack: 170 },
  { name: "Vulcan", baseHp: 3400, attack: 155 },
  { name: "Kargalgan", baseHp: 3000, attack: 145 },
  { name: "Igris", baseHp: 3800, attack: 178 },
  { name: "Ant King", baseHp: 4200, attack: 190 },
  { name: "Architect", baseHp: 3900, attack: 180 },
  { name: "Frost Monarch", baseHp: 4700, attack: 214 },
  { name: "Beast Monarch", baseHp: 4850, attack: 220 },
  { name: "Plague Monarch", baseHp: 5000, attack: 228 },
  { name: "Monarch of Iron Body", baseHp: 5200, attack: 236 },
  { name: "Demon Monarch", baseHp: 4600, attack: 210 },
  { name: "Antares", baseHp: 5600, attack: 255 },
  { name: "Ashborn", baseHp: 6000, attack: 300 },
  { name: "Reve", baseHp: 5500, attack: 240 },
  { name: "Eden", baseHp: 5300, attack: 230 },
  { name: "Kallavan", baseHp: 4800, attack: 205 },
];

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function shuffleRoundBanners() {
  const arr = [...ROUND_BANNERS];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function healthBar(current, max, length = 24) {
  const safeMax = Math.max(1, Number(max || 1));
  const safeCurrent = clamp(Number(current || 0), 0, safeMax);
  const ratio = safeCurrent / safeMax;
  const filled = Math.round(ratio * length);
  const empty = Math.max(0, length - filled);
  const percent = Math.round(ratio * 100);
  return `${"▰".repeat(filled)}${"▱".repeat(empty)} ${percent}% (${safeCurrent}/${safeMax})`;
}

function difficultyMultiplier(key) {
  const cfg = DUNGEON_DIFFICULTIES[key] || DUNGEON_DIFFICULTIES.normal;
  return Number(cfg.multiplier || 1);
}

function pickBoss(difficultyKey) {
  const d = difficultyMultiplier(difficultyKey);
  const base = SOLO_LEVELING_BOSSES[randomInt(0, SOLO_LEVELING_BOSSES.length - 1)];
  return {
    name: base.name,
    maxHp: Math.floor(base.baseHp * d),
    hp: Math.floor(base.baseHp * d),
    attack: Math.floor(base.attack * (0.9 + d * 0.22)),
  };
}

function basePlayerHp(hunter) {
  return Math.max(400, 320 + Number(hunter.vitality || 0) * 42 + Number(hunter.level || 1) * 24);
}

async function loadActiveSkillsAndConsume(hunter) {
  const inventory = Array.isArray(hunter.inventory) ? [...hunter.inventory] : [];
  const skills = {};
  const kept = [];

  for (const item of inventory) {
    const text = String(item || "").trim();
    if (text.startsWith("active_skill:")) {
      const key = text.slice("active_skill:".length);
      skills[key] = Number(skills[key] || 0) + 1;
      continue;
    }
    kept.push(item);
  }

  if (kept.length !== inventory.length) {
    await updateUser(hunter.user_id, hunter.guild_id, { inventory: kept });
  }

  return { skills, inventory: kept };
}

function participantTag(userId) {
  return `<@${userId}>`;
}

function createLobby({ guildId, channelId, ownerId, difficultyKey = "normal" }) {
  const sessionId = createId();
  const session = {
    id: sessionId,
    guildId,
    channelId,
    ownerId,
    difficultyKey,
    state: "lobby",
    createdAt: Date.now(),
    maxRounds: randomInt(4, 5),
    round: 0,
    participants: new Map(),
    defeated: new Set(),
    rewards: [],
    boss: null,
    bannerOrder: shuffleRoundBanners(),
    roundStartedAt: null,
  };
  sessions.set(sessionId, session);
  return session;
}

function createLobbyWithId({ sessionId, guildId, channelId, ownerId, difficultyKey = "normal", maxRounds = null }) {
  const id = String(sessionId || createId());
  const session = {
    id,
    guildId,
    channelId,
    ownerId,
    difficultyKey,
    state: "lobby",
    createdAt: Date.now(),
    maxRounds: maxRounds && Number(maxRounds) > 0 ? Number(maxRounds) : randomInt(4, 5),
    round: 0,
    participants: new Map(),
    defeated: new Set(),
    rewards: [],
    boss: null,
    bannerOrder: shuffleRoundBanners(),
    roundStartedAt: null,
  };
  sessions.set(id, session);
  return session;
}

function getSession(sessionId) {
  return sessions.get(String(sessionId || "")) || null;
}

function removeSession(sessionId) {
  sessions.delete(String(sessionId || ""));
}

function collectMessageText(nodes, bucket = []) {
  if (!Array.isArray(nodes)) return bucket;
  for (const node of nodes) {
    if (!node) continue;
    if (typeof node.content === "string" && node.content.trim()) {
      bucket.push(node.content);
    }
    if (Array.isArray(node.components)) {
      collectMessageText(node.components, bucket);
    }
  }
  return bucket;
}

function parseDifficultyKeyFromText(text) {
  if (!text) return "normal";
  const match = text.match(/Difficulty:\s*\*\*([^*]+)\*\*/i);
  if (!match) return "normal";
  const label = String(match[1] || "").trim().toLowerCase();
  const found = Object.entries(DUNGEON_DIFFICULTIES).find(([, cfg]) => String(cfg.label || "").toLowerCase() === label);
  return found ? found[0] : "normal";
}

function parseMaxRoundsFromText(text) {
  if (!text) return null;
  const match = text.match(/Rounds:\s*\*\*(\d+)\*\*/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 1) return null;
  return value;
}

function recoverLobbyFromMessage({ sessionId, guildId, channelId, message }) {
  const existing = getSession(sessionId);
  if (existing) return existing;

  const text = collectMessageText(message?.components || []).join("\n");
  const difficultyKey = parseDifficultyKeyFromText(text);
  const maxRounds = parseMaxRoundsFromText(text);
  return createLobbyWithId({
    sessionId,
    guildId,
    channelId,
    ownerId: "auto",
    difficultyKey,
    maxRounds,
  });
}

function listParticipants(session) {
  return Array.from(session.participants.values());
}

async function joinLobby(sessionId, userId, guildId) {
  const session = getSession(sessionId);
  if (!session) return { ok: false, reason: "missing" };
  if (session.state !== "lobby") return { ok: false, reason: "started" };
  if (session.guildId !== guildId) return { ok: false, reason: "wrong_guild" };
  if (session.participants.has(userId)) return { ok: true, session, joined: false };
  if (session.participants.size >= 12) return { ok: false, reason: "full" };

  const hunter = await ensureHunter({ userId, guildId });
  const shadows = await getEquippedShadows(userId, guildId);
  const cards = await getBattleBonus(hunter);
  const prepared = await loadActiveSkillsAndConsume(hunter);
  const healKits = prepared.inventory.filter((x) => String(x) === "raid_heal_kit").length;
  const hp = basePlayerHp(hunter);

  session.participants.set(userId, {
    userId,
    hunter,
    hp,
    maxHp: hp,
    shield: 0,
    acted: false,
    shadows,
    cardBonus: cards.totalPower,
    skills: prepared.skills,
    inventory: prepared.inventory,
    healKits,
    totalDamage: 0,
    dead: false,
  });

  return { ok: true, session, joined: true };
}

async function startRaid(sessionId, starterId) {
  const session = getSession(sessionId);
  if (!session) return { ok: false, reason: "missing" };
  if (session.state !== "lobby") return { ok: false, reason: "already" };
  if (session.ownerId !== starterId && session.ownerId !== "auto") return { ok: false, reason: "owner_only" };
  if (!session.participants.size) return { ok: false, reason: "empty" };

  session.state = "in_progress";
  session.round = 1;
  session.boss = pickBoss(session.difficultyKey);
  session.boss.intent = "attack";
  session.boss.intentName = "";
  session.combatLog = ["The Raid begins! Boss approaches."];
  session.mvpUserId = null;
  session.roundStartedAt = Date.now();
  for (const p of session.participants.values()) {
    p.acted = false;
    p.afkTimeout = false;
  }
  return { ok: true, session };
}

function actionDamage(participant, action, sessionLogs) {
  const h = participant.hunter;
  const base = computePower(h, participant.shadows, Number(participant.cardBonus || 0)) * 0.5 + Number(h.level || 1) * 8;

  if (action === "skill") {
    const preferred = ["monarch_roar", "flame_slash", "shadow_step"];
    const chosen = preferred.find((k) => Number(participant.skills[k] || 0) > 0);
    action = chosen ? `skill:${chosen}` : "attack";
  }

  participant.lastAction = action;

  if (action === "guard") {
    participant.shield = Math.floor(180 + Number(h.vitality || 0) * 12 + Number(h.level || 1) * 8);
    sessionLogs.push(`🛡️ <@${participant.userId}> braced for impact! (Shield: ${participant.shield})`);
    return 0;
  }

  if (action === "heal") return 0; // handled elsewhere

  let mult = 1;
  let skillName = "";
  if (action.startsWith("skill:")) {
    const skill = action.split(":")[1];
    if (participant.skills[skill] > 0) {
      participant.skills[skill] -= 1;
      participant.lastAction = skill;
      if (skill === "flame_slash") { mult = 3.2; skillName = "🔥 Flame Slash"; }
      if (skill === "shadow_step") { mult = 1.0; skillName = "👟 Shadow Step (Dodge)"; }
      if (skill === "monarch_roar") { mult = 4.5; skillName = "📣 Monarch's Roar"; }
    } else {
      mult = 1.1; // fallback if trying to cheat
    }
  } else if (action === "attack") {
    mult = 1.0;
  }

  const variance = randomInt(90, 115) / 100;
  const dmg = Math.max(20, Math.floor(base * mult * variance));
  
  if (skillName) {
    sessionLogs.push(`💥 <@${participant.userId}> cast **${skillName}** targeting the boss! (${dmg} DMG)`);
  }
  return dmg;
}
async function consumeHealKit(participant, guildId) {
  const inventory = Array.isArray(participant.inventory) ? [...participant.inventory] : [];
  const index = inventory.indexOf("raid_heal_kit");
  if (index < 0) return false;
  inventory.splice(index, 1);
  participant.inventory = inventory;
  participant.healKits = Math.max(0, Number(participant.healKits || 0) - 1);
  await updateUser(participant.userId, guildId, { inventory });
  return true;
}

function everyoneActed(session) {
  for (const p of session.participants.values()) {
    if (!p.dead && !p.acted) return false;
  }
  return true;
}

/** Bot auto-resolves inactive players with the same actions as real buttons: attack, guard, or skill. */
function autoResolveInactivePlayers(session) {
  const logs = Array.isArray(session.combatLog) ? [...session.combatLog] : [];
  const actions = ["attack", "attack", "guard", "skill"];
  for (const p of session.participants.values()) {
    if (p.dead || p.acted) continue;
    const action = actions[randomInt(0, actions.length - 1)];
    const dmg = actionDamage(p, action, logs);
    p.totalDamage += dmg;
    p.acted = true;
    p.afkTimeout = true;
    session.boss.hp = Math.max(0, session.boss.hp - dmg);
  }
  session.combatLog = logs;
}

function applyBossStrike(session) {
  const alive = listParticipants(session).filter((p) => !p.dead);
  if (!alive.length) return;
  
  const isUltimate = session.boss.intent === "ultimate";
  const logs = Array.isArray(session.combatLog) ? [...session.combatLog] : [];
  
  if (isUltimate) {
    logs.push(`[ALERT] ${session.boss.name} unleashed ${session.boss.intentName || 'Devastating Ultimate'}!`);
  } else if (session.boss.intent === "charge") {
    logs.push(`[WARNING] ${session.boss.name} is charging energy...`);
    return; // No damage this turn!
  }
  
  for (const p of alive) {
    let raw = Math.floor(session.boss.attack * (randomInt(85, 115) / 100));
    // Ultimate does 3.5x normal damage, forces players to guard/heal!
    if (isUltimate) raw = Math.floor(raw * 3.5);

    // If player used Shadow Step, they dodge completely!
    if (p.lastAction === "shadow_step") {
      logs.push(`  <@${p.userId}> vanished into shadows and dodged the attack!`);
      continue;
    }

    const blocked = Math.min(raw, Number(p.shield || 0));
    const dmg = Math.max(0, raw - blocked);
    p.shield = Math.max(0, Number(p.shield || 0) - raw);
    p.hp = Math.max(0, p.hp - dmg);
    
    // reset shield after boss turn
    p.shield = 0;

    if (p.hp <= 0) {
      p.dead = true;
      session.defeated.add(p.userId);
      logs.push(`  💀 <@${p.userId}> was struck down!`);
    } else if (dmg > 0 && isUltimate) {
      logs.push(`  <@${p.userId}> took ${dmg} massive damage!`);
    } else if (blocked > 0 && isUltimate) {
      logs.push(`  🛡️ <@${p.userId}> guarded against the ultimate! (${blocked} blocked)`);
    }
  }
  
  // Decide next intent
  const opts = ["attack", "attack", "charge", "charge", "ultimate"];
  if (isUltimate) {
    session.boss.intent = "attack";
    session.boss.intentName = "";
  } else if (session.boss.intent === "charge") {
    session.boss.intent = "ultimate";
    const uNames = ["Infernal Flame", "Death Strike", "Annihilation Ray", "Monarch's Wrath"];
    session.boss.intentName = uNames[randomInt(0, uNames.length-1)];
  } else {
    session.boss.intent = opts[randomInt(0, opts.length - 1)];
  }
  
  session.combatLog = logs;
}
function shouldAutoAdvanceByHalfHp(session) {
  const alive = listParticipants(session).filter((p) => !p.dead);
  if (!alive.length) return false;
  const lowHpCount = alive.filter((p) => p.hp <= p.maxHp / 2).length;
  return lowHpCount >= Math.ceil(alive.length / 2);
}

function raidEnded(session) {
  const alive = listParticipants(session).filter((p) => !p.dead).length;
  return session.boss.hp <= 0 || alive <= 0 || session.round > session.maxRounds;
}

function raidWon(session) {
  return session.boss.hp <= 0;
}

async function finalizeRaid(session) {
  const cfg = DUNGEON_DIFFICULTIES[session.difficultyKey] || DUNGEON_DIFFICULTIES.normal;
  const won = raidWon(session);
  const rewards = [];
  
  // Find MVP (most damage)
  let mvpId = null;
  let maxDmg = -1;
  for (const p of session.participants.values()) {
    if (p.totalDamage > maxDmg) { maxDmg = p.totalDamage; mvpId = p.userId; }
  }
  session.mvpUserId = mvpId;

  for (const p of session.participants.values()) {
    const aliveAtEnd = !p.dead;
    if (won && aliveAtEnd) {
      let xp = randomInt(cfg.xp[0], cfg.xp[1]);
      let gold = randomInt(cfg.gold[0], cfg.gold[1]);
      let isMvp = (p.userId === mvpId);
      const damageBonusXp = Math.min(450, Math.floor(Number(p.totalDamage || 0) / 500));
      const damageBonusGold = Math.min(700, Math.floor(Number(p.totalDamage || 0) / 350));
      
      if (isMvp) {
        xp = Math.floor(xp * 1.5); // MVP +50%
        gold = Math.floor(gold * 1.5) + 500;
      }
      xp += damageBonusXp;
      gold += damageBonusGold;
      
      const progression = await addXpAndGold(p.userId, session.guildId, xp, gold);
      await recordDamage(session.guildId, p.userId, Number(p.totalDamage || 0));
      await recordDungeonClear(session.guildId, p.userId);
      // MVP has much higher drop chance
      const rand = Math.random();
      const dropChance = isMvp ? 0.08 : 0.01;
      let cardName = null;
      if (rand <= dropChance) {
         const drop = await tryGrantSingleCard(progression.hunter);
         if (drop.granted) cardName = drop.card.name;
      }
      rewards.push({ userId: p.userId, xp, gold, card: cardName, alive: true, mvp: isMvp, damage: Number(p.totalDamage || 0) });
    } else {
      const xp = Math.floor(cfg.xp[0] * 0.2);
      const penalty = randomInt(12, 40);
      await addXpAndGold(p.userId, session.guildId, xp, -penalty);
      await recordDamage(session.guildId, p.userId, Number(p.totalDamage || 0));
      rewards.push({ userId: p.userId, xp, gold: -penalty, card: null, alive: false, mvp: false, damage: Number(p.totalDamage || 0) });
    }
  }

  session.rewards = rewards;
  session.state = "ended";
  return { won, rewards };
}
function startNextRound(session) {
  applyBossStrike(session);
  session.round += 1;
  session.roundStartedAt = Date.now();
  for (const part of session.participants.values()) {
    part.acted = false;
    part.afkTimeout = false;
  }
}

async function handleRoundTimeout(sessionId) {
  const session = getSession(sessionId);
  if (!session) return { ok: false, reason: "missing" };
  if (session.state !== "in_progress") return { ok: false, reason: "not_running" };

  const startedAt = Number(session.roundStartedAt || 0);
  const now = Date.now();
  const elapsed = startedAt > 0 ? now - startedAt : ROUND_ACTION_TIMEOUT_MS;
  if (elapsed < ROUND_ACTION_TIMEOUT_MS) {
    return {
      ok: false,
      reason: "too_early",
      retryAfterMs: ROUND_ACTION_TIMEOUT_MS - elapsed,
      session,
    };
  }

  const timedOut = [];
  for (const p of session.participants.values()) {
    if (p.dead || p.acted) continue;
    p.acted = true;
    p.afkTimeout = true;
    timedOut.push(p.userId);
  }

  if (timedOut.length) {
    const timeoutLogs = timedOut.map((id) => `Oh yow <@${id}> you forgot do attack.`);
    session.combatLog = [...timeoutLogs, ...(Array.isArray(session.combatLog) ? session.combatLog : [])];
  }

  let progressedRound = false;
  let ended = false;
  if (everyoneActed(session) || shouldAutoAdvanceByHalfHp(session)) {
    startNextRound(session);
    progressedRound = true;
    ended = raidEnded(session);
  }

  const finalResult = ended ? await finalizeRaid(session) : null;
  return { ok: true, session, timedOut, progressedRound, ended, finalResult };
}

async function performAction(sessionId, userId, action) {
  const session = getSession(sessionId);
  if (!session) return { ok: false, reason: "missing" };
  if (session.state !== "in_progress") return { ok: false, reason: "not_running" };

  const p = session.participants.get(userId);
  if (!p) return { ok: false, reason: "not_joined" };
  if (p.dead) return { ok: false, reason: "dead" };

  if (shouldAutoAdvanceByHalfHp(session)) {
    startNextRound(session);
    const endedAuto = raidEnded(session);
    const autoFinal = endedAuto ? await finalizeRaid(session) : null;
    return {
      ok: true,
      session,
      damage: 0,
      action: "auto_next",
      progressedRound: true,
      ended: endedAuto,
      finalResult: autoFinal,
    };
  }

  if (p.acted) return { ok: false, reason: "already_acted" };

  if (action === "heal") {
    if (Number(p.healKits || 0) <= 0) return { ok: false, reason: "no_heal_item" };
    const consumed = await consumeHealKit(p, session.guildId);
    if (!consumed) return { ok: false, reason: "no_heal_item" };
    const healAmount = Math.floor(p.maxHp * 0.35);
    p.hp = Math.min(p.maxHp, p.hp + healAmount);
    p.acted = true;
    await recordHeal(session.guildId, p.userId, 1);
  }

  const dmg = actionDamage(p, action, session.combatLog);
  p.totalDamage += dmg;
  if (!p.acted) p.acted = true;
  session.boss.hp = Math.max(0, session.boss.hp - dmg);

  autoResolveInactivePlayers(session);

  let progressedRound = false;
  let ended = false;

  if (session.boss.hp <= 0) {
    ended = true;
  } else if (everyoneActed(session) || shouldAutoAdvanceByHalfHp(session)) {
    startNextRound(session);
    progressedRound = true;
    ended = raidEnded(session);
  }

  const finalResult = ended ? await finalizeRaid(session) : null;

  return {
    ok: true,
    session,
    damage: dmg,
    action,
    progressedRound,
    ended,
    finalResult,
  };
}

async function forceNextRound(sessionId, userId) {
  const session = getSession(sessionId);
  if (!session) return { ok: false, reason: "missing" };
  if (session.state !== "in_progress") return { ok: false, reason: "not_running" };
  if (!session.participants.has(userId)) return { ok: false, reason: "not_joined" };

  startNextRound(session);
  const ended = raidEnded(session);
  const finalResult = ended ? await finalizeRaid(session) : null;
  return { ok: true, session, ended, finalResult };
}

function summary(session) {
  const players = listParticipants(session);
  const roundBannerUrl =
    Array.isArray(session.bannerOrder) && session.bannerOrder.length && session.round > 0
      ? session.bannerOrder[(session.round - 1) % session.bannerOrder.length]
      : null;
  return {
    id: session.id,
    state: session.state,
    round: session.round,
    maxRounds: session.maxRounds,
    difficultyKey: session.difficultyKey,
    difficultyLabel: (DUNGEON_DIFFICULTIES[session.difficultyKey] || DUNGEON_DIFFICULTIES.normal).label,
    boss: session.boss,
    roundBannerUrl,
    bossHpBar: session.boss ? healthBar(session.boss.hp, session.boss.maxHp) : null,
    bossIntent: session.boss ? session.boss.intent : null,
    bossIntentName: session.boss ? session.boss.intentName : null,
    combatLog: session.combatLog || [],
    mvpUserId: session.mvpUserId,
    players: players.map((part) => ({
      userId: part.userId,
      mention: participantTag(part.userId),
      hp: part.hp,
      maxHp: part.maxHp,
      hpBar: healthBar(part.hp, part.maxHp, 14),
      acted: part.acted,
      afkTimeout: Boolean(part.afkTimeout),
      dead: part.dead,
      totalDamage: part.totalDamage,
      healKits: Number(part.healKits || 0),
      skills: part.skills,
    })),
    defeated: Array.from(session.defeated.values()).map((id) => participantTag(id)),
    rewards: session.rewards || [],
  };
}

function getRaidBossNames() {
  return SOLO_LEVELING_BOSSES.map((b) => b.name);
}

module.exports = {
  createLobby,
  createLobbyWithId,
  getSession,
  removeSession,
  recoverLobbyFromMessage,
  joinLobby,
  startRaid,
  performAction,
  forceNextRound,
  handleRoundTimeout,
  ROUND_ACTION_TIMEOUT_MS,
  getRaidBossNames,
  summary,
};
