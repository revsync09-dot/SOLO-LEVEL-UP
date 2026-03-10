const { supabase } = require("../lib/supabase");

const INT_MIN = -2147483648;
const INT_MAX = 2147483647;
const INT_FIELDS = new Set([
  "level",
  "exp",
  "gold",
  "mana",
  "strength",
  "agility",
  "intelligence",
  "vitality",
  "stat_points",
  "shadow_slots",
  "points",
  "wins",
  "losses",
]);

function clampInt32(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n > INT_MAX) return INT_MAX;
  if (n < INT_MIN) return INT_MIN;
  return Math.trunc(n);
}

function normalizePatch(patch) {
  const next = { ...patch };
  for (const key of Object.keys(next)) {
    if (INT_FIELDS.has(key) && next[key] !== null && next[key] !== undefined) {
      next[key] = clampInt32(next[key]);
    }
  }
  if ("inventory" in next) {
    next.inventory = Array.isArray(next.inventory) ? next.inventory : [];
  }
  if ("cooldowns" in next) {
    const raw = next.cooldowns;
    next.cooldowns = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  }
  return next;
}

async function findUser(userId, guildId) {
  const { data, error } = await supabase
    .from("hunters")
    .select("*")
    .eq("user_id", userId)
    .eq("guild_id", guildId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function updateUser(userId, guildId, patch) {
  let updatePatch = { ...normalizePatch(patch), updated_at: new Date().toISOString() };

  for (let i = 0; i < 6; i += 1) {
    const { data, error } = await supabase
      .from("hunters")
      .update(updatePatch)
      .eq("user_id", userId)
      .eq("guild_id", guildId)
      .select("*")
      .single();

    if (!error) return data;

    const isMissingColumn = error.code === "PGRST204" && typeof error.message === "string";
    if (!isMissingColumn) throw error;

    const match = error.message.match(/'([^']+)' column/);
    const missingColumn = match && match[1];
    if (!missingColumn || !(missingColumn in updatePatch)) throw error;
    delete updatePatch[missingColumn];
  }

  throw new Error("Failed to update user due to unresolved schema mismatch.");
}

async function saveInventory(userId, guildId, inventory) {
  return updateUser(userId, guildId, { inventory });
}

module.exports = { findUser, updateUser, saveInventory };
