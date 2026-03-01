const fs = require("fs");
const path = require("path");
const { Canvas, FontLibrary, loadImage } = require("skia-canvas");
const { normalizeRank, rankBadgeText, rankColor } = require("../utils/constants");

const ASSETS_DIR = path.join(process.cwd(), "assets");
const MAIN_BACKGROUND_PATH = path.join(ASSETS_DIR, "backgrounds", "Main_background.png");
const emojiImageCache = new Map();

const STAT_EMOJI_IDS = {
  strength: "1475890708140392621",
  agility: "1475914899870978160",
  intelligence: "1475914937887887523",
  vitality: "1475914963225940221",
  gold: "1475915038182346894",
  mana: "1475915084911087708",
  level: "1475916361623408902",
  rank: "1475916735860445358",
};
const FONT_CANDIDATES = [
  "Sora-ExtraBold.ttf",
  "Sora-Black.ttf",
  "Sora-SemiBold.ttf",
  "Sora-Bold.ttf",
  "Poppins-ExtraBold.ttf",
  "Poppins-SemiBold.ttf",
  "Poppins-Bold.ttf",
  "Montserrat-ExtraBold.ttf",
  "Montserrat-SemiBold.ttf",
  "Montserrat-Bold.ttf",
  "Inter-Bold.ttf",
];

function setupPrimaryFont() {
  for (const file of FONT_CANDIDATES) {
    const full = path.join(ASSETS_DIR, "fonts", file);
    if (fs.existsSync(full)) {
      // Keep family name "Inter" in drawing code, but map it to the best available font file.
      FontLibrary.use("Inter", full);
      return file;
    }
  }
  return null;
}

setupPrimaryFont();

function formatDisplayName(name) {
  const value = String(name || "");
  if (!value) return "Hunter";
  return value.replace(/[A-Za-z0-9]+/g, (token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase());
}

async function safeLoadImage(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return loadImage(filePath);
}

function drawStrongText(ctx, text, x, y, size, color = "#F8FAFC", align = "left") {
  const prevAlign = ctx.textAlign;
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1.3, size * 0.052);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.95)";
  ctx.fillStyle = color;
  ctx.font = `900 ${size}px Inter`;
  ctx.textAlign = align;
  ctx.strokeText(String(text), x, y);
  ctx.fillText(String(text), x, y);
  
  // Add glow effect
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = color;
  ctx.fillText(String(text), x, y);
  ctx.shadowBlur = 0;
  ctx.textAlign = prevAlign;
}

function drawShinyBar(ctx, x, y, w, h, progress, colorA = "#2563EB", colorB = "#06B6D4") {
  const p = Math.max(0, Math.min(1, Number(progress || 0)));
  
  // Track/Background
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  roundedRect(ctx, x, y, w, h, 999);
  const trackGrad = ctx.createLinearGradient(x, y, x, y + h);
  trackGrad.addColorStop(0, "rgba(71, 85, 105, 0.85)");
  trackGrad.addColorStop(0.5, "rgba(51, 65, 85, 0.88)");
  trackGrad.addColorStop(1, "rgba(30, 41, 59, 0.92)");
  ctx.fillStyle = trackGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(148,163,184,0.45)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  const fw = Math.max(0, (w - 4) * p);
  if (fw <= 0) return;
  
  // Main fill bar
  roundedRect(ctx, x + 2, y + 2, fw, h - 4, 999);
  const grad = ctx.createLinearGradient(x + 2, y, x + 2 + fw, y);
  grad.addColorStop(0, colorA);
  grad.addColorStop(0.45, "#60A5FA");
  grad.addColorStop(0.55, "#38B6FF");
  grad.addColorStop(1, colorB);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Middle glow layer
  roundedRect(ctx, x + 2, y + 2, fw, h - 4, 999);
  const glowGrad = ctx.createLinearGradient(x + 2, y + 2, x + 2 + fw, y + h - 2);
  glowGrad.addColorStop(0, "rgba(255, 255, 255, 0.12)");
  glowGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.06)");
  glowGrad.addColorStop(1, "rgba(255, 255, 255, 0.02)");
  ctx.fillStyle = glowGrad;
  ctx.fill();

  // Top reflective highlight - Premium gloss
  roundedRect(ctx, x + 2, y + 2, fw, Math.max(10, (h - 4) * 0.46), 999);
  const gloss = ctx.createLinearGradient(x + 2, y + 2, x + 2, y + h * 0.65);
  gloss.addColorStop(0, "rgba(255,255,255,0.52)");
  gloss.addColorStop(0.35, "rgba(255,255,255,0.25)");
  gloss.addColorStop(1, "rgba(255,255,255,0.01)");
  ctx.fillStyle = gloss;
  ctx.fill();

  // Animated shine streak effect
  const shineW = Math.min(72, fw * 0.22);
  if (shineW > 12) {
    const sx = x + Math.max(8, fw - shineW - 12);
    roundedRect(ctx, sx, y + 3, shineW, h - 6, 999);
    const shineGrad = ctx.createLinearGradient(sx, y, sx + shineW, y);
    shineGrad.addColorStop(0, "rgba(255,255,255,0.00)");
    shineGrad.addColorStop(0.5, "rgba(255,255,255,0.35)");
    shineGrad.addColorStop(1, "rgba(255,255,255,0.00)");
    ctx.fillStyle = shineGrad;
    ctx.fill();
  }
  
  // Edge highlights
  roundedRect(ctx, x + 2, y + 2, fw, Math.max(4, (h - 4) * 0.15), 999);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fill();
  
  ctx.shadowBlur = 0;
}

function drawBoxShine(ctx, x, y, w, h, borderColor) {
  const edgeGlow = ctx.createLinearGradient(x, y, x + w, y + h);
  edgeGlow.addColorStop(0, `${borderColor}33`);
  edgeGlow.addColorStop(1, "rgba(255,255,255,0.04)");
  roundedRect(ctx, x - 1, y - 1, w + 2, h + 2, 16);
  ctx.fillStyle = edgeGlow;
  ctx.fill();
}

async function loadDiscordEmojiById(emojiId) {
  if (!emojiId) return null;
  if (emojiImageCache.has(emojiId)) return emojiImageCache.get(emojiId);
  try {
    const url = `https://cdn.discordapp.com/emojis/${emojiId}.png?size=64&quality=lossless`;
    const img = await loadImage(url);
    emojiImageCache.set(emojiId, img);
    return img;
  } catch {
    emojiImageCache.set(emojiId, null);
    return null;
  }
}

async function drawBackground(ctx, width, height, imagePath) {
  const image = await safeLoadImage(imagePath);
  if (image) {
    ctx.drawImage(image, 0, 0, width, height);
    return;
  }
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#0F172A");
  gradient.addColorStop(1, "#1E293B");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

async function drawMainBackground(ctx, width, height) {
  await drawBackground(ctx, width, height, MAIN_BACKGROUND_PATH);

  // Darker overlay for better contrast and modern look
  const darkWash = ctx.createLinearGradient(0, 0, width, height);
  darkWash.addColorStop(0, "rgba(2, 4, 12, 0.68)");
  darkWash.addColorStop(1, "rgba(3, 7, 18, 0.75)");
  ctx.fillStyle = darkWash;
  ctx.fillRect(0, 0, width, height);

  // Stronger vignette for focused content area
  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.2,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.8
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0.00)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.45)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

function toBuffer(canvas) {
  return canvas.toBuffer("png");
}

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawModernBox(ctx, x, y, w, h, borderColor, glowColor = null) {
  // Outer glow - Enhanced
  if (glowColor) {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.fillStyle = `${glowColor}15`;
    roundedRect(ctx, x - 12, y - 12, w + 24, h + 24, 18);
    ctx.fill();
    
    // Secondary glow layer
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.fillStyle = `${glowColor}08`;
    roundedRect(ctx, x - 6, y - 6, w + 12, h + 12, 18);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Main glass body - Premium gradient
  roundedRect(ctx, x, y, w, h, 16);
  const body = ctx.createLinearGradient(x, y, x, y + h);
  body.addColorStop(0, "rgba(45, 56, 75, 0.68)");
  body.addColorStop(0.5, "rgba(35, 48, 68, 0.75)");
  body.addColorStop(1, "rgba(20, 28, 45, 0.85)");
  ctx.fillStyle = body;
  ctx.fill();

  // Primary border - Enhanced
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2.8;
  ctx.stroke();
  
  // Outer glow border
  ctx.strokeStyle = `${borderColor}44`;
  ctx.lineWidth = 5;
  ctx.globalAlpha = 0.4;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Edge shine.
  drawBoxShine(ctx, x, y, w, h, glowColor || borderColor);

  // Inner highlight - Premium
  roundedRect(ctx, x + 2, y + 2, w - 4, h - 4, 14);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.20)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Top reflective strip - Premium
  roundedRect(ctx, x + 6, y + 6, w - 12, Math.max(16, h * 0.24), 10);
  const strip = ctx.createLinearGradient(x, y + 6, x, y + h * 0.32);
  strip.addColorStop(0, "rgba(255,255,255,0.22)");
  strip.addColorStop(0.4, "rgba(255,255,255,0.10)");
  strip.addColorStop(1, "rgba(255,255,255,0.00)");
  ctx.fillStyle = strip;
  ctx.fill();
  
  // Side highlight accents
  roundedRect(ctx, x + 3, y + h * 0.3, 2, h * 0.4, 999);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fill();
}

function drawModernProgressBar(ctx, options) {
  const {
    x,
    y,
    width,
    height,
    progress,
    label,
    valueText,
    startColor = "#3B82F6",
    endColor = "#06B6D4",
  } = options;

  const p = Math.max(0, Math.min(1, progress));

  // Outer glass panel - Enhanced
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  roundedRect(ctx, x, y - 28, width, height + 56, 14);
  const panelGrad = ctx.createLinearGradient(x, y - 28, x, y + height + 28);
  panelGrad.addColorStop(0, "rgba(25, 35, 55, 0.60)");
  panelGrad.addColorStop(1, "rgba(15, 23, 42, 0.75)");
  ctx.fillStyle = panelGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Label - Enhanced typography
  ctx.fillStyle = "#F0F4F8";
  ctx.font = "900 22px Inter";
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.fillText(label, x + 20, y + 2);
  ctx.shadowBlur = 0;
  
  // Track - Enhanced
  roundedRect(ctx, x + 14, y + 12, width - 28, height - 24, 999);
  const trackGrad = ctx.createLinearGradient(x + 14, y + 12, x + 14, y + 12 + height - 24);
  trackGrad.addColorStop(0, "rgba(45, 55, 75, 0.80)");
  trackGrad.addColorStop(1, "rgba(25, 35, 50, 0.90)");
  ctx.fillStyle = trackGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.28)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Fill - Premium shiny effect
  const fillW = (width - 28) * p;
  if (fillW > 0) {
    roundedRect(ctx, x + 14, y + 12, fillW, height - 24, 999);
    const fillGrad = ctx.createLinearGradient(x + 14, y, x + 14 + fillW, y);
    fillGrad.addColorStop(0, startColor);
    fillGrad.addColorStop(0.45, "#5BBDFF");
    fillGrad.addColorStop(0.55, "#38D4FF");
    fillGrad.addColorStop(1, endColor);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.fillStyle = fillGrad;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Premium highlight on top
    roundedRect(ctx, x + 14, y + 12, fillW, (height - 24) * 0.48, 999);
    const topGlow = ctx.createLinearGradient(x + 14, y + 12, x + 14, y + 12 + (height - 24) * 0.48);
    topGlow.addColorStop(0, "rgba(255,255,255,0.45)");
    topGlow.addColorStop(1, "rgba(255,255,255,0.05)");
    ctx.fillStyle = topGlow;
    ctx.fill();
    
    // Shine streak
    const shineW = Math.min(80, fillW * 0.25);
    if (shineW > 12) {
      const sx = x + 14 + Math.max(10, fillW - shineW - 10);
      roundedRect(ctx, sx, y + 14, shineW, height - 28, 999);
      const shineGrad = ctx.createLinearGradient(sx, y, sx + shineW, y);
      shineGrad.addColorStop(0, "rgba(255,255,255,0.00)");
      shineGrad.addColorStop(0.5, "rgba(255,255,255,0.28)");
      shineGrad.addColorStop(1, "rgba(255,255,255,0.00)");
      ctx.fillStyle = shineGrad;
      ctx.fill();
    }
  }

  // Value text pill - Enhanced
  const pillW = 180;
  const pillH = 38;
  const pillX = x + width - pillW - 14;
  const pillY = y - 22;
  
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  roundedRect(ctx, pillX, pillY, pillW, pillH, 999);
  const pillGrad = ctx.createLinearGradient(pillX, pillY, pillX, pillY + pillH);
  pillGrad.addColorStop(0, "rgba(30, 45, 70, 0.85)");
  pillGrad.addColorStop(1, "rgba(15, 25, 45, 0.95)");
  ctx.fillStyle = pillGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.45)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.shadowBlur = 0;
  
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 16px Inter";
  ctx.textAlign = "center";
  ctx.fillText(valueText, pillX + pillW / 2, pillY + 26);
  ctx.textAlign = "left";
}

async function generateProfileCard(user, hunter) {
  const displayName = formatDisplayName(user.username);
  const width = 1400;
  const height = 700;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");
  const rankLabel = normalizeRank(hunter.rank);
  const rankTint = rankColor(rankLabel);
  const rankBadge = rankBadgeText(rankLabel);

  await drawMainBackground(ctx, width, height);

  // Top accent bar - cleaner
  ctx.fillStyle = "#7C3AED";
  ctx.fillRect(0, 0, width, 6);

  // Avatar Circle - Larger
  const avatarSize = 200;
  const avatarX = 48;
  const avatarY = 32;
  
  // Avatar Background Circle
  ctx.fillStyle = "rgba(124, 58, 237, 0.2)";
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 6, 0, Math.PI * 2);
  ctx.fill();
  
  // Avatar Circle
  ctx.fillStyle = "#1E293B";
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.fill();

  // Draw user avatar (Discord avatar URL)
  try {
    const avatarUrl = user.displayAvatarURL({ size: 512 });
    if (avatarUrl) {
      const avatarImg = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
    }
  } catch (e) {
    // Fallback
  }

  // Rank Badge - Larger
  const badgeX = avatarX + avatarSize - 50;
  const badgeY = avatarY + avatarSize - 50;
  const badgeSize = 70;
  
  ctx.fillStyle = rankTint;
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeSize / 2, 0, Math.PI * 2);
  ctx.fill();
  
  // Badge border
  ctx.strokeStyle = "#0F172A";
  ctx.lineWidth = 3;
  ctx.stroke();
  
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 40px Inter";
  ctx.textAlign = "center";
  ctx.fillText(rankBadge, badgeX, badgeY + 14);
  ctx.textAlign = "left";

  // Username & Title Section - Larger
  const infoX = avatarX + avatarSize + 48;
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 56px Inter";
  ctx.fillText(displayName, infoX, 110);

  ctx.fillStyle = "#CBD5E1";
  ctx.font = "900 26px Inter";
  ctx.fillText(`Rank ${rankLabel} | Level ${hunter.level} | Points ${Number(hunter.stat_points || 0)}`, infoX, 160);

  // Left side - Main Stats
  const leftX = 48;
  let currentY = 280;

  // EXP Bar - Large
  ctx.fillStyle = "#CBD5E1";
  ctx.font = "900 22px Inter";
  ctx.fillText("Experience", leftX, currentY);
  
  const expBarWidth = 420;
  const expBarHeight = 36;
  const maxExp = Math.ceil(100 * Math.pow(hunter.level, 1.5));
  const expPercent = Math.min(hunter.exp / maxExp, 1);
  
  roundedRect(ctx, leftX, currentY + 12, expBarWidth, expBarHeight, 12);
  ctx.fillStyle = "rgba(51, 65, 85, 0.8)";
  ctx.fill();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
  ctx.lineWidth = 2;
  ctx.stroke();
  
  roundedRect(ctx, leftX, currentY + 12, expBarWidth * expPercent, expBarHeight, 12);
  ctx.fillStyle = "#3B82F6";
  ctx.fill();
  
  ctx.fillStyle = "#E2E8F0";
  ctx.font = "900 16px Inter";
  ctx.fillText(`${hunter.exp} / ${maxExp}`, leftX + expBarWidth + 20, currentY + 40);

  currentY += 100;

  // Resources Row - Larger
  const resourceBoxWidth = 180;
  const resourceBoxHeight = 120;
  const resources = [
    { key: "gold", label: "Gold", value: hunter.gold, color: "#FBBF24" },
    { key: "mana", label: "Mana", value: hunter.mana, color: "#A78BFA" },
  ];

  for (let i = 0; i < resources.length; i += 1) {
    const res = resources[i];
    const x = leftX + i * (resourceBoxWidth + 28);
    drawModernBox(ctx, x, currentY, resourceBoxWidth, resourceBoxHeight, res.color, res.color);

    ctx.fillStyle = "#94A3B8";
    ctx.font = "900 18px Inter";
    const emoji = await loadDiscordEmojiById(STAT_EMOJI_IDS[res.key]);
    if (emoji) {
      ctx.drawImage(emoji, x + 18, currentY + 17, 22, 22);
      ctx.fillText(res.label, x + 46, currentY + 37);
    } else {
      ctx.fillText(res.label, x + 20, currentY + 42);
    }

    ctx.fillStyle = res.color;
    ctx.font = "900 42px Inter";
    ctx.fillText(String(res.value), x + 20, currentY + 98);
  }

  // Right side - Stats Grid - LARGER
  const rightX = 700;
  const statsStartY = 280;
  const statBoxWidth = 300;
  const statBoxHeight = 100;
  const statPadding = 20;

  const stats = [
    { key: "strength", label: "STR", value: hunter.strength, color: "#EF4444" },
    { key: "agility", label: "AGI", value: hunter.agility, color: "#10B981" },
  ];

  for (let i = 0; i < stats.length; i += 1) {
    const stat = stats[i];
    const x = rightX + i * (statBoxWidth + statPadding);
    const y = statsStartY;

    drawModernBox(ctx, x, y, statBoxWidth, statBoxHeight, stat.color, stat.color);

    const emoji = await loadDiscordEmojiById(STAT_EMOJI_IDS[stat.key]);
    ctx.fillStyle = stat.color;
    ctx.font = "900 20px Inter";
    if (emoji) {
      ctx.drawImage(emoji, x + 22, y + 13, 22, 22);
      ctx.fillText(stat.label, x + 52, y + 38);
    } else {
      ctx.fillText(stat.label, x + 24, y + 38);
    }

    ctx.fillStyle = "#F8FAFC";
    ctx.font = "900 56px Inter";
    ctx.fillText(String(stat.value), x + 24, y + 92);
  }

  // INT & VIT below
  const intVitStats = [
    { key: "intelligence", label: "INT", value: hunter.intelligence, color: "#3B82F6" },
    { key: "vitality", label: "VIT", value: hunter.vitality, color: "#F59E0B" },
  ];

  for (let i = 0; i < intVitStats.length; i += 1) {
    const stat = intVitStats[i];
    const x = rightX + i * (statBoxWidth + statPadding);
    const y = statsStartY + statBoxHeight + statPadding + 20;

    drawModernBox(ctx, x, y, statBoxWidth, statBoxHeight, stat.color, stat.color);

    const emoji = await loadDiscordEmojiById(STAT_EMOJI_IDS[stat.key]);
    ctx.fillStyle = stat.color;
    ctx.font = "900 20px Inter";
    if (emoji) {
      ctx.drawImage(emoji, x + 22, y + 13, 22, 22);
      ctx.fillText(stat.label, x + 52, y + 38);
    } else {
      ctx.fillText(stat.label, x + 24, y + 38);
    }

    ctx.fillStyle = "#F8FAFC";
    ctx.font = "900 56px Inter";
    ctx.fillText(String(stat.value), x + 24, y + 92);
  }

  return toBuffer(canvas);
}

async function generateShadowCard(shadows, username = "Hunter") {
  const displayName = formatDisplayName(username);
  const width = 960;
  const height = 540;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");
  await drawMainBackground(ctx, width, height);

  ctx.fillStyle = "rgba(0,0,0,0.58)";
  ctx.fillRect(20, 20, width - 40, height - 40);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 44px Inter";
  ctx.fillText(`${displayName} - Shadow Army`, 40, 80);
  ctx.font = "900 25px Inter";

  shadows.slice(0, 12).forEach((s, i) => {
    const y = 130 + i * 32;
    ctx.fillText(
      `${i + 1}. ${s.equipped ? "[EQ] " : ""}${s.rarity} ${s.name} Lv.${s.level} DMG:${s.base_damage} AB:${s.ability_bonus}`,
      40,
      y
    );
  });

  return toBuffer(canvas);
}

async function generateDungeonResultCard(result) {
  const width = 1280;
  const height = 720;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");
  await drawMainBackground(ctx, width, height);

  const accent = result.didWin ? "#10B981" : "#EF4444";
  const accentSoft = result.didWin ? "rgba(16,185,129,0.24)" : "rgba(239,68,68,0.24)";
  const panelBg = "rgba(7, 12, 26, 0.70)";

  // Atmosphere tint
  const wash = ctx.createLinearGradient(0, 0, width, height);
  wash.addColorStop(0, result.didWin ? "rgba(8, 44, 34, 0.42)" : "rgba(52, 13, 16, 0.42)");
  wash.addColorStop(1, "rgba(2, 6, 23, 0.58)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  // Top accent strip
  const strip = ctx.createLinearGradient(0, 0, width, 0);
  strip.addColorStop(0, accent);
  strip.addColorStop(1, result.didWin ? "#22D3EE" : "#F97316");
  ctx.fillStyle = strip;
  ctx.fillRect(0, 0, width, 8);

  // Outer frame
  roundedRect(ctx, 28, 28, width - 56, height - 56, 24);
  ctx.fillStyle = panelBg;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // Header
  const title = `Dungeon ${String(result.difficulty || "Run")}`;
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 68px Inter";
  ctx.fillText(title, 70, 124);
  ctx.fillStyle = "#94A3B8";
  ctx.font = "900 24px Inter";
  ctx.fillText("Combat analytics and reward breakdown", 72, 162);

  // Status badge
  const badgeX = width - 300;
  const badgeY = 64;
  const badgeW = 214;
  const badgeH = 72;
  roundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 12);
  ctx.fillStyle = accentSoft;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.font = "900 46px Inter";
  ctx.textAlign = "center";
  ctx.fillText(result.didWin ? "VICTORY" : "DEFEAT", badgeX + badgeW / 2, badgeY + 51);
  ctx.textAlign = "left";

  // Left analytics block
  const leftX = 64;
  const leftY = 206;
  const leftW = 740;
  const leftH = 448;
  roundedRect(ctx, leftX, leftY, leftW, leftH, 20);
  ctx.fillStyle = "rgba(8, 13, 30, 0.72)";
  ctx.fill();
  ctx.strokeStyle = "rgba(148,163,184,0.25)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Metric cards
  const statBoxW = 340;
  const statBoxH = 116;
  const gapX = 24;
  const gapY = 20;
  const statStartX = leftX + 24;
  const statStartY = leftY + 24;

  const stats = [
    { label: "Win Chance", value: `${Number(result.winChance || 0).toFixed(1)}%`, color: "#3B82F6" },
    { label: "Your Power", value: String(result.playerPower || 0), color: "#14B8A6" },
    { label: "Enemy Power", value: String(result.enemyPower || 0), color: "#F43F5E" },
    { label: "XP Gained", value: result.didWin ? `+${result.xp || 0}` : "Minor", color: "#F59E0B" },
  ];

  stats.forEach((stat, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = statStartX + col * (statBoxW + gapX);
    const y = statStartY + row * (statBoxH + gapY);

    roundedRect(ctx, x, y, statBoxW, statBoxH, 16);
    ctx.fillStyle = "rgba(15,23,42,0.72)";
    ctx.fill();
    ctx.strokeStyle = stat.color;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    roundedRect(ctx, x + 2, y + 2, statBoxW - 4, statBoxH - 4, 14);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#A8B3C8";
    ctx.font = "900 30px Inter";
    ctx.fillText(stat.label, x + 18, y + 42);
    ctx.fillStyle = stat.color;
    ctx.font = "900 54px Inter";
    ctx.fillText(stat.value, x + 18, y + 98);
  });

  // Rewards strip
  const rewardY = leftY + leftH - 136;
  roundedRect(ctx, leftX + 24, rewardY, leftW - 48, 108, 14);
  ctx.fillStyle = "rgba(9, 15, 36, 0.74)";
  ctx.fill();
  ctx.strokeStyle = "rgba(148,163,184,0.22)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = "#CBD5E1";
  ctx.font = "900 26px Inter";
  ctx.fillText("Rewards", leftX + 44, rewardY + 42);

  const goldLabel = result.didWin ? `+${result.gold || 0}` : `-${result.penaltyGold || 0}`;
  ctx.fillStyle = "#FBBF24";
  ctx.font = "900 50px Inter";
  ctx.fillText(`${goldLabel} Gold`, leftX + 44, rewardY + 92);

  const shadowX = leftX + 340;
  if (result.arisenShadow) {
    roundedRect(ctx, shadowX, rewardY + 16, leftW - 390, 72, 12);
    ctx.fillStyle = "rgba(42, 25, 74, 0.48)";
    ctx.fill();
    ctx.strokeStyle = "#A78BFA";
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.fillStyle = "#CBD5E1";
    ctx.font = "900 22px Inter";
    ctx.fillText("Shadow Obtained", shadowX + 18, rewardY + 45);
    ctx.fillStyle = "#A78BFA";
    ctx.font = "900 28px Inter";
    ctx.fillText(`${result.arisenShadow.rarity} ${result.arisenShadow.name}`.slice(0, 34), shadowX + 18, rewardY + 78);
  } else {
    roundedRect(ctx, shadowX, rewardY + 16, leftW - 390, 72, 12);
    ctx.fillStyle = "rgba(15, 23, 42, 0.70)";
    ctx.fill();
    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#7B8AA3";
    ctx.font = "900 25px Inter";
    ctx.fillText("No Shadow Obtained", shadowX + 18, rewardY + 62);
  }

  // Right summary rail
  const rightX = 836;
  const rightY = 206;
  const rightW = 380;
  const rightH = 448;
  roundedRect(ctx, rightX, rightY, rightW, rightH, 20);
  ctx.fillStyle = "rgba(9, 13, 30, 0.78)";
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#A8B3C8";
  ctx.font = "900 21px Inter";
  ctx.fillText("Encounter Summary", rightX + 28, rightY + 44);

  const summaryLines = [
    `Outcome: ${result.didWin ? "Cleared" : "Failed"}`,
    `Difficulty: ${String(result.difficulty || "Unknown")}`,
    `Power Gap: ${Math.abs(Number(result.playerPower || 0) - Number(result.enemyPower || 0))}`,
    `Drop Chance (ARISE): ${result.didWin ? "Active" : "Blocked"}`,
  ];

  let sy = rightY + 94;
  for (const line of summaryLines) {
    roundedRect(ctx, rightX + 22, sy - 24, rightW - 44, 52, 10);
    ctx.fillStyle = "rgba(15,23,42,0.68)";
    ctx.fill();
    ctx.strokeStyle = "rgba(148,163,184,0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#E2E8F0";
    ctx.font = "900 22px Inter";
    ctx.fillText(line, rightX + 36, sy + 10);
    sy += 70;
  }

  roundedRect(ctx, rightX + 22, rightY + rightH - 130, rightW - 44, 94, 12);
  ctx.fillStyle = accentSoft;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 28px Inter";
  ctx.fillText(result.didWin ? "Hunter Dominance Confirmed" : "Recalibrate and Re-enter", rightX + 36, rightY + rightH - 72);
  ctx.fillStyle = "#CBD5E1";
  ctx.font = "900 20px Inter";
  ctx.fillText("Progression is based on real account stats.", rightX + 36, rightY + rightH - 40);

  return toBuffer(canvas);
}

async function generateInventoryCard(user, hunter) {
  const displayName = formatDisplayName(user.username);
  const width = 1100;
  const height = 700;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");
  await drawMainBackground(ctx, width, height);

  const overlay = ctx.createLinearGradient(0, 0, width, height);
  overlay.addColorStop(0, "rgba(15,23,42,0.82)");
  overlay.addColorStop(1, "rgba(2,6,23,0.82)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 52px Inter";
  ctx.fillText(`${displayName} Inventory`, 42, 72);
  ctx.font = "900 24px Inter";
  ctx.fillStyle = "#CBD5E1";
  ctx.fillText(`Gold ${hunter.gold}  |  Rank ${normalizeRank(hunter.rank)}  |  Level ${hunter.level}`, 44, 110);

  const items = Array.isArray(hunter.inventory) ? hunter.inventory : [];
  const list = items.slice(0, 18);
  const startX = 46;
  const startY = 150;
  const columns = 3;
  const tileW = 330;
  const tileH = 74;
  const gapX = 16;
  const gapY = 12;

  if (!list.length) {
    roundedRect(ctx, 44, 160, width - 88, 120, 14);
    ctx.fillStyle = "rgba(51,65,85,0.66)";
    ctx.fill();
    ctx.fillStyle = "#E2E8F0";
    ctx.font = "900 30px Inter";
    ctx.fillText("No items yet. Use /shop to buy your first item.", 70, 232);
    return toBuffer(canvas);
  }

  list.forEach((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = startX + col * (tileW + gapX);
    const y = startY + row * (tileH + gapY);

    roundedRect(ctx, x, y, tileW, tileH, 12);
    ctx.fillStyle = "rgba(30,41,59,0.80)";
    ctx.fill();
    ctx.strokeStyle = "rgba(148,163,184,0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#E2E8F0";
    ctx.font = "900 22px Inter";
    ctx.fillText(`#${index + 1}`, x + 16, y + 46);
    ctx.fillStyle = "#F8FAFC";
    ctx.font = "900 24px Inter";
    ctx.fillText(String(item), x + 70, y + 46);
  });

  return toBuffer(canvas);
}

async function generateCardsCollectionCard(username, cards) {
  const displayName = formatDisplayName(username);
  const width = 1400;
  const height = 900;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");
  await drawMainBackground(ctx, width, height);

  const overlay = ctx.createLinearGradient(0, 0, width, height);
  overlay.addColorStop(0, "rgba(8,12,28,0.78)");
  overlay.addColorStop(1, "rgba(15,23,42,0.86)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 56px Inter";
  ctx.fillText(`${displayName} Card Collection`, 42, 78);
  ctx.font = "900 24px Inter";
  ctx.fillStyle = "#CBD5E1";
  ctx.fillText(`Total cards: ${cards.length}`, 44, 114);

  const visible = cards.slice(0, 12);
  if (!visible.length) {
    roundedRect(ctx, 46, 164, width - 92, 130, 14);
    ctx.fillStyle = "rgba(30,41,59,0.70)";
    ctx.fill();
    ctx.fillStyle = "#E2E8F0";
    ctx.font = "900 32px Inter";
    ctx.fillText("No cards collected yet. The unique card drops at 0.025%.", 78, 244);
    return toBuffer(canvas);
  }

  const cardW = 220;
  const cardH = 310;
  const gap = 24;
  const columns = Math.min(4, visible.length);
  const rows = Math.ceil(visible.length / columns);
  const gridW = columns * cardW + (columns - 1) * gap;
  const gridStartX = Math.floor((width - gridW) / 2);
  const gridStartY = Math.max(170, Math.floor((height - (rows * cardH + (rows - 1) * gap)) / 2) + 40);

  for (let index = 0; index < visible.length; index += 1) {
    const card = visible[index];
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = gridStartX + col * (cardW + gap);
    const y = gridStartY + row * (cardH + gap);
    const accent = rarityColor(card.rarity);

    roundedRect(ctx, x, y, cardW, cardH, 16);
    ctx.fillStyle = "rgba(15,23,42,0.95)";
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    roundedRect(ctx, x + 14, y + 14, cardW - 28, 120, 10);
    ctx.fillStyle = "rgba(51,65,85,0.72)";
    ctx.fill();
    const slug = String(card.asset || card.title || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const imagePath = path.join(ASSETS_DIR, "cards", `${slug}.png`);
    const img = await safeLoadImage(imagePath);
    if (img) {
      ctx.drawImage(img, x + 18, y + 18, cardW - 36, 112);
    }

    ctx.fillStyle = accent;
    ctx.font = "900 18px Inter";
    ctx.fillText(card.rarity, x + 18, y + 170);

    ctx.fillStyle = "#F8FAFC";
    ctx.font = "900 25px Inter";
    ctx.fillText(card.title.slice(0, 14), x + 18, y + 206);

    ctx.fillStyle = "#CBD5E1";
    ctx.font = "900 17px Inter";
    ctx.fillText(card.subtitle.slice(0, 22), x + 18, y + 236);
    ctx.fillText(card.meta.slice(0, 24), x + 18, y + 260);

    ctx.fillStyle = "#94A3B8";
    ctx.font = "900 16px Inter";
    ctx.fillText(`#${index + 1}`, x + 18, y + 286);
  }

  return toBuffer(canvas);
}

async function generateLeaderboardCard(hunters, title = "Hunter Leaderboard") {
  const width = 1100;
  const height = 750;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");

  await drawMainBackground(ctx, width, height);

  // Decorative top bar
  const topGradient = ctx.createLinearGradient(0, 0, width, 6);
  topGradient.addColorStop(0, "#EC4899");
  topGradient.addColorStop(0.5, "#7C3AED");
  topGradient.addColorStop(1, "#EC4899");
  ctx.fillStyle = topGradient;
  ctx.fillRect(0, 0, width, 6);

  // Title
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 52px Inter";
  ctx.fillText(title, 48, 80);

  // Header row
  const headerY = 120;
  const headerH = 50;
  
  roundedRect(ctx, 48, headerY, width - 96, headerH, 12);
  ctx.fillStyle = "rgba(124, 58, 237, 0.2)";
  ctx.fill();
  ctx.strokeStyle = "rgba(124, 58, 237, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#CBD5E1";
  ctx.font = "900 16px Inter";
  ctx.fillText("Rank", 68, headerY + 33);
  ctx.fillText("Player", 140, headerY + 33);
  ctx.fillText("Level", 520, headerY + 33);
  ctx.fillText("Experience", 680, headerY + 33);
  ctx.fillText("Gold", 950, headerY + 33);

  // Leaderboard rows
  const rowH = 70;
  const maxRows = Math.min(hunters.length, 9);
  
  hunters.slice(0, maxRows).forEach((hunter, i) => {
    const y = headerY + headerH + i * (rowH + 12);
    const isTopThree = i < 3;
    
    // Medal colors for top 3
    let medalColor = "#CBD5E1";
    let medalEmoji = `#${i + 1}`;
    if (i === 0) {
      medalColor = "#FFD700";
      medalEmoji = "­ƒÑç";
    } else if (i === 1) {
      medalColor = "#C0C0C0";
      medalEmoji = "­ƒÑê";
    } else if (i === 2) {
      medalColor = "#CD7F32";
      medalEmoji = "­ƒÑë";
    }

    roundedRect(ctx, 48, y, width - 96, rowH, 10);
    ctx.fillStyle = isTopThree ? "rgba(124, 58, 237, 0.15)" : "rgba(51, 65, 85, 0.4)";
    ctx.fill();
    ctx.strokeStyle = isTopThree ? medalColor : "rgba(148, 163, 184, 0.2)";
    ctx.lineWidth = isTopThree ? 2 : 1;
    ctx.stroke();

    // Rank/Medal
    ctx.fillStyle = medalColor;
    ctx.font = "900 24px Inter";
    ctx.fillText(medalEmoji, 68, y + 45);

    // Username
    ctx.fillStyle = "#F8FAFC";
    ctx.font = "900 22px Inter";
    ctx.fillText(formatDisplayName(String(hunter.username)).substring(0, 35), 140, y + 45);

    // Rank badge
    const hunterRank = normalizeRank(hunter.rank);
    const rankTint = rankColor(hunterRank);
    ctx.fillStyle = rankTint;
    ctx.font = "900 14px Inter";
    ctx.fillText(`[${hunterRank}]`, 500, y + 25);

    // Level
    ctx.fillStyle = "#CBD5E1";
    ctx.font = "900 18px Inter";
    ctx.fillText(`Lv. ${hunter.level}`, 520, y + 50);

    // EXP Bar (smaller)
    const expBarW = 180;
    const expBarH = 12;
    const maxExp = Math.ceil(100 * Math.pow(hunter.level, 1.5));
    const expPercent = Math.min(hunter.exp / maxExp, 1);

    roundedRect(ctx, 680, y + 20, expBarW, expBarH, 6);
    ctx.fillStyle = "rgba(51, 65, 85, 0.6)";
    ctx.fill();

    roundedRect(ctx, 680, y + 20, expBarW * expPercent, expBarH, 6);
    const expGrad = ctx.createLinearGradient(680, 0, 680 + expBarW, 0);
    expGrad.addColorStop(0, "#3B82F6");
    expGrad.addColorStop(1, "#0EA5E9");
    ctx.fillStyle = expGrad;
    ctx.fill();

    ctx.fillStyle = "#94A3B8";
    ctx.font = "900 12px Inter";
    ctx.fillText(`${Math.floor(expPercent * 100)}%`, 680, y + 50);

    // Gold
    ctx.fillStyle = "#FBBF24";
    ctx.font = "900 18px Inter";
    ctx.fillText(String(hunter.gold), 950, y + 45);
  });

  return toBuffer(canvas);
}

async function generateStatsCard(user, hunter, metrics = {}) {
  const displayName = formatDisplayName(user.username);
  const width = 1400;
  const height = 880;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");

  await drawMainBackground(ctx, width, height);

  const rankLabel = normalizeRank(hunter.rank);
  const rankTint = rankColor(rankLabel);
  const rankBadge = rankBadgeText(rankLabel);

  // Top accent bar
  ctx.fillStyle = "#3B82F6";
  ctx.fillRect(0, 0, width, 6);

  // Avatar Circle - Large
  const avatarSize = 200;
  const avatarX = 48;
  const avatarY = 32;
  
  ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 6, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = "#1E293B";
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.fill();

  // Draw user avatar
  try {
    const avatarUrl = user.displayAvatarURL({ size: 512 });
    if (avatarUrl) {
      const avatarImg = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
    }
  } catch (e) {
    // Fallback
  }

  // Rank Badge
  const badgeX = avatarX + avatarSize - 50;
  const badgeY = avatarY + avatarSize - 50;
  const badgeSize = 70;
  
  ctx.fillStyle = rankTint;
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeSize / 2, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.strokeStyle = "#0F172A";
  ctx.lineWidth = 3;
  ctx.stroke();
  
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 40px Inter";
  ctx.textAlign = "center";
  ctx.fillText(rankBadge, badgeX, badgeY + 14);
  ctx.textAlign = "left";

  // Title Section
  const titleX = avatarX + avatarSize + 48;
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 56px Inter";
  ctx.fillText(displayName, titleX, 110);

  ctx.fillStyle = "#CBD5E1";
  ctx.font = "900 26px Inter";
  ctx.fillText("Detailed Combat Stats", titleX, 160);

  const expNeeded = metrics.expNeeded || Math.ceil(100 * Math.pow(hunter.level, 1.5));
  const basePower = Number(metrics.basePower || 0);
  const shadowPower = Number(metrics.shadowPower || 0);
  const cardPower = Number(metrics.cardPower || 0);
  const finalPower = Number(metrics.finalPower || 0);
  const equippedShadows = Number(metrics.equippedShadows || 0);
  const shadowSlots = Number(metrics.shadowSlots || hunter.shadow_slots || 0);
  const ownedCards = Number(metrics.ownedCards || 0);
  const topCards = String(metrics.topCards || "None");

  // Stats Grid - Four Columns
  const statsStartX = 48;
  const statsStartY = 280;
  const colWidth = 320;
  const rowHeight = 130;
  const gap = 20;

  const allStats = [
    { key: "strength", label: "Strength", value: hunter.strength, color: "#EF4444" },
    { key: "agility", label: "Agility", value: hunter.agility, color: "#10B981" },
    { key: "intelligence", label: "Intelligence", value: hunter.intelligence, color: "#3B82F6" },
    { key: "vitality", label: "Vitality", value: hunter.vitality, color: "#F59E0B" },
    { key: "gold", label: "Gold", value: hunter.gold, color: "#FBBF24" },
    { key: "mana", label: "Mana", value: hunter.mana, color: "#A78BFA" },
    { key: "level", label: "Level", value: hunter.level, color: "#06B6D4" },
    { key: "rank", label: "Rank", value: rankLabel, color: rankTint }
  ];

  for (let i = 0; i < allStats.length; i += 1) {
    const stat = allStats[i];
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = statsStartX + col * (colWidth + gap);
    const y = statsStartY + row * (rowHeight + gap);

    // Modern box with glow effect
    drawModernBox(ctx, x, y, colWidth, rowHeight, stat.color, stat.color);

    const emoji = await loadDiscordEmojiById(STAT_EMOJI_IDS[stat.key]);
    const labelX = x + 28;
    if (emoji) {
      ctx.drawImage(emoji, x + 24, y + 16, 26, 26);
      ctx.fillStyle = stat.color;
      ctx.font = "900 24px Inter";
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.fillText(stat.label, x + 58, y + 40);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = stat.color;
      ctx.font = "900 24px Inter";
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.fillText(stat.label, labelX, y + 44);
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = "#F8FAFC";
    ctx.font = "900 56px Inter";
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.fillText(String(stat.value), x + 28, y + 112);
    ctx.shadowBlur = 0;
  }

  // EXP Info at bottom
  const expY = statsStartY + 2 * (rowHeight + gap) + 40;
  const expPercent = Math.min(hunter.exp / expNeeded, 1);

  drawModernProgressBar(ctx, {
    x: 48,
    y: expY + 8,
    width: width - 96,
    height: 58,
    progress: expPercent,
    label: "Experience Progress",
    valueText: `${hunter.exp} / ${expNeeded} (${Math.floor(expPercent * 100)}%)`,
    startColor: "#2563EB",
    endColor: "#06B6D4",
  });

  // Real combat breakdown row
  const breakdownY = expY + 126;
  const bW = 300;
  const bH = 92;
  const bGap = 20;
  const entries = [
    { label: "Base Power", value: basePower, color: "#22c55e" },
    { label: "Shadow Bonus", value: `+${shadowPower}`, color: "#a78bfa" },
    { label: "Card Bonus", value: `+${cardPower}`, color: "#f59e0b" },
    { label: "Final Power", value: finalPower, color: "#ef4444" },
  ];

  entries.forEach((e, i) => {
    const x = 48 + i * (bW + bGap);
    drawModernBox(ctx, x, breakdownY, bW, bH, e.color, e.color);
    
    ctx.fillStyle = "#94A3B8";
    ctx.font = "900 16px Inter";
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.fillText(e.label, x + 20, breakdownY + 36);
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = e.color;
    ctx.font = "900 42px Inter";
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.fillText(String(e.value), x + 20, breakdownY + 82);
    ctx.shadowBlur = 0;
  });

  // Info footer
  ctx.fillStyle = "#94A3B8";
  ctx.font = "900 16px Inter";
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  const infoText = `Shadows: ${equippedShadows}/${shadowSlots} | Cards: ${ownedCards} | Top Set: ${topCards}`;
  ctx.fillText(infoText, 48, breakdownY + 140);
  ctx.shadowBlur = 0;

  return toBuffer(canvas);
}

async function generateHuntResultCard(user, rewards, levelsGained) {
  const displayName = formatDisplayName(user.username);
  const width = 1200;
  const height = 600;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");

  await drawMainBackground(ctx, width, height);

  // Top Accent Bar - Green for hunt
  ctx.fillStyle = "#10B981";
  ctx.fillRect(0, 0, width, 6);

  // Title
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 64px Inter";
  ctx.fillText("Hunt Complete!", 48, 100);

  // Rewards boxes
  const boxW = 320;
  const boxH = 140;
  const startX = 48;
  const startY = 160;
  const gap = 32;

  const rewards_list = [
    { key: "level", label: "Experience", value: `+${rewards.xp}`, color: "#3B82F6" },
    { key: "gold", label: "Gold", value: `+${rewards.gold}`, color: "#FBBF24" },
    { key: "rank", label: "Levels", value: levelsGained > 0 ? `+${levelsGained}` : "-", color: levelsGained > 0 ? "#EC4899" : "#64748B" },
  ];

  for (let i = 0; i < rewards_list.length; i += 1) {
    const reward = rewards_list[i];
    const x = startX + i * (boxW + gap);
    
    drawModernBox(ctx, x, startY, boxW, boxH, reward.color, reward.color);

    ctx.fillStyle = reward.color;
    ctx.font = "900 24px Inter";
    const emoji = await loadDiscordEmojiById(STAT_EMOJI_IDS[reward.key]);
    if (emoji) {
      ctx.drawImage(emoji, x + 24, startY + 20, 24, 24);
      ctx.fillText(reward.label, x + 56, startY + 42);
    } else {
      ctx.fillText(reward.label, x + 24, startY + 50);
    }

    ctx.fillStyle = "#F8FAFC";
    ctx.font = "900 52px Inter";
    ctx.fillText(reward.value, x + 24, startY + 115);
  }

  // Cooldown info
  ctx.fillStyle = "#CBD5E1";
  ctx.font = "900 20px Inter";
  ctx.fillText("Next hunt available in 5 Minutes", 48, 420);

  // Username at bottom
  ctx.fillStyle = "#94A3B8";
  ctx.font = "900 18px Inter";
  ctx.fillText(`Hunter: ${displayName}`, 48, 560);

  return toBuffer(canvas);
}

async function generateBattleResultCard(attacker, defender, result) {
  const attackerName = formatDisplayName(attacker.username);
  const defenderName = formatDisplayName(defender.username);
  const width = 1200;
  const height = 700;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");

  await drawMainBackground(ctx, width, height);

  
  const topColor = result.attackerWon ? "#10B981" : "#EF4444";
  ctx.fillStyle = topColor;
  ctx.fillRect(0, 0, width, 6);

 
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 64px Inter";
  const battleEmoji = await loadDiscordEmojiById(STAT_EMOJI_IDS.strength);
  if (battleEmoji) {
    ctx.drawImage(battleEmoji, 48, 40, 44, 44);
    ctx.fillText("Battle Result", 102, 90);
  } else {
    ctx.fillText("Battle Result", 48, 90);
  }

  
  const badgeX = width - 280;
  const badgeY = 40;
  const badgeW = 240;
  const badgeH = 80;

  roundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 16);
  ctx.fillStyle = result.attackerWon ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)";
  ctx.fill();
  ctx.strokeStyle = topColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = topColor;
  ctx.font = "900 48px Inter";
  ctx.textAlign = "center";
  ctx.fillText(result.attackerWon ? "VICTORY" : "DEFEAT", badgeX + badgeW / 2, badgeY + 62);
  ctx.textAlign = "left";


  const fighterBoxW = 480;
  const fighterBoxH = 200;
  const fighterY = 160;

 
  roundedRect(ctx, 48, fighterY, fighterBoxW, fighterBoxH, 16);
  ctx.fillStyle = "rgba(51, 65, 85, 0.5)";
  ctx.fill();
  ctx.strokeStyle = "#3B82F6";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = "#3B82F6";
  ctx.font = "900 26px Inter";
  ctx.fillText("­ƒöÁ Attacker", 72, fighterY + 50);

  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 40px Inter";
  ctx.fillText(attackerName, 72, fighterY + 100);

  ctx.fillStyle = "#CBD5E1";
  ctx.font = "900 20px Inter";
  ctx.fillText(`Power: ${result.attScore}`, 72, fighterY + 150);


  const defenderX = 48 + fighterBoxW + 48;
  roundedRect(ctx, defenderX, fighterY, fighterBoxW, fighterBoxH, 16);
  ctx.fillStyle = "rgba(51, 65, 85, 0.5)";
  ctx.fill();
  ctx.strokeStyle = "#EF4444";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = "#EF4444";
  ctx.font = "900 26px Inter";
  ctx.fillText("­ƒö┤ Defender", defenderX + 72, fighterY + 50);

  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 40px Inter";
  ctx.fillText(defenderName, defenderX + 72, fighterY + 100);

  ctx.fillStyle = "#CBD5E1";
  ctx.font = "900 20px Inter";
  ctx.fillText(`Power: ${result.defScore}`, defenderX + 72, fighterY + 150);


  const statsBoxW = 540;
  const statsBoxH = 120;
  const statsY = fighterY + fighterBoxH + 32;


  roundedRect(ctx, 48, statsY, statsBoxW, statsBoxH, 14);
  ctx.fillStyle = "rgba(51, 65, 85, 0.5)";
  ctx.fill();
  ctx.strokeStyle = "#A78BFA";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#A78BFA";
  ctx.font = "900 20px Inter";
  ctx.fillText("Win Probability", 72, statsY + 45);

  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 52px Inter";
  ctx.fillText(`${result.winChance.toFixed(1)}%`, 72, statsY + 100);

  return toBuffer(canvas);
}

async function generateRankupCard(user, newRank, previousRank) {
  const displayName = formatDisplayName(user.username);
  const width = 1200;
  const height = 600;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");

  await drawMainBackground(ctx, width, height);


  ctx.fillStyle = "#A855F7";
  ctx.fillRect(0, 0, width, 6);


  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 64px Inter";
  ctx.fillText("­ƒÄû´©Å Rank Up!", 48, 100);

  const boxW = 400;
  const boxH = 240;
  const startY = 140;
  const gap = 32;


  roundedRect(ctx, 48, startY, boxW, boxH, 16);
  ctx.fillStyle = "rgba(51, 65, 85, 0.5)";
  ctx.fill();
  ctx.strokeStyle = "#64748B";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#94A3B8";
  ctx.font = "900 22px Inter";
  ctx.fillText("Previous Rank", 72, startY + 50);

  ctx.fillStyle = "#64748B";
  ctx.font = "900 80px Inter";
  ctx.fillText(previousRank, 72, startY + 160);


  ctx.fillStyle = "#A855F7";
  ctx.font = "900 48px Inter";
  ctx.textAlign = "center";
  ctx.fillText("ÔåÆ", 560 + boxW / 2, startY + 150);
  ctx.textAlign = "left";


  const normalizedNewRank = normalizeRank(newRank);
  const rankTint = rankColor(normalizedNewRank);

  const afterX = 48 + boxW + gap + 60;
  roundedRect(ctx, afterX, startY, boxW, boxH, 16);
  ctx.fillStyle = `rgba(168, 85, 247, 0.15)`;
  ctx.fill();
  ctx.strokeStyle = rankTint;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = rankTint;
  ctx.font = "900 22px Inter";
  ctx.fillText("New Rank", afterX + 72, startY + 50);

  ctx.fillStyle = rankTint;
  ctx.font = "900 80px Inter";
  ctx.fillText(normalizedNewRank, afterX + 72, startY + 160);


  ctx.fillStyle = "#CBD5E1";
  ctx.font = "900 22px Inter";
  ctx.fillText(`Congratulations, ${displayName}! You've successfully ranked up!`, 48, 520);

  return toBuffer(canvas);
}

async function generateSalaryCard(user, salary, totalEarned) {
  const width = 1200;
  const height = 600;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");

  await drawMainBackground(ctx, width, height);


  ctx.fillStyle = "#FBBF24";
  ctx.fillRect(0, 0, width, 6);


  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 64px Inter";
  ctx.fillText("­ƒÆ░ Daily Salary", 48, 100);


  const mainBoxW = 700;
  const mainBoxH = 280;
  const mainBoxX = (width - mainBoxW) / 2;
  const mainBoxY = 140;

  roundedRect(ctx, mainBoxX, mainBoxY, mainBoxW, mainBoxH, 20);
  ctx.fillStyle = "rgba(251, 191, 36, 0.1)";
  ctx.fill();
  ctx.strokeStyle = "#FBBF24";
  ctx.lineWidth = 3;
  ctx.stroke();


  ctx.fillStyle = "#FBBF24";
  ctx.font = "900 28px Inter";
  ctx.textAlign = "center";
  ctx.fillText("Amount Earned", mainBoxX + mainBoxW / 2, mainBoxY + 60);

  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 72px Inter";
  ctx.fillText(`+${salary}`, mainBoxX + mainBoxW / 2, mainBoxY + 150);

  ctx.fillStyle = "gold";
  ctx.font = "900 24px Inter";
  ctx.fillText("Gold", mainBoxX + mainBoxW / 2, mainBoxY + 200);


  ctx.fillStyle = "#CBD5E1";
  ctx.font = "900 20px Inter";
  ctx.textAlign = "left";
  ctx.fillText(`Total Earned (Today): ${totalEarned} Gold`, 48, 520);


  ctx.fillStyle = "#94A3B8";
  ctx.font = "900 18px Inter";
  ctx.fillText("ÔÅ▒´©Å Next salary available in 24 hours", 48, 560);

  return toBuffer(canvas);
}

async function generateGateCard(user, difficulty, rewards, didWin) {
  const displayName = formatDisplayName(user.username);
  const width = 1200;
  const height = 700;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");

  await drawMainBackground(ctx, width, height);


  const topColor = "#FF6B6B";
  ctx.fillStyle = topColor;
  ctx.fillRect(0, 0, width, 6);

  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 64px Inter";
  ctx.fillText("­ƒÜ¬ Gate Challenge", 48, 100);


  ctx.fillStyle = "#FF6B6B";
  ctx.font = "900 28px Inter";
  ctx.fillText(`Difficulty: ${difficulty}`, 48, 160);


  const badgeX = width - 280;
  const badgeY = 80;
  const badgeW = 240;
  const badgeH = 80;

  roundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 16);
  ctx.fillStyle = didWin ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)";
  ctx.fill();
  ctx.strokeStyle = didWin ? "#10B981" : "#EF4444";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = didWin ? "#10B981" : "#EF4444";
  ctx.font = "900 48px Inter";
  ctx.textAlign = "center";
  ctx.fillText(didWin ? "SUCCESS" : "FAILED", badgeX + badgeW / 2, badgeY + 62);
  ctx.textAlign = "left";

  // Rewards section
  const rewardBoxW = 340;
  const rewardBoxH = 140;
  const rewardStartY = 220;
  const rewardGap = 32;

  Object.entries(rewards).forEach((entry, i) => {
    const [key, value] = entry;
    const x = 48 + i * (rewardBoxW + rewardGap);
    
    if (x + rewardBoxW > width - 48) return; // Don't overflow

    const label = key.includes("xp") ? "Experience" : key.includes("gold") ? "Gold" : key.includes("mana") ? "Mana" : key;
    const color = key.includes("xp") ? "#3B82F6" : key.includes("gold") ? "#FBBF24" : "#A78BFA";

    roundedRect(ctx, x, rewardStartY, rewardBoxW, rewardBoxH, 14);
    ctx.fillStyle = "rgba(51, 65, 85, 0.6)";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = "900 18px Inter";
    ctx.fillText(label, x + 20, rewardStartY + 45);

    ctx.fillStyle = "#F8FAFC";
    ctx.font = "900 36px Inter";
    ctx.fillText(`+${value}`, x + 20, rewardStartY + 105);
  });

  // Risk warning
  ctx.fillStyle = "#FF6B6B";
  ctx.font = "900 20px Inter";
  ctx.fillText("ÔÜá´©Å High Risk - High Reward Challenge", 48, 500);

  // Player info
  ctx.fillStyle = "#94A3B8";
  ctx.font = "900 18px Inter";
  ctx.fillText(`Hunter: ${displayName}`, 48, 560);

  return toBuffer(canvas);
}

async function generateStartCard(user, hunter) {
  const displayName = formatDisplayName(user.username);
  const width = 1200;
  const height = 700;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");
  await drawMainBackground(ctx, width, height);

  ctx.fillStyle = "#7C3AED";
  ctx.fillRect(0, 0, width, 6);

  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 58px Inter";
  ctx.fillText("Hunter Initialization Complete", 48, 92);

  ctx.fillStyle = "#CBD5E1";
  ctx.font = "900 24px Inter";
  ctx.fillText(`${displayName} joined this server as a Hunter`, 48, 134);

  drawModernBox(ctx, 48, 170, 540, 230, "#3B82F6", "#3B82F6");
  ctx.fillStyle = "#E2E8F0";
  ctx.font = "900 26px Inter";
  ctx.fillText("Starter Profile", 74, 214);

  const starterRows = [
    { key: "rank", label: "Rank", value: hunter.rank, color: "#F59E0B" },
    { key: "level", label: "Level", value: hunter.level, color: "#06B6D4" },
    { key: "gold", label: "Gold", value: hunter.gold, color: "#FBBF24" },
    { key: "mana", label: "Mana", value: hunter.mana, color: "#A78BFA" },
  ];

  for (let i = 0; i < starterRows.length; i += 1) {
    const row = starterRows[i];
    const y = 254 + i * 34;
    const emoji = await loadDiscordEmojiById(STAT_EMOJI_IDS[row.key]);
    ctx.fillStyle = row.color;
    ctx.font = "900 20px Inter";
    if (emoji) {
      ctx.drawImage(emoji, 74, y - 18, 20, 20);
      ctx.fillText(`${row.label}: ${row.value}`, 102, y);
    } else {
      ctx.fillText(`${row.label}: ${row.value}`, 74, y);
    }
  }

  drawModernBox(ctx, 612, 170, 540, 230, "#10B981", "#10B981");
  ctx.fillStyle = "#E2E8F0";
  ctx.font = "900 26px Inter";
  ctx.fillText("Base Attributes", 638, 214);

  const attributes = [
    { key: "strength", label: "Strength", value: hunter.strength, color: "#EF4444" },
    { key: "agility", label: "Agility", value: hunter.agility, color: "#10B981" },
    { key: "intelligence", label: "Intelligence", value: hunter.intelligence, color: "#3B82F6" },
    { key: "vitality", label: "Vitality", value: hunter.vitality, color: "#F59E0B" },
  ];

  for (let i = 0; i < attributes.length; i += 1) {
    const row = attributes[i];
    const x = 638 + (i % 2) * 250;
    const y = 258 + Math.floor(i / 2) * 74;
    const emoji = await loadDiscordEmojiById(STAT_EMOJI_IDS[row.key]);

    ctx.fillStyle = row.color;
    ctx.font = "900 20px Inter";
    if (emoji) {
      ctx.drawImage(emoji, x, y - 18, 20, 20);
      ctx.fillText(`${row.label}: ${row.value}`, x + 28, y);
    } else {
      ctx.fillText(`${row.label}: ${row.value}`, x, y);
    }
  }

  drawModernBox(ctx, 48, 432, 1104, 220, "#A78BFA", "#A78BFA");
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 28px Inter";
  ctx.fillText("What To Do Next", 74, 476);

  ctx.fillStyle = "#CBD5E1";
  ctx.font = "900 20px Inter";
  ctx.fillText("/profile  - open your full profile card", 74, 522);
  ctx.fillText("/stats    - show real combat metrics", 74, 558);
  ctx.fillText("/hunt     - earn XP and gold with cooldown", 74, 594);
  ctx.fillText("/dungeon  - choose difficulty and fight", 612, 522);
  ctx.fillText("/cards    - see your card collection PNG", 612, 558);
  ctx.fillText("Profile button - inspect your shadow army", 612, 594);

  return toBuffer(canvas);
}

async function generateDungeonSpawnCard(data) {
  const width = 1280;
  const height = 720;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");
  await drawMainBackground(ctx, width, height);

  const key = String(data.difficultyKey || "normal").toLowerCase();
  const accentMap = {
    easy: "#22C55E",
    normal: "#3B82F6",
    hard: "#F59E0B",
    elite: "#EF4444",
    raid: "#A855F7",
  };
  const accent = accentMap[key] || "#3B82F6";

  const accentGrad = ctx.createLinearGradient(0, 0, width, 0);
  accentGrad.addColorStop(0, accent);
  accentGrad.addColorStop(1, key === "raid" ? "#EC4899" : "#22D3EE");
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, width, 8);

  // Ambient layer for depth
  const ambient = ctx.createRadialGradient(width * 0.7, 120, 20, width * 0.7, 120, 320);
  ambient.addColorStop(0, `${accent}55`);
  ambient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ambient;
  ctx.fillRect(0, 0, width, height);

  drawModernBox(ctx, 44, 44, width - 88, 140, accent, accent);
  ctx.fillStyle = "#9AA7BD";
  ctx.font = "900 22px Inter";
  ctx.fillText("AUTOMATED GATE EVENT", 72, 96);
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 70px Inter";
  ctx.fillText("Dungeon Alert", 72, 158);

  drawModernBox(ctx, 44, 208, width - 88, 318, "#334155", accent);
  ctx.fillStyle = "#E2E8F0";
  ctx.font = "900 27px Inter";
  ctx.fillText("Gate Name", 72, 262);
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 64px Inter";
  const gateName = String(data.dungeonName || "Unknown Gate");
  ctx.fillText(gateName.slice(0, 24), 72, 340);

  // Difficulty pill
  roundedRect(ctx, 72, 374, 360, 74, 999);
  ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#94A3B8";
  ctx.font = "900 22px Inter";
  ctx.fillText("DIFFICULTY", 100, 422);
  ctx.fillStyle = accent;
  ctx.font = "900 44px Inter";
  ctx.fillText(String(data.difficultyLabel || "Normal"), 245, 422);

  // Right detail rail
  const railX = 760;
  const railY = 242;
  const railW = 450;
  const railH = 250;
  roundedRect(ctx, railX, railY, railW, railH, 18);
  ctx.fillStyle = "rgba(8, 13, 30, 0.76)";
  ctx.fill();
  ctx.strokeStyle = "rgba(148,163,184,0.28)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = "#A8B3C8";
  ctx.font = "900 24px Inter";
  ctx.fillText("Threat Preview", railX + 26, railY + 44);
  const threatMap = { easy: "Low", normal: "Moderate", hard: "High", elite: "Severe", raid: "Catastrophic" };
  const threat = threatMap[key] || "Moderate";
  const lines = [
    `Tier: ${String(data.difficultyLabel || "Normal")}`,
    `Threat: ${threat}`,
    "Rewards scale with hunter power",
    "ARISE chance active on clear",
  ];
  let ty = railY + 84;
  for (const line of lines) {
    roundedRect(ctx, railX + 22, ty - 22, railW - 44, 50, 10);
    ctx.fillStyle = "rgba(15,23,42,0.72)";
    ctx.fill();
    ctx.strokeStyle = "rgba(148,163,184,0.20)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#E2E8F0";
    ctx.font = "900 23px Inter";
    ctx.fillText(line, railX + 36, ty + 10);
    ty += 58;
  }

  drawModernBox(ctx, 44, 548, width - 88, 132, "#10B981", "#10B981");
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 40px Inter";
  ctx.fillText("Tap Join below to enter this dungeon", 72, 604);
  ctx.fillStyle = "#CBD5E1";
  ctx.font = "900 24px Inter";
  ctx.fillText("Combat uses real stats, shadows, cards, and progression from your account.", 72, 646);

  return toBuffer(canvas);
}

module.exports = {
  generateProfileCard,
  generateShadowCard,
  generateDungeonResultCard,
  generateInventoryCard,
  generateCardsCollectionCard,
  generateLeaderboardCard,
  generateStatsCard,
  generateHuntResultCard,
  generateBattleResultCard,
  generateRankupCard,
  generateSalaryCard,
  generateGateCard,
  generateStartCard,
  generateDungeonSpawnCard,
};


