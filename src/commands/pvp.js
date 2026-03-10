const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { ensureHunter } = require("../services/hunterService");
const { runPvp } = require("../services/pvpService");
const { generateBattleResultCard } = require("../services/cardGenerator");
const { getCooldown, setCooldown } = require("../services/cooldownService");
const { cooldownRemaining, nextCooldown } = require("../utils/cooldownHelper");

const pvpLocks = new Set();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pvp")
    .setDescription("Challenge another Hunter.")
    .addUserOption((option) => option.setName("opponent").setDescription("Hunter to challenge").setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const lockKey = `pvp:${interaction.guildId}:${interaction.user.id}`;
    if (pvpLocks.has(lockKey)) {
      await interaction.editReply({ content: "Please wait — a battle is already in progress." });
      return;
    }
    pvpLocks.add(lockKey);
    setTimeout(() => pvpLocks.delete(lockKey), 12_000);

    const cd = await getCooldown(interaction.user.id, interaction.guildId, "battle");
    if (cd && new Date(cd.available_at).getTime() > Date.now()) {
      pvpLocks.delete(lockKey);
      await interaction.editReply({ content: `Battle cooldown active: ${cooldownRemaining(cd.available_at)}s` });
      return;
    }

    const opponentUser = interaction.options.getUser("opponent", true);

    if (opponentUser.bot || opponentUser.id === interaction.user.id) {
      pvpLocks.delete(lockKey);
      await interaction.editReply({ content: "Choose a valid human opponent." });
      return;
    }

    const attacker = await ensureHunter({ userId: interaction.user.id, guildId: interaction.guildId });
    const defender = await ensureHunter({ userId: opponentUser.id, guildId: interaction.guildId });
    const result = await runPvp(attacker, defender);

    const card = await generateBattleResultCard(
      { username: interaction.user.username },
      { username: opponentUser.username },
      result
    );
    await interaction.editReply({
      content:
        `Rounds: ${result.rounds} | ` +
        `${result.attackerWon ? interaction.user.username : opponentUser.username} won\n` +
        `You: +${result.rewards?.attacker?.xp || 0} XP, +${result.rewards?.attacker?.gold || 0} Gold`,
      files: [{ attachment: card, name: "pvp-result.png" }],
    });
    await setCooldown(interaction.user.id, interaction.guildId, "battle", nextCooldown(300));
  },
};