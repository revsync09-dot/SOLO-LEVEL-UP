const { SlashCommandBuilder } = require("discord.js");
const { getLeaderboards } = require("../services/eventService");

function ellipsizeToken(str, max) {
  if (!str) return "Unknown";
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + "...";
}

function formatRows(rows, keyField, nameMap) {
  if (!rows || rows.length === 0) return "No data";
  return rows.slice(0, 10).map((r, i) => {
    const val = r[keyField];
    const name = ellipsizeToken(r.username || nameMap.get(r.user_id) || "Hunter", 12);
    return `${i + 1}. **${name}** - ${Number(val).toLocaleString()}`;
  }).join("\n");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View the top hunters in various categories."),
  async execute(interaction) {
    await interaction.deferReply();
    const lb = await getLeaderboards(interaction.guildId);
    
    const userIds = new Set();
    const addToSet = (arr) => { if (arr) arr.forEach(r => userIds.add(r.user_id)); };
    addToSet(lb.combatPower);
    addToSet(lb.dungeonClears);
    addToSet(lb.highestDamage);

    const nameMap = new Map();
    if (userIds.size > 0 && interaction.guild) {
      try {
        const members = await interaction.guild.members.fetch({ user: Array.from(userIds) });
        members.forEach(m => nameMap.set(m.id, m.user.username));
      } catch (err) {}
    }

    const embed = {
      title: "🏆 Global Hunter Leaderboards",
      color: 0x0099ff,
      fields: [
        { name: "⚔️ Combat Power", value: formatRows(lb.combatPower, "combat_power", nameMap), inline: true },
        { name: "🛡️ Dungeon Clears", value: formatRows(lb.dungeonClears, "dungeon_clears", nameMap), inline: true },
        { name: "💥 Highest Damage", value: formatRows(lb.highestDamage, "highest_damage", nameMap), inline: true },
      ],
      footer: { text: "Data is synchronized globally." }
    };

    await interaction.editReply({ embeds: [embed] });
  },
};
