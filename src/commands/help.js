const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");
const { getHelpEmoji } = require("../config/emojis");

module.exports = {
  data: new SlashCommandBuilder().setName("help").setDescription("Show clear command guide for players."),
  async execute(interaction) {
    const lines = [
      `${getHelpEmoji()} **Solo Leveling Help**`,
      "",
      "**Start Here**",
      "`/start` create your hunter profile",
      "`/hunt` earn XP + gold",
      "`/profile` and `/stats` check your progress",
      "",
      "**Main Gameplay**",
      "Auto dungeon events spawn in the configured channel",
      "`/battle` fight another player for rewards",
      "`/shop` buy items",
      "`/use` activate bought items/skills",
      "`/class` view or change class (needs Reawakened Stone)",
      "`/inventory` and `/cards` view items/cards",
      "",
      "**Event Features**",
      "`!leaderboard` top combat power, gold, clears, damage",
      "`!faction` and `!faction join <name>`",
      "`!quests` and `!claimquests`",
      "`!prestige` (level 100+)",
      "",
      "**Guild Features**",
      "`!setupguild create <name>` (level 20+)",
      "`!setupguild join <clanId>`",
      "`!setupguild info` / `!setupguild members`",
      "`!guildbattle @owner`",
      "",
      "**Tip**",
      "Use `!help` for prefix command guide.",
    ];

    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join("\n"))
    );

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  },
};

