const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { ensureHunter } = require("../services/hunterService");
const {
  HUNTER_CLASSES,
  getHunterClass,
  consumeReawakenedStoneAndSetClass,
  normalizeClass,
} = require("../services/classService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("class")
    .setDescription("Show or change your hunter class (requires Reawakened Stone).")
    .addStringOption((opt) =>
      opt
        .setName("set")
        .setDescription("Class to switch to")
        .setRequired(false)
        .addChoices(...HUNTER_CLASSES.map((cls) => ({ name: cls, value: cls })))
    ),
  async execute(interaction) {
    const hunter = await ensureHunter({ userId: interaction.user.id, guildId: interaction.guildId });
    const next = interaction.options.getString("set");
    const current = getHunterClass(hunter);

    if (!next) {
      await interaction.reply({
        content: `Current class: **${current}**\nAvailable classes: ${HUNTER_CLASSES.join(", ")}\nUse \`/class set:<name>\` with a **Reawakened Stone** in inventory.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const target = normalizeClass(next);
    if (target === current) {
      await interaction.reply({ content: `You are already **${current}**.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const changed = await consumeReawakenedStoneAndSetClass(hunter, target);
    if (!changed.ok) {
      await interaction.reply({
        content: "You need a **Reawakened Stone** in your inventory to change class.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: `Class changed to **${changed.className}**. Reawakened Stone consumed.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};