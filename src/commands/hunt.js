const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { ensureHunter, addXpAndGold } = require("../services/hunterService");
const { getCooldown, setCooldown } = require("../services/cooldownService");
const { runHunt } = require("../services/combatService");
const { cooldownRemaining, nextCooldown } = require("../utils/cooldownHelper");
const { sendStatus } = require("../utils/statusMessage");
const { generateHuntResultCard } = require("../services/cardGenerator");
const { tryGrantSingleCard } = require("../services/cardsService");
const { recordHunt, patchStats, getFactionXpBoost } = require("../services/eventService");
const { computePower } = require("../services/combatService");

module.exports = {
  data: new SlashCommandBuilder().setName("hunt").setDescription("Quick hunt for small XP and gold."),
  async execute(interaction) {
    const hunter = await ensureHunter({ userId: interaction.user.id, guildId: interaction.guildId });
    const cd = await getCooldown(interaction.user.id, interaction.guildId, "hunt");

    if (cd && new Date(cd.available_at).getTime() > Date.now()) {
      const remaining = cooldownRemaining(cd.available_at);
      await sendStatus(interaction, { ok: false, text: `Hunt cooldown active: ${remaining}s`, ephemeral: true });
      return;
    }

    const rewards = runHunt(hunter);
    const boost = await getFactionXpBoost(interaction.guildId, interaction.user.id);
    const boostedXp = Math.floor(Number(rewards.xp || 0) * Number(boost.multiplier || 1));
    const progression = await addXpAndGold(
      interaction.user.id,
      interaction.guildId,
      boostedXp,
      rewards.gold
    );
    const { hunter: updated, levelsGained } = progression;
    await setCooldown(interaction.user.id, interaction.guildId, "hunt", nextCooldown(300));
    await recordHunt(interaction.guildId, interaction.user.id);
    await patchStats(interaction.guildId, interaction.user.id, {
      combat_power: computePower(updated, []),
      top_gold: Number(updated.gold || 0),
    });
    const cardDrop = await tryGrantSingleCard(updated);

    const card = await generateHuntResultCard(interaction.user, rewards, levelsGained);
    const files = [{ attachment: card, name: "hunt-result.png" }];
    if (cardDrop.granted && cardDrop.imagePath) {
      files.push({ attachment: cardDrop.imagePath, name: "single-card.png" });
    }

    await interaction.reply({
      content:
        [
          cardDrop.granted ? `You unlocked **${cardDrop.card.name}** (drop chance: 0.025%).` : "",
          boost.multiplier > 1 ? `Faction bonus active (+10% XP for **${boost.faction}**).` : "",
        ]
          .filter(Boolean)
          .join("\n") || undefined,
      files,
      flags: MessageFlags.Ephemeral,
    });
  },
};
