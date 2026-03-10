const { SlashCommandBuilder } = require("discord.js");
const { ensureHunter } = require("../services/hunterService");
const { updateUser } = require("../services/database");
const { RANKS, RANK_THRESHOLDS } = require("../utils/constants");
const { sendStatus } = require("../utils/statusMessage");

const ALLOWED_USERS = new Set(["795466540140986368", "760194150452035595"]);
const MAX_DELTA = 1_000_000_000;

function inferRank(level) {
  let current = "E-Rank";
  for (const rank of RANKS) {
    if (level >= RANK_THRESHOLDS[rank]) current = rank;
  }
  return current;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("addcurreny")
    .setDescription("Admin: add hunter currency/stats to a user.")
    .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
    .addIntegerOption((opt) => opt.setName("gold").setDescription("Add gold (can be negative)").setRequired(false))
    .addIntegerOption((opt) => opt.setName("level").setDescription("Add level (can be negative)").setRequired(false))
    .addIntegerOption((opt) => opt.setName("mana").setDescription("Add mana (can be negative)").setRequired(false))
    .addIntegerOption((opt) => opt.setName("strength").setDescription("Add strength").setRequired(false))
    .addIntegerOption((opt) => opt.setName("agility").setDescription("Add agility").setRequired(false))
    .addIntegerOption((opt) => opt.setName("intelligence").setDescription("Add intelligence").setRequired(false))
    .addIntegerOption((opt) => opt.setName("vitality").setDescription("Add vitality").setRequired(false))
    .addIntegerOption((opt) => opt.setName("stat_points").setDescription("Add stat points").setRequired(false))
    .addIntegerOption((opt) => opt.setName("exp").setDescription("Add exp").setRequired(false))
    .addIntegerOption((opt) => opt.setName("shadow_slots").setDescription("Add shadow slots").setRequired(false)),
  async execute(interaction) {
    if (!ALLOWED_USERS.has(interaction.user.id)) {
      await sendStatus(interaction, {
        ok: false,
        text: "You are not allowed to use this command.",
        ephemeral: true,
      });
      return;
    }

    const target = interaction.options.getUser("user", true);
    const deltas = {
      gold: interaction.options.getInteger("gold"),
      level: interaction.options.getInteger("level"),
      mana: interaction.options.getInteger("mana"),
      strength: interaction.options.getInteger("strength"),
      agility: interaction.options.getInteger("agility"),
      intelligence: interaction.options.getInteger("intelligence"),
      vitality: interaction.options.getInteger("vitality"),
      stat_points: interaction.options.getInteger("stat_points"),
      exp: interaction.options.getInteger("exp"),
      shadow_slots: interaction.options.getInteger("shadow_slots"),
    };

    const provided = Object.values(deltas).some((v) => Number.isInteger(v));
    if (!provided) {
      await sendStatus(interaction, {
        ok: false,
        text: "Provide at least one value to add.",
        ephemeral: true,
      });
      return;
    }
    const tooLarge = Object.values(deltas).find(
      (v) => Number.isInteger(v) && Math.abs(Number(v)) > MAX_DELTA
    );
    if (tooLarge !== undefined) {
      await sendStatus(interaction, {
        ok: false,
        text: `Value too large. Max absolute value per field is ${MAX_DELTA}.`,
        ephemeral: true,
      });
      return;
    }

    const hunter = await ensureHunter({ userId: target.id, guildId: interaction.guildId });
    const nextLevel = Math.max(1, Number(hunter.level || 1) + Number(deltas.level || 0));
    const patch = {
      gold: Number(hunter.gold || 0) + Number(deltas.gold || 0),
      level: nextLevel,
      rank: inferRank(nextLevel),
      mana: Math.max(0, Number(hunter.mana || 0) + Number(deltas.mana || 0)),
      strength: Math.max(0, Number(hunter.strength || 0) + Number(deltas.strength || 0)),
      agility: Math.max(0, Number(hunter.agility || 0) + Number(deltas.agility || 0)),
      intelligence: Math.max(0, Number(hunter.intelligence || 0) + Number(deltas.intelligence || 0)),
      vitality: Math.max(0, Number(hunter.vitality || 0) + Number(deltas.vitality || 0)),
      stat_points: Math.max(0, Number(hunter.stat_points || 0) + Number(deltas.stat_points || 0)),
      exp: Math.max(0, Number(hunter.exp || 0) + Number(deltas.exp || 0)),
      shadow_slots: Math.max(0, Number(hunter.shadow_slots || 0) + Number(deltas.shadow_slots || 0)),
    };

    const updated = await updateUser(target.id, interaction.guildId, patch);
    await sendStatus(interaction, {
      ok: true,
      text:
        `Updated ${target}. ` +
        `Gold: ${updated.gold} | Level: ${updated.level} | Mana: ${updated.mana} | ` +
        `STR: ${updated.strength} | AGI: ${updated.agility} | INT: ${updated.intelligence} | ` +
        `VIT: ${updated.vitality} | Points: ${updated.stat_points} | EXP: ${updated.exp}`,
      ephemeral: true,
    });
  },
};
