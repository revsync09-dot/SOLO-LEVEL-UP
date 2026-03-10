const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { ensureHunter, getHunter, xpRequired } = require("../services/hunterService");
const { generateStatsCard } = require("../services/cardGenerator");
const { getEquippedShadows } = require("../services/shadowService");
const { getBattleBonus, getOwnedCards } = require("../services/cardsService");
const { computePower } = require("../services/combatService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Display detailed combat stats.")
    .addUserOption((option) =>
      option.setName("user").setDescription("View stats for another hunter").setRequired(false)
    ),
  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (e) {
      
    }

    try {
      const targetUser = interaction.options.getUser("user") || interaction.user;
      if (targetUser.bot) {
        await interaction.editReply({ content: "Bots do not have hunter stats." });
        return;
      }

      let hunter;
      if (targetUser.id === interaction.user.id) {
        hunter = await ensureHunter({ userId: interaction.user.id, guildId: interaction.guildId });
      } else {
        hunter = await getHunter(targetUser.id, interaction.guildId);
        if (!hunter) {
          await interaction.editReply({ content: `${targetUser.username} has no hunter profile in this server yet.` });
          return;
        }
      }

      const [equippedShadows, cardBonus, ownedCards] = await Promise.all([
        getEquippedShadows(targetUser.id, interaction.guildId),
        getBattleBonus(hunter),
        getOwnedCards(hunter),
      ]);

      const shadowPower = equippedShadows.reduce((sum, s) => sum + s.base_damage + s.ability_bonus, 0);
      const basePower = computePower(hunter, []);
      const finalPower = computePower(hunter, equippedShadows, cardBonus.totalPower);
      const expNeeded = xpRequired(hunter.level);
      const topCards = cardBonus.cards.map((c) => c.name).slice(0, 3).join(", ") || "None";

      const card = await generateStatsCard(targetUser, hunter, {
        expNeeded,
        basePower,
        shadowPower,
        cardPower: cardBonus.totalPower,
        finalPower,
        equippedShadows: equippedShadows.length,
        shadowSlots: hunter.shadow_slots,
        ownedCards: ownedCards.length,
        topCards,
      });

      await interaction.editReply({
        files: [{ attachment: card, name: "stats-card.png" }],
      });
    } catch (error) {
      console.error("[stats:error]", error);
      try {
        await interaction.editReply({ content: "Error generating stats card." });
      } catch (e) {
        
      }
    }
  },
};