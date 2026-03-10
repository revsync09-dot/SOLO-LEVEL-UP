const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getLeaderboards } = require("../services/eventService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View the top hunters in various categories."),
  async execute(interaction) {
    await interaction.deferReply();
    const lb = await getLeaderboards(interaction.guildId);
    
    // We can't use the V2 components easily here without a lot of overhead,
    // so we'll just provide a nice link to the web leaderboard which is much better anyway.
    
    const embed = {
      title: "🏆 Global Hunter Leaderboards",
      description: "Click the button below to view the full, real-time leaderboard on our high-speed intelligence dashboard.",
      color: 0x0099ff,
      fields: [
        { name: "Combat Power", value: lb.combatPower?.length ? "Rankings available online" : "No data", inline: true },
        { name: "Dungeon Clears", value: lb.dungeonClears?.length ? "Rankings available online" : "No data", inline: true },
      ],
      footer: { text: "Data synchronized with hunters' database." }
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Open Live Leaderboard")
        .setStyle(ButtonStyle.Link)
        .setURL("https://solo-level-up-delta.vercel.app/leaderboard")
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};
