const { SlashCommandBuilder } = require("discord.js");
const { ensureHunter } = require("../services/hunterService");
const { supabase } = require("../lib/supabase");

const ALLOWED_USERS = new Set(["795466540140986368", "760194150452035595"]);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats_giving")
    .setDescription("Admin: Recover lost stats / bulk give stat points to ALL users or a specific user.")
    .addSubcommand(subcmd => 
      subcmd.setName("all")
        .setDescription("Give stats to ALL human users in the server (takes ~1 min)")
        .addIntegerOption(opt => opt.setName("amount").setDescription("Amount of stat points to give everyone").setRequired(true))
    )
    .addSubcommand(subcmd =>
      subcmd.setName("user")
        .setDescription("Give stats to a specific user")
        .addUserOption(opt => opt.setName("target").setDescription("User to give stats to").setRequired(true))
        .addIntegerOption(opt => opt.setName("amount").setDescription("Amount of stat points").setRequired(true))
    ),
  async execute(interaction) {
    if (!ALLOWED_USERS.has(interaction.user.id)) {
      await interaction.reply({ content: "You do not have permission to use this master command.", ephemeral: true });
      return;
    }

    const commandStr = interaction.options.getSubcommand();
    const amount = interaction.options.getInteger("amount");

    if (amount <= 0 || amount > 1000000) {
      await interaction.reply({ content: "Amount must be between 1 and 1,000,000.", ephemeral: true });
      return;
    }

    try {
      await interaction.deferReply({ ephemeral: false });

      if (commandStr === "all") {
        await interaction.editReply(`⚙️ Initializing mass stat distribution of **${amount} points** to every member in the server... This will take roughly 30-60 seconds... Please wait!`);

        const guild = await interaction.client.guilds.fetch(interaction.guildId);
        await guild.members.fetch(); 
        const members = Array.from(guild.members.cache.values()).filter(m => !m.user.bot);

        let successCount = 0;
        const chunkSize = 15; // Handle 15 members at a time so we don't accidentally overload rate limits

        for (let i = 0; i < members.length; i += chunkSize) {
          const chunk = members.slice(i, i + chunkSize);
          
          await Promise.all(chunk.map(async (member) => {
            try {
              const prevHunter = await ensureHunter({
                userId: member.id,
                guildId: interaction.guildId,
                username: member.user.username,
                avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 256 })
              });

              if (prevHunter) {
                const nextPoints = Number(prevHunter.stat_points || 0) + amount;
                await supabase
                  .from("hunters")
                  .update({ stat_points: nextPoints })
                  .eq("user_id", member.id)
                  .eq("guild_id", interaction.guildId);
                successCount++;
              }
            } catch (err) {
              // Simply ignore users who fail to save silently to keep process moving
            }
          }));

          // Progress update message every ~300 users
          if (i > 0 && i % 300 === 0) {
            await interaction.editReply(`♻️ **Progress:** Processed ${i} / ${members.length} members so far...`);
          }
        }

        await interaction.editReply(`✅ **Mass Distribution Complete!**\nSuccessfully distributed **+${amount} Stat Points** to **${successCount} / ${members.length}** Discord hunters! All stats are saved.`);
        
      } else if (commandStr === "user") {
        const targetUser = interaction.options.getUser("target");
        
        await interaction.editReply(`⚙️ Processing stat distribution to ${targetUser.username}...`);
        
        const prevHunter = await ensureHunter({
          userId: targetUser.id,
          guildId: interaction.guildId,
          username: targetUser.username,
          avatarUrl: targetUser.displayAvatarURL({ extension: "png", size: 256 })
        });

        if (prevHunter) {
          const nextPoints = Number(prevHunter.stat_points || 0) + amount;
          await supabase
            .from("hunters")
            .update({ stat_points: nextPoints })
            .eq("user_id", targetUser.id)
            .eq("guild_id", interaction.guildId);
            
          await interaction.editReply(`✅ **Success!** Granted **+${amount} Stat Points** to ${targetUser}. (New Total: ${nextPoints} points)`);
        } else {
          await interaction.editReply(`❌ Failed to load or register hunter data for ${targetUser}.`);
        }
      }
    } catch (error) {
      console.error("[stats_giving:error]", error);
      try {
        await interaction.editReply({ content: "An unexpected error occurred during distribution." });
      } catch (e) {
        // silent
      }
    }
  }
};
