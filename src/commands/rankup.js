const { SlashCommandBuilder } = require("discord.js");
const { ensureHunter } = require("../services/hunterService");
const { sendStatus } = require("../utils/statusMessage");
const { RANKS, RANK_THRESHOLDS } = require("../utils/constants");
const { updateUser } = require("../services/database");
const { generateRankupCard } = require("../services/cardGenerator");

module.exports = {
  data: new SlashCommandBuilder().setName("rankup").setDescription("Take rank exam when level requirement is met."),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const hunter = await ensureHunter({ userId: interaction.user.id, guildId: interaction.guildId });
    const currentIndex = RANKS.indexOf(hunter.rank);
    if (currentIndex < 0 || currentIndex >= RANKS.length - 1) {
      await interaction.editReply({ content: "You are already at the maximum rank." });
      return;
    }

    const nextRank = RANKS[currentIndex + 1];
    const requiredLevel = RANK_THRESHOLDS[nextRank];
    const examCost = 300 + currentIndex * 250;

    if (hunter.level < requiredLevel) {
      await interaction.editReply({ content: `You need level ${requiredLevel} for rank ${nextRank}.` });
      return;
    }
    if (hunter.gold < examCost) {
      await interaction.editReply({ content: `Not enough gold. Required: ${examCost}.` });
      return;
    }

    await updateUser(interaction.user.id, interaction.guildId, { rank: nextRank, gold: hunter.gold - examCost });
    const card = await generateRankupCard(interaction.user, nextRank, hunter.rank);
    await interaction.editReply({ files: [{ attachment: card, name: "rankup-card.png" }] });
  },
};