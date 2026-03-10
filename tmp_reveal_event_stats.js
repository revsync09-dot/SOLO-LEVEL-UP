require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const GUILD_ID = '1425973312588091394';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.once('ready', async () => {
  console.log(`[revealer] Logged in as ${client.user.tag}`);
  
  try {
    const { data: eventStats, error } = await supabase.from('event_user_stats').select('user_id').eq('guild_id', GUILD_ID);
    if (error) throw error;
    
    console.log(`[revealer] We have ${eventStats.length} event_user_stats to update.`);
    let count = 0;
    
    for (const statRow of eventStats) {
      try {
        const user = await client.users.fetch(statRow.user_id);
        if (user) {
          const username = user.username;
          const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 }) || null;
          
          await supabase.from('event_user_stats')
            .update({ username, avatar_url: avatarUrl })
            .eq('user_id', statRow.user_id)
            .eq('guild_id', GUILD_ID);
            
          // and let's update hunters table too just in case
          await supabase.from('hunters')
            .update({ username, avatar_url: avatarUrl })
            .eq('user_id', statRow.user_id)
            .eq('guild_id', GUILD_ID);
            
          count++;
          if (count % 10 === 0) console.log(`[revealer] Updated ${count} / ${eventStats.length}`);
        }
      } catch (e) {
         console.log(`Could not fetch user ${statRow.user_id}: ${e.message}`);
      }
    }
    
    console.log(`[revealer] Done! Updated metadata for ${count} users.`);
  } catch (err) {
    console.error(err);
  } finally {
    client.destroy();
    process.exit(0);
  }
});

client.login(process.env.DISCORD_TOKEN);
