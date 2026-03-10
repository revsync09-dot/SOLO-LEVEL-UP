const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { ensureHunter, addXpAndGold } = require("../services/hunterService");
const { getCooldown, setCooldown, remainingSeconds } = require("../services/cooldownService");
const { randomInt } = require("../utils/math");
const { generateSalaryCard } = require("../services/cardGenerator");

module.exports = {
  data: new SlashCommandBuilder().setName("guild_salary").setDescription("Claim your daily guild salary."),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await ensureHunter({ userId: interaction.user.id, guildId: interaction.guildId });

    const cooldown = await getCooldown(interaction.user.id, interaction.guildId, "guild_salary");
    if (cooldown && new Date(cooldown.available_at).getTime() > Date.now()) {
      const seconds = remainingSeconds(cooldown.available_at);
      await interaction.editReply({ content: `Guild salary is on cooldown. Try again in ${seconds}s.` });
      return;
    }

    const gold = randomInt(200, 350);
    const xp = randomInt(30, 65);
    const progression = await addXpAndGold(interaction.user.id, interaction.guildId, xp, gold);
    const tomorrow = new Date(Date.now() + 24 * 180 * 180 * 1000).toISOString();
    await setCooldown(interaction.user.id, interaction.guildId, "guild_salary", tomorrow);

    const card = await generateSalaryCard(interaction.user, gold, progression.hunter.gold);
    await interaction.editReply({ files: [{ attachment: card, name: "salary-card.png" }] });
  },
};