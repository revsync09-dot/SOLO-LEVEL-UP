const { SlashCommandBuilder } = require("discord.js");
const { ensureHunter } = require("../services/hunterService");
const { buildShopPayload } = require("../services/shopService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Open the Hunter Shop and buy items with Gold."),

  async execute(interaction) {
    const hunter = await ensureHunter({
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    await interaction.reply(buildShopPayload({ userId: interaction.user.id, hunter, page: 0 }));
  },
};
