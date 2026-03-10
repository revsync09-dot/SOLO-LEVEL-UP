const CLASS_SKILLS = {
  mage: [
    { key: "fireball", name: "Fire Ball", desc: "Launches a ball of fire.", bonus: { int: 1.1 } },
    { key: "water_dragon", name: "Water Dragon", desc: "Summons a dragon of water.", bonus: { int: 1.25 } }
  ],
  element_mage: [
    { key: "elemental_storm", name: "Elemental Storm", desc: "A chaotic storm of all elements.", bonus: { int: 1.5 } }
  ],
  shadow_assassin: [
    { key: "quick_slashes", name: "Quick Slashes", desc: "A flurry of rapid attacks.", bonus: { agi: 1.4 } },
    { key: "shadow_step", name: "Shadow Step", desc: "Instant movement behind the enemy.", bonus: { agi: 1.2 } }
  ],
  necromancer: [
    { key: "soul_extraction", name: "Soul Extraction", desc: "Extract shadows from the fallen.", bonus: { int: 1.1 } },
    { key: "army_of_dead", name: "Army of the Dead", desc: "Buffs all shadows.", bonus: { int: 1.3 } }
  ],
  knight: [
    { key: "shield_bash", name: "Shield Bash", desc: "Stuns the enemy.", bonus: { str: 1.1, vit: 1.1 } },
    { key: "royal_guard", name: "Royal Guard", desc: "Increases defense significantly.", bonus: { vit: 1.5 } }
  ]
};

function getSkillsForClass(className) {
  return CLASS_SKILLS[className.toLowerCase()] || [];
}

module.exports = {
  CLASS_SKILLS,
  getSkillsForClass
};
