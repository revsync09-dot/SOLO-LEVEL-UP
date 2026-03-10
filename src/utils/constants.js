const RANKS = [
  "E-Rank",
  "D-Rank",
  "C-Rank",
  "B-Rank",
  "A-Rank",
  "S-Rank",
  "SS-Rank",
  "SSS-Rank",
  "National Level",
  "Monarch Level",
  "Ruler Level",
  "Shadow Monarch",
  "Absolute Being",
];

const RANK_THRESHOLDS = {
  "E-Rank": 1,
  "D-Rank": 15,
  "C-Rank": 30,
  "B-Rank": 45,
  "A-Rank": 60,
  "S-Rank": 80,
  "SS-Rank": 100,
  "SSS-Rank": 120,
  "National Level": 140,
  "Monarch Level": 170,
  "Ruler Level": 200,
  "Shadow Monarch": 250,
  "Absolute Being": 350,
};

const LEGACY_RANK_MAP = {
  E: "E-Rank",
  D: "D-Rank",
  C: "C-Rank",
  B: "B-Rank",
  A: "A-Rank",
  S: "S-Rank",
  SS: "SS-Rank",
  SSS: "SSS-Rank",
  NATIONAL: "National Level",
  "NATIONAL LEVEL": "National Level",
  "MONARCH LEVEL": "Monarch Level",
  "RULER LEVEL": "Ruler Level",
  "SHADOW MONARCH": "Shadow Monarch",
  "ABSOLUTE BEING": "Absolute Being",
};

function normalizeRank(rank) {
  if (!rank) return "E-Rank";
  const raw = String(rank).trim();
  if (RANKS.includes(raw)) return raw;
  const mapped = LEGACY_RANK_MAP[raw.toUpperCase()];
  return mapped || "E-Rank";
}

function rankBadgeText(rank) {
  const normalized = normalizeRank(rank);
  const map = {
    "E-Rank": "E",
    "D-Rank": "D",
    "C-Rank": "C",
    "B-Rank": "B",
    "A-Rank": "A",
    "S-Rank": "S",
    "SS-Rank": "SS",
    "SSS-Rank": "SSS",
    "National Level": "N",
    "Monarch Level": "M",
    "Ruler Level": "R",
    "Shadow Monarch": "SM",
    "Absolute Being": "AB",
  };
  return map[normalized] || "E";
}

function rankColor(rank) {
  const normalized = normalizeRank(rank);
  const map = {
    "E-Rank": "#06B6D4",
    "D-Rank": "#8B5CF6",
    "C-Rank": "#10B981",
    "B-Rank": "#3B82F6",
    "A-Rank": "#F59E0B",
    "S-Rank": "#EF4444",
    "SS-Rank": "#F43F5E",
    "SSS-Rank": "#E11D48",
    "National Level": "#F97316",
    "Monarch Level": "#EC4899",
    "Ruler Level": "#22D3EE",
    "Shadow Monarch": "#A855F7",
    "Absolute Being": "#FFFFFF",
  };
  return map[normalized] || "#94A3B8";
}

const DUNGEON_DIFFICULTIES = {
  easy: { label: "Easy", multiplier: 0.9, xp: [40, 80], gold: [25, 60], arise: 0.01 },
  normal: { label: "Normal", multiplier: 1, xp: [80, 140], gold: [60, 120], arise: 0.03 },
  hard: { label: "Hard", multiplier: 1.3, xp: [130, 210], gold: [110, 220], arise: 0.05 },
  elite: { label: "Elite", multiplier: 1.7, xp: [220, 330], gold: [200, 360], arise: 0.08 },
  raid: { label: "Raid", multiplier: 2.2, xp: [320, 500], gold: [300, 580], arise: 0.12 },
  monarch: { label: "Monarch Raid", multiplier: 3.5, xp: [1000, 2500], gold: [1000, 5000], arise: 0.25 },
};

const SHADOW_RARITY = [
  { name: "Common", min: 0, max: 49, bonus: 4 },
  { name: "Rare", min: 50, max: 74, bonus: 8 },
  { name: "Epic", min: 75, max: 89, bonus: 14 },
  { name: "Legendary", min: 90, max: 97, bonus: 21 },
  { name: "Mythic", min: 98, max: 100, bonus: 32 },
];

const HUNTER_CLASSES = [
  "warrior", "mage", "assassin", "summoner", "tank",
  "knight", "necromancer", "element_mage", "shadow_assassin"
];

const HUNTER_RACES = ["human", "beast", "dragon", "elf"];

const RARITY_TIERS = ["Normal", "Exotic", "Special", "Legendary", "Ultra", "Mythic"];

const STATUS_EFFECTS = ["Poison", "Acid", "Bleed", "Burn", "Freeze", "Shock"];

const CLASS_WEAPON_DROPS = {
  mage: ["Arcane Staff", "Mana Scepter", "Elder Grimoire", "3 Element Staff"],
  element_mage: ["Elemental Core", "Staff of Storms", "3 Element Staff"],
  assassin: ["Twin Daggers", "Shadow Dagger", "Silent Blade", "Kamish's Wrath"],
  shadow_assassin: ["Soul Dagger", "Void Blade", "Kamish's Wrath"],
  summoner: ["Spirit Codex", "Soul Bell", "Summoner Orb"],
  necromancer: ["Heart of Monarch", "Shadow Grimoire", "Soul Bell"],
  warrior: ["Knight Longsword", "Jeju Greatsword", "Crimson Blade", "Demon King Longsword"],
  knight: ["Royal Sword", "Guardian Shield", "Demon King Longsword"],
  tank: ["Guardian Shield", "Titan Tower Shield", "Aegis Buckler", "Dragon Scale Shield"],
};

const COMPANION_DROPS = ["Igris", "Tusk", "SJW Summon", "Beru", "Kaisel", "Iron", "Greed"];

module.exports = {
  RANKS,
  RANK_THRESHOLDS,
  DUNGEON_DIFFICULTIES,
  SHADOW_RARITY,
  HUNTER_CLASSES,
  HUNTER_RACES,
  RARITY_TIERS,
  STATUS_EFFECTS,
  CLASS_WEAPON_DROPS,
  COMPANION_DROPS,
  normalizeRank,
  rankBadgeText,
  rankColor,
};