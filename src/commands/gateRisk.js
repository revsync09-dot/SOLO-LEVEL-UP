const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { ensureHunter, addXpAndGold } = require("../services/hunterService");
const { getCooldown, setCooldown } = require("../services/cooldownService");
const { cooldownRemaining, nextCooldown } = require("../utils/cooldownHelper");
const { randomInt } = require("../utils/math");
const { generateGateCard } = require("../services/cardGenerator");
const { updateUser } = require("../services/database");
const { recordExtremeGateClear, recordDungeonClear, patchStats } = require("../services/eventService");
const { computePower } = require("../services/combatService");

module.exports = {
  data: new SlashCommandBuilder().setName("gate_risk").setDescription("High-risk gate: high reward or heavy penalty."),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const hunter = await ensureHunter({ userId: interaction.user.id, guildId: interaction.guildId });
    const cd = await getCooldown(interaction.user.id, interaction.guildId, "gate_risk");
    if (cd && new Date(cd.available_at).getTime() > Date.now()) {
      await interaction.editReply({ content: `Gate risk cooldown active: ${cooldownRemaining(cd.available_at)}s` });
      return;
    }

    const inventory = Array.isArray(hunter.inventory) ? [...hunter.inventory] : [];
    const activeHunterKeyIndex = inventory.indexOf("active_item:hunter_key");
    const activeGateCrystalIndex = inventory.indexOf("active_item:gate_crystal");
    const usedHunterKey = activeHunterKeyIndex >= 0;
    const usedGateCrystal = activeGateCrystalIndex >= 0;
    if (usedHunterKey) {
      inventory.splice(activeHunterKeyIndex, 1);
    }
    if (usedGateCrystal) {
      const idx = inventory.indexOf("active_item:gate_crystal");
      if (idx >= 0) inventory.splice(idx, 1);
    }
    if (usedHunterKey || usedGateCrystal) {
      await updateUser(interaction.user.id, interaction.guildId, { inventory });
    }

    const difficulty = "EXTREME";
    const rawChance =
      52 +
      (Number(hunter.level) || 0) * 0.7 +
      (Number(hunter.agility) || 0) * 0.45 +
      (Number(hunter.strength) || 0) * 0.15 +
      (usedHunterKey ? 14 : 0) +
      (usedGateCrystal ? 7 : 0);
    const successChance = Math.min(96, Math.max(48, Math.round(rawChance)));
    const roll = randomInt(1, 100);
    const didWin = roll <= successChance;

    let rewards = {};
    let progression;
    if (didWin) {
      const mult = (usedHunterKey ? 1.5 : 1) * (usedGateCrystal ? 1.2 : 1);
      const gold = Math.floor(randomInt(280, 520) * mult);
      const xp = Math.floor(randomInt(120, 240) * mult);
      rewards = { gold, xp };
      progression = await addXpAndGold(interaction.user.id, interaction.guildId, xp, gold);
      await recordExtremeGateClear(interaction.guildId, interaction.user.id);
      await recordDungeonClear(interaction.guildId, interaction.user.id);
    } else {
      const penalty = Math.floor(randomInt(80, 180) * (usedHunterKey ? 0.6 : 1));
      rewards = { penalty };
      progression = await addXpAndGold(interaction.user.id, interaction.guildId, 30, -penalty);
    }
    await patchStats(interaction.guildId, interaction.user.id, {
      combat_power: computePower(progression.hunter, []),
      top_gold: Number(progression.hunter.gold || 0),
    });

    const card = await generateGateCard(interaction.user, difficulty, rewards, didWin, successChance);
    await setCooldown(interaction.user.id, interaction.guildId, "gate_risk", nextCooldown(280));
    const chanceText = `**Win chance: ${successChance}%** ${didWin ? "✓" : "— Roll failed."}`;
    await interaction.editReply({
      content: [chanceText, usedHunterKey || usedGateCrystal ? "Active gate item effect consumed for this run." : null].filter(Boolean).join("\n"),
      files: [{ attachment: card, name: "gate-card.png" }],
    });
  },
};
