const { randomInt } = require("../utils/math");

const EXERCISES = [
  { key: "pushups", label: "Push-ups", stat: "strength", emoji: "💪", bonus: 1 },
  { key: "situps", label: "Sit-ups", stat: "vitality", emoji: "🧘", bonus: 1 },
  { key: "running", label: "Running", stat: "agility", emoji: "🏃", bonus: 1 },
  { key: "jumprope", label: "Jump Rope", stat: "agility", emoji: "🦘", bonus: 1 },
];

function getExercise(key) {
  return EXERCISES.find(e => e.key === key.toLowerCase());
}

function getRandomExercise() {
  return EXERCISES[randomInt(0, EXERCISES.length - 1)];
}

module.exports = {
  EXERCISES,
  getExercise,
  getRandomExercise
};
