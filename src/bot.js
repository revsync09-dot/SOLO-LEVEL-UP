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

function startHealthServer(client) {
  const port = Number(process.env.PORT || 8080);
  const server = http.createServer(async (req, res) => {
    // Enable CORS for Vercel
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      return res.end();
    }

    if (req.url === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end("ok");
      return;
    }
    
    // API Route used by Vercel Dashboard to fetch Discord Avatars
    if (req.url === "/api/users/batch" && req.method === "POST") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", async () => {
        try {
          const { user_ids } = JSON.parse(body);
          if (!Array.isArray(user_ids)) throw new Error("user_ids must be an array");
          
          const result = {};
          await Promise.all(
            user_ids.map(async id => {
              try {
                // Fetch dynamically using the bot's global token view
                const u = await client.users.fetch(id);
                result[id] = {
                  username: u.username,
                  avatar_url: u.displayAvatarURL({ extension: "png", size: 256 })
                };
              } catch (e) {
                // ignore invalid users privately
              }
            })
          );

          res.writeHead(200, { "content-type": "application/json" });
          return res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(400, { "content-type": "application/json" });
          return res.end(JSON.stringify({ error: err.message }));
        }
      });
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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
client.commands = new Collection();

startHealthServer(client);

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