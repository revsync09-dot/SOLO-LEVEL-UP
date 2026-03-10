const { supabase } = require("../lib/supabase");
const { SHADOW_RARITY } = require("../utils/constants");
const { randomInt } = require("../utils/math");
let hasGuildColumnCache = null;

function isMissingShadowGuildColumn(error) {
  return (
    error?.code === "42703" &&
    typeof error?.message === "string" &&
    (error.message.includes("shadows.guild_id") ||
      (error.message.includes("guild_id") && error.message.toLowerCase().includes("shadows")))
  );
}

const SHADOW_NAMES = [
  "Igris Echo", "Iron Fang", "Stone Warden", "Night Talon", "Crimson Drake", "Void General",
  "Beru Shard", "Tusk Phantom", "Kaisel Wing", "Tank Maul", "Greed Echo", "Jinho Shield",
  "Shadow Knight", "Dark Archer", "Soul Reaver", "Eternal Guard", "Frost Giant", "Lava Beast"
];

const MONARCH_SHADOWS = [
  "Shadow Monarch", "Frost Monarch", "Plague Monarch", "Beast Monarch"
];

function rollRarity() {
  const roll = randomInt(0, 100);
  return SHADOW_RARITY.find((r) => roll >= r.min && roll <= r.max) || SHADOW_RARITY[0];
}

async function rollExtraction(userId, guildId, targetName, targetRank) {
  const rarity = rollRarity();
  const name = `${targetName} Shadow`;
  
  const payload = {
    user_id: userId,
    guild_id: guildId,
    name: name,
    rank: targetRank || "E-Rank",
    rarity: rarity.name,
    rarity_score: rarity.bonus,
    base_damage: 15 + rarity.bonus + randomInt(5, 15),
    ability_bonus: 5 + Math.ceil(rarity.bonus / 2),
    level: 1,
    equipped: false,
  };

  const { data, error } = await supabase.from("shadows").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

async function listShadows(userId, guildId) {
  const queryWithGuild = () =>
    supabase
      .from("shadows")
      .select("*")
      .eq("user_id", userId)
      .eq("guild_id", guildId)
      .order("equipped", { ascending: false })
      .order("rarity_score", { ascending: false });
  const queryNoGuild = () =>
    supabase
      .from("shadows")
      .select("*")
      .eq("user_id", userId)
      .order("equipped", { ascending: false })
      .order("rarity_score", { ascending: false });

  const useGuild = hasGuildColumnCache !== false;
  const first = useGuild ? await queryWithGuild() : await queryNoGuild();
  if (!first.error) return first.data || [];

  const missingGuild = isMissingShadowGuildColumn(first.error);
  if (!missingGuild) throw first.error;
  hasGuildColumnCache = false;
  const second = await queryNoGuild();
  if (second.error) throw second.error;
  return second.data || [];
}

async function getEquippedShadows(userId, guildId) {
  const queryWithGuild = () =>
    supabase.from("shadows").select("*").eq("user_id", userId).eq("guild_id", guildId).eq("equipped", true);
  const queryNoGuild = () => supabase.from("shadows").select("*").eq("user_id", userId).eq("equipped", true);

  const useGuild = hasGuildColumnCache !== false;
  const first = useGuild ? await queryWithGuild() : await queryNoGuild();
  if (!first.error) return first.data || [];

  const missingGuild = isMissingShadowGuildColumn(first.error);
  if (!missingGuild) throw first.error;
  hasGuildColumnCache = false;
  const second = await queryNoGuild();
  if (second.error) throw second.error;
  return second.data || [];
}

async function addRandomShadow(userId, guildId, baseRank) {
  const rarity = rollRarity();
  const payload = {
    user_id: userId,
    guild_id: guildId,
    name: SHADOW_NAMES[randomInt(0, SHADOW_NAMES.length - 1)],
    rank: baseRank,
    rarity: rarity.name,
    rarity_score: rarity.bonus,
    base_damage: 10 + rarity.bonus + randomInt(1, 9),
    ability_bonus: 3 + Math.ceil(rarity.bonus / 2),
    level: 1,
    equipped: false,
  };
  let { data, error } = await supabase.from("shadows").insert(payload).select("*").single();
  if (!error) return data;
  const missingGuild = isMissingShadowGuildColumn(error);
  if (!missingGuild) throw error;
  hasGuildColumnCache = false;
  const fallbackPayload = { ...payload };
  delete fallbackPayload.guild_id;
  const retry = await supabase.from("shadows").insert(fallbackPayload).select("*").single();
  if (retry.error) throw retry.error;
  return retry.data;
}

async function equipShadow(userId, guildId, shadowId, maxSlots) {
  const all = await listShadows(userId, guildId);
  const currentlyEquipped = all.filter((s) => s.equipped);
  if (currentlyEquipped.length >= maxSlots) return { ok: false, reason: "slots_full" };

  const target = all.find((s) => s.id === shadowId);
  if (!target) return { ok: false, reason: "not_found" };
  if (target.equipped) return { ok: false, reason: "already_equipped" };

  const withGuild = await supabase
    .from("shadows")
    .update({ equipped: true, updated_at: new Date().toISOString() })
    .eq("id", shadowId)
    .eq("user_id", userId)
    .eq("guild_id", guildId)
    .select("*")
    .single();
  if (!withGuild.error) return { ok: true, shadow: withGuild.data };

  const missingGuild = isMissingShadowGuildColumn(withGuild.error);
  if (!missingGuild) throw withGuild.error;
  hasGuildColumnCache = false;
  const noGuild = await supabase
    .from("shadows")
    .update({ equipped: true, updated_at: new Date().toISOString() })
    .eq("id", shadowId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (noGuild.error) throw noGuild.error;
  return { ok: true, shadow: noGuild.data };
}

module.exports = { listShadows, getEquippedShadows, addRandomShadow, equipShadow };