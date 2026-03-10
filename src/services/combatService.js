const { randomInt, clamp } = require("../utils/math");
const { DUNGEON_DIFFICULTIES } = require("../utils/constants");
const { getHunterClass, getClassMultipliers } = require("./classService");

function computePower(hunter, shadows, cardBonus = 0) {
  const className = getHunterClass(hunter);
  const m = getClassMultipliers(className);

  const { getHunterRace, getRaceBonuses } = require("./raceService");
  const race = getHunterRace(hunter);
  const rm = getRaceBonuses(race);

  const { checkSetBonus } = require("./armorService");
  const armorSet = checkSetBonus(hunter.inventory);
  const am = armorSet ? armorSet.fullSetBonus : { str: 1, agi: 1, int: 1, vit: 1 };

  const shadowBonus = (shadows || []).reduce((sum, s) => sum + s.base_damage + s.ability_bonus, 0);
  
  const effStr = Math.floor(hunter.strength * m.str * rm.str * (am.str || 1));
  const effAgi = Math.floor(hunter.agility * m.agi * rm.agi * (am.agi || 1));
  const effInt = Math.floor(hunter.intelligence * m.int * rm.int * (am.int || 1));
  const effVit = Math.floor(hunter.vitality * m.vit * rm.vit * (am.vit || 1));

  return effStr * 2 + effAgi + Math.floor(effInt / 2) + effVit + shadowBonus + cardBonus;
}

function runHunt(hunter) {
  const xp = randomInt(20, 42);
  const gold = randomInt(16, 40);
  return {
    xp,
    gold,
    message: `Hunt complete. +${xp} XP and +${gold} Gold.`,
  };
}

function runDungeonCombat(hunter, shadows, difficultyKey) {
  const difficulty = DUNGEON_DIFFICULTIES[difficultyKey];
  if (!difficulty) throw new Error("Invalid difficulty");

  const playerPower = computePower(hunter, shadows);
  const enemyPower = Math.floor((hunter.level * 5 + randomInt(10, 30)) * difficulty.multiplier);
  const winChance = clamp(55 + (playerPower - enemyPower) * 0.65, 10, 95);
  const didWin = randomInt(1, 100) <= winChance;

  return { difficulty, playerPower, enemyPower, winChance, didWin };
}

module.exports = { runHunt, runDungeonCombat, computePower };