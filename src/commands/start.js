const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { ensureHunter } = require("../services/hunterService");
const { generateStartCard } = require("../services/cardGenerator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("start")
    .setDescription("Register as a Hunter and enter the Solo Leveling RPG."),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const hunter = await ensureHunter({ userId: interaction.user.id, guildId: interaction.guildId });
    const card = await generateStartCard(interaction.user, hunter);
    await interaction.editReply({
      files: [{ attachment: card, name: "start-card.png" }],
    });
  },
};