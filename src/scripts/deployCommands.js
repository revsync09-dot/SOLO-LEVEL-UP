require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");
const { getConfig } = require("../config/config");

async function deploy() {
  const config = getConfig();
  const commands = [];
  const commandsPath = path.join(__dirname, "..", "commands");
  const disabledCommandFiles = new Set(["dungeon.js"]);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js") && !disabledCommandFiles.has(file));

  for (const file of commandFiles) {
    try {
      const command = require(path.join(commandsPath, file));
      if (command.data) commands.push(command.data.toJSON());
    } catch (e) {
      console.error(`Error loading command from ${file}:`, e);
      throw e;
    }
  }

  const rest = new REST({ version: "10" }).setToken(config.discordToken);

  if (config.discordGuildId) {
    await rest.put(Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId), { body: commands });
    console.log(`Deployed ${commands.length} guild commands to ${config.discordGuildId}`);
    return;
  }

  await rest.put(Routes.applicationCommands(config.discordClientId), { body: commands });
  console.log(`Deployed ${commands.length} global commands`);
}

deploy().catch((error) => {
  console.error(error);
  process.exit(1);
});