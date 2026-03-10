const { ContainerBuilder, TextDisplayBuilder } = require("discord.js");
const { getStatusEmojis } = require("../config/emojis");

function getEmojis() {
  return getStatusEmojis();
}

function resolveEmoji(ctx, emoji) {
  if (!emoji || !emoji.id || !String(emoji.id).trim()) return (emoji && emoji.fallback) || "[?]";
  const guild = ctx?.guild || null;
  const me = guild?.members?.me || null;
  const canUseExternal = Boolean(me?.permissions?.has("UseExternalEmojis"));
  const existsInGuild = Boolean(guild && guild.emojis?.cache?.has(emoji.id));
  return canUseExternal || existsInGuild ? emoji.custom : (emoji.fallback || "[?]");
}

function buildStatusComponents(ctx, { ok, text }) {
  const emojis = getEmojis();
  const prefix = ok ? resolveEmoji(ctx, emojis.success) : resolveEmoji(ctx, emojis.error);
  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${prefix} ${text}`)
  );
  return [container];
}

function buildFlags(ephemeral = true) {
  const { MessageFlags } = require("discord.js");
  let flags = 0;
  if (MessageFlags && MessageFlags.IsComponentsV2) flags |= MessageFlags.IsComponentsV2;
  if (ephemeral) {
    if (MessageFlags && MessageFlags.Ephemeral) flags |= MessageFlags.Ephemeral;
    else flags |= 64;
  }
  return flags;
}

function buildStatusPayload(ctx, { ok, text, ephemeral = true }) {
  return {
    components: buildStatusComponents(ctx, { ok, text }),
    flags: buildFlags(ephemeral),
  };
}

async function sendStatus(interaction, { ok, text, ephemeral = true }) {
  const payload = buildStatusPayload(interaction, { ok, text, ephemeral });

  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp(payload);
    }
    return await interaction.reply(payload);
  } catch (error) {
    const code = error && error.code;
    if (code === 40060 || code === 10062) {
      return null;
    }
    throw error;
  }
}

module.exports = {
  getEmojis,
  sendStatus,
  buildStatusPayload,
  buildStatusComponents,
  buildFlags,
};