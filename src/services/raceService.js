const { HUNTER_RACES } = require("../utils/constants");
const { updateUser } = require("./database");

const RACE_MARKER_PREFIX = "RACE::";

function normalizeRace(value) {
  const raw = String(value || "").trim().toLowerCase();
  return HUNTER_RACES.includes(raw) ? raw : "human";
}

function getHunterRace(hunter) {
  // If we added a race column, we'd use it. For now, fallback to inventory marker or default.
  if (hunter.race) return normalizeRace(hunter.race);
  
  const inventory = Array.isArray(hunter?.inventory) ? hunter.inventory : [];
  const marker = inventory.find((item) => String(item).startsWith(RACE_MARKER_PREFIX));
  if (!marker) return "human";
  return normalizeRace(String(marker).slice(RACE_MARKER_PREFIX.length));
}

function getRaceBonuses(race) {
  const r = normalizeRace(race);
  switch(r) {
    case "human": return { str: 1.0, agi: 1.0, int: 1.0, vit: 1.0, desc: "Balanced and versatile." };
    case "beast": return { str: 1.2, agi: 1.1, int: 0.8, vit: 1.1, desc: "High strength and agility, lower intelligence." };
    case "dragon": return { str: 1.3, agi: 1.0, int: 1.2, vit: 1.5, desc: "Immense vitality and strength." };
    case "elf": return { str: 0.8, agi: 1.3, int: 1.4, vit: 0.9, desc: "High agility and intelligence, lower physical stats." };
    default: return { str: 1.0, agi: 1.0, int: 1.0, vit: 1.0, desc: "Normal human." };
  }
}

async function setHunterRace(hunter, nextRace) {
  const normalized = normalizeRace(nextRace);
  // We try to update the race column first. Our updateUser handles missing columns.
  const updated = await updateUser(hunter.user_id, hunter.guild_id, { race: normalized });
  return { hunter: updated, race: normalized };
}

module.exports = {
  HUNTER_RACES,
  getHunterRace,
  setHunterRace,
  getRaceBonuses,
  normalizeRace
};
