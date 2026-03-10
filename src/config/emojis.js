/**
 * Custom emoji IDs — read from .env, fallback to defaults.
 * Set in .env e.g. EMOJI_HELP_ID=976524440080883802
 * Optional: EMOJI_ATTACK_ID, EMOJI_GUARD_ID, EMOJI_SKILL_ID, EMOJI_ERROR_ID, EMOJI_SUCCESS_ID,
 * EMOJI_STRENGTH_ID, EMOJI_AGILITY_ID, EMOJI_INTELLIGENCE_ID, EMOJI_VITALITY_ID,
 * EMOJI_GOLD_ID, EMOJI_MANA_ID, EMOJI_LEVEL_ID, EMOJI_RANK_ID,
 * EMOJI_SHOP_NEXT_ID, EMOJI_SHOP_BUY_ID, and EMOJI_<ITEM_KEY>_ID for shop items (e.g. EMOJI_MANA_POTION_ID).
 */

const DEFAULTS = {
  HELP: "976524440080883802",
  ATTACK: "1136755867899924480",
  GUARD: "1043563693557956708",
  SKILL: "1473673520549462229",
  ERROR: "1428973588119289889",
  SUCCESS: "1271110981338267708",
  STRENGTH: "1475890708140392621",
  AGILITY: "1475914899870978160",
  INTELLIGENCE: "1475914937887887523",
  VITALITY: "1475914963225940221",
  GOLD: "1475915038182346894",
  MANA: "1475915084911087708",
  LEVEL: "1475916361623408902",
  RANK: "1475916735860445358",
  SHOP_NEXT: "1473670425371344907",
  SHOP_BUY: "1006637475067859105",
  SHOP: "1445924320730808391",
  SHOP_SUCCESS: "1473670205094887474",
  SHOP_PAGE: "1437069843353571449",
  // Shop item defaults (key lowercase with underscores)
  mana_potion: "1475915084911087708",
  shadow_essence: "1475924101179899994",
  gate_crystal: "1475924134650445884",
  hunter_key: "1477554399097389198",
  raid_heal_kit: "1477554472032014449",
  stat_reset_token: "1477554321074950194",
  flame_slash: "1477554431238344735",
  shadow_step: "1477554358525890601",
  monarch_roar: "1477554506031169577",
  reawakened_stone: "1477554553531531307",
  lootbox_common: "1477554803243483197",
  lootbox_rare: "1477556142199541953",
  lootbox_epic: "1477557061935173733",
  lootbox_legendary: "1477554431238344735",
};

function envKey(name) {
  return "EMOJI_" + String(name).toUpperCase().replace(/-/g, "_") + "_ID";
}

function get(name, defaultId) {
  const raw = process.env[envKey(name)] || process.env["EMOJI_" + String(name).toUpperCase().replace(/-/g, "_")] || defaultId || (DEFAULTS[name] != null ? DEFAULTS[name] : "");
  const id = typeof raw === "string" ? raw.trim() : "";
  return id || "";
}

function getHelpEmoji() {
  const id = get("HELP");
  return id ? `<:e:${id}>` : "❓";
}

function getRaidIds() {
  return {
    attack: get("ATTACK"),
    guard: get("GUARD"),
    skill: get("SKILL"),
  };
}

function getStatEmojiIds() {
  return {
    strength: get("STRENGTH"),
    agility: get("AGILITY"),
    intelligence: get("INTELLIGENCE"),
    vitality: get("VITALITY"),
    gold: get("GOLD"),
    mana: get("MANA"),
    level: get("LEVEL"),
    rank: get("RANK"),
  };
}

function getStatusEmojis() {
  const errorId = get("ERROR");
  const successId = get("SUCCESS");
  const errorName = (process.env.EMOJI_ERROR_NAME || "e").trim() || "e";
  const successName = (process.env.EMOJI_SUCCESS_NAME || "e").trim() || "e";
  return {
    error: { custom: errorId ? `<a:${errorName}:${errorId}>` : "[X]", id: errorId, fallback: "[X]" },
    success: { custom: successId ? `<a:${successName}:${successId}>` : "[OK]", id: successId, fallback: "[OK]" },
  };
}

function getShopNavIds() {
  return {
    next: get("SHOP_NEXT"),
    buy: get("SHOP_BUY"),
  };
}

function getShopItemEmojiId(itemKey, defaultId) {
  if (!itemKey) return (defaultId && String(defaultId).trim()) || "";
  const key = String(itemKey).toLowerCase().replace(/-/g, "_");
  const id = get(key, defaultId) || (defaultId && String(defaultId).trim()) || (DEFAULTS[key] != null ? DEFAULTS[key] : "");
  return (id && String(id).trim()) || "";
}

/** Returns shop UI strings for header, gold, success, error, page (for use in message content). */
function getShopDisplayEmojis() {
  const shopId = get("SHOP");
  const goldId = get("GOLD");
  const successId = get("SHOP_SUCCESS");
  const errorId = get("ERROR");
  const pageId = get("SHOP_PAGE");
  const name = (process.env.EMOJI_SHOP_DISPLAY_NAME || "e").trim() || "e";
  return {
    shop: shopId ? `<a:${name}:${shopId}>` : "🛒",
    gold: goldId ? `<:${name}:${goldId}>` : "🪙",
    success: successId ? `<a:${name}:${successId}>` : "✅",
    error: errorId ? `<:${name}:${errorId}>` : "❌",
    page: pageId ? `<:${name}:${pageId}>` : "📄",
  };
}

/** Returns dungeon result line emojis (xp, gold, str, agi) as message strings. */
function getDungeonResultEmojis() {
  const ids = getStatEmojiIds();
  const name = (process.env.EMOJI_STAT_DISPLAY_NAME || "e").trim() || "e";
  return {
    xp: ids.level ? `<:${name}:${ids.level}>` : "XP",
    gold: ids.gold ? `<:${name}:${ids.gold}>` : "Gold",
    str: ids.strength ? `<:${name}:${ids.strength}>` : "Str",
    agi: ids.agility ? `<:${name}:${ids.agility}>` : "Agi",
  };
}

module.exports = {
  get,
  getHelpEmoji,
  getRaidIds,
  getStatEmojiIds,
  getStatusEmojis,
  getShopNavIds,
  getShopDisplayEmojis,
  getShopItemEmojiId,
  getDungeonResultEmojis,
  DEFAULTS,
};
