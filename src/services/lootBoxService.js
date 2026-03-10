/**
 * lootBoxService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Loot Box system for Solo Leveling bot.
 *
 * Members can buy loot boxes from the shop and open them for random rewards.
 * Four tiers: Common, Rare, Epic, Legendary — each with different cost and drop tables.
 *
 * Error reasons:
 *   no_box       — user doesn't have this box type in inventory
 *   invalid_tier — unknown box tier requested
 *   db_error     — logging failed (non-fatal)
 */

const { supabase } = require("../lib/supabase");
const { randomInt } = require("../utils/math");

let _dbMissing = false;

function isMissingTable(err) {
  return (
    err?.code === "42P01" ||
    err?.code === "PGRST205" ||
    (err?.code === "PGRST204" && typeof err?.message === "string")
  );
}

// ── Box Definitions ──────────────────────────────────────────────────────────
const LOOT_BOX_TIERS = {
  common: {
    label:        "Common Loot Box",
    emoji:        "📦",
    inventoryKey: "loot_box:common",
    shopKey:      "loot_box_common",
    price:        200,
    rarity:       "Common",
    tables: [
      { weight: 40, xp:  30, gold:  60, items: [] },
      { weight: 30, xp:  60, gold:  80, items: ["item:mana_potion"] },
      { weight: 20, xp:  80, gold: 120, items: [] },
      { weight:  8, xp: 100, gold: 180, items: ["material:gate_crystal"] },
      { weight:  2, xp: 150, gold: 300, items: ["material:shadow_essence"] },
    ],
  },
  rare: {
    label:        "Rare Loot Box",
    emoji:        "📫",
    inventoryKey: "loot_box:rare",
    shopKey:      "loot_box_rare",
    price:        600,
    rarity:       "Rare",
    tables: [
      { weight: 30, xp: 100, gold: 150, items: [] },
      { weight: 25, xp: 120, gold: 200, items: ["item:mana_potion"] },
      { weight: 20, xp: 160, gold: 250, items: ["material:gate_crystal"] },
      { weight: 15, xp: 200, gold: 350, items: ["material:shadow_essence"] },
      { weight:  7, xp: 250, gold: 450, items: ["material:rune_fragment"] },
      { weight:  3, xp: 350, gold: 700, items: ["item:stat_reset_token"] },
    ],
  },
  epic: {
    label:        "Epic Loot Box",
    emoji:        "🎁",
    inventoryKey: "loot_box:epic",
    shopKey:      "loot_box_epic",
    price:        1500,
    rarity:       "Epic",
    tables: [
      { weight: 25, xp: 200, gold: 300, items: ["item:mana_potion"] },
      { weight: 20, xp: 250, gold: 400, items: ["material:gate_crystal"] },
      { weight: 20, xp: 300, gold: 500, items: ["material:shadow_essence"] },
      { weight: 15, xp: 350, gold: 600, items: ["material:rune_fragment"] },
      { weight: 12, xp: 400, gold: 800, items: ["skill_scroll:flame_slash"] },
      { weight:  5, xp: 500, gold:1000, items: ["skill_scroll:shadow_step"] },
      { weight:  3, xp: 700, gold:1500, items: ["skill_scroll:monarch_roar"] },
    ],
  },
  legendary: {
    label:        "Legendary Loot Box",
    emoji:        "🏆",
    inventoryKey: "loot_box:legendary",
    shopKey:      "loot_box_legendary",
    price:        4000,
    rarity:       "Legendary",
    tables: [
      { weight: 20, xp: 400, gold: 600, items: ["skill_scroll:flame_slash", "item:mana_potion"] },
      { weight: 20, xp: 450, gold: 700, items: ["skill_scroll:shadow_step", "material:gate_crystal"] },
      { weight: 15, xp: 500, gold: 900, items: ["skill_scroll:monarch_roar"] },
      { weight: 15, xp: 600, gold:1000, items: ["item:stat_reset_token", "material:shadow_essence"] },
      { weight: 10, xp: 700, gold:1200, items: ["material:jeju_ant_core"] },
      { weight:  8, xp: 800, gold:1500, items: ["item:reawakened_stone"] },
      { weight:  7, xp:1000, gold:2000, items: ["skill_scroll:monarch_roar","item:stat_reset_token","material:shadow_essence"] },
      { weight:  5, xp:1500, gold:3000, items: ["item:monarch_sigil"] },
    ],
  },
};

const VALID_TIERS = Object.keys(LOOT_BOX_TIERS);

function rollTable(tables) {
  const total = tables.reduce((s, t) => s + t.weight, 0);
  let r = randomInt(1, total);
  for (const entry of tables) {
    r -= entry.weight;
    if (r <= 0) return entry;
  }
  return tables[0];
}

// ── DB Logging (non-fatal — if table missing we skip) ────────────────────────
async function logOpen(userId, guildId, tier, reward) {
  if (_dbMissing) return;
  try {
    const { error } = await supabase.from("loot_box_opens").insert({
      user_id:     userId,
      guild_id:    guildId,
      box_tier:    tier,
      opened_at:   new Date().toISOString(),
      reward_json: JSON.stringify(reward),
    });
    if (error && isMissingTable(error)) _dbMissing = true;
  } catch (err) {
    if (isMissingTable(err)) _dbMissing = true;
    else console.error("[lootBoxService] logOpen error:", err?.message);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Open a loot box from the user's inventory.
 *
 * @param {object} hunter  — current hunter row (must have .inventory)
 * @param {string} tier    — "common" | "rare" | "epic" | "legendary"
 * @returns {{ ok, reason?, xp, gold, items, label, emoji, rarity }}
 */
function openBox(hunter, tier) {
  if (!VALID_TIERS.includes(tier)) return { ok: false, reason: "invalid_tier" };

  const def = LOOT_BOX_TIERS[tier];
  const inventory = Array.isArray(hunter.inventory) ? [...hunter.inventory] : [];
  const idx = inventory.findIndex((x) => x === def.inventoryKey);
  if (idx < 0) return { ok: false, reason: "no_box" };

  // Remove from inventory
  inventory.splice(idx, 1);

  const entry = rollTable(def.tables);
  return {
    ok:        true,
    tier,
    label:     def.label,
    emoji:     def.emoji,
    rarity:    def.rarity,
    xp:        entry.xp,
    gold:      entry.gold,
    items:     entry.items || [],
    newInventory: [...inventory, ...(entry.items || [])],
  };
}

/**
 * Async version — also logs the opening to DB.
 */
async function openBoxAndLog(hunter, tier) {
  const result = openBox(hunter, tier);
  if (result.ok) {
    await logOpen(hunter.user_id, hunter.guild_id, tier, { xp: result.xp, gold: result.gold, items: result.items });
  }
  return result;
}

/**
 * Count how many of each box tier the user has in inventory.
 */
function countBoxes(hunter) {
  const inv = Array.isArray(hunter.inventory) ? hunter.inventory : [];
  const counts = {};
  for (const tier of VALID_TIERS) {
    counts[tier] = inv.filter((x) => x === LOOT_BOX_TIERS[tier].inventoryKey).length;
  }
  return counts;
}

module.exports = {
  LOOT_BOX_TIERS,
  VALID_TIERS,
  openBox,
  openBoxAndLog,
  countBoxes,
};
