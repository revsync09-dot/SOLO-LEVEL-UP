const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder } = require("discord.js");

const HELP_EMOJI = "<:help:976524440080883802>";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all bot commands and features."),
    
  async execute(interaction) {
    const lines = [
      `${HELP_EMOJI} **Solo Leveling Help**`,
      "",
      "**Slash Commands**",
      "`/start` - Register your hunter profile",
      "`/profile` - View your profile card",
      "`/hunt` - Start a hunt (chance for unique card)",
      "`/dungeon` - Start a dungeon run",
      "`/class` - View or change your class",
      "`/inventory` - View your inventory",
      "`/cards` - View your card collection",
      "`/stats` - Show detailed stats",
      "`/rankup` - Take the rank exam",
      "`/battle` - PvP battle against another hunter",
      "`/shop` - Open the shop",
      "`/use` - Use a purchased item",
      "`/help` - Show this help menu",
      "",
      "**Prefix Commands (`!` and `?`)**",
      "`!help` or `?help` - Show help menu",
      "`!profile` or `?profile` - View profile",
      "`!hunt` or `?hunt` - Start hunt",
      "`!stats` or `?stats` - Show stats",
      "`!class <type>` - Change class",
      "`!dungeon <difficulty>` - Start dungeon",
      "",
      "**System Info**",
      "Unique card available: **Shadow Monarch**",
      "Card drop chance: **0.025%**",
      "Auto dungeon event spawns every 1 hour",
    ];

    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join("\n"))
    );

    const { MessageFlags } = require("discord.js");
    let flags = 0;
    if (MessageFlags && MessageFlags.IsComponentsV2) flags |= MessageFlags.IsComponentsV2;
    if (MessageFlags && MessageFlags.Ephemeral) flags |= MessageFlags.Ephemeral;
    else flags |= 64;

    await interaction.reply({
      components: [container],
      flags,
    });
  },
};