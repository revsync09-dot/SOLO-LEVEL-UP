const { SlashCommandBuilder } = require("discord.js");
const { ensureHunter } = require("../services/hunterService");
const { runPvp } = require("../services/pvpService");
const { generateBattleResultCard } = require("../services/cardGenerator");
const { getCooldown, setCooldown } = require("../services/cooldownService");
const { cooldownRemaining, nextCooldown } = require("../utils/cooldownHelper");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("battle")
    .setDescription("Battle another hunter (PvP).")
    .addUserOption((option) => option.setName("opponent").setDescription("Target hunter").setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const cd = await getCooldown(interaction.user.id, interaction.guildId, "battle");
    if (cd && new Date(cd.available_at).getTime() > Date.now()) {
      await interaction.editReply({ content: `Battle cooldown active: ${cooldownRemaining(cd.available_at)}s` });
      return;
    }

    const opponent = interaction.options.getUser("opponent", true);
    if (opponent.bot || opponent.id === interaction.user.id) {
      await interaction.editReply({ content: "Choose a valid opponent." });
      return;
    }

    const attacker = await ensureHunter({ userId: interaction.user.id, guildId: interaction.guildId });
    const defender = await ensureHunter({ userId: opponent.id, guildId: interaction.guildId });
    const result = await runPvp(attacker, defender);

    const card = await generateBattleResultCard(attacker, defender, result);
    await interaction.editReply({
      content:
        `Rounds: ${result.rounds} | ` +
        `${result.attackerWon ? interaction.user.username : opponent.username} won\n` +
        `You: +${result.rewards?.attacker?.xp || 0} XP, +${result.rewards?.attacker?.gold || 0} Gold`,
      files: [{ attachment: card, name: "battle-result.png" }],
    });
    await setCooldown(interaction.user.id, interaction.guildId, "battle", nextCooldown(300));
  },
};