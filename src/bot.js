const dotenvPath = process.env.DOTENV_CONFIG_PATH || process.env.BOT_ENV_FILE || ".env";
require("dotenv").config({ path: dotenvPath });

const fs = require("fs");
const http = require("http");
console.log("🚀 SOLO LEVELING BOT V2.1 STARTING (Node.js)");
const path = require("path");
const { Client, Collection, GatewayIntentBits } = require("discord.js");
const { getConfig } = require("./config/config");

const config = getConfig();
const INSTANCE_LOCK_PATH = path.join(process.cwd(), ".solo-leveling.bot.lock");
const ENABLE_SINGLE_INSTANCE_LOCK = String(process.env.SINGLE_INSTANCE_LOCK || "false").toLowerCase() === "true";

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireSingleInstanceLock() {
  if (!ENABLE_SINGLE_INSTANCE_LOCK) return;
  if (fs.existsSync(INSTANCE_LOCK_PATH)) {
    const raw = fs.readFileSync(INSTANCE_LOCK_PATH, "utf8").trim();
    const existingPid = Number(raw);
    if (isProcessRunning(existingPid) && existingPid !== process.pid) {
      console.error(
        `[startup:error] Another bot instance is already running (PID ${existingPid}). Stop it before starting a new one.`
      );
      process.exit(1);
    }
  }

  fs.writeFileSync(INSTANCE_LOCK_PATH, String(process.pid), "utf8");
}

function cleanupInstanceLock() {
  if (!ENABLE_SINGLE_INSTANCE_LOCK) return;
  try {
    if (!fs.existsSync(INSTANCE_LOCK_PATH)) return;
    const raw = fs.readFileSync(INSTANCE_LOCK_PATH, "utf8").trim();
    if (Number(raw) === process.pid) {
      fs.unlinkSync(INSTANCE_LOCK_PATH);
    }
  } catch (error) {
    console.error("[lock:cleanup:error]", error);
  }
}

acquireSingleInstanceLock();

process.on("exit", cleanupInstanceLock);
process.on("SIGINT", () => {
  cleanupInstanceLock();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanupInstanceLock();
  process.exit(0);
});

function startHealthServer() {
  const port = Number(process.env.PORT || 8080);
  const server = http.createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end("ok");
      return;
    }
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("Solo Leveling bot is running");
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`[health] Port ${port} already in use, skipping health server.`);
    } else {
      console.error("[health:error]", err);
    }
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(`[health] listening on 0.0.0.0:${port}`);
  });
}

startHealthServer();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
client.commands = new Collection();

process.on("unhandledRejection", (error) => {
  console.error("[unhandledRejection]", error);
});

process.on("uncaughtException", (error) => {
  console.error("[uncaughtException]", error);
});

client.on("error", (error) => {
  console.error("[client:error]", error);
});

client.on("shardError", (error) => {
  console.error("[client:shardError]", error);
});

const commandsPath = path.join(__dirname, "commands");
const DISABLED_COMMAND_FILES = new Set(["dungeon.js"]);
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js") && !DISABLED_COMMAND_FILES.has(f))) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
  }
}

const eventsPath = path.join(__dirname, "events");
for (const file of fs.readdirSync(eventsPath).filter((f) => f.endsWith(".js"))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

client.login(config.discordToken);