/**
 * Backfill script to "reveal" all hunters by fetching their Discord names and avatars.
 */
require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const GUILD_ID = '1425973312588091394';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.once('ready', async () => {
  console.log(`[revealer] Logged in as ${client.user.tag}`);
  
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    console.log(`[revealer] Fetching members from guild: ${guild.name}`);
    await guild.members.fetch();
    const members = guild.members.cache;
    console.log(`[revealer] Found ${members.size} members in cache.`);

    const { data: hunters, error } = await supabase.from('hunters').select('user_id').eq('guild_id', GUILD_ID);
    if (error) throw error;
    
    console.log(`[revealer] Backfilling metadata for ${hunters.length} hunters...`);

    let count = 0;
    for (const hunter of hunters) {
      const member = members.get(hunter.user_id);
      if (member) {
        const username = member.user.username;
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        
        // Update hunters table
        await supabase.from('hunters')
          .update({ username, avatar_url: avatarUrl })
          .eq('user_id', hunter.user_id)
          .eq('guild_id', GUILD_ID);
          
        // Update event_user_stats table
        await supabase.from('event_user_stats')
          .update({ username, avatar_url: avatarUrl })
          .eq('user_id', hunter.user_id)
          .eq('guild_id', GUILD_ID);

        count++;
        if (count % 10 === 0) console.log(`[revealer] Updated ${count} hunters...`);
      }
    }

    console.log(`[revealer] Success! Updated ${count} out of ${hunters.length} hunters.`);
  } catch (err) {
    console.error('[revealer:error]', err);
  } finally {
    client.destroy();
    process.exit(0);
  }
});

client.login(process.env.DISCORD_TOKEN);
