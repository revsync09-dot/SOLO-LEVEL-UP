const ISLANDS = [
  { key: "default", name: "Main Island", minLevel: 1, description: "The starter island." },
  { key: "jeju", name: "Jeju Island", minLevel: 60, description: "Home of the Giant Ants. Dangerous!" },
  { key: "red_gate", name: "Red Gate Island", minLevel: 40, description: "A frozen wasteland." },
  { key: "monarch_realm", name: "Monarch's Realm", minLevel: 100, description: "The domain of monarchs." },
];

function getIsland(key) {
  return ISLANDS.find(i => i.key === key.toLowerCase());
}

async function canTravelTo(hunter, islandKey) {
  const island = getIsland(islandKey);
  if (!island) return { ok: false, reason: "invalid" };
  if (hunter.level < island.minLevel) return { ok: false, reason: "level", minLevel: island.minLevel };
  return { ok: true };
}

module.exports = {
  ISLANDS,
  getIsland,
  canTravelTo
};
