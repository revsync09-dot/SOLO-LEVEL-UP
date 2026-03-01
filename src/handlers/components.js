const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const { allocateStat, getHunter, ensureHunter, xpRequired } = require("../services/hunterService");
const { runDungeon } = require("../services/dungeonService");
const { DUNGEON_DIFFICULTIES } = require("../utils/constants");
const { listShadows, equipShadow } = require("../services/shadowService");
const { tryGrantSingleCard } = require("../services/cardsService");
const { sendStatus } = require("../utils/statusMessage");
const { generateProfileCard, generateShadowCard } = require("../services/cardGenerator");
const { updateUser } = require("../services/database");
const { sendProgressionBanner } = require("../utils/progressionBanner");
const { applyPurchase, buildShopPayload, buildShopRowsForMessage, buildShopText, clampPage, getItem } = require("../services/shopService");
const { reserveSpawnJoin, finishSpawnJoin } = require("../services/autoDungeonService");
const { tryGrantMonarchRole } = require("../utils/rewardRoles");
const { buildDungeonResultV2Payload } = require("../utils/dungeonResultV2");
const {
  getSession,
  joinLobby,
  startRaid,
  performAction,
  forceNextRound,
  summary,
  removeSession,
  recoverLobbyFromMessage,
} = require("../services/raidDungeonService");
const {
  buildLobbyPayload,
  buildBattlePayload,
  buildDefeatedPayload,
  buildRewardsPayload,
} = require("../utils/raidV2Renderer");

function isDuplicateInteractionError(error) {
  return Boolean(error && (error.code === 40060 || error.code === 10062));
}

async function safeInteractionCall(fn) {
  try {
    return await fn();
  } catch (error) {
    if (isDuplicateInteractionError(error)) return null;
    throw error;
  }
}

function buildShopUpdatePayload(params) {
  const payload = buildShopPayload(params);
  payload.content = null;
  return payload;
}

function buildClassicShopPayload({ userId, hunter, page = 0, selectedKey = null, notice = "" }) {
  return {
    content: buildShopText({ hunter, page, selectedKey, notice }),
    components: buildShopRowsForMessage({ userId, page, selectedKey }),
  };
}

function buildRaidUpdatePayload(params) {
  const payload = { ...params };
  payload.content = null;
  return payload;
}

function profileRows(userId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`alloc:${userId}:strength`).setLabel("+STR").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`alloc:${userId}:agility`).setLabel("+AGI").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`alloc:${userId}:intelligence`).setLabel("+INT").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`alloc:${userId}:vitality`).setLabel("+VIT").setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`shadows:${userId}`).setLabel("View Shadows").setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function dungeonSelectionRows(userId) {
  const options = Object.entries(DUNGEON_DIFFICULTIES).map(([value, cfg]) => ({
    label: cfg.label,
    value,
    description: `Multiplier x${cfg.multiplier}`,
  }));

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`dungeon_select:${userId}`)
        .setPlaceholder("Choose difficulty")
        .addOptions(options)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`dungeon_confirm:${userId}:normal`)
        .setLabel("Confirm run")
        .setStyle(ButtonStyle.Success)
    ),
  ];
}

function shadowsRow(userId, shadows) {
  const equipable = shadows.filter((s) => !s.equipped).slice(0, 4);
  if (!equipable.length) return [];

  return [
    new ActionRowBuilder().addComponents(
      ...equipable.map((shadow) =>
        new ButtonBuilder()
          .setCustomId(`shadow_equip:${userId}:${shadow.id}`)
          .setLabel(`Equip ${shadow.rarity} ${shadow.name}`)
          .setStyle(ButtonStyle.Secondary)
      )
    ),
  ];
}

function dungeonLootText(result, monarchGranted = false) {
  const parts = [];
  if (result.weaponDrop) parts.push(`Weapon: ${result.weaponDrop}`);
  if (result.companionDrop) parts.push(`Companion: ${result.companionDrop}`);
  if (result.statusEffects?.length) parts.push(`Status: ${result.statusEffects.join(", ")}`);
  if (monarchGranted) parts.push("Shadow Monarch Role obtained");
  if (!parts.length) return null;
  return parts.join(" | ");
}

async function handleComponent(interaction) {
  const [action, ownerId, value] = interaction.customId.split(":");

  if (action === "raid_join" && interaction.isButton()) {
    const sessionId = interaction.customId.split(":")[1];
    let joined = await joinLobby(sessionId, interaction.user.id, interaction.guildId);
    if (!joined.ok && joined.reason === "missing") {
      recoverLobbyFromMessage({
        sessionId,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        message: interaction.message,
      });
      joined = await joinLobby(sessionId, interaction.user.id, interaction.guildId);
    }
    if (!joined.ok) {
      const map = {
        missing: "This raid session no longer exists.",
        started: "Raid already started. You can no longer join.",
        wrong_guild: "This raid belongs to another server.",
        full: "This raid is full.",
      };
      await sendStatus(interaction, { ok: false, text: map[joined.reason] || "Unable to join this raid session.", ephemeral: true });
      return;
    }
    await safeInteractionCall(() =>
      interaction.update(buildRaidUpdatePayload(buildLobbyPayload(summary(joined.session))))
    );
    return;
  }

  if (action === "raid_start" && interaction.isButton()) {
    const sessionId = interaction.customId.split(":")[1];
    let started = await startRaid(sessionId, interaction.user.id);
    if (!started.ok && started.reason === "missing") {
      recoverLobbyFromMessage({
        sessionId,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        message: interaction.message,
      });
      started = await startRaid(sessionId, interaction.user.id);
    }
    if (!started.ok) {
      const text =
        started.reason === "owner_only"
          ? "Only the lobby owner can start."
          : started.reason === "empty"
            ? "No hunters joined this raid."
            : "Cannot start this raid now.";
      await sendStatus(interaction, { ok: false, text, ephemeral: true });
      return;
    }
    await safeInteractionCall(() =>
      interaction.update(buildRaidUpdatePayload(buildBattlePayload(summary(started.session), interaction.user.id)))
    );
    return;
  }

  if (action === "raid_act" && (interaction.isButton() || interaction.isStringSelectMenu())) {
    const [, sessionId, actType] = interaction.customId.split(":");
    let act = actType;
    if (interaction.isStringSelectMenu() && actType === "skill_select") {
      act = interaction.values[0]; // e.g. "skill:flame_slash"
    }
    
    const result = await performAction(sessionId, interaction.user.id, act);
    if (!result.ok) {
      const map = {
        not_joined: "You are not inside this raid.",
        dead: "You are defeated in this raid.",
        already_acted: "You already acted this round.",
        no_heal_item: "You need Raid Medkit from /shop to heal.",
      };
      await sendStatus(interaction, { ok: false, text: map[result.reason] || "Action failed.", ephemeral: true });
      return;
    }

    const view = summary(result.session);
    await safeInteractionCall(() =>
      interaction.update(buildRaidUpdatePayload(buildBattlePayload(view, interaction.user.id)))
    );

    if (result.ended) {
      const won = Boolean(result.finalResult && result.finalResult.won);
      if (view.defeated.length) {
        await safeInteractionCall(() => interaction.followUp(buildDefeatedPayload(view)));
      }
      await safeInteractionCall(() => interaction.followUp(buildRewardsPayload(view, won)));
      removeSession(sessionId);
    }
    return;
  }

  if (action === "raid_next" && interaction.isButton()) {
    const sessionId = interaction.customId.split(":")[1];
    const progressed = await forceNextRound(sessionId, interaction.user.id);
    if (!progressed.ok) {
      await sendStatus(interaction, { ok: false, text: "You must be inside this raid.", ephemeral: true });
      return;
    }
    const session = progressed.session || getSession(sessionId);
    const view = summary(session);
    await safeInteractionCall(() =>
      interaction.update(buildRaidUpdatePayload(buildBattlePayload(view, interaction.user.id)))
    );
    if (progressed.ended && session && session.state === "ended") {
      if (view.defeated.length) {
        await safeInteractionCall(() => interaction.followUp(buildDefeatedPayload(view)));
      }
      const won = Boolean(progressed.finalResult && progressed.finalResult.won);
      await safeInteractionCall(() => interaction.followUp(buildRewardsPayload(view, won)));
      removeSession(sessionId);
    }
    return;
  }

  if (action === "raid_cancel" && interaction.isButton()) {
    const sessionId = interaction.customId.split(":")[1];
    const session = getSession(sessionId);
    if (!session || session.ownerId !== interaction.user.id) {
      await sendStatus(interaction, { ok: false, text: "Only the owner can cancel this raid.", ephemeral: true });
      return;
    }
    removeSession(sessionId);
    await safeInteractionCall(() => interaction.update({
      components: [],
    }));
    await sendStatus(interaction, { ok: true, text: "Raid lobby canceled.", ephemeral: false });
    return;
  }

  if (action === "auto_dungeon_join" && interaction.isButton()) {
    const [, , difficulty = "normal", spawnId = "0"] = interaction.customId.split(":");
    const joinCheck = reserveSpawnJoin(spawnId, interaction.user.id);
    if (!joinCheck.ok) {
      if (joinCheck.reason === "already_joined") {
        await sendStatus(interaction, {
          ok: false,
          text: "You already joined this dungeon spawn.",
          ephemeral: true,
        });
        return;
      }
      const seconds = Math.max(1, Math.ceil(Number(joinCheck.retryAfterMs || 0) / 1000));
      await sendStatus(interaction, {
        ok: false,
        text: `Join cooldown active for this spawn: ${seconds}s`,
        ephemeral: true,
      });
      return;
    }

    await safeInteractionCall(() => interaction.deferReply({ ephemeral: true }));
    try {
      const hunter = await ensureHunter({ userId: interaction.user.id, guildId: interaction.guildId });
      const result = await runDungeon(hunter, difficulty);
      let monarchGranted = false;
      if (result.didWin && result.monarchRoleRollWon) {
        const roleResult = await tryGrantMonarchRole(interaction.guild, interaction.user.id);
        monarchGranted = roleResult.granted;
      }
      const cardDrop = await tryGrantSingleCard(result.progression?.hunter || hunter);
      const lootText = dungeonLootText(result, monarchGranted);
      await safeInteractionCall(() =>
        interaction.editReply(
          buildDungeonResultV2Payload(result, {
            lootText: cardDrop.granted
              ? `${lootText ? `${lootText} | ` : ""}Card unlocked: ${cardDrop.card.name} (0.0025%)`
              : lootText || "",
            ephemeral: true,
          })
        )
      );
      finishSpawnJoin(spawnId, interaction.user.id, true);
      await sendProgressionBanner(interaction, result.progression);
      return;
    } catch (error) {
      finishSpawnJoin(spawnId, interaction.user.id, false);
      throw error;
    }
  }

  if (!ownerId || ownerId !== interaction.user.id) {
    await sendStatus(interaction, {
      ok: false,
      text: "This interaction belongs to another hunter.",
      ephemeral: true,
    });
    return;
  }

  if (action === "alloc" && interaction.isButton()) {
    const stat = value;
    const result = await allocateStat(interaction.user.id, interaction.guildId, stat, 1);
    if (!result.ok) {
      await sendStatus(interaction, {
        ok: false,
        text: "No stat points available.",
        ephemeral: true,
      });
      return;
    }
    const profileCard = await generateProfileCard(interaction.user, result.hunter);
    await safeInteractionCall(() => interaction.update({
      content: "",
      files: [{ attachment: profileCard, name: "profile-card.png" }],
      components: profileRows(interaction.user.id),
    }));
    return;
  }

  if (action === "dungeon_select" && interaction.isStringSelectMenu()) {
    const selected = interaction.values[0];
    await safeInteractionCall(() => interaction.update({
      content: `Selected difficulty: **${DUNGEON_DIFFICULTIES[selected].label}**`,
      components: [
        interaction.message.components[0],
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`dungeon_confirm:${interaction.user.id}:${selected}`)
            .setLabel("Confirm run")
          .setStyle(ButtonStyle.Success)
        ),
      ],
    }));
    return;
  }

  if (action === "dungeon_confirm" && interaction.isButton()) {
    const difficulty = interaction.customId.split(":")[2];
    const hunter = await ensureHunter({ userId: interaction.user.id, guildId: interaction.guildId });
    const result = await runDungeon(hunter, difficulty);
    let monarchGranted = false;
    if (result.didWin && result.monarchRoleRollWon) {
      const roleResult = await tryGrantMonarchRole(interaction.guild, interaction.user.id);
      monarchGranted = roleResult.granted;
    }
    const cardDrop = await tryGrantSingleCard(result.progression?.hunter || hunter);
    const lootText = dungeonLootText(result, monarchGranted);
    await safeInteractionCall(() => interaction.update({
      content: "Dungeon run finished. See the detailed result below.",
      components: dungeonSelectionRows(interaction.user.id),
    }));
    await safeInteractionCall(() =>
      interaction.followUp(
        buildDungeonResultV2Payload(result, {
          lootText: cardDrop.granted
            ? `${lootText ? `${lootText} | ` : ""}Card unlocked: ${cardDrop.card.name} (0.0025%)`
            : lootText || "",
          ephemeral: true,
        })
      )
    );
    await sendProgressionBanner(interaction, result.progression);
    return;
  }

  if (action === "shadows" && interaction.isButton()) {
    const shadows = await listShadows(interaction.user.id, interaction.guildId);
    if (!shadows.length) {
      await sendStatus(interaction, {
        ok: false,
        text: "No shadows collected yet. Clear dungeons to trigger ARISE.",
        ephemeral: true,
      });
      return;
    }

    const card = await generateShadowCard(shadows, interaction.user.username);
    await safeInteractionCall(() => interaction.reply({
      content: "Shadow Army",
      files: [{ attachment: card, name: "shadows.png" }],
      components: shadowsRow(interaction.user.id, shadows),
      ephemeral: true,
    }));
    return;
  }

  if (action === "shadow_equip" && interaction.isButton()) {
    const shadowId = interaction.customId.split(":")[2];
    const hunter = await getHunter(interaction.user.id, interaction.guildId);
    const result = await equipShadow(interaction.user.id, interaction.guildId, shadowId, hunter.shadow_slots);

    if (!result.ok) {
      let message = "Cannot equip shadow.";
      if (result.reason === "slots_full") message = "All shadow slots are full.";
      if (result.reason === "already_equipped") message = "Shadow is already equipped.";
      await sendStatus(interaction, {
        ok: false,
        text: message,
        ephemeral: true,
      });
      return;
    }

    await sendStatus(interaction, {
      ok: true,
      text: `Equipped ${result.shadow.rarity} ${result.shadow.name}.`,
      ephemeral: true,
    });
    return;
  }

  if (action === "shop_select" && interaction.isStringSelectMenu()) {
    const page = clampPage(interaction.customId.split(":")[2]);
    const selected = interaction.values[0];
    const hunter = await getHunter(interaction.user.id, interaction.guildId);
    if (!hunter) {
      await sendStatus(interaction, { ok: false, text: "Hunter profile not found.", ephemeral: true });
      return;
    }
    await safeInteractionCall(() =>
      interaction.update(
        buildShopUpdatePayload({ userId: interaction.user.id, hunter, page, selectedKey: selected })
      )
    );
    return;
  }

  if (action === "shop_buy" && interaction.isStringSelectMenu()) {
    const selected = interaction.values[0];
    const item = getItem(selected);
    const hunter = await getHunter(interaction.user.id, interaction.guildId);
    if (!item || !hunter) {
      await sendStatus(interaction, { ok: false, text: "Shop item is unavailable.", ephemeral: true });
      return;
    }
    if (hunter.gold < item.price) {
      await sendStatus(interaction, { ok: false, text: `Not enough gold. Required: ${item.price}.`, ephemeral: true });
      return;
    }
    const patch = applyPurchase(hunter, item);
    await updateUser(interaction.user.id, interaction.guildId, patch);
    await sendStatus(interaction, {
      ok: true,
      text: `Purchased ${item.name} for ${item.price} gold.`,
      ephemeral: true,
    });
    return;
  }

  if ((action === "shop_prev" || action === "shop_next") && interaction.isButton()) {
    const [, , pageRaw, selectedRaw] = interaction.customId.split(":");
    const page = clampPage(pageRaw);
    const nextPage = action === "shop_prev" ? page - 1 : page + 1;
    const hunter = await getHunter(interaction.user.id, interaction.guildId);
    if (!hunter) {
      await sendStatus(interaction, { ok: false, text: "Hunter profile not found.", ephemeral: true });
      return;
    }
    await safeInteractionCall(() =>
      interaction.update(
        buildShopUpdatePayload({
          userId: interaction.user.id,
          hunter,
          page: nextPage,
          selectedKey: selectedRaw && selectedRaw !== "none" ? selectedRaw : null,
        })
      )
    );
    return;
  }

  if (action === "shop_buy" && interaction.isButton()) {
    const [, , pageRaw, selectedRaw] = interaction.customId.split(":");
    const page = clampPage(pageRaw);
    const selectedKey = selectedRaw && selectedRaw !== "none" ? selectedRaw : null;
    const item = getItem(selectedKey);
    if (!item) {
      await sendStatus(interaction, { ok: false, text: "Select an item first.", ephemeral: true });
      return;
    }
    const hunter = await getHunter(interaction.user.id, interaction.guildId);
    if (!hunter) {
      await sendStatus(interaction, { ok: false, text: "Hunter profile not found.", ephemeral: true });
      return;
    }
    if (hunter.gold < item.price) {
      await safeInteractionCall(() =>
        interaction.update(
          buildShopUpdatePayload({
            userId: interaction.user.id,
            hunter,
            page,
            selectedKey: item.key,
            notice: `<:e:1006637475067859105> Not enough gold. You need **${item.price - Number(hunter.gold || 0)}** more gold.`,
          })
        )
      );
      return;
    }
    const patch = applyPurchase(hunter, item);
    const updated = await updateUser(interaction.user.id, interaction.guildId, patch);
    await safeInteractionCall(() =>
      interaction.update(
        buildShopUpdatePayload({
          userId: interaction.user.id,
          hunter: updated,
          page,
          selectedKey: item.key,
          notice: `<a:e:1473670205094887474> **${item.name}** purchased for **${item.price} gold**! Check /inventory to see it.`,
        })
      )
    );
    return;
  }
}

module.exports = { handleComponent, profileRows, dungeonSelectionRows };