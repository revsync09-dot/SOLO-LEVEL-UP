const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { ensureHunter } = require("../services/hunterService");
const { generateCardsCollectionCard } = require("../services/cardGenerator");
const { getOwnedCards } = require("../services/cardsService");

module.exports = {
  data: new SlashCommandBuilder().setName("cards").setDescription("Show your full card collection as PNG."),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const hunter = await ensureHunter({ userId: interaction.user.id, guildId: interaction.guildId });
    const owned = await getOwnedCards(hunter);
    const cards = owned.map((card) => ({
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
    const collection = await generateCardsCollectionCard(interaction.user.username, cards);

    await interaction.editReply({
      files: [{ attachment: collection, name: "cards-collection.png" }],
    });
  },
};