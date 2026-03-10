const {
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  TextDisplayBuilder,
} = require("discord.js");

const { getDungeonResultEmojis } = require("../config/emojis");

const DUNGEON_IMAGE_A = process.env.DUNGEON_RESULT_IMAGE_A || null;
const DUNGEON_IMAGE_B = process.env.DUNGEON_RESULT_IMAGE_B || null;

function dungeonSummaryLines(result, lootText) {
  const EMOJI = getDungeonResultEmojis();
  const lines = [
    `**${result.didWin ? "Dungeon Clear" : "Dungeon Failed"}**`,
    `${EMOJI.str} Your Power: **${Number(result.playerPower || 0)}**`,
    `${EMOJI.agi} Enemy Power: **${Number(result.enemyPower || 0)}**`,
    `${EMOJI.xp} XP: **${result.didWin ? `+${result.xp || 0}` : "minor"}**`,
    `${EMOJI.gold} Gold: **${result.didWin ? `+${result.gold || 0}` : `-${result.penaltyGold || 0}`}**`,
  ];

  if (lootText) lines.push(`Loot: ${lootText}`);
  return lines;
}

function maybeGallery() {
  const urls = [DUNGEON_IMAGE_A, DUNGEON_IMAGE_B].filter(Boolean);
  if (!urls.length) return null;

  const gallery = new MediaGalleryBuilder();
  urls.slice(0, 2).forEach((url) => {
    gallery.addItems(new MediaGalleryItemBuilder().setURL(url));
  });
  return gallery;
}

function buildDungeonResultV2Payload(result, { lootText = "", ephemeral = true } = {}) {
  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(dungeonSummaryLines(result, lootText).join("\n"))
  );

  const gallery = maybeGallery();
  if (gallery) {
    container.addMediaGalleryComponents(gallery);
  }

  let flags = MessageFlags.IsComponentsV2;
  if (ephemeral) flags |= MessageFlags.Ephemeral;

  return {
    components: [container],
    flags,
  };
}

module.exports = { buildDungeonResultV2Payload };