const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { ensureHunter } = require("../services/hunterService");
const { updateUser } = require("../services/database");

const SKILLS = [
  {
    key: "flame_slash",
    label: "Flame Slash",
    scrollToken: "skill_scroll:flame_slash",
    activeToken: "active_skill:flame_slash",
  },
  {
    key: "shadow_step",
    label: "Shadow Step",
    scrollToken: "skill_scroll:shadow_step",
    activeToken: "active_skill:shadow_step",
  },
  {
    key: "monarch_roar",
    label: "Monarch Roar",
    scrollToken: "skill_scroll:monarch_roar",
    activeToken: "active_skill:monarch_roar",
  },
];

const USABLE_ITEMS = [
  {
    key: "mana_potion",
    label: "Mana Potion",
    tokens: ["item:mana_potion", "Mana Potion", "potion"],
    apply: (hunter, inventory) => ({
      inventory,
      patch: { mana: Math.min(9999, Number(hunter.mana || 0) + 100) },
      text: "Used **Mana Potion**. +100 mana.",
    }),
  },
  {
    key: "hunter_key",
    label: "Hunter Key",
    tokens: ["item:hunter_key", "Hunter Key", "hunter_key"],
    apply: (_hunter, inventory) => {
      if (inventory.includes("active_item:hunter_key")) {
        return {
          inventory,
          patch: null,
          text: "Hunter Key is already active for your next gate.",
        };
      }
      inventory.push("active_item:hunter_key");
      return {
        inventory,
        patch: {},
        text: "Activated **Hunter Key** for your next `gate_risk`.",
      };
    },
  },
  {
    key: "shadow_essence",
    label: "Shadow Essence",
    tokens: ["material:shadow_essence", "Shadow Essence"],
    apply: (_hunter, inventory) => ({
      inventory,
      patch: { stat_points: Number(_hunter.stat_points || 0) + 3 },
      text: "Used **Shadow Essence**. +3 stat points.",
    }),
  },
  {
    key: "gate_crystal",
    label: "Gate Crystal",
    tokens: ["material:gate_crystal", "Gate Crystal"],
    apply: (_hunter, inventory) => {
      if (inventory.includes("active_item:gate_crystal")) {
        return { inventory, patch: null, text: "Gate Crystal is already active for your next gate." };
      }
      inventory.push("active_item:gate_crystal");
      return { inventory, patch: {}, text: "Activated **Gate Crystal** for your next gate run." };
    },
  },
  {
    key: "stat_reset",
    label: "Stat Reset Token",
    tokens: ["item:stat_reset_token", "Stat Reset Token", "stat_reset"],
    apply: (hunter, inventory) => {
      const refund =
        Math.max(0, Number(hunter.strength || 5) - 5) +
        Math.max(0, Number(hunter.agility || 5) - 5) +
        Math.max(0, Number(hunter.intelligence || 5) - 5) +
        Math.max(0, Number(hunter.vitality || 5) - 5);
      return {
        inventory,
        patch: {
          strength: 5,
          agility: 5,
          intelligence: 5,
          vitality: 5,
          stat_points: Number(hunter.stat_points || 0) + refund,
        },
        text: `Used **Stat Reset Token**. Refunded **${refund}** stat points.`,
      };
    },
  },
];

const USABLE_CHOICES = [
  ...SKILLS.map((s) => ({ name: s.label, value: s.key })),
  ...USABLE_ITEMS.map((i) => ({ name: i.label, value: i.key })),
];

function consumeFirstToken(inventory, tokens) {
  const list = Array.isArray(inventory) ? [...inventory] : [];
  for (const token of tokens) {
    const idx = list.indexOf(token);
    if (idx >= 0) {
      list.splice(idx, 1);
      return { ok: true, inventory: list };
    }
  }
  return { ok: false, inventory: list };
}

function shadowEssenceDailyState(hunter) {
  const today = new Date().toISOString().slice(0, 10);
  const cooldowns = hunter && typeof hunter.cooldowns === "object" && !Array.isArray(hunter.cooldowns)
    ? { ...hunter.cooldowns }
    : {};
  const state = cooldowns.shadow_essence && typeof cooldowns.shadow_essence === "object"
    ? cooldowns.shadow_essence
    : { date: today, points: 0 };
  const normalized = state.date === today ? Number(state.points || 0) : 0;
  return { today, cooldowns, pointsToday: Math.max(0, normalized) };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("use")
    .setDescription("Use purchased shop item/scroll (skills, potion, key, reset token).")
    .addStringOption((option) =>
      option
        .setName("item")
        .setDescription("Item or skill to use")
        .setRequired(false)
        .addChoices(...USABLE_CHOICES)
    )
    .addStringOption((option) =>
      option
        .setName("skill")
        .setDescription("Legacy option (still supported)")
        .setRequired(false)
        .addChoices(...USABLE_CHOICES)
    ),
  async execute(interaction) {
    try {
      const key = interaction.options.getString("item", false) || interaction.options.getString("skill", false);
      if (!key) {
        await interaction.reply({
          content: "Choose an item/skill in `/use` (item field).",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const skill = SKILLS.find((s) => s.key === key);
      const hunter = await ensureHunter({ userId: interaction.user.id, guildId: interaction.guildId });

      if (skill) {
        const inventory = Array.isArray(hunter.inventory) ? [...hunter.inventory] : [];
        const idx = inventory.indexOf(skill.scrollToken);
        if (idx < 0) {
          await interaction.reply({
            content: `You need **${skill.label} Scroll** from /shop first.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        inventory.splice(idx, 1);
        inventory.push(skill.activeToken);
        await updateUser(interaction.user.id, interaction.guildId, { inventory });

        await interaction.reply({
          content: `Activated **${skill.label}** for your next raid.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const item = USABLE_ITEMS.find((x) => x.key === key);
      if (!item) {
        await interaction.reply({ content: "Unknown item.", flags: MessageFlags.Ephemeral });
        return;
      }

      if (item.key === "shadow_essence") {
        const state = shadowEssenceDailyState(hunter);
        if (state.pointsToday >= 9) {
          await interaction.reply({
            content: "Daily limit reached: you can gain max **9 stat points** per day from Shadow Essence.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      const consumed = consumeFirstToken(hunter.inventory, item.tokens);
      if (!consumed.ok) {
        await interaction.reply({
          content: `You need **${item.label}** from /shop first.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const result = item.apply(hunter, consumed.inventory);
      const patch = { inventory: result.inventory, ...(result.patch || {}) };
      if (item.key === "shadow_essence") {
        const state = shadowEssenceDailyState(hunter);
        patch.cooldowns = {
          ...state.cooldowns,
          shadow_essence: {
            date: state.today,
            points: Math.min(9, state.pointsToday + 3),
          },
        };
      }
      await updateUser(interaction.user.id, interaction.guildId, patch);
      await interaction.reply({ content: result.text, flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.error("[use:error]", error);
      const payload = { content: "Could not use this item right now. Try again.", flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
      else await interaction.reply(payload);
    }
  },
};
