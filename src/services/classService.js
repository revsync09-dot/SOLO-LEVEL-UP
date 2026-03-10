const { HUNTER_CLASSES } = require("../utils/constants");
const { updateUser } = require("./database");

const CLASS_MARKER_PREFIX = "CLASS::";

function normalizeClass(value) {
  const raw = String(value || "").trim().toLowerCase();
  return HUNTER_CLASSES.includes(raw) ? raw : "warrior";
}

function getHunterClass(hunter) {
  const inventory = Array.isArray(hunter?.inventory) ? hunter.inventory : [];
  const marker = inventory.find((item) => String(item).startsWith(CLASS_MARKER_PREFIX));
  if (!marker) return "warrior";
  return normalizeClass(String(marker).slice(CLASS_MARKER_PREFIX.length));
}

function withClassMarker(inventory, nextClass) {
  const items = (Array.isArray(inventory) ? inventory : []).filter(
    (item) => !String(item).startsWith(CLASS_MARKER_PREFIX)
  );
  items.unshift(`${CLASS_MARKER_PREFIX}${normalizeClass(nextClass)}`);
  return items;
}

async function setHunterClass(hunter, nextClass) {
  const normalized = normalizeClass(nextClass);
  const inventory = withClassMarker(hunter.inventory, normalized);
  const updated = await updateUser(hunter.user_id, hunter.guild_id, { inventory });
  return { hunter: updated, className: normalized };
}

async function consumeReawakenedStoneAndSetClass(hunter, nextClass) {
  const inventory = Array.isArray(hunter?.inventory) ? [...hunter.inventory] : [];
  const stoneIdx = inventory.findIndex((item) => {
    const s = String(item).toLowerCase();
    return s === "item:reawakened_stone" || s === "reawakened_stone" || s === "reawakened stone";
  });
  if (stoneIdx < 0) return { ok: false, reason: "missing_stone" };
  inventory.splice(stoneIdx, 1);
  const patched = withClassMarker(inventory, nextClass);
  const updated = await updateUser(hunter.user_id, hunter.guild_id, { inventory: patched });
  return { ok: true, hunter: updated, className: normalizeClass(nextClass) };
}

function getClassMultipliers(className) {
  const cn = normalizeClass(className);
  const m = { str: 1.0, agi: 1.0, int: 1.0, vit: 1.0 };
  switch (cn) {
    case "mage": m.int = 1.30; break;
    case "element_mage": m.int = 1.45; m.vit = 0.90; break;
    case "assassin": m.agi = 1.30; break;
    case "shadow_assassin": m.agi = 1.45; m.str = 1.10; break;
    case "summoner": m.int = 1.15; m.vit = 1.15; break;
    case "necromancer": m.int = 1.40; m.vit = 1.25; break;
    case "warrior": m.str = 1.20; m.vit = 1.10; break;
    case "knight": m.str = 1.35; m.vit = 1.20; break;
    case "tank": m.vit = 1.30; m.str = 1.10; break;
    default: break;
  }
  return m;
}

module.exports = {
  HUNTER_CLASSES,
  getHunterClass,
  setHunterClass,
  consumeReawakenedStoneAndSetClass,
  normalizeClass,
  getClassMultipliers,
};