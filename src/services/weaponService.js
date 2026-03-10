const WEAPONS = [
  { 
    key: "arcane_staff", 
    name: "Arcane Staff", 
    rarity: "Normal", 
    passive: "Mana Flow: +5% Intelligence",
    bonus: { int: 1.05 }
  },
  { 
    key: "three_element_staff", 
    name: "3 Element Staff", 
    rarity: "Mythic", 
    passive: "Elemental Mastery: Allows switching between Fire, Water, and Ice. +30% Intelligence.",
    bonus: { int: 1.30 }
  },
  { 
    key: "shadow_dagger", 
    name: "Shadow Dagger", 
    rarity: "Special", 
    passive: "Silent Strike: +15% Agility when attacking from shadows.",
    bonus: { agi: 1.15 }
  },
  { 
    key: "kamish_wrath", 
    name: "Kamish's Wrath", 
    rarity: "Mythic", 
    passive: "Dragon's Might: +50% Strength. Inflicts 'Terror' on enemies.",
    bonus: { str: 1.50 }
  },
];

function getWeapon(key) {
  return WEAPONS.find(w => w.key === key.toLowerCase());
}

module.exports = {
  WEAPONS,
  getWeapon
};
