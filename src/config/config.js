function getConfig() {
  const mode = String(process.env.BOT_MODE || "live").toLowerCase();
  const isTestMode = mode === "test";
  const token =
    (isTestMode ? process.env.DISCORD_TOKEN_TEST : null) ||
    process.env.DISCORD_TOKEN;
  const clientId =
    (isTestMode ? process.env.DISCORD_CLIENT_ID_TEST : null) ||
    process.env.DISCORD_CLIENT_ID;
  const DEFAULT_LOCKED_GUILD_ID = "1425973312588091394";
  const DEFAULT_LOCKED_COMMAND_CHANNEL_ID = "1477018034169188362";
  const LOCKED_GUILD_ID =
    process.env.BOT_LOCKED_GUILD_ID ||
    (isTestMode ? process.env.BOT_LOCKED_GUILD_ID_TEST : null) ||
    DEFAULT_LOCKED_GUILD_ID;
  const LOCKED_COMMAND_CHANNEL_ID =
    process.env.BOT_COMMAND_CHANNEL_ID ||
    (isTestMode ? process.env.BOT_COMMAND_CHANNEL_ID_TEST : null) ||
    DEFAULT_LOCKED_COMMAND_CHANNEL_ID;
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  if (!isTestMode) required.push("DISCORD_TOKEN", "DISCORD_CLIENT_ID");
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  if (process.env.DISCORD_GUILD_ID && process.env.DISCORD_GUILD_ID !== LOCKED_GUILD_ID) {
    console.warn(
      `[config:warn] DISCORD_GUILD_ID (${process.env.DISCORD_GUILD_ID}) ignored. Bot is locked to ${LOCKED_GUILD_ID}.`
    );
  }

  return {
    botMode: mode,
    discordToken: token,
    discordClientId: clientId,
    discordGuildId: LOCKED_GUILD_ID,
    commandChannelId: LOCKED_COMMAND_CHANNEL_ID,
    portalChannelId: process.env.PORTAL_CHANNEL_ID || null,
    portalSpawnMinutes: Number(process.env.PORTAL_SPAWN_MINUTES || 60),
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

module.exports = { getConfig };