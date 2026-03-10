const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { ensureHunter } = require("../services/hunterService");
const { profileRows } = require("../handlers/components");
const { generateProfileCard } = require("../services/cardGenerator");

module.exports = {
  data: new SlashCommandBuilder().setName("profile").setDescription("Show your Hunter profile and allocate stats."),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const hunter = await ensureHunter({ 
      userId: interaction.user.id, 
      guildId: interaction.guildId,
      username: interaction.user.username,
      avatarUrl: interaction.user.displayAvatarURL({ extension: "png", size: 256 })
    });
    const card = await generateProfileCard(interaction.user, hunter);
    await interaction.editReply({
      files: [{ attachment: card, name: "profile-card.png" }],
      components: profileRows(interaction.user.id),
    });
  },
};