const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  TextDisplayBuilder,
} = require("discord.js");

const { getRaidIds } = require("../config/emojis");

function raidEmojiIds() {
  return getRaidIds();
}

function buildLobbyPayload(view) {
  const top = [
    "**Dungeon Raid Lobby**",
    `Session: \`${view.id}\``,
    `Difficulty: **${view.difficultyLabel}** | Rounds: **${view.maxRounds}**`,
  ].join("\n");

  const party = [
    "**Hunters Inside**",
    ...(view.players.length ? view.players.map((p, i) => `${i + 1}. ${p.mention}`) : ["No one joined yet."]),
    "",
    "Press **Join** to enter. Press **Start Raid** to begin.",
  ].join("\n");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`raid_join:${view.id}`).setLabel("Join").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`raid_start:${view.id}`).setLabel("Start Raid").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`raid_cancel:${view.id}`).setLabel("Cancel").setStyle(ButtonStyle.Secondary)
  );

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(top))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("_______________________________"))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(party))
    .addActionRowComponents(row);

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildBattlePayload(view) {
  const bossTop = [
    `**Boss: ${view.boss.name}**`,
    `Round: **${view.round}/${view.maxRounds}** | Difficulty: **${view.difficultyLabel}**`,
    `HP: ${view.bossHpBar}`,
  ].join("\n");

  const playerList = [
    "**Player Status**",
    ...view.players.map(
      (p) =>
        `${p.mention} | DMG **${p.totalDamage}** | HP ${p.hpBar} | Kits ${p.healKits} | ${
          p.dead ? "DEFEATED" : p.afkTimeout ? "AFK" : p.acted ? "Acted" : "Ready"
        }`
    ),
  ].join("\n");

  const combatLog = [
    "**Combat Log**",
    ...((view.combatLog || []).slice(0, 6)),
  ].join("\n");

  const ids = raidEmojiIds();
  const attackBtn = new ButtonBuilder()
    .setCustomId(`raid_act:${view.id}:attack`)
    .setLabel("Attack")
    .setStyle(ButtonStyle.Danger);
  if (ids.attack && String(ids.attack).trim()) attackBtn.setEmoji({ id: String(ids.attack).trim() });
  const guardBtn = new ButtonBuilder()
    .setCustomId(`raid_act:${view.id}:guard`)
    .setLabel("Guard")
    .setStyle(ButtonStyle.Secondary);
  if (ids.guard && String(ids.guard).trim()) guardBtn.setEmoji({ id: String(ids.guard).trim() });
  const skillBtn = new ButtonBuilder()
    .setCustomId(`raid_act:${view.id}:skill`)
    .setLabel("Skill")
    .setStyle(ButtonStyle.Primary);
  if (ids.skill && String(ids.skill).trim()) skillBtn.setEmoji({ id: String(ids.skill).trim() });
  const row = new ActionRowBuilder().addComponents(
    attackBtn,
    guardBtn,
    skillBtn,
    new ButtonBuilder().setCustomId(`raid_act:${view.id}:heal`).setLabel("Heal").setStyle(ButtonStyle.Success)
  );

  const container = new ContainerBuilder();
  if (view.roundBannerUrl) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(view.roundBannerUrl))
    );
  }
  container
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(bossTop))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("_______________________________"))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(playerList))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(combatLog))
    .addActionRowComponents(row);

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

/** Final battle state when raid ended – no buttons so no one can click and get "Action failed". */
function buildBattleEndedPayload(view, won) {
  const bossTop = [
    `**Boss: ${view.boss?.name ?? "—"}**`,
    `Round: **${view.round}/${view.maxRounds}** | ${won ? "Cleared" : "Failed"}`,
    view.bossHpBar ? `HP: ${view.bossHpBar}` : "—",
  ].join("\n");

  const playerList = [
    "**Player Status**",
    ...(view.players || []).map(
      (p) =>
        `${p.mention} | DMG **${p.totalDamage}** | HP ${p.hpBar} | ${p.dead ? "DEFEATED" : "Alive"}`
    ),
  ].join("\n");

  const combatLog = ["**Combat Log**", ...((view.combatLog || []).slice(0, 6))].join("\n");
  const footer = "**Raid ended.** See rewards below. Do not use the buttons on this message.";
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(bossTop))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("_______________________________"))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(playerList))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(combatLog))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer));
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

/** Shown when someone clicks on an already-ended raid (session missing) – removes buttons. */
function buildRaidExpiredPayload() {
  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent("**This raid has already ended.** Buttons were removed to avoid errors.")
  );
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildDefeatedPayload(view) {
  const lines = ["**Defeated Hunters**", ...(view.defeated.length ? view.defeated : ["No one is defeated."])];
  const container = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")));
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildRewardsPayload(view, won) {
  const mvpPlayer = (view.players || []).reduce((best, p) => {
    if (!best) return p;
    return Number(p.totalDamage || 0) > Number(best.totalDamage || 0) ? p : best;
  }, null);

  const lines = [
    `**Raid ${won ? "Cleared" : "Failed"}**`,
    `Boss: **${view.boss.name}**`,
    mvpPlayer ? `**MVP:** <@${mvpPlayer.userId}> | Damage: **${Number(mvpPlayer.totalDamage || 0)}**` : "**MVP:** None",
    "_______________________________",
    "**Rewards**",
    ...view.rewards.map((r) => {
      const card = r.card ? ` | Card: **${r.card}**` : "";
      const mvp = r.mvp ? " | MVP" : "";
      const dmg = ` | DMG ${Number(r.damage || 0)}`;
      return `<@${r.userId}> -> XP ${r.xp} | Gold ${r.gold}${dmg}${mvp}${card}`;
    }),
  ];

  const container = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")));
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

module.exports = {
  buildLobbyPayload,
  buildBattlePayload,
  buildBattleEndedPayload,
  buildRaidExpiredPayload,
  buildDefeatedPayload,
  buildRewardsPayload,
};
