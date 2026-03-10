const ARMOR_SETS = [
  {
    key: "gold_set",
    name: "Golden Armor Set",
    description: "Radiant armor forged from holy gold.",
    pieces: ["gold_helmet", "gold_chestplate", "gold_leggings", "gold_boots"],
    fullSetBonus: { vit: 1.25, str: 1.10 },
    bonusDesc: "+25% Vitality, +10% Strength"
  },
  {
    key: "shadow_set",
    name: "Shadow Monarch Set",
    description: "Armor that pulses with shadow energy.",
    pieces: ["shadow_hood", "shadow_robe", "shadow_pants", "shadow_boots"],
    fullSetBonus: { int: 1.30, agi: 1.20 },
    bonusDesc: "+30% Intelligence, +20% Agility"
  }
];

function checkSetBonus(inventory) {
  const inv = Array.isArray(inventory) ? inventory : [];
  for (const set of ARMOR_SETS) {
    const hasAll = set.pieces.every(piece => inv.includes(`item:${piece}`) || inv.includes(piece));
    if (hasAll) return set;
  }
  return null;
}

module.exports = {
  ARMOR_SETS,
  checkSetBonus
};
