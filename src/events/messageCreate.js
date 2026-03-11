const { ContainerBuilder, Events, MessageFlags, PermissionsBitField, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { ensureHunter, addXpAndGold, getHunter, xpRequired } = require("../services/hunterService");
const { getCooldown, setCooldown, remainingSeconds } = require("../services/cooldownService");
const { runHunt, computePower } = require("../services/combatService");
const { cooldownRemaining, nextCooldown } = require("../utils/cooldownHelper");
const {
  generateBattleResultCard,
  generateCardsCollectionCard,
  generateGateCard,
  generateHuntResultCard,
  generateInventoryCard,
  generateProfileCard,
  generateRankupCard,
  generateSalaryCard,
  generateStartCard,
  generateStatsCard,
} = require("../services/cardGenerator");
const { profileRows } = require("../handlers/components");
const { getEquippedShadows } = require("../services/shadowService");
const { getBattleBonus, getOwnedCards, tryGrantSingleCard } = require("../services/cardsService");
const { runPvp } = require("../services/pvpService");
const { RANKS, RANK_THRESHOLDS } = require("../utils/constants");
const { randomInt } = require("../utils/math");
const { buildShopPayload } = require("../services/shopService");
const { upsertDungeonConfig } = require("../services/autoDungeonService");
const { getConfig } = require("../config/config");
const { buildStatusPayload } = require("../utils/statusMessage");
const { updateUser } = require("../services/database");
const {
  HUNTER_CLASSES,
  getHunterClass,
  consumeReawakenedStoneAndSetClass,
  normalizeClass,
} = require("../services/classService");
const {
  FACTIONS,
  getFaction,
  setFaction,
  listFactionStandings,
  getLeaderboards,
  getStats,
  getQuestStatus,
  claimDailyRewards,
  claimWeeklyRewards,
  recordHunt,
  recordDungeonClear,
  recordDamage,
  recordExtremeGateClear,
  patchStats,
  addPrestige,
  getFactionXpBoost,
} = require("../services/eventService");
const {
  createClan,
  joinClan,
  leaveClan,
  updateClanConfig,
  getClanByMember,
  listClanMembers,
  guildBattle,
} = require("../services/guildSystemService");
const { getRaidBossNames } = require("../services/raidDungeonService");
const { checkAndIncrement, rateLimitMessage } = require("../services/rateLimitService");
const { getHelpEmoji } = require("../config/emojis");
const { performSpin, getSpinStatus } = require("../services/dailySpinService");
const { claimStreak, getStreakStatus } = require("../services/streakService");
const { getUserAchievements, checkUnlocks, buildCheckKeys } = require("../services/achievementService");
const { openBoxAndLog, countBoxes, VALID_TIERS: LOOT_BOX_VALID_TIERS } = require("../services/lootBoxService");
const { generateSpinCard, generateLootboxCard, generateTrainingCard, generateExpeditionCard, generateBossResultCard, generateStreakCard } = require("../services/minigameGenerator");
const { getHunterRace, setHunterRace, getRaceBonuses } = require("../services/raceService");
const { getExercise, getRandomExercise } = require("../services/trainingService");
const { ISLANDS, getIsland, canTravelTo } = require("../services/islandService");

const PREFIXES = ["!", "?"];
const processedMessages = new Set();
const battleLocks = new Set();
const config = getConfig();
const CHANNEL_BYPASS_USERS = new Set(["795466540140986368", "760194150452035595"]);

function helpText() {
  const lines = [
    "SOLO LEVELING - COMMAND GUIDE",
    "",
    "START",
    "!start                 Create your hunter profile",
    "!help                  Show this help",
    "",
    "PROGRESSION",
    "!profile               Your profile",
    "!stats [@user]         Detailed stats",
    "!hunt                  Hunt for XP and gold (5 min)",
    "!rankup                Rank up when ready",
    "!class                 Show/Change class",
    "!race                  Show/Change race",
    "!training              Specific training sessions",
    "",
    "DUNGEON & COMBAT",
    "Auto dungeon is the main dungeon mode",
    "!battle @user          PvP fight for rewards",
    "!gate_risk             Extreme gate challenge",
    "!island                Travel to Jeju and others",
    "",
    "SHOP & ITEMS",
    "!shop                  Open shop",
    "/use                   Use bought items/skills",
    "!shop infos            Important shop usage",
    "!inventory             Show your items & equipment",
    "!class infos           Important class usage",
    "!lootbox <tier>        Open a loot box (common/rare/epic/legendary)",
    "",
    "FUN & DAILY",
    "!spin                  Free daily reward (once per day, resets midnight UTC)",
    "!streak                Daily login streak — view or !streak claim",
    "!training              Train for XP & Gold + 1 stat (1h cooldown)",
    "!expedition            Send hunter on expedition (12h cooldown)",
    "!boss                  Daily solo boss fight (once per day)",
    "!achievements          View your hunter achievements/badges",
    "",
    "EVENT SYSTEM",
    "!leaderboard           Top Combat/Gold/Clears/Damage",
    "!eventstatus / !event  Your event stats & ranks",
    "!weekly                Weekly reward (once per week)",
    "!meditate              Rest & recover (10 min cooldown)",
    "!challenge             Daily challenge reward (once per day)",
    "!faction               Faction info/standings",
    "!faction join <name>   Join one of 3 factions",
    "!quests                Daily + weekly progress",
    "!claimquests           Claim finished quests",
    "!prestige              Prestige at level 100+",
    "",
    "GUILDS",
    "!setupguild create <name>    Create guild (level 20+)",
    "!setupguild info             Show your guild",
    "!setupguild members          Show guild members",
    "!setupguild join <clanId>    Join guild",
    "!setupguild leave            Leave guild",
    "!setupguild name <new name>  Rename your guild",
    "!setupguild logo <url>       Set guild logo",
    "!setupguild desc <text>      Set guild description",
    "!guildbattle @owner          Guild vs guild battle",
    "",
    "STAFF",
    "!setupdungeon [#ch] [min]    Configure auto dungeon",
    "!guild_salary                Daily salary",
  ];
  return [`${getHelpEmoji()} **Solo Leveling Help**`, "", "```", ...lines, "```"].join("\n");
}

function prefixHelpV2Payload() {
  const container = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(helpText()));
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function mapCollectionCards(owned) {
  return owned.map((card) => ({
    title: card.name,
    subtitle: `${card.rank}-Rank ${card.role}`,
    meta: `ATK ${card.atk} | HP ${card.hp} | DEF ${card.def}`,
    rarity:
      String(card.rank).toUpperCase() === "NATIONAL" || String(card.rank).toUpperCase() === "NATIONAL LEVEL"
        ? "Mythic"
        : String(card.rank).toUpperCase() === "S" || String(card.rank).toUpperCase() === "S-RANK"
          ? "Legendary"
          : card.rank,
    asset: card.asset || card.name,
  }));
}

function formatLeaderboardRows(rows, field) {
  if (!rows.length) return "No data yet.";
  const nameMap = arguments[2];
  const name = (r) => {
    if (nameMap && nameMap[r.user_id]) return nameMap[r.user_id];
    return `Hunter ${String(r.user_id).slice(-6)}`;
  };
  return rows.map((r, i) => `${i + 1}. **${name(r)}** — ${Number(r[field] || 0).toLocaleString()}`).join("\n");
}

function leaderboardV2Payload(lb, nameMap = null) {
  const text = [
    "## Event Leaderboards",
    "",
    "**Combat Power**",
    formatLeaderboardRows(lb.combatPower, "combat_power", nameMap),
    "",
    "**Top Gold**",
    formatLeaderboardRows(lb.topGold, "top_gold", nameMap),
    "",
    "**Most Dungeon Clears**",
    formatLeaderboardRows(lb.dungeonClears, "dungeon_clears", nameMap),
    "",
    "**Highest Damage**",
    formatLeaderboardRows(lb.highestDamage, "highest_damage", nameMap),
  ].join("\n");
  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(text)
  );
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function v2TextPayload(text) {
  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(String(text || ""))
  );
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function addBuffTokenToInventory(userId, guildId, token) {
  const hunter = await ensureHunter({ userId, guildId });
  const inventory = Array.isArray(hunter.inventory) ? [...hunter.inventory] : [];
  inventory.push(token);
  await updateUser(userId, guildId, { inventory });
}

function normalizeUseKey(parts) {
  const raw = String(parts.join(" ") || "").trim().toLowerCase();
  if (!raw) return "";
  const map = new Map([
    ["mana potion", "mana_potion"],
    ["mana_potion", "mana_potion"],
    ["potion", "mana_potion"],
    ["hunter key", "hunter_key"],
    ["hunter_key", "hunter_key"],
    ["stat reset token", "stat_reset"],
    ["stat reset", "stat_reset"],
    ["stat_reset", "stat_reset"],
    ["shadow essence", "shadow_essence"],
    ["shadow_essence", "shadow_essence"],
    ["gate crystal", "gate_crystal"],
    ["gate_crystal", "gate_crystal"],
    ["flame slash", "flame_slash"],
    ["flame_slash", "flame_slash"],
    ["shadow step", "shadow_step"],
    ["shadow_step", "shadow_step"],
    ["monarch roar", "monarch_roar"],
    ["monarch_roar", "monarch_roar"],
  ]);
  return map.get(raw) || raw.replace(/\s+/g, "_");
}

function shadowEssenceDailyState(hunter) {
  const today = new Date().toISOString().slice(0, 10);
  const cooldowns = hunter && typeof hunter.cooldowns === "object" && !Array.isArray(hunter.cooldowns)
    ? { ...hunter.cooldowns }
    : {};
  const state = cooldowns.shadow_essence && typeof cooldowns.shadow_essence === "object"
    ? cooldowns.shadow_essence
    : { date: today, points: 0 };
  const pointsToday = state.date === today ? Number(state.points || 0) : 0;
  return { today, cooldowns, pointsToday: Math.max(0, pointsToday) };
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild || message.author.bot) return;
    if (config.discordGuildId && message.guild.id !== config.discordGuildId) return;
    if (config.commandChannelId && message.channelId !== config.commandChannelId && !CHANNEL_BYPASS_USERS.has(message.author.id)) return;
    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 15_000);

    const matchedPrefix = PREFIXES.find((p) => message.content.startsWith(p));
    if (!matchedPrefix) return;

    const args = message.content.slice(matchedPrefix.length).trim().split(/\s+/);
    const command = (args.shift() || "").toLowerCase();
    const userId = message.author.id;
    const guildId = message.guild.id;

    // ── Global rate limit check (skip for owner) ──────────────────────────────
    if (userId !== "795466540140986368") {
      const rl = await checkAndIncrement(userId, guildId, command);
      if (!rl.ok) {
        await message.reply(v2TextPayload(rateLimitMessage(rl)));
        return;
      }
    }

    try {
      if (command === "help") {
        await message.reply(prefixHelpV2Payload());
        return;
      }

      if (command === "start") {
        const hunter = await ensureHunter({ 
          userId, 
          guildId, 
          username: message.author.username, 
          avatarUrl: message.author.displayAvatarURL({ extension: "png", size: 256 }) 
        });
        const card = await generateStartCard(message.author, hunter);
        await message.reply({ files: [{ attachment: card, name: "start-card.png" }] });
        return;
      }

      if (command === "setupdungeon") {
        const member = message.member;
        const isOwner = message.guild.ownerId === message.author.id;
        const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);
        const canManageGuild = member.permissions.has(PermissionsBitField.Flags.ManageGuild);
        if (!isOwner && !isAdmin && !canManageGuild) {
          await message.reply("Only the server owner or co-owner (admin/manage server) can use this.");
          return;
        }
        const firstArg = (args[0] || "").toLowerCase();
        if (firstArg === "off" || firstArg === "disable") {
          const cfg = await upsertDungeonConfig({ guildId, channelId: null, intervalMinutes: 15, enabled: false });
          await message.reply(`Auto dungeon disabled. Enabled: ${cfg.dungeon_enabled ? "yes" : "no"}`);
          return;
        }
        const mentionedChannel = message.mentions.channels.first();
        const channel = mentionedChannel || message.channel;
        const minuteArg = args.find((a) => /^\d+$/.test(a));
        const minutes = Math.max(1, Math.min(180, Number(minuteArg || 15)));
        const cfg = await upsertDungeonConfig({ guildId, channelId: channel.id, intervalMinutes: minutes, enabled: true });
        await message.reply(`Auto dungeon enabled in <#${cfg.dungeon_channel_id}> every ${cfg.dungeon_interval_minutes} minute(s).\nUse \`!setupdungeon off\` to disable.`);
        return;
      }

      if (command === "profile") {
        const hunter = await ensureHunter({ 
          userId, 
          guildId, 
          username: message.author.username, 
          avatarUrl: message.author.displayAvatarURL({ extension: "png", size: 256 }) 
        });
        const card = await generateProfileCard(message.author, hunter);
        await message.reply({ files: [{ attachment: card, name: "profile-card.png" }], components: profileRows(userId) });
        return;
      }

      if (command === "stats") {
        const targetUser = message.mentions.users.first() || message.author;
        if (targetUser.bot) return void (await message.reply("Bots do not have hunter stats."));
        let hunter;
        if (targetUser.id === userId) {
          hunter = await ensureHunter({ 
            userId, 
            guildId, 
            username: message.author.username, 
            avatarUrl: message.author.displayAvatarURL({ extension: "png", size: 256 }) 
          });
        } else {
          hunter = await ensureHunter({ 
            userId: targetUser.id, 
            guildId, 
            username: targetUser.username, 
            avatarUrl: targetUser.displayAvatarURL({ extension: "png", size: 256 }) 
          });
        }
        const [equippedShadows, cardBonus, ownedCards] = await Promise.all([
          getEquippedShadows(targetUser.id, guildId),
          getBattleBonus(hunter),
          getOwnedCards(hunter),
        ]);
        const shadowPower = equippedShadows.reduce((sum, s) => sum + s.base_damage + s.ability_bonus, 0);
        const basePower = computePower(hunter, []);
        const finalPower = computePower(hunter, equippedShadows, cardBonus.totalPower);
        const expNeeded = xpRequired(hunter.level);
        const topCards = cardBonus.cards.map((c) => c.name).slice(0, 3).join(", ") || "None";
        const card = await generateStatsCard(targetUser, hunter, {
          expNeeded, basePower, shadowPower, cardPower: cardBonus.totalPower, finalPower,
          equippedShadows: equippedShadows.length, shadowSlots: hunter.shadow_slots, ownedCards: ownedCards.length, topCards,
        });
        await message.reply({ files: [{ attachment: card, name: "stats-card.png" }] });
        return;
      }

      if (command === "race") {
        const hunter = await ensureHunter({ userId, guildId });
        const arg0 = String(args[0] || "").toLowerCase();
        
        if (!arg0) {
          const race = getHunterRace(hunter);
          const bonuses = getRaceBonuses(race);
          await message.reply([
            `Current Race: **${race.charAt(0).toUpperCase() + race.slice(1)}**`,
            `${bonuses.desc}`,
            "",
            "Available: Human, Beast, Dragon, Elf",
            "Use `!race <name>` to change (costs 10,000 Gold).",
          ].join("\n"));
          return;
        }

        const nextRace = arg0;
        const { HUNTER_RACES } = require("../utils/constants");
        if (!HUNTER_RACES.includes(nextRace)) {
          return void (await message.reply(`Invalid race. Available: ${HUNTER_RACES.join(", ")}`));
        }

        if (hunter.gold < 10000) {
          return void (await message.reply("You need 10,000 Gold to change your race."));
        }

        await updateUser(userId, guildId, { gold: hunter.gold - 10000, race: nextRace });
        await message.reply(`Race changed to **${nextRace.charAt(0).toUpperCase() + nextRace.slice(1)}**. 10,000 Gold consumed.`);
        return;
      }

      if (command === "island" || command === "travel") {
        const hunter = await ensureHunter({ userId, guildId });
        const arg0 = String(args[0] || "").toLowerCase();

        if (!arg0) {
          const currentIsland = hunter.current_island || "Main Island";
          return void (await message.reply([
            `📍 Current Location: **${currentIsland}**`,
            "",
            "**Available Islands:**",
            ISLANDS.map(i => `• **${i.name}** (Req Level: ${i.minLevel}) - \`!island ${i.key}\``).join("\n"),
          ].join("\n")));
        }

        const island = getIsland(arg0);
        if (!island) return void (await message.reply("Unknown island. Use `!island` to see available locations."));

        const travel = await canTravelTo(hunter, arg0);
        if (!travel.ok) {
          if (travel.reason === "level") return void (await message.reply(`❌ You need to be level **${travel.minLevel}** to travel to ${island.name}.`));
          return void (await message.reply("❌ Cannot travel there."));
        }

        await updateUser(userId, guildId, { current_island: island.name });
        await message.reply(`🚢 You have traveled to **${island.name}**!`);
        return;
      }

      if (command === "hunt") {
        const hunter = await ensureHunter({ 
          userId, 
          guildId, 
          username: message.author.username, 
          avatarUrl: message.author.displayAvatarURL({ extension: "png", size: 256 }) 
        });
        const cd = await getCooldown(userId, guildId, "hunt");
        if (cd && new Date(cd.available_at).getTime() > Date.now()) return void (await message.reply(`Hunt cooldown active: ${cooldownRemaining(cd.available_at)}s`));
        const rewards = runHunt(hunter);
        const boost = await getFactionXpBoost(guildId, userId);
        const boostedXp = Math.floor(Number(rewards.xp || 0) * Number(boost.multiplier || 1));
        const progression = await addXpAndGold(userId, guildId, boostedXp, rewards.gold);
        await setCooldown(userId, guildId, "hunt", nextCooldown(300));
        await recordHunt(guildId, userId);
        await patchStats(guildId, userId, { combat_power: computePower(progression.hunter, []), top_gold: Number(progression.hunter.gold || 0) });
        const cardDrop = await tryGrantSingleCard(progression.hunter);
        // ── Achievement check after hunt ─────────────────────────────────────
        const huntAchKeys = buildCheckKeys(progression.hunter, { firstHunt: true });
        const newHuntAchs = await checkUnlocks(userId, guildId, huntAchKeys);
        const card = await generateHuntResultCard(message.author, rewards, progression.levelsGained);
        const files = [{ attachment: card, name: "hunt-result.png" }];
        if (cardDrop.granted && cardDrop.imagePath) files.push({ attachment: cardDrop.imagePath, name: "single-card.png" });
        const bonusText = boost.multiplier > 1 ? `Faction bonus active (+10% XP for **${boost.faction}**).` : "";
        const dropText = cardDrop.granted ? `You unlocked **${cardDrop.card.name}** (drop chance: 0.025%).` : "";
        const achAnnounce = newHuntAchs.length ? `\u{1F3C5} Achievement: ${newHuntAchs.map((a) => `${a.emoji} **${a.title}**`).join(", ")}` : "";
        const content = [dropText, bonusText, achAnnounce].filter(Boolean).join("\n") || undefined;
        await message.reply({ content, files });
        return;
      }

      if (command === "dungeon") return;

      if (command === "inventory") {
        const hunter = await ensureHunter({ userId, guildId });
        const card = await generateInventoryCard(message.author, hunter);
        await message.reply({ files: [{ attachment: card, name: "inventory-card.png" }] });
        return;
      }

      if (command === "arise" || command === "extract") {
        const hunter = await ensureHunter({ userId, guildId });
        const hunterClass = getHunterClass(hunter);
        if (hunterClass !== "necromancer" && hunterClass !== "summoner") {
          return void (await message.reply("Only **Necromancers** and **Summoners** can use the **Arise** command!"));
        }

        const cd = await getCooldown(userId, guildId, "arise");
        if (cd && new Date(cd.available_at).getTime() > Date.now()) {
          return void (await message.reply(`⏳ Arise cooldown: ${cooldownRemaining(cd.available_at)}s`));
        }

        const { rollExtraction } = require("../services/shadowService");
        // We simulate extracting from a recent "fallen" but for now, let's just make it a random roll from a selection of enemies.
        const targets = ["High Orc", "Ice Elf", "Ant Warrior", "Statue Guard"];
        const target = targets[randomInt(0, targets.length - 1)];
        const rank = hunter.rank; // Extracts at hunter's rank
        
        try {
          const shadow = await rollExtraction(userId, guildId, target, rank);
          await setCooldown(userId, guildId, "arise", nextCooldown(3600)); // 1h cooldown
          await message.reply(`✨ **ARISE.**\nYou have extracted the shadow of a **${target}**!\nRank: **${shadow.rarity}** | Rank: **${shadow.rank}**`);
        } catch (e) {
          await message.reply("❌ Extraction failed. The soul was too weak.");
        }
        return;
      }

      if (command === "skills") {
        const hunter = await ensureHunter({ userId, guildId });
        const hunterClass = getHunterClass(hunter);
        const { getSkillsForClass } = require("../services/skillService");
        const skills = getSkillsForClass(hunterClass);
        
        if (skills.length === 0) {
          return void (await message.reply(`Your class (**${hunterClass}**) has no base skills unlocked yet.`));
        }

        await message.reply([
          `⚔️ **${hunterClass.toUpperCase()} SKILLS**`,
          "",
          skills.map(s => `• **${s.name}**: ${s.desc}`).join("\n"),
        ].join("\n"));
        return;
      }

      if (command === "monarch") {
        const hunter = await ensureHunter({ userId, guildId });
        if (hunter.level < 100 && !["Shadow Monarch", "Absolute Being"].includes(hunter.rank)) {
          return void (await message.reply("Only top-tier hunters (Level 100+) can access the **Monarch System**."));
        }
        
        await message.reply([
          "👑 **MONARCH SYSTEM**",
          "You have touched the power of the Monarchs.",
          "",
          "• Monarch Shadow Extraction: Unlocked",
          "• Monarch Weapons: Check !shop Monarch tab",
          "• Ruler's Authority: Passive XP Boost active",
        ].join("\n"));
        return;
      }

      if (command === "rankup") {
        const hunter = await ensureHunter({ userId, guildId });
        const currentIndex = RANKS.indexOf(hunter.rank);
        if (currentIndex < 0 || currentIndex >= RANKS.length - 1) return void (await message.reply("You are already at the maximum rank."));
        const nextRank = RANKS[currentIndex + 1];
        const requiredLevel = RANK_THRESHOLDS[nextRank];
        const examCost = 300 + currentIndex * 250;
        if (hunter.level < requiredLevel) return void (await message.reply(`You need level ${requiredLevel} for rank ${nextRank}.`));
        if (hunter.gold < examCost) return void (await message.reply(`Not enough gold. Required: ${examCost}.`));
        const updatedHunter = await updateUser(userId, guildId, { rank: nextRank, gold: hunter.gold - examCost });
        const rankAchKeys = buildCheckKeys({ ...hunter, rank: nextRank, gold: hunter.gold - examCost }, {});
        const newRankAchs = await checkUnlocks(userId, guildId, rankAchKeys);
        const card = await generateRankupCard(message.author, nextRank, hunter.rank);
        const rankAchText = newRankAchs.length ? `\n🏅 Achievement Unlocked: ${newRankAchs.map((a) => `${a.emoji} **${a.title}**`).join(", ")}` : "";
        await message.reply({ content: rankAchText || undefined, files: [{ attachment: card, name: "rankup-card.png" }] });
        return;
      }

      if (command === "battle" || command === "pvp") {
        const lockKey = `battle:${guildId}:${userId}`;
        if (battleLocks.has(lockKey)) return void (await message.reply("Please wait — a battle is already in progress."));
        battleLocks.add(lockKey);
        setTimeout(() => battleLocks.delete(lockKey), 12_000);

        const cd = await getCooldown(userId, guildId, "battle");
        if (cd && new Date(cd.available_at).getTime() > Date.now()) {
          battleLocks.delete(lockKey);
          return void (await message.reply(`Battle cooldown active: ${cooldownRemaining(cd.available_at)}s`));
        }
        const opponent = message.mentions.users.first();
        if (!opponent || opponent.bot || opponent.id === userId) {
          battleLocks.delete(lockKey);
          return void (await message.reply("Use a valid opponent mention. Example: `!battle @user`"));
        }
        const attacker = await ensureHunter({ 
          userId, 
          guildId, 
          username: message.author.username, 
          avatarUrl: message.author.displayAvatarURL({ extension: "png", size: 256 }) 
        });
        const defender = await ensureHunter({ 
          userId: opponent.id, 
          guildId, 
          username: opponent.username, 
          avatarUrl: opponent.displayAvatarURL({ extension: "png", size: 256 }) 
        });
        const result = await runPvp(attacker, defender);
        const card = await generateBattleResultCard({ username: message.author.username }, { username: opponent.username }, result);
        const attackerDamage = Math.max(0, Number(result.defenderMaxHp || 0) - Number(result.defenderHp || 0));
        const defenderDamage = Math.max(0, Number(result.attackerMaxHp || 0) - Number(result.attackerHp || 0));
        await recordDamage(guildId, userId, attackerDamage);
        await recordDamage(guildId, opponent.id, defenderDamage);
        const pvpAchKeys = buildCheckKeys(attacker, { firstPvp: true, pvpWin: result.attackerWon });
        const newPvpAchs = await checkUnlocks(userId, guildId, pvpAchKeys);
        const pvpAchText = newPvpAchs.length ? `\n\u{1F3C5} Achievement: ${newPvpAchs.map((a) => `${a.emoji} **${a.title}**`).join(", ")}` : "";
        await message.reply({
          content: `Rounds: ${result.rounds} | ${result.attackerWon ? message.author.username : opponent.username} won\nYou: +${result.rewards?.attacker?.xp || 0} XP, +${result.rewards?.attacker?.gold || 0} Gold${pvpAchText}`,
          files: [{ attachment: card, name: "battle-result.png" }],
        });
        await setCooldown(userId, guildId, "battle", nextCooldown(300));
        return;
      }

      if (command === "use") {
        const key = normalizeUseKey(args);
        if (!key) {
          await message.reply("Usage: `!use <item>` (example: `!use Stat Reset Token`)");
          return;
        }

        const hunter = await ensureHunter({ userId, guildId });
        const inventory = Array.isArray(hunter.inventory) ? [...hunter.inventory] : [];
        const consume = (tokens) => {
          for (const t of tokens) {
            const i = inventory.indexOf(t);
            if (i >= 0) {
              inventory.splice(i, 1);
              return true;
            }
          }
          return false;
        };

        if (key === "flame_slash" || key === "shadow_step" || key === "monarch_roar") {
          const scroll = `skill_scroll:${key}`;
          const active = `active_skill:${key}`;
          if (!consume([scroll])) {
            await message.reply(`You need **${key.replace(/_/g, " ")} Scroll** from /shop first.`);
            return;
          }
          inventory.push(active);
          await updateUser(userId, guildId, { inventory });
          await message.reply(`Activated **${key.replace(/_/g, " ")}** for your next raid.`);
          return;
        }

        if (key === "mana_potion") {
          if (!consume(["item:mana_potion", "Mana Potion", "potion"])) {
            await message.reply("You need **Mana Potion** from /shop first.");
            return;
          }
          await updateUser(userId, guildId, { inventory, mana: Math.min(9999, Number(hunter.mana || 0) + 100) });
          await message.reply("Used **Mana Potion**. +100 mana.");
          return;
        }

        if (key === "hunter_key") {
          if (inventory.includes("active_item:hunter_key")) {
            await message.reply("Hunter Key is already active for your next gate.");
            return;
          }
          if (!consume(["item:hunter_key", "Hunter Key", "hunter_key"])) {
            await message.reply("You need **Hunter Key** from /shop first.");
            return;
          }
          inventory.push("active_item:hunter_key");
          await updateUser(userId, guildId, { inventory });
          await message.reply("Activated **Hunter Key** for your next gate.");
          return;
        }

        if (key === "gate_crystal") {
          if (inventory.includes("active_item:gate_crystal")) {
            await message.reply("Gate Crystal is already active for your next gate.");
            return;
          }
          if (!consume(["material:gate_crystal", "Gate Crystal"])) {
            await message.reply("You need **Gate Crystal** from /shop first.");
            return;
          }
          inventory.push("active_item:gate_crystal");
          await updateUser(userId, guildId, { inventory });
          await message.reply("Activated **Gate Crystal** for your next gate.");
          return;
        }

        if (key === "shadow_essence") {
          const state = shadowEssenceDailyState(hunter);
          if (state.pointsToday >= 9) {
            await message.reply("Daily limit reached: you can gain max **9 stat points** per day from Shadow Essence.");
            return;
          }
          if (!consume(["material:shadow_essence", "Shadow Essence"])) {
            await message.reply("You need **Shadow Essence** from /shop first.");
            return;
          }
          await updateUser(userId, guildId, {
            inventory,
            stat_points: Number(hunter.stat_points || 0) + 3,
            cooldowns: {
              ...state.cooldowns,
              shadow_essence: {
                date: state.today,
                points: Math.min(9, state.pointsToday + 3),
              },
            },
          });
          await message.reply("Used **Shadow Essence**. +3 stat points.");
          return;
        }

        if (key === "stat_reset") {
          if (!consume(["item:stat_reset_token", "Stat Reset Token", "stat_reset"])) {
            await message.reply("You need **Stat Reset Token** from /shop first.");
            return;
          }
          const refund =
            Math.max(0, Number(hunter.strength || 5) - 5) +
            Math.max(0, Number(hunter.agility || 5) - 5) +
            Math.max(0, Number(hunter.intelligence || 5) - 5) +
            Math.max(0, Number(hunter.vitality || 5) - 5);
          await updateUser(userId, guildId, {
            inventory,
            strength: 5,
            agility: 5,
            intelligence: 5,
            vitality: 5,
            stat_points: Number(hunter.stat_points || 0) + refund,
          });
          await message.reply(`Used **Stat Reset Token**. Refunded **${refund}** stat points.`);
          return;
        }

        await message.reply("Unknown item. Use `/use` or try: mana potion, hunter key, stat reset token.");
        return;
      }

      if (command === "shop") {
        const arg0 = String(args[0] || "").toLowerCase();
        if (arg0 === "infos" || arg0 === "info") {
          await message.reply([
            "**Shop Infos**",
            "Open shop: `!shop` or `/shop`",
            "Buy items with Gold.",
            "Use bought items with `/use`.",
            "Hunter Key: boosts your next `gate_risk` run.",
            "Mana Potion: +100 mana.",
            "Stat Reset Token: resets STR/AGI/INT/VIT and refunds points.",
            "Raid Medkit: heal in raid rounds.",
            "Skill Scrolls: activate with `/use` for your next raid.",
          ].join("\n"));
          return;
        }
        const hunter = await ensureHunter({ userId, guildId });
        await message.reply(buildShopPayload({ userId, hunter, page: 0, ephemeral: false }));
        return;
      }

      if (command === "guild_salary" || command === "salary") {
        await ensureHunter({ userId, guildId });
        const cooldown = await getCooldown(userId, guildId, "guild_salary");
        if (cooldown && new Date(cooldown.available_at).getTime() > Date.now()) return void (await message.reply(`Guild salary is on cooldown. Try again in ${remainingSeconds(cooldown.available_at)}s.`));
        const gold = randomInt(200, 350);
        const xp = randomInt(30, 65);
        const progression = await addXpAndGold(userId, guildId, xp, gold);
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await setCooldown(userId, guildId, "guild_salary", tomorrow);
        await patchStats(guildId, userId, { combat_power: computePower(progression.hunter, []), top_gold: Number(progression.hunter.gold || 0) });
        const card = await generateSalaryCard(message.author, gold, progression.hunter.gold);
        await message.reply({ files: [{ attachment: card, name: "salary-card.png" }] });
        return;
      }

      if (command === "gate_risk" || command === "gaterisk") {
        const hunter = await ensureHunter({ userId, guildId });
        const cooldown = await getCooldown(userId, guildId, "gate_risk");
        if (cooldown && new Date(cooldown.available_at).getTime() > Date.now()) return void (await message.reply(`Gate risk cooldown active: ${cooldownRemaining(cooldown.available_at)}s`));
        const inventory = Array.isArray(hunter.inventory) ? [...hunter.inventory] : [];
        const hunterKeyIndex = inventory.indexOf("active_item:hunter_key");
        const gateCrystalIndex = inventory.indexOf("active_item:gate_crystal");
        const usedHunterKey = hunterKeyIndex >= 0;
        const usedGateCrystal = gateCrystalIndex >= 0;
        if (hunterKeyIndex >= 0) inventory.splice(hunterKeyIndex, 1);
        if (gateCrystalIndex >= 0) {
          const idx = inventory.indexOf("active_item:gate_crystal");
          if (idx >= 0) inventory.splice(idx, 1);
        }
        if (usedHunterKey || usedGateCrystal) {
          await updateUser(userId, guildId, { inventory });
        }

        const rawChance =
          52 +
          (Number(hunter.level) || 0) * 0.7 +
          (Number(hunter.agility) || 0) * 0.45 +
          (Number(hunter.strength) || 0) * 0.15 +
          (usedHunterKey ? 14 : 0) +
          (usedGateCrystal ? 7 : 0);
        const successChance = Math.min(96, Math.max(48, Math.round(rawChance)));
        const didWin = randomInt(1, 100) <= successChance;
        let rewards = {};
        let progression;
        if (didWin) {
          const mult = (usedHunterKey ? 1.25 : 1) * (usedGateCrystal ? 1.2 : 1);
          const gold = Math.floor(randomInt(280, 520) * mult);
          const xp = Math.floor(randomInt(120, 240) * mult);
          rewards = { gold, xp };
          progression = await addXpAndGold(userId, guildId, xp, gold);
          await recordExtremeGateClear(guildId, userId);
          await recordDungeonClear(guildId, userId);
        } else {
          const penalty = Math.floor(randomInt(80, 180) * (usedHunterKey ? 0.7 : 1));
          rewards = { penalty };
          progression = await addXpAndGold(userId, guildId, 30, -penalty);
        }
        await patchStats(guildId, userId, { combat_power: computePower(progression.hunter, []), top_gold: Number(progression.hunter.gold || 0) });
        const gateAchKeys = buildCheckKeys(progression.hunter, { firstGate: didWin });
        const newGateAchs = await checkUnlocks(userId, guildId, gateAchKeys);
        const card = await generateGateCard(message.author, "EXTREME", rewards, didWin, successChance);
        await setCooldown(userId, guildId, "gate_risk", nextCooldown(280));
        const gateAchText = newGateAchs.length ? ` | 🏅 ${newGateAchs.map((a) => `${a.emoji} ${a.title}`).join(", ")}` : "";
        const chanceText = `**Win chance: ${successChance}%** ${didWin ? "✓" : "— Roll failed."}${gateAchText}`;
        await message.reply({ content: chanceText, files: [{ attachment: card, name: "gate-card.png" }] });
        return;
      }

      if (command === "leaderboard" || command === "lb") {
        const lb = await getLeaderboards(guildId);
        const allIds = new Set([
          ...(lb.combatPower || []).map((r) => r.user_id),
          ...(lb.topGold || []).map((r) => r.user_id),
          ...(lb.dungeonClears || []).map((r) => r.user_id),
          ...(lb.highestDamage || []).map((r) => r.user_id),
        ]);
        const nameMap = {};
        for (const id of allIds) {
          const member = message.guild.members.cache.get(id);
          nameMap[id] = member?.displayName || member?.user?.username || `Hunter ${String(id).slice(-6)}`;
        }
        await message.reply(leaderboardV2Payload(lb, nameMap));
        return;
      }

      if (command === "faction") {
        const sub = String(args[0] || "").toLowerCase();
        if (sub === "join") {
          const raw = args.slice(1).join(" ").trim();
          const direct = FACTIONS.find((f) => f.toLowerCase() === raw.toLowerCase());
          const byIndex = Number(raw);
          const picked = direct || (Number.isFinite(byIndex) && byIndex >= 1 && byIndex <= FACTIONS.length ? FACTIONS[byIndex - 1] : null);
          if (!picked) return void (await message.reply(v2TextPayload(`Choose one faction: 1) ${FACTIONS[0]}, 2) ${FACTIONS[1]}, 3) ${FACTIONS[2]}`)));
          const joined = await setFaction(guildId, userId, picked);
          if (!joined.ok) return void (await message.reply(v2TextPayload("Could not join faction right now.")));
          await message.reply(v2TextPayload(`You joined **${picked}**.`));
          return;
        }
        const standings = await listFactionStandings(guildId);
        const myFaction = await getFaction(guildId, userId);
        const top = standings[0];
        await message.reply(v2TextPayload([
          "**Hunter Factions**",
          `Your faction: **${myFaction?.faction || "None"}**`,
          `Current leader: **${top?.faction || "None"}** (${Number(top?.score || 0).toLocaleString()} pts)`,
          "",
          "**Weekly Standings**",
          ...standings.map((s, i) => `${i + 1}. ${s.faction} - ${Number(s.score || 0).toLocaleString()} pts`),
          "",
          "Use `!faction join <name>` to join.",
        ].join("\n")));
        return;
      }

      if (command === "quests") {
        const q = await getQuestStatus(guildId, userId);
        await message.reply(v2TextPayload([
          "**Quests**",
          "",
          "**Daily**",
          `Hunts: ${q.daily.hunts}/3`,
          `Dungeons: ${q.daily.dungeons}/1`,
          `Gold spent: ${q.daily.gold_spent}/100`,
          `Status: ${q.dailyDone ? (q.daily.claimed ? "Claimed" : "Ready to claim") : "In progress"}`,
          "",
          "**Weekly**",
          `Damage: ${q.weekly.damage}/10000`,
          `Heals: ${q.weekly.heals}/5`,
          `Extreme gates: ${q.weekly.extreme_gate}/1`,
          `Status: ${q.weeklyDone ? (q.weekly.claimed ? "Claimed" : "Ready to claim") : "In progress"}`,
          "",
          "Use `!claimquests` to claim completed rewards.",
        ].join("\n")));
        return;
      }

      if (command === "claimquests") {
        const [daily, weekly] = await Promise.all([claimDailyRewards(guildId, userId), claimWeeklyRewards(guildId, userId)]);
        const rewards = [];
        if (daily.ok) {
          await addXpAndGold(userId, guildId, daily.rewards.xp, daily.rewards.gold);
          await addBuffTokenToInventory(userId, guildId, daily.rewards.buffToken);
          rewards.push(`Daily claimed: +${daily.rewards.xp} XP, +${daily.rewards.gold} Gold, XP buff token`);
        }
        if (weekly.ok) {
          await addXpAndGold(userId, guildId, weekly.rewards.xp, weekly.rewards.gold);
          await addBuffTokenToInventory(userId, guildId, weekly.rewards.buffToken);
          rewards.push(`Weekly claimed: +${weekly.rewards.xp} XP, +${weekly.rewards.gold} Gold, XP buff token`);
        }
        if (!rewards.length) return void (await message.reply(v2TextPayload("No quest rewards available to claim yet.")));
        await message.reply(v2TextPayload(["**Quest Rewards Claimed**", ...rewards].join("\n")));
        return;
      }

      if (command === "prestige") {
        const hunter = await ensureHunter({ userId, guildId });
        if (Number(hunter.level || 1) < 100) return void (await message.reply(v2TextPayload("You need level 100+ to prestige.")));
        await addPrestige(guildId, userId);
        await updateUser(userId, guildId, {
          level: 1,
          exp: 0,
          rank: "E-Rank",
          stat_points: Number(hunter.stat_points || 0) + 50,
          shadow_slots: Number(hunter.shadow_slots || 1) + 1,
          gold: Number(hunter.gold || 0) + 5000,
        });
        await message.reply(v2TextPayload("Prestige complete. You were reset to Level 1 and gained bonus rewards (gold, points, shadow slot)."));
        return;
      }

      if (command === "setupguild") {
        const sub = String(args.shift() || "").toLowerCase();
        if (sub === "create") {
          const name = args.join(" ").trim();
          if (!name) return void (await message.reply(v2TextPayload("Usage: `!setupguild create <name>`")));
          const created = await createClan({ discordGuildId: guildId, ownerUserId: userId, name });
          if (!created.ok) {
            if (created.reason === "level_too_low") return void (await message.reply(v2TextPayload(`You need level ${created.requiredLevel}+ to create a guild.`)));
            if (created.reason === "already_in_clan") return void (await message.reply(v2TextPayload("You are already in a guild.")));
            return void (await message.reply(v2TextPayload("Guild creation failed.")));
          }
          await message.reply(v2TextPayload(`Guild created: **${created.clan.name}**\nClan ID: \`${created.clan.clan_id}\``));
          return;
        }
        if (sub === "join") {
          const clanId = String(args[0] || "").trim();
          if (!clanId) return void (await message.reply(v2TextPayload("Usage: `!setupguild join <clanId>`")));
          const joined = await joinClan({ discordGuildId: guildId, userId, clanId });
          if (!joined.ok) {
            if (joined.reason === "level_too_low") return void (await message.reply(v2TextPayload("You need level 20+ to join a guild.")));
            if (joined.reason === "already_in_clan") return void (await message.reply(v2TextPayload("You are already in a guild.")));
            if (joined.reason === "clan_missing") return void (await message.reply(v2TextPayload("Clan ID not found.")));
            return void (await message.reply(v2TextPayload("Could not join guild.")));
          }
          const guildJoinAchs = await checkUnlocks(userId, guildId, ["guild_join"]);
          const gjText = guildJoinAchs.length ? ` | 🏅 ${guildJoinAchs[0].emoji} **${guildJoinAchs[0].title}**` : "";
          await message.reply(v2TextPayload(`Joined guild: **${joined.clan.name}**${gjText}`));
          return;
        }
        if (sub === "leave") {
          const left = await leaveClan({ discordGuildId: guildId, userId });
          if (!left.ok) {
            if (left.reason === "not_in_clan") return void (await message.reply(v2TextPayload("You are not in a guild.")));
            if (left.reason === "owner_cannot_leave") return void (await message.reply(v2TextPayload("Guild owner cannot leave. Transfer or disband first.")));
            return void (await message.reply(v2TextPayload("Could not leave guild.")));
          }
          await message.reply(v2TextPayload(`You left guild: **${left.clan.name}**`));
          return;
        }
        if (sub === "info" || !sub) {
          const target = message.mentions.users.first() || message.author;
          const clan = await getClanByMember(guildId, target.id);
          if (!clan) return void (await message.reply(v2TextPayload(`${target} is not in a guild.`)));
          const members = await listClanMembers(guildId, clan.clan_id);
          await message.reply(v2TextPayload([
            `**${clan.name}**`,
            `ID: \`${clan.clan_id}\``,
            `Owner: <@${clan.owner_user_id}>`,
            `Members: ${members.length}`,
            `Score: ${clan.score || 0} | W/L: ${clan.wins || 0}/${clan.losses || 0}`,
            clan.logo_url ? `Logo: ${clan.logo_url}` : "Logo: not set",
            clan.description ? `Description: ${clan.description}` : "Description: not set",
          ].join("\n")));
          return;
        }
        if (sub === "members") {
          const clan = await getClanByMember(guildId, userId);
          if (!clan) return void (await message.reply(v2TextPayload("You are not in a guild.")));
          const members = await listClanMembers(guildId, clan.clan_id);
          await message.reply(v2TextPayload([`**${clan.name} members**`, ...members.map((m) => `- <@${m.user_id}> (${m.role})`)].join("\n")));
          return;
        }
        if (sub === "name") {
          const newName = args.join(" ").trim().slice(0, 40);
          if (!newName) return void (await message.reply(v2TextPayload("Usage: `!setupguild name <new name>`")));
          const updated = await updateClanConfig({ discordGuildId: guildId, ownerUserId: userId, patch: { name: newName } });
          if (!updated.ok) return void (await message.reply(v2TextPayload("Only guild owner can update guild settings.")));
          await message.reply(v2TextPayload(`Guild renamed to **${updated.clan.name}**`));
          return;
        }
        if (sub === "logo") {
          const logoUrl = String(args[0] || "").trim();
          if (!logoUrl) return void (await message.reply(v2TextPayload("Usage: `!setupguild logo <url>`")));
          const updated = await updateClanConfig({ discordGuildId: guildId, ownerUserId: userId, patch: { logo_url: logoUrl } });
          if (!updated.ok) return void (await message.reply(v2TextPayload("Only guild owner can update guild settings.")));
          await message.reply(v2TextPayload("Guild logo updated."));
          return;
        }
        if (sub === "desc" || sub === "description") {
          const description = args.join(" ").trim().slice(0, 500);
          const updated = await updateClanConfig({ discordGuildId: guildId, ownerUserId: userId, patch: { description } });
          if (!updated.ok) return void (await message.reply(v2TextPayload("Only guild owner can update guild settings.")));
          await message.reply(v2TextPayload("Guild description updated."));
          return;
        }
        await message.reply(v2TextPayload("Unknown setupguild action. Use: create/join/leave/info/members/name/logo/desc"));
        return;
      }

      if (command === "guildbattle") {
        const targetOwner = message.mentions.users.first();
        if (!targetOwner) return void (await message.reply(v2TextPayload("Usage: `!guildbattle @guildOwner`.")));
        const result = await guildBattle({ discordGuildId: guildId, attackerOwnerId: userId, defenderOwnerId: targetOwner.id });
        if (!result.ok) {
          if (result.reason === "clan_missing") return void (await message.reply(v2TextPayload("Both guild owners must own a guild.")));
          if (result.reason === "same_clan") return void (await message.reply(v2TextPayload("Cannot battle the same guild.")));
          return void (await message.reply(v2TextPayload("Guild battle failed.")));
        }
        await message.reply(v2TextPayload([
          "**Guild Battle Result**",
          `${result.attacker.name} Power: ${result.attackerPower}`,
          `${result.defender.name} Power: ${result.defenderPower}`,
          `Winner: **${result.winner.name}**`,
          "All members got rewards.",
        ].join("\n")));
        return;
      }

      // ══════════════════════════════════════════════════════════════════════
      // NEW FUN FEATURES
      // ══════════════════════════════════════════════════════════════════════

      // ── !spin — Daily Reward System ───────────────────────────────────────
      if (command === "spin") {
        const hunter = await ensureHunter({ userId, guildId });
        const status = await getSpinStatus(userId, guildId);
        if (status.spun) {
          await message.reply(v2TextPayload([
            "🎁 **Daily Reward**",
            "",
            "You already claimed today’s reward. Come back tomorrow (resets midnight UTC).",
          ].join("\n")));
          return;
        }
        const spinResult = await performSpin(userId, guildId);
        if (!spinResult.ok) {
          await message.reply(v2TextPayload("🎁 Could not claim reward right now. Try again in a moment."));
          return;
        }
        // Apply rewards
        const progression = await addXpAndGold(userId, guildId, spinResult.xp, spinResult.gold);
        // Apply item if any
        if (spinResult.item) {
          const inv = Array.isArray(progression.hunter.inventory) ? [...progression.hunter.inventory] : [];
          inv.push(spinResult.item);
          await updateUser(userId, guildId, { inventory: inv });
        }
        // Check achievements
        const achKeys = buildCheckKeys(progression.hunter, { firstSpin: true, spinJackpot: spinResult.slot.weight === 1 });
        const newAchs = await checkUnlocks(userId, guildId, achKeys);
        let achText = "";
        if (newAchs.length) {
          achText = "\n\n🏅 **Achievement Unlocked:** " + newAchs.map((a) => `${a.emoji} ${a.title}`).join(", ");
        }
        const rarityColors = { Common: "⚪", Uncommon: "🟢", Rare: "🔵", Epic: "🟣", Legendary: "🟡" };
        const cardBuf = await generateSpinCard(message.author.username, spinResult.slot, spinResult.rarity, spinResult.xp, spinResult.gold, spinResult.item, progression.hunter.gold);
        await message.reply({ content: achText || undefined, files: [{ attachment: cardBuf, name: "spin.png" }] });
        return;
      }

      // ── !training — Training session (1h cooldown, +1 random stat) ────────────
      if (command === "training" || command === "train") {
        const cd = await getCooldown(userId, guildId, "training");
        if (cd && new Date(cd.available_at).getTime() > Date.now()) {
          return void (await message.reply(v2TextPayload(`⏳ Training cooldown: ${cooldownRemaining(cd.available_at)}s. Rest before your next session.`)));
        }

        const hunter = await ensureHunter({ userId, guildId });
        const arg0 = String(args[0] || "").toLowerCase();
        
        const exercise = getExercise(arg0) || getRandomExercise();
        const xp = randomInt(20, 45);
        const gold = randomInt(15, 35);
        
        const statKey = exercise.stat;
        const statBonus = `+${exercise.bonus} ${statKey.slice(0, 3).toUpperCase()}`;
        
        const progression = await addXpAndGold(userId, guildId, xp, gold);
        const currentVal = Number(progression.hunter[statKey] || 0);
        await updateUser(userId, guildId, { [statKey]: currentVal + exercise.bonus });
        await setCooldown(userId, guildId, "training", nextCooldown(3600));
        
        const cardBuf = await generateTrainingCard(
          message.author.username, 
          xp, 
          gold, 
          statBonus, 
          progression.hunter.gold,
          exercise.label,
          exercise.emoji
        );
        
        await message.reply({ files: [{ attachment: cardBuf, name: "training.png" }] });
        return;
      }

      // ── !expedition — 12h cooldown, come back with rewards ───────────────────
      if (command === "expedition" || command === "exp") {
        const cd = await getCooldown(userId, guildId, "expedition");
        if (cd && new Date(cd.available_at).getTime() > Date.now()) {
          return void (await message.reply(v2TextPayload(`⏳ Expedition cooldown: ${cooldownRemaining(cd.available_at)}s. Your hunter is still away.`)));
        }
        const hunter = await ensureHunter({ userId, guildId });
        const durationHours = 12;
        const xp = randomInt(80, 160) + Math.floor((hunter.level || 1) * 3);
        const gold = randomInt(60, 140) + Math.floor((hunter.level || 1) * 2);
        let itemFound = null;
        if (Math.random() <= 0.25) {
          const roll = randomInt(0, 2);
          const tokens = ["item:mana_potion", "raid_heal_kit", "material:shadow_essence"];
          const labels = ["Mana Potion", "Raid Medkit", "Shadow Essence"];
          itemFound = labels[roll];
          const inv = Array.isArray(hunter.inventory) ? [...hunter.inventory] : [];
          inv.push(tokens[roll]);
          await updateUser(userId, guildId, { inventory: inv });
        }
        const progression = await addXpAndGold(userId, guildId, xp, gold);
        await setCooldown(userId, guildId, "expedition", nextCooldown(43200));
        const cardBuf = await generateExpeditionCard(message.author.username, xp, gold, itemFound, progression.hunter.gold, durationHours);
        await message.reply({ files: [{ attachment: cardBuf, name: "expedition.png" }] });
        return;
      }

      // ── !boss — Daily solo boss (once per day) ───────────────────────────────
      if (command === "boss" || command === "dailyboss") {
        const cd = await getCooldown(userId, guildId, "boss");
        if (cd && new Date(cd.available_at).getTime() > Date.now()) {
          return void (await message.reply(v2TextPayload(`⏳ Daily boss cooldown: ${cooldownRemaining(cd.available_at)}s. Come back tomorrow.`)));
        }
        const hunter = await ensureHunter({ userId, guildId });
        const { getEquippedShadows } = require("../services/shadowService");
        const { getBattleBonus } = require("../services/cardsService");
        const shadows = await getEquippedShadows(userId, guildId);
        const cards = await getBattleBonus(hunter);
        const playerPower = computePower(hunter, shadows, cards.totalPower);
        const bossNames = ["Shadow Wolf", "Dungeon Guardian", "Cursed Knight", "Ice Serpent", "Flame Drake"];
        const bossName = bossNames[randomInt(0, bossNames.length - 1)];
        const level = Number(hunter.level) || 1;
        const bossPower = Math.floor((level * 8 + 40) * (1 + level * 0.02));
        const winChance = Math.min(92, Math.max(20, 50 + (playerPower - bossPower) * 0.4));
        const didWin = randomInt(1, 100) <= winChance;
        let xp = 0, gold = 0, penalty = 0;
        if (didWin) {
          xp = randomInt(100, 220) + level * 2;
          gold = randomInt(150, 350) + level * 3;
          const progression = await addXpAndGold(userId, guildId, xp, gold);
          await setCooldown(userId, guildId, "boss", nextCooldown(86400));
          const cardBuf = await generateBossResultCard(message.author.username, bossName, true, xp, gold, 0, progression.hunter.gold);
          await message.reply({ files: [{ attachment: cardBuf, name: "boss-result.png" }] });
        } else {
          penalty = randomInt(30, 80);
          await addXpAndGold(userId, guildId, Math.floor(25 + level), -penalty);
          await setCooldown(userId, guildId, "boss", nextCooldown(86400));
          const h = await getHunter(userId, guildId);
          const cardBuf = await generateBossResultCard(message.author.username, bossName, false, 0, 0, penalty, h.gold);
          await message.reply({ files: [{ attachment: cardBuf, name: "boss-result.png" }] });
        }
        return;
      }

      // ── !weekly — Weekly reward (7-day cooldown, rate limited) ─────────────
      if (command === "weekly") {
        const cd = await getCooldown(userId, guildId, "weekly");
        if (cd && new Date(cd.available_at).getTime() > Date.now()) {
          return void (await message.reply(v2TextPayload(`⏳ Weekly reward cooldown: ${cooldownRemaining(cd.available_at)}s. Come back next week.`)));
        }
        const hunter = await ensureHunter({ userId, guildId });
        const xp = randomInt(150, 320) + (hunter.level || 0) * 4;
        const gold = randomInt(200, 450) + (hunter.level || 0) * 5;
        const progression = await addXpAndGold(userId, guildId, xp, gold);
        await setCooldown(userId, guildId, "weekly", nextCooldown(604800));
        await message.reply(v2TextPayload([
          "📦 **Weekly Reward Claimed**",
          "",
          `+${xp} XP  ·  +${gold} Gold`,
          `Balance: ${Number(progression.hunter.gold || 0).toLocaleString()} G`,
          "",
          "Next weekly reward in 7 days.",
        ].join("\n")));
        return;
      }

      // ── !meditate — Rest & recover (10 min cooldown, rate limited) ──────────
      if (command === "meditate" || command === "meditation") {
        const cd = await getCooldown(userId, guildId, "meditate");
        if (cd && new Date(cd.available_at).getTime() > Date.now()) {
          return void (await message.reply(v2TextPayload(`⏳ Meditate cooldown: ${cooldownRemaining(cd.available_at)}s. Rest a bit longer.`)));
        }
        const hunter = await ensureHunter({ userId, guildId });
        const xp = randomInt(8, 18);
        const progression = await addXpAndGold(userId, guildId, xp, 0);
        await setCooldown(userId, guildId, "meditate", nextCooldown(600));
        await message.reply(v2TextPayload([
          "🧘 **Meditation Complete**",
          "",
          `You recovered focus. +${xp} XP`,
          "",
          "Next meditation in 10 minutes.",
        ].join("\n")));
        return;
      }

      // ── !challenge — Daily challenge (24h cooldown, rate limited) ───────────
      if (command === "challenge") {
        const cd = await getCooldown(userId, guildId, "challenge");
        if (cd && new Date(cd.available_at).getTime() > Date.now()) {
          return void (await message.reply(v2TextPayload(`⏳ Daily challenge cooldown: ${cooldownRemaining(cd.available_at)}s. New challenge tomorrow.`)));
        }
        const hunter = await ensureHunter({ userId, guildId });
        const challenges = [
          { name: "Swift Hunter", xp: 45, gold: 55 },
          { name: "Shadow Step", xp: 38, gold: 48 },
          { name: "Mana Focus", xp: 52, gold: 62 },
          { name: "Dungeon Scout", xp: 48, gold: 58 },
          { name: "Gate Crasher", xp: 55, gold: 70 },
        ];
        const c = challenges[randomInt(0, challenges.length - 1)];
        const progression = await addXpAndGold(userId, guildId, c.xp, c.gold);
        await setCooldown(userId, guildId, "challenge", nextCooldown(86400));
        await message.reply(v2TextPayload([
          "⚔️ **Daily Challenge Completed**",
          "",
          `**${c.name}** — Challenge complete!`,
          `+${c.xp} XP  ·  +${c.gold} Gold`,
          "",
          "Next challenge in 24 hours.",
        ].join("\n")));
        return;
      }

      // ── !eventstatus / !event — Your event stats (rate limited) ─────────────
      if (command === "eventstatus" || command === "event") {
        const hunter = await getHunter(userId, guildId).catch(() => null) || await ensureHunter({ userId, guildId });
        const stats = await getStats(guildId, userId).catch(() => null);
        const lb = await getLeaderboards(guildId).catch(() => null);
        const rank = (list, field) => {
          if (!list || !Array.isArray(list)) return { pos: null, value: null };
          const idx = list.findIndex((r) => String(r.user_id) === String(userId));
          if (idx < 0) return { pos: null, value: list[0] ? list[0][field] : null };
          return { pos: idx + 1, value: list[idx][field] };
        };
        const cp = rank(lb?.combatPower, "combat_power");
        const tg = rank(lb?.topGold, "top_gold");
        const dc = rank(lb?.dungeonClears, "dungeon_clears");
        const hd = rank(lb?.highestDamage, "highest_damage");
        const myFaction = await getFaction(guildId, userId).catch(() => null);
        const lines = [
          "📊 **Event Status**",
          "",
          "**Your ranks** (top 10 only)",
          `Combat Power: ${cp.pos ? `#${cp.pos}` : "—"} ${stats ? `(${Number(stats.combat_power || 0).toLocaleString()})` : ""}`,
          `Top Gold:     ${tg.pos ? `#${tg.pos}` : "—"} ${stats ? `(${Number(stats.top_gold || 0).toLocaleString()} G)` : ""}`,
          `Dungeon Clears: ${dc.pos ? `#${dc.pos}` : "—"} ${stats ? `(${stats.dungeon_clears || 0})` : ""}`,
          `Highest Damage: ${hd.pos ? `#${hd.pos}` : "—"} ${stats ? `(${Number(stats.highest_damage || 0).toLocaleString()})` : ""}`,
          "",
          `Weekly Score: **${Number(stats?.weekly_score || 0).toLocaleString()}**`,
          myFaction ? `Faction: **${myFaction}**` : "",
        ].filter(Boolean);
        await message.reply(v2TextPayload(lines.join("\n")));
        return;
      }

      // ── !streak — Daily Login Streak (with PNG card) ────────────────────────
      if (command === "streak") {
        const sub = String(args[0] || "").toLowerCase();
        if (!sub || sub === "info" || sub === "status") {
          const status = await getStreakStatus(userId, guildId);
          const cardBuf = await generateStreakCard(
            message.author.username,
            status.currentStreak,
            status.longestStreak,
            status.nextReward || { xp: 20, gold: 30, bonus: null },
            status.claimedToday
          );
          const nr = status.nextReward || { xp: 20, gold: 30, bonus: null };
          await message.reply({
            content: status.claimedToday
              ? "✅ Already claimed today. Come back tomorrow!"
              : `🎁 Use \`!streak claim\` for +${nr.xp} XP, +${nr.gold} Gold${nr.bonus ? " + item" : ""}`,
            files: [{ attachment: cardBuf, name: "streak.png" }],
          });
          return;
        }
        if (sub === "claim") {
          const result = await claimStreak(userId, guildId);
          if (!result.ok) {
            if (result.reason === "already_claimed") {
              const status = await getStreakStatus(userId, guildId);
              const cardBuf = await generateStreakCard(message.author.username, status.currentStreak, status.longestStreak, status.nextReward || { xp: 20, gold: 30, bonus: null }, true);
              await message.reply({ content: "✅ **Already claimed today!**", files: [{ attachment: cardBuf, name: "streak.png" }] });
            } else {
              await message.reply(v2TextPayload("❌ Could not claim streak. Try again in a moment."));
            }
            return;
          }
          const progression = await addXpAndGold(userId, guildId, result.xp, result.gold);
          if (result.bonus) {
            const inv = Array.isArray(progression.hunter.inventory) ? [...progression.hunter.inventory] : [];
            inv.push(result.bonus);
            await updateUser(userId, guildId, { inventory: inv });
          }
          const achKeys = buildCheckKeys(progression.hunter, { streak: result.newStreak });
          const newAchs = await checkUnlocks(userId, guildId, achKeys);
          const achText = newAchs.length ? "\n\n🏅 **Achievement Unlocked:** " + newAchs.map((a) => `${a.emoji} ${a.title}`).join(", ") : "";
          const brokenText = result.broken ? "\n> ⚠️ Streak broken! Starting fresh from Day 1." : "";
          const status = await getStreakStatus(userId, guildId);
          const cardBuf = await generateStreakCard(message.author.username, status.currentStreak, status.longestStreak, status.nextReward, true);
          await message.reply({
            content: [
              `${result.emoji} **Streak Claimed!** — ${result.newStreak} day(s)${brokenText}`,
              `+${result.xp} XP, +${result.gold} Gold${result.bonus ? ` + \`${result.bonus}\`` : ""}`,
              achText,
            ].filter(Boolean).join("\n"),
            files: [{ attachment: cardBuf, name: "streak.png" }],
          });
          return;
        }
        await message.reply(v2TextPayload("Usage: `!streak` to see status, `!streak claim` to claim today's reward."));
        return;
      }

      // ── !achievements — Badge System ───────────────────────────────────────
      if (command === "achievements" || command === "badges" || command === "ach") {
        const achs = await getUserAchievements(userId, guildId);
        const unlocked = achs.filter((a) => a.unlocked);
        const locked   = achs.filter((a) => !a.unlocked);
        const lines = [
          `🏅 **Hunter Achievements** — ${unlocked.length}/${achs.length} unlocked`,
          "",
          "**Unlocked:**",
        ];
        if (unlocked.length) {
          for (const a of unlocked) lines.push(`${a.emoji} **${a.title}** — ${a.desc}`);
        } else {
          lines.push("*None yet — get hunting!*");
        }
        lines.push("", "**Locked:**");
        for (const a of locked.slice(0, 8)) lines.push(`🔒 ~~${a.title}~~ — ${a.desc}`);
        if (locked.length > 8) lines.push(`...and ${locked.length - 8} more hidden achievements.`);
        await message.reply(v2TextPayload(lines.join("\n")));
        return;
      }

      // ── !lootbox — Open a Loot Box ─────────────────────────────────────────
      if (command === "lootbox" || command === "openbox") {
        const tierArg = String(args[0] || "").toLowerCase();
        if (!tierArg || !LOOT_BOX_VALID_TIERS.includes(tierArg)) {
          await message.reply(v2TextPayload([
            "📦 **Loot Box Opener**",
            "",
            `Usage: \`!lootbox <tier>\``,
            `Available tiers: ${LOOT_BOX_VALID_TIERS.map((t) => `\`${t}\``).join(", ")}`,
            "",
            "Buy boxes from \`!shop\` first, then open them here!",
          ].join("\n")));
          return;
        }
        const hunter = await ensureHunter({ userId, guildId });
        const boxes = countBoxes(hunter);
        if (!boxes[tierArg]) {
          await message.reply(v2TextPayload([
            `📦 You don't have a **${tierArg}** Loot Box in your inventory!`,
            `Buy one from \`!shop\` first.`,
            `Your boxes: ${Object.entries(boxes).filter(([,v]) => v > 0).map(([k,v]) => `${k}×${v}`).join(", ") || "None"}`,
          ].join("\n")));
          return;
        }
        const result = await openBoxAndLog(hunter, tierArg);
        if (!result.ok) {
          const errMessages = {
            no_box:       "You don't have that box type in your inventory.",
            invalid_tier: "Unknown box tier. Use: common, rare, epic, legendary.",
          };
          await message.reply(v2TextPayload(`❌ ${errMessages[result.reason] || "Could not open box. Try again."}`));
          return;
        }
        // Apply rewards
        await updateUser(userId, guildId, { inventory: result.newInventory });
        const progression = await addXpAndGold(userId, guildId, result.xp, result.gold);
        const achKeys = buildCheckKeys(progression.hunter, {});
        const newAchs = await checkUnlocks(userId, guildId, achKeys);
        const achText = newAchs.length ? "\n\n🏅 **Achievement:** " + newAchs.map((a) => `${a.emoji} ${a.title}`).join(", ") : "";
        const cardBuf = await generateLootboxCard(message.author.username, result.label, result.rarity, result.xp, result.gold, result.items, progression.hunter.gold);
        await message.reply({ content: achText || undefined, files: [{ attachment: cardBuf, name: "lootbox.png" }] });
        return;
      }


      if (command === "dungeonlist") {
        const bosses = getRaidBossNames();
        await message.reply(v2TextPayload([
          "**Dungeon Boss List**",
          bosses.map((b, i) => `${i + 1}. ${b}`).join("\n"),
          "",
          "**Possible Drops**",
          "- Unique card (very rare)",
          "- XP and Gold",
          "- Dungeon reward items",
        ].join("\n")));
        return;
      }

      await message.reply(buildStatusPayload(message, { ok: false, text: "Unknown prefix command. Use !help or ?help.", ephemeral: false }));
    } catch (error) {
      console.error(error);
      await message.reply(buildStatusPayload(message, { ok: false, text: "An unexpected error occurred. Please try again.", ephemeral: false }));
    }
  },
};
