const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { ensureHunter } = require("../services/hunterService");
const { generateInventoryCard } = require("../services/cardGenerator");

module.exports = {
  data: new SlashCommandBuilder().setName("inventory").setDescription("Show your inventory items."),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const hunter = await ensureHunter({ userId: interaction.user.id, guildId: interaction.guildId });
    const card = await generateInventoryCard(interaction.user, hunter);
    await interaction.editReply({
      files: [{ attachment: card, name: "inventory-card.png" }],
    });
  },
};