const fs = require("fs");
const path = require("path");
const { Canvas, FontLibrary, loadImage } = require("skia-canvas");
const { normalizeRank, rankBadgeText, rankColor } = require("../utils/constants");
const { randomInt } = require("../utils/math");

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

function drawEpic3DBox(ctx, x, y, w, h, baseColor, glowColor = null) {
  if (!glowColor) glowColor = baseColor;
  
  ctx.save();
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 40;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 15;
  roundedRect(ctx, x, y, w, h, 16);
  ctx.fillStyle = "rgba(4, 8, 20, 0.9)";
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundedRect(ctx, x, y, w, h, 16);
  ctx.fillStyle = "rgba(10, 15, 30, 0.95)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = baseColor;
  ctx.stroke();
  ctx.restore();
  
  ctx.save();
  roundedRect(ctx, x + 2, y + 2, w - 4, h/2 - 2, 14);
  const grad = ctx.createLinearGradient(x, y, x, y + h/2);
  grad.addColorStop(0, "rgba(255, 255, 255, 0.1)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0.0)");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}


function drawDigitalGrid(ctx, w, h, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.1;
  for (let x = 0; x < w; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += 50) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.restore();
}

function drawSystemHeader(ctx, w, title, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = "900 24px Orbitron";
  ctx.fillText("[ SYSTEM ALERT ]", 50, 60);
  
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 50px Orbitron";
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillText(title, 50, 120);
  ctx.restore();
}


function drawNeoUIBacking(ctx, x, y, w, h, color) {
  ctx.save();
  // Deep Shadow
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 20;
  roundedRect(ctx, x, y, w, h, 20);
  ctx.fillStyle = "#02040a";
  ctx.fill();
  ctx.restore();

  // Glass Layer
  ctx.save();
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, "rgba(255,255,255,0.05)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.01)");
  grad.addColorStop(1, "rgba(255,255,255,0.03)");
  roundedRect(ctx, x, y, w, h, 20);
  ctx.fillStyle = grad;
  ctx.fill();
  
  // High-Tech border
  ctx.strokeStyle = color + "88";
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Inner glow rim
  ctx.strokeStyle = color + "22";
  ctx.lineWidth = 10;
  roundedRect(ctx, x+5, y+5, w-10, h-10, 15);
  ctx.stroke();
  ctx.restore();
}

function drawHUDBrackets(ctx, x, y, w, h, color, size = 30) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "square";
  
  // Top Left
  ctx.beginPath(); ctx.moveTo(x, y + size); ctx.lineTo(x, y); ctx.lineTo(x + size, y); ctx.stroke();
  // Top Right
  ctx.beginPath(); ctx.moveTo(x + w - size, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + size); ctx.stroke();
  // Bottom Left
  ctx.beginPath(); ctx.moveTo(x, y + h - size); ctx.lineTo(x, y + h); ctx.lineTo(x + size, y + h); ctx.stroke();
  // Bottom Right
  ctx.beginPath(); ctx.moveTo(x + w - size, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - size); ctx.stroke();
  
  ctx.restore();
}

function drawTechCircles(ctx, x, y, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.2;
  ctx.setLineDash([10, 5]);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 1.2, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

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

function setupFonts() {
  // Orbitron — retro-futuristic for big numbers & headings
  const orbitron = path.join(ASSETS_DIR, "fonts", "Orbitron-Bold.ttf");
  if (fs.existsSync(orbitron)) FontLibrary.use("Orbitron", orbitron);

  // Rajdhani — clean military/gaming for labels & subtext
  const rajBold = path.join(ASSETS_DIR, "fonts", "Rajdhani-Bold.ttf");
  if (fs.existsSync(rajBold)) FontLibrary.use("Rajdhani", rajBold);

  // Fallback Inter alias from existing candidates
  for (const file of FONT_CANDIDATES) {
    const full = path.join(ASSETS_DIR, "fonts", file);
    if (fs.existsSync(full)) {
      FontLibrary.use("Inter", full);
      return file;
    }
  }
  return null;
}

setupFonts();

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
  
  
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = color;
  ctx.fillText(String(text), x, y);
  ctx.shadowBlur = 0;
  ctx.textAlign = prevAlign;
}

function fitFontSize(ctx, text, initialSize, minSize, maxWidth) {
  let size = Math.max(minSize, Number(initialSize || minSize));
  while (size > minSize) {
    ctx.font = `900 ${size}px Inter`;
    if (ctx.measureText(String(text)).width <= maxWidth) return size;
    size -= 1;
  }
  return minSize;
}

function ellipsizeText(ctx, text, maxWidth) {
  const raw = String(text || "");
  if (!raw) return raw;
  if (ctx.measureText(raw).width <= maxWidth) return raw;
  const dots = "...";
  let out = raw;
  while (out.length > 0 && ctx.measureText(`${out}${dots}`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out ? `${out}${dots}` : dots;
}

function drawShinyBar(ctx, x, y, w, h, progress, colorA = "#2563EB", colorB = "#06B6D4") {
  const p = Math.max(0, Math.min(1, Number(progress || 0)));
  
  
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

  
  roundedRect(ctx, x + 2, y + 2, fw, h - 4, 999);
  const glowGrad = ctx.createLinearGradient(x + 2, y + 2, x + 2 + fw, y + h - 2);
  glowGrad.addColorStop(0, "rgba(255, 255, 255, 0.12)");
  glowGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.06)");
  glowGrad.addColorStop(1, "rgba(255, 255, 255, 0.02)");
  ctx.fillStyle = glowGrad;
  ctx.fill();

  
  roundedRect(ctx, x + 2, y + 2, fw, Math.max(10, (h - 4) * 0.46), 999);
  const gloss = ctx.createLinearGradient(x + 2, y + 2, x + 2, y + h * 0.65);
  gloss.addColorStop(0, "rgba(255,255,255,0.52)");
  gloss.addColorStop(0.35, "rgba(255,255,255,0.25)");
  gloss.addColorStop(1, "rgba(255,255,255,0.01)");
  ctx.fillStyle = gloss;
  ctx.fill();

  
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

  
  const darkWash = ctx.createLinearGradient(0, 0, width, height);
  darkWash.addColorStop(0, "rgba(2, 4, 12, 0.68)");
  darkWash.addColorStop(1, "rgba(3, 7, 18, 0.75)");
  ctx.fillStyle = darkWash;
  ctx.fillRect(0, 0, width, height);

  
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
  
  if (glowColor) {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.fillStyle = `${glowColor}15`;
    roundedRect(ctx, x - 12, y - 12, w + 24, h + 24, 18);
    ctx.fill();
    
    
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.fillStyle = `${glowColor}08`;
    roundedRect(ctx, x - 6, y - 6, w + 12, h + 12, 18);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  
  roundedRect(ctx, x, y, w, h, 16);
  const body = ctx.createLinearGradient(x, y, x, y + h);
  body.addColorStop(0, "rgba(45, 56, 75, 0.68)");
  body.addColorStop(0.5, "rgba(35, 48, 68, 0.75)");
  body.addColorStop(1, "rgba(20, 28, 45, 0.85)");
  ctx.fillStyle = body;
  ctx.fill();

  
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2.8;
  ctx.stroke();
  
  
  ctx.strokeStyle = `${borderColor}44`;
  ctx.lineWidth = 5;
  ctx.globalAlpha = 0.4;
  ctx.stroke();
  ctx.globalAlpha = 1;

  
  drawBoxShine(ctx, x, y, w, h, glowColor || borderColor);

  
  roundedRect(ctx, x + 2, y + 2, w - 4, h - 4, 14);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.20)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  
  roundedRect(ctx, x + 6, y + 6, w - 12, Math.max(16, h * 0.24), 10);
  const strip = ctx.createLinearGradient(x, y + 6, x, y + h * 0.32);
  strip.addColorStop(0, "rgba(255,255,255,0.22)");
  strip.addColorStop(0.4, "rgba(255,255,255,0.10)");
  strip.addColorStop(1, "rgba(255,255,255,0.00)");
  ctx.fillStyle = strip;
  ctx.fill();
  
  
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

  
  ctx.fillStyle = "#F0F4F8";
  ctx.font = "900 22px Inter";
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.fillText(label, x + 20, y + 2);
  ctx.shadowBlur = 0;
  
  
  roundedRect(ctx, x + 14, y + 12, width - 28, height - 24, 999);
  const trackGrad = ctx.createLinearGradient(x + 14, y + 12, x + 14, y + 12 + height - 24);
  trackGrad.addColorStop(0, "rgba(45, 55, 75, 0.80)");
  trackGrad.addColorStop(1, "rgba(25, 35, 50, 0.90)");
  ctx.fillStyle = trackGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.28)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  
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

    
    roundedRect(ctx, x + 14, y + 12, fillW, (height - 24) * 0.48, 999);
    const topGlow = ctx.createLinearGradient(x + 14, y + 12, x + 14, y + 12 + (height - 24) * 0.48);
    topGlow.addColorStop(0, "rgba(255,255,255,0.45)");
    topGlow.addColorStop(1, "rgba(255,255,255,0.05)");
    ctx.fillStyle = topGlow;
    ctx.fill();
    
    
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
  const width = 1200;
  const height = 750;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");

  try {
    const bg = await loadImage(MAIN_BACKGROUND_PATH);
    ctx.drawImage(bg, 0, 0, width, height);
  } catch (e) {
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, width, height);
  }
  
  const gradBG = ctx.createRadialGradient(width/2, height/2, height/4, width/2, height/2, width);
  gradBG.addColorStop(0, "rgba(0, 0, 0, 0.4)");
  gradBG.addColorStop(1, "rgba(0, 0, 0, 0.95)");
  ctx.fillStyle = gradBG;
  ctx.fillRect(0, 0, width, height);

  const rankColorHex = rankColor(hunter.rank);
  drawEpic3DBox(ctx, 40, 40, 400, 670, rankColorHex);
  
  const cx = 240, cy = 200, r = 100;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.shadowColor = rankColorHex;
  ctx.shadowBlur = 35;
  ctx.lineWidth = 10;
  ctx.strokeStyle = rankColorHex;
  ctx.stroke();
  ctx.clip();
  let avatarUrl = "https://cdn.discordapp.com/embed/avatars/0.png";
  if (user && typeof user.displayAvatarURL === "function") {
      avatarUrl = user.displayAvatarURL({ extension: "png", size: 512, forceStatic: true });
  } else if (user && user.avatarURL) {
      avatarUrl = user.avatarURL;
  }
  try {
    const avatar = await loadImage(avatarUrl);
    ctx.drawImage(avatar, cx - r, cy - r, r * 2, r * 2);
  } catch (err) {}
  ctx.restore();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 38px Orbitron";
  ctx.textAlign = "center";
  const nameToUse = user.username || user.displayName || "Unknown";
  let safeName = ellipsizeText(ctx, nameToUse, 350);
  ctx.shadowColor = "#FFF";
  ctx.shadowBlur = 10;
  ctx.fillText(safeName, cx, cy + 160);
  ctx.shadowBlur = 0;

  ctx.font = "700 24px Rajdhani";
  ctx.fillStyle = "#94A3B8";
  ctx.fillText("Level " + hunter.level + " | " + hunter.rank, cx, cy + 200);
  
  let hClass = "WARRIOR";
  try { hClass = String(require("./classService").getHunterClass(hunter)).toUpperCase(); } catch(e){}
  
  drawEpic3DBox(ctx, cx - 120, cy + 240, 240, 50, "#8B5CF6");
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 28px Orbitron";
  ctx.fillText(hClass, cx, cy + 276);

  const maxExp = Math.ceil(100 * Math.pow(hunter.level, 1.5));
  const expPercent = Math.min(Math.max((Number(hunter.exp)||0) / maxExp, 0), 1);
  ctx.fillStyle = "#1E293B";
  roundedRect(ctx, cx - 140, cy + 320, 280, 25, 12);
  ctx.fill();
  ctx.fillStyle = "#3B82F6";
  ctx.shadowColor = "#3B82F6";
  ctx.shadowBlur = 10;
  if(expPercent > 0) {
    roundedRect(ctx, cx - 140, cy + 320, 280 * expPercent, 25, 12);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#FFF";
  ctx.font = "700 16px Rajdhani";
  ctx.fillText((hunter.exp||0) + " / " + maxExp + " XP", cx, cy + 338);

  drawEpic3DBox(ctx, 480, 40, 680, 310, "rgba(99, 102, 241, 0.8)");
  ctx.textAlign = "left";
  ctx.fillStyle = "#6366F1";
  ctx.font = "900 34px Orbitron";
  ctx.fillText("SYSTEM CAPABILITIES", 520, 90);
  
  const stats = [
    { label: "STR", val: hunter.strength, c: "#EF4444" },
    { label: "AGI", val: hunter.agility, c: "#10B981" },
    { label: "INT", val: hunter.intelligence, c: "#3B82F6" },
    { label: "VIT", val: hunter.vitality, c: "#F59E0B" }
  ];
  
  for(let i=0; i<stats.length; i++) {
     const s = stats[i];
     const bx = 520 + (i % 2) * 310;
     const by = 130 + Math.floor(i / 2) * 90;
     drawEpic3DBox(ctx, bx, by, 280, 70, s.c);
     ctx.fillStyle = "#FFF";
     ctx.font = "900 28px Orbitron";
     ctx.fillText(s.label, bx + 25, by + 45);
     ctx.textAlign = "right";
     ctx.fillStyle = s.c;
     ctx.shadowColor = s.c; ctx.shadowBlur = 15;
     ctx.fillText(Number(s.val), bx + 265, by + 48);
     ctx.shadowBlur = 0;
     ctx.textAlign = "left";
  }

  drawEpic3DBox(ctx, 480, 400, 680, 310, "rgba(245, 158, 11, 0.8)");
  ctx.fillStyle = "#F59E0B";
  ctx.font = "900 34px Orbitron";
  ctx.fillText("INVENTORY RESOURCES", 520, 450);

  const res = [
    { label: "GOLD", val: hunter.gold||0, c: "#FBBF24" },
    { label: "MANA", val: hunter.mana||0, c: "#A78BFA" },
    { label: "STAT POINTS", val: hunter.stat_points||0, c: "#EC4899" }
  ];
  
  for(let j=0; j<res.length; j++) {
     const r = res[j];
     const by = 490 + j * 65;
     drawEpic3DBox(ctx, 520, by, 600, 50, r.c);
     ctx.fillStyle = "#FFF";
     ctx.font = "900 24px Rajdhani";
     ctx.fillText(r.label, 545, by + 34);
     ctx.textAlign = "right";
     ctx.fillStyle = r.c;
     ctx.fillText(Number(r.val), 1090, by + 34);
     ctx.textAlign = "left";
  }

  return await canvas.toBuffer("png");
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

  
  const wash = ctx.createLinearGradient(0, 0, width, height);
  wash.addColorStop(0, result.didWin ? "rgba(8, 44, 34, 0.42)" : "rgba(52, 13, 16, 0.42)");
  wash.addColorStop(1, "rgba(2, 6, 23, 0.58)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  
  const strip = ctx.createLinearGradient(0, 0, width, 0);
  strip.addColorStop(0, accent);
  strip.addColorStop(1, result.didWin ? "#22D3EE" : "#F97316");
  ctx.fillStyle = strip;
  ctx.fillRect(0, 0, width, 8);

  
  roundedRect(ctx, 28, 28, width - 56, height - 56, 24);
  ctx.fillStyle = panelBg;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.4;
  ctx.stroke();

  
  const title = `Dungeon ${String(result.difficulty || "Run")}`;
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 68px Inter";
  ctx.fillText(title, 70, 124);
  ctx.fillStyle = "#94A3B8";
  ctx.font = "900 24px Inter";
  ctx.fillText("Combat analytics and reward breakdown", 72, 162);

  
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
  const W = 1480, H = 920;
  const canvas = new Canvas(W, H);
  const ctx    = canvas.getContext("2d");

  await drawMainBackground(ctx, W, H);

  const FONT_NUM = "Orbitron";
  const FONT_LBL = "Rajdhani";
  const FONT_FB  = "Inter";
  function numFont(sz) { return "900 " + sz + "px " + FONT_NUM + ", " + FONT_FB; }
  function lblFont(sz) { return "700 " + sz + "px " + FONT_LBL + ", " + FONT_FB; }

  const ITEM_CATALOG = {
    "Mana Potion":               { display: "Mana Potion",         category: "Consumable", rarity: "Common",    color: "#A78BFA" },
    "Hunter Key":                { display: "Hunter Key",          category: "Consumable", rarity: "Uncommon",  color: "#22C55E" },
    "raid_heal_kit":             { display: "Raid Medkit",         category: "Consumable", rarity: "Uncommon",  color: "#22C55E" },
    "material:shadow_essence":   { display: "Shadow Essence",      category: "Material",   rarity: "Rare",      color: "#3B82F6" },
    "material:gate_crystal":     { display: "Gate Crystal",        category: "Material",   rarity: "Rare",      color: "#3B82F6" },
    "material:rune_fragment":    { display: "Rune Fragment",       category: "Material",   rarity: "Epic",      color: "#8B5CF6" },
    "material:jeju_ant_core":    { display: "Jeju Ant Core",       category: "Material",   rarity: "Epic",      color: "#8B5CF6" },
    "item:reawakened_stone":     { display: "Reawakened Stone",    category: "Special",    rarity: "Epic",      color: "#8B5CF6" },
    "item:monarch_sigil":        { display: "Monarch Sigil",       category: "Special",    rarity: "Legendary", color: "#F59E0B" },
    "Stat Reset Token":          { display: "Stat Reset Token",    category: "Special",    rarity: "Rare",      color: "#3B82F6" },
    "skill_scroll:flame_slash":  { display: "Flame Slash Scroll",  category: "Skill",      rarity: "Rare",      color: "#EF4444" },
    "skill_scroll:shadow_step":  { display: "Shadow Step Scroll",  category: "Skill",      rarity: "Rare",      color: "#6366F1" },
    "skill_scroll:monarch_roar": { display: "Monarch Roar Scroll", category: "Skill",      rarity: "Epic",      color: "#8B5CF6" },
  };
  const RARITY_COLORS = { Common:"#94A3B8", Uncommon:"#22C55E", Rare:"#3B82F6", Epic:"#8B5CF6", Legendary:"#F59E0B" };
  function resolveItem(token) {
    return ITEM_CATALOG[token] || { display: token, category: "Item", rarity: "Common", color: "#94A3B8" };
  }

  const rankLabel = normalizeRank(hunter.rank);
  const rankTint  = rankColor(rankLabel);
  const items     = Array.isArray(hunter.inventory) ? hunter.inventory : [];

  // ── BACKGROUND WASH ──────────────────────────────────────────────
  const wash = ctx.createLinearGradient(0, 0, W, H);
  wash.addColorStop(0, "rgba(2,4,18,0.88)"); wash.addColorStop(1, "rgba(1,2,12,0.94)");
  ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H);

  // grid
  ctx.save(); ctx.globalAlpha = 0.04; ctx.strokeStyle = "#4A90D9"; ctx.lineWidth = 1;
  for (let gx = 0; gx < W; gx += 48) { ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke(); }
  for (let gy = 0; gy < H; gy += 48) { ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke(); }
  ctx.restore();

  // scan lines
  ctx.save(); ctx.globalAlpha = 0.018; ctx.strokeStyle = "#7C3AED"; ctx.lineWidth = 1;
  for (let i = -H; i < W + H; i += 26) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i+H,H); ctx.stroke(); }
  ctx.restore();

  // ── TOP BAR ──────────────────────────────────────────────────────
  const topG = ctx.createLinearGradient(0,0,W,0);
  topG.addColorStop(0,rankTint); topG.addColorStop(0.35,"#7C3AED"); topG.addColorStop(0.7,"#0EA5E9"); topG.addColorStop(1,rankTint);
  ctx.fillStyle = topG; ctx.fillRect(0,0,W,8);
  const tgl = ctx.createLinearGradient(0,8,0,70); tgl.addColorStop(0,rankTint+"44"); tgl.addColorStop(1,"transparent");
  ctx.fillStyle = tgl; ctx.fillRect(0,8,W,62);
  ctx.fillStyle = topG; ctx.fillRect(0,H-8,W,8);

  // ── CORNER BRACKETS ──────────────────────────────────────────────
  function drawCorner(bx,by,size,fx,fy,color) {
    ctx.save(); ctx.translate(bx,by); ctx.scale(fx?-1:1,fy?-1:1);
    ctx.strokeStyle=color; ctx.lineWidth=3; ctx.lineCap="square";
    ctx.beginPath(); ctx.moveTo(0,size); ctx.lineTo(0,0); ctx.lineTo(size,0); ctx.stroke();
    ctx.globalAlpha=0.22; ctx.lineWidth=9; ctx.stroke(); ctx.restore();
  }
  drawCorner(16,16,46,false,false,rankTint); drawCorner(W-16,16,46,true,false,rankTint);
  drawCorner(16,H-16,46,false,true,"#0EA5E9"); drawCorner(W-16,H-16,46,true,true,"#0EA5E9");

  // ── HEADER BANNER ────────────────────────────────────────────────
  const bY=24, bH=72;
  roundedRect(ctx,28,bY,W-56,bH,18);
  const bBg=ctx.createLinearGradient(28,bY,W-28,bY+bH);
  bBg.addColorStop(0,"rgba(30,20,70,0.75)"); bBg.addColorStop(0.5,"rgba(15,25,60,0.80)"); bBg.addColorStop(1,"rgba(10,20,50,0.75)");
  ctx.fillStyle=bBg; ctx.fill(); ctx.strokeStyle="#7C3AED55"; ctx.lineWidth=1.5; ctx.stroke();
  // banner gloss
  roundedRect(ctx,30,bY+2,W-60,bH*0.44,16);
  const bGl=ctx.createLinearGradient(28,bY,28,bY+bH*0.44);
  bGl.addColorStop(0,"rgba(255,255,255,0.10)"); bGl.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=bGl; ctx.fill();

  // avatar small
  const avR=28, avX=64, avY=bY+bH/2;
  ctx.beginPath(); ctx.arc(avX,avY,avR,0,Math.PI*2); ctx.fillStyle="#0D1528"; ctx.fill();
  ctx.strokeStyle=rankTint; ctx.lineWidth=2.5; ctx.stroke();
  try {
    const au=user.displayAvatarURL({size:128});
    if(au){const ai=await loadImage(au);ctx.save();ctx.beginPath();ctx.arc(avX,avY,avR-1,0,Math.PI*2);ctx.clip();ctx.drawImage(ai,avX-avR,avY-avR,avR*2,avR*2);ctx.restore();}
  } catch(e){}

  ctx.font=lblFont(13); ctx.fillStyle="#7C3AED"; ctx.fillText("[ SYSTEM ]", 104, bY+28);
  ctx.font=numFont(24); ctx.fillStyle="#F8FAFC"; ctx.textAlign="center";
  ctx.fillText("HUNTER INVENTORY", W/2, bY+46);
  ctx.font=lblFont(14); ctx.fillStyle="#4B5563"; ctx.textAlign="right";
  ctx.fillText(displayName + "  •  " + rankLabel + "  •  Lv." + hunter.level, W-44, bY+28);
  ctx.textAlign="left";

  // stats row under header
  const statItems=[
    {label:"ITEMS",  value: items.length,                           color:"#06B6D4"},
    {label:"GOLD",   value: Number(hunter.gold||0).toLocaleString(), color:"#FBBF24"},
    {label:"LEVEL",  value: hunter.level,                           color:"#3B82F6"},
    {label:"RANK",   value: rankLabel,                              color: rankTint},
  ];
  const statW=200, statH=40, statGap=18;
  const statTotalW=statItems.length*(statW+statGap)-statGap;
  const statX=(W-statTotalW)/2, statY=bY+bH+12;
  for(let i=0;i<statItems.length;i++){
    const s=statItems[i], sx=statX+i*(statW+statGap);
    roundedRect(ctx,sx,statY,statW,statH,10);
    const sg=ctx.createLinearGradient(sx,statY,sx,statY+statH);
    sg.addColorStop(0,"rgba(12,20,50,0.90)"); sg.addColorStop(1,"rgba(6,10,28,0.95)");
    ctx.fillStyle=sg; ctx.fill(); ctx.strokeStyle=s.color+"44"; ctx.lineWidth=1.5; ctx.stroke();
    roundedRect(ctx,sx+2,statY+2,statW-4,3,2); ctx.fillStyle=s.color; ctx.fill();
    ctx.font=lblFont(11); ctx.fillStyle="#4B5563"; ctx.fillText(s.label, sx+12, statY+18);
    ctx.font=numFont(14); ctx.fillStyle=s.color; ctx.fillText(String(s.value), sx+12, statY+36);
  }

  // ── INVENTORY GRID ────────────────────────────────────────────────
  const gridY  = statY + statH + 16;
  const COLS   = 5;
  const GAP    = 14;
  const TILE_W = (W - 56 - GAP*(COLS-1)) / COLS;
  const TILE_H = 120;
  const MAX_ITEMS = 20; // 4 rows × 5 cols

  if (!items.length) {
    // empty state
    const emY = gridY + 60;
    roundedRect(ctx,28,emY,W-56,180,20);
    const emBg=ctx.createLinearGradient(28,emY,28,emY+180);
    emBg.addColorStop(0,"rgba(12,18,46,0.92)"); emBg.addColorStop(1,"rgba(6,10,28,0.96)");
    ctx.fillStyle=emBg; ctx.fill(); ctx.strokeStyle="#1E3A5F"; ctx.lineWidth=1.5; ctx.stroke();
    ctx.font=numFont(28); ctx.fillStyle="#1E3A5F"; ctx.textAlign="center";
    ctx.fillText("INVENTORY IS EMPTY", W/2, emY+70);
    ctx.font=lblFont(18); ctx.fillStyle="#374151";
    ctx.fillText("Use /shop to purchase items and begin your collection.", W/2, emY+108);
    ctx.textAlign="left";
    return toBuffer(canvas);
  }

  const visibleItems = items.slice(0, MAX_ITEMS);

  for (let idx = 0; idx < visibleItems.length; idx++) {
    const token = visibleItems[idx];
    const info  = ITEM_CATALOG[token] || { display: token, category: "Item", rarity: "Common", color: "#94A3B8" };
    const rarColor = RARITY_COLORS[info.rarity] || "#94A3B8";

    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const tx  = 28 + col * (TILE_W + GAP);
    const ty  = gridY + row * (TILE_H + GAP);

    // card bg
    roundedRect(ctx, tx, ty, TILE_W, TILE_H, 16);
    const tbg = ctx.createLinearGradient(tx, ty, tx, ty + TILE_H);
    tbg.addColorStop(0, "rgba(10,18,46,0.97)");
    tbg.addColorStop(1, "rgba(5,9,26,0.99)");
    ctx.fillStyle = tbg; ctx.fill();
    ctx.strokeStyle = rarColor + "55"; ctx.lineWidth = 1.8; ctx.stroke();

    // top rarity stripe
    roundedRect(ctx, tx + 2, ty + 2, TILE_W - 4, 4, 3);
    ctx.fillStyle = rarColor; ctx.fill();

    // left accent bar
    roundedRect(ctx, tx, ty, 5, TILE_H, 4);
    ctx.fillStyle = info.color; ctx.fill();

    // top gloss
    roundedRect(ctx, tx + 6, ty + 6, TILE_W - 12, TILE_H * 0.30, 12);
    const tgl2 = ctx.createLinearGradient(tx, ty, tx, ty + TILE_H * 0.30);
    tgl2.addColorStop(0, "rgba(255,255,255,0.08)"); tgl2.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = tgl2; ctx.fill();

    // bottom accent
    roundedRect(ctx, tx + 8, ty + TILE_H - 5, TILE_W - 16, 4, 3);
    ctx.fillStyle = rarColor + "66"; ctx.fill();

    // slot number (top-right)
    ctx.font = lblFont(11); ctx.fillStyle = "#1E3A5F"; ctx.textAlign = "right";
    ctx.fillText("#" + (idx + 1), tx + TILE_W - 10, ty + 22);
    ctx.textAlign = "left";

    // rarity badge (top-left)
    ctx.font = lblFont(11); ctx.fillStyle = rarColor;
    ctx.fillText(info.rarity.toUpperCase(), tx + 12, ty + 22);

    // category
    ctx.font = lblFont(11); ctx.fillStyle = "#374151";
    ctx.fillText(info.category.toUpperCase(), tx + 12, ty + 38);

    // item name (big, clamped)
    const nameMaxW = TILE_W - 24;
    const nameSz = (() => {
      let sz = 18; ctx.font = numFont(sz);
      while (sz > 10 && ctx.measureText(info.display).width > nameMaxW) { sz -= 1; ctx.font = numFont(sz); }
      return sz;
    })();
    ctx.font = numFont(nameSz);
    ctx.save(); ctx.shadowColor = info.color; ctx.shadowBlur = 12;
    ctx.fillStyle = rarColor; ctx.fillText(info.display, tx + 12, ty + TILE_H - 28);
    ctx.restore();

    // count badge if more than MAX_ITEMS
    if (idx === MAX_ITEMS - 1 && items.length > MAX_ITEMS) {
      const remain = items.length - MAX_ITEMS;
      roundedRect(ctx, tx + TILE_W - 44, ty + TILE_H - 28, 38, 20, 8);
      ctx.fillStyle = "rgba(30,58,138,0.90)"; ctx.fill();
      ctx.font = numFont(11); ctx.fillStyle = "#60A5FA"; ctx.textAlign = "center";
      ctx.fillText("+" + remain, tx + TILE_W - 25, ty + TILE_H - 12);
      ctx.textAlign = "left";
    }
  }

  // ── FOOTER ───────────────────────────────────────────────────────
  const fY = gridY + Math.ceil(Math.min(items.length, MAX_ITEMS) / COLS) * (TILE_H + GAP) + 8;
  if (fY < H - 40) {
    ctx.font = lblFont(13); ctx.fillStyle = "#1E3A5F"; ctx.textAlign = "center";
    ctx.fillText(
      "Showing " + Math.min(items.length, MAX_ITEMS) + " of " + items.length + " items  •  Use /shop to buy more",
      W / 2, fY + 20
    );
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "rgba(100,116,139,0.25)"; ctx.font = lblFont(12); ctx.textAlign = "right";
  ctx.fillText("Solo Leveling RPG  •  Hunter Inventory", W - 36, H - 18);
  ctx.textAlign = "left";

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
    ctx.fillText("No cards collected yet. The unique card drops at 0.0025%.", 78, 244);
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

  
  const topGradient = ctx.createLinearGradient(0, 0, width, 6);
  topGradient.addColorStop(0, "#EC4899");
  topGradient.addColorStop(0.5, "#7C3AED");
  topGradient.addColorStop(1, "#EC4899");
  ctx.fillStyle = topGradient;
  ctx.fillRect(0, 0, width, 6);

  
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 52px Inter";
  ctx.fillText(title, 48, 80);

  
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

  
  const rowH = 70;
  const maxRows = Math.min(hunters.length, 9);
  
  hunters.slice(0, maxRows).forEach((hunter, i) => {
    const y = headerY + headerH + i * (rowH + 12);
    const isTopThree = i < 3;
    
    
    let medalColor = "#CBD5E1";
    let medalEmoji = `#${i + 1}`;
    if (i === 0) {
      medalColor = "#FFD700";
      medalEmoji = "🥇";
    } else if (i === 1) {
      medalColor = "#C0C0C0";
      medalEmoji = "🥈";
    } else if (i === 2) {
      medalColor = "#CD7F32";
      medalEmoji = "🥉";
    }

    roundedRect(ctx, 48, y, width - 96, rowH, 10);
    ctx.fillStyle = isTopThree ? "rgba(124, 58, 237, 0.15)" : "rgba(51, 65, 85, 0.4)";
    ctx.fill();
    ctx.strokeStyle = isTopThree ? medalColor : "rgba(148, 163, 184, 0.2)";
    ctx.lineWidth = isTopThree ? 2 : 1;
    ctx.stroke();

    
    ctx.fillStyle = medalColor;
    ctx.font = "900 24px Inter";
    ctx.fillText(medalEmoji, 68, y + 45);

    
    ctx.fillStyle = "#F8FAFC";
    ctx.font = "900 22px Inter";
    ctx.fillText(formatDisplayName(String(hunter.username)).substring(0, 35), 140, y + 45);

    
    const hunterRank = normalizeRank(hunter.rank);
    const rankTint = rankColor(hunterRank);
    ctx.fillStyle = rankTint;
    ctx.font = "900 14px Inter";
    ctx.fillText(`[${hunterRank}]`, 500, y + 25);

    
    ctx.fillStyle = "#CBD5E1";
    ctx.font = "900 18px Inter";
    ctx.fillText(`Lv. ${hunter.level}`, 520, y + 50);

    
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

    
    ctx.fillStyle = "#FBBF24";
    ctx.font = "900 18px Inter";
    ctx.fillText(String(hunter.gold), 950, y + 45);
  });

  return toBuffer(canvas);
}

async function generateStatsCard(user, hunter, metrics = {}) {
  const displayName = formatDisplayName(user.username);
  const W = 1600;
  const H = 1000;
  const canvas = new Canvas(W, H);
  const ctx = canvas.getContext("2d");

  await drawMainBackground(ctx, W, H);

  const rankLabel = normalizeRank(hunter.rank);
  const rankTint = rankColor(rankLabel);
  const rankBadge = rankBadgeText(rankLabel);
  const { RANKS, RANK_THRESHOLDS } = require("../utils/constants");

  const expNeeded    = metrics.expNeeded    || Math.ceil(100 * Math.pow(hunter.level, 1.5));
  const basePower    = Number(metrics.basePower    || 0);
  const shadowPower  = Number(metrics.shadowPower  || 0);
  const cardPower    = Number(metrics.cardPower    || 0);
  const finalPower   = Number(metrics.finalPower   || 0);
  const equippedShadows = Number(metrics.equippedShadows || 0);
  const shadowSlots  = Number(metrics.shadowSlots  || hunter.shadow_slots || 0);
  const ownedCards   = Number(metrics.ownedCards   || 0);
  const topCards     = String(metrics.topCards     || "None");

  // Font aliases — use Orbitron for numbers, Rajdhani for labels, Inter as fallback
  const FONT_NUM = "Orbitron";
  const FONT_LBL = "Rajdhani";
  const FONT_FB  = "Inter";

  function numFont(size) { return "900 " + size + "px " + FONT_NUM + ", " + FONT_FB; }
  function lblFont(size) { return "700 " + size + "px " + FONT_LBL + ", " + FONT_FB; }
  function hdrFont(size) { return "900 " + size + "px " + FONT_LBL + ", " + FONT_FB; }

  // Abbreviate large numbers: 1500 → 1.5K, 2000000 → 2M
  function fmtNum(n) {
    const v = Number(n);
    if (isNaN(v)) return String(n);
    if (Math.abs(v) >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace(/.0$/, "") + "B";
    if (Math.abs(v) >= 1_000_000)     return (v / 1_000_000).toFixed(1).replace(/.0$/, "") + "M";
    if (Math.abs(v) >= 10_000)        return (v / 1_000).toFixed(1).replace(/.0$/, "") + "K";
    return v.toLocaleString();
  }

  // Auto-fit number text into maxW using Orbitron, starting at maxSize down to minSize
  function fitNumText(str, maxSz, minSz, maxW) {
    let sz = maxSz;
    while (sz > minSz) {
      ctx.font = numFont(sz);
      if (ctx.measureText(str).width <= maxW) return sz;
      sz -= 1;
    }
    return minSz;
  }

  // ─── DARK BACKGROUND WASH ────────────────────────────────────────
  const wash = ctx.createLinearGradient(0, 0, W, H);
  wash.addColorStop(0, "rgba(2, 4, 16, 0.85)");
  wash.addColorStop(0.5, "rgba(5, 8, 24, 0.78)");
  wash.addColorStop(1, "rgba(1, 2, 12, 0.90)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  // ─── SYSTEM GRID ─────────────────────────────────────────────────
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = "#4A90D9";
  ctx.lineWidth = 1;
  for (let gx = 0; gx < W; gx += 48) { ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke(); }
  for (let gy = 0; gy < H; gy += 48) { ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke(); }
  ctx.restore();

  // ─── DIAGONAL SCAN LINES ─────────────────────────────────────────
  ctx.save();
  ctx.globalAlpha = 0.022;
  ctx.strokeStyle = "#7C3AED";
  ctx.lineWidth = 1;
  for (let i = -H; i < W + H; i += 28) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i+H,H); ctx.stroke(); }
  ctx.restore();

  // ─── TOP & BOTTOM BARS ───────────────────────────────────────────
  const topGrad = ctx.createLinearGradient(0,0,W,0);
  topGrad.addColorStop(0, rankTint); topGrad.addColorStop(0.3,"#7C3AED"); topGrad.addColorStop(0.7,"#0EA5E9"); topGrad.addColorStop(1,rankTint);
  ctx.fillStyle = topGrad; ctx.fillRect(0,0,W,8);
  const tg = ctx.createLinearGradient(0,8,0,72); tg.addColorStop(0,rankTint+"44"); tg.addColorStop(1,"transparent");
  ctx.fillStyle=tg; ctx.fillRect(0,8,W,64);
  ctx.fillStyle = topGrad; ctx.fillRect(0,H-8,W,8);
  const bg2=ctx.createLinearGradient(0,H-72,0,H-8); bg2.addColorStop(0,"transparent"); bg2.addColorStop(1,rankTint+"33");
  ctx.fillStyle=bg2; ctx.fillRect(0,H-72,W,64);

  // ─── CORNER BRACKETS ─────────────────────────────────────────────
  function drawCorner(bx,by,size,flipX,flipY,color) {
    ctx.save(); ctx.translate(bx,by); ctx.scale(flipX?-1:1,flipY?-1:1);
    ctx.strokeStyle=color; ctx.lineWidth=3; ctx.lineCap="square";
    ctx.beginPath(); ctx.moveTo(0,size); ctx.lineTo(0,0); ctx.lineTo(size,0); ctx.stroke();
    ctx.globalAlpha=0.25; ctx.lineWidth=9; ctx.stroke(); ctx.restore();
  }
  drawCorner(16,16,46,false,false,rankTint); drawCorner(W-16,16,46,true,false,rankTint);
  drawCorner(16,H-16,46,false,true,rankTint); drawCorner(W-16,H-16,46,true,true,rankTint);

  // ─── LEFT PANEL ──────────────────────────────────────────────────
  const LP_X=32, LP_Y=28, LP_W=360, LP_H=H-56;
  roundedRect(ctx,LP_X,LP_Y,LP_W,LP_H,24);
  const lpBg=ctx.createLinearGradient(LP_X,LP_Y,LP_X,LP_Y+LP_H);
  lpBg.addColorStop(0,"rgba(10,18,45,0.96)"); lpBg.addColorStop(1,"rgba(5,10,28,0.99)");
  ctx.fillStyle=lpBg; ctx.fill();
  ctx.strokeStyle=rankTint+"70"; ctx.lineWidth=2; ctx.stroke();
  // glowing left border stripe
  roundedRect(ctx,LP_X,LP_Y,5,LP_H,4);
  const lbg=ctx.createLinearGradient(LP_X,LP_Y,LP_X,LP_Y+LP_H);
  lbg.addColorStop(0,rankTint); lbg.addColorStop(0.5,"#7C3AED"); lbg.addColorStop(1,rankTint);
  ctx.fillStyle=lbg; ctx.fill();

  // ─── AVATAR ──────────────────────────────────────────────────────
  const AV_CX=LP_X+LP_W/2, AV_CY=LP_Y+150, AV_R=105;
  [AV_R+36,AV_R+22,AV_R+10].forEach((r,i)=>{
    ctx.beginPath(); ctx.arc(AV_CX,AV_CY,r,0,Math.PI*2);
    ctx.strokeStyle=rankTint; ctx.globalAlpha=0.10-i*0.02; ctx.lineWidth=3-i; ctx.stroke(); ctx.globalAlpha=1;
    ctx.fillStyle=rankTint+(i===0?"16":i===1?"0E":"07"); ctx.fill();
  });
  // orbit dots
  for(let d=0;d<8;d++){
    const ang=(d/8)*Math.PI*2; const or=AV_R+26;
    ctx.beginPath(); ctx.arc(AV_CX+Math.cos(ang)*or,AV_CY+Math.sin(ang)*or,d%2===0?4:2.5,0,Math.PI*2);
    ctx.fillStyle=d%2===0?rankTint:"#7C3AED"; ctx.globalAlpha=d%2===0?0.9:0.5; ctx.fill(); ctx.globalAlpha=1;
  }
  ctx.beginPath(); ctx.arc(AV_CX,AV_CY,AV_R,0,Math.PI*2); ctx.fillStyle="#0D1528"; ctx.fill();
  ctx.strokeStyle=rankTint; ctx.lineWidth=3.5; ctx.stroke();
  try {
    const au=user.displayAvatarURL({size:512});
    if(au){const ai=await loadImage(au);ctx.save();ctx.beginPath();ctx.arc(AV_CX,AV_CY,AV_R-2,0,Math.PI*2);ctx.clip();ctx.drawImage(ai,AV_CX-AV_R,AV_CY-AV_R,AV_R*2,AV_R*2);ctx.restore();}
  } catch(e){}
  // avatar sheen
  ctx.save(); ctx.beginPath(); ctx.arc(AV_CX,AV_CY,AV_R-2,0,Math.PI*2); ctx.clip();
  const sh=ctx.createLinearGradient(AV_CX-AV_R,AV_CY-AV_R,AV_CX-AV_R,AV_CY+AV_R);
  sh.addColorStop(0,"rgba(255,255,255,0.15)"); sh.addColorStop(0.4,"rgba(255,255,255,0.00)"); sh.addColorStop(1,"rgba(0,0,0,0.40)");
  ctx.fillStyle=sh; ctx.fillRect(AV_CX-AV_R,AV_CY-AV_R,AV_R*2,AV_R*2); ctx.restore();
  // rank badge
  const BD_X=AV_CX+AV_R*0.65, BD_Y=AV_CY+AV_R*0.65, BD_R=38;
  ctx.beginPath(); ctx.arc(BD_X,BD_Y,BD_R+5,0,Math.PI*2); ctx.fillStyle=rankTint+"40"; ctx.fill();
  ctx.beginPath(); ctx.arc(BD_X,BD_Y,BD_R,0,Math.PI*2); ctx.fillStyle=rankTint; ctx.fill();
  ctx.strokeStyle="#060E24"; ctx.lineWidth=4; ctx.stroke();
  ctx.fillStyle="#FFFFFF"; ctx.font=numFont(rankBadge.length>1?16:22); ctx.textAlign="center";
  ctx.fillText(rankBadge,BD_X,BD_Y+9); ctx.textAlign="left";

  // Name
  ctx.textAlign="center";
  const nmSz=fitFontSize(ctx,displayName,34,16,LP_W-40);
  ctx.font=hdrFont(nmSz); ctx.fillStyle="#F8FAFC";
  ctx.fillText(ellipsizeText(ctx,displayName,LP_W-40),AV_CX,AV_CY+AV_R+48);
  ctx.font=lblFont(16); ctx.fillStyle=rankTint;
  ctx.fillText(rankLabel,AV_CX,AV_CY+AV_R+74);
  // level pill
  const lvW=130,lvH=36,lvX=AV_CX-65,lvY=AV_CY+AV_R+88;
  roundedRect(ctx,lvX,lvY,lvW,lvH,999);
  const lvg=ctx.createLinearGradient(lvX,lvY,lvX+lvW,lvY);
  lvg.addColorStop(0,"#1E40AF"); lvg.addColorStop(1,"#0EA5E9"); ctx.fillStyle=lvg; ctx.fill();
  ctx.font=numFont(14); ctx.fillStyle="#FFFFFF";
  ctx.fillText("LV. "+String(hunter.level),AV_CX,lvY+24); ctx.textAlign="left";

  // ─── RANK PROGRESS BAR ───────────────────────────────────────────
  const rpY=AV_CY+AV_R+140, rpW=LP_W-48, rpX=LP_X+24;
  const rankIdx=RANKS.indexOf(rankLabel);
  const nextRank=rankIdx<RANKS.length-1?RANKS[rankIdx+1]:null;
  const nextThresh=nextRank?RANK_THRESHOLDS[nextRank]:null;
  const rankPct=nextThresh?Math.min(hunter.level/nextThresh,1):1;

  ctx.font=lblFont(12); ctx.fillStyle="#475569"; ctx.fillText("RANK PROGRESS",rpX,rpY);
  if(nextRank){ctx.textAlign="right";ctx.fillStyle=rankTint;ctx.fillText("→ "+nextRank+"  (Lv."+nextThresh+")",rpX+rpW,rpY);ctx.textAlign="left";}

  const rpBarH=22,rpBarY=rpY+10;
  ctx.save(); ctx.shadowColor=rankTint; ctx.shadowBlur=14;
  roundedRect(ctx,rpX,rpBarY,rpW,rpBarH,999); ctx.strokeStyle=rankTint+"45"; ctx.lineWidth=1.5; ctx.stroke(); ctx.restore();
  roundedRect(ctx,rpX,rpBarY,rpW,rpBarH,999);
  const rpt=ctx.createLinearGradient(rpX,rpBarY,rpX,rpBarY+rpBarH);
  rpt.addColorStop(0,"rgba(20,30,65,0.96)"); rpt.addColorStop(1,"rgba(10,16,42,0.99)"); ctx.fillStyle=rpt; ctx.fill();
  const rpFillW=Math.max(0,rpW*rankPct);
  if(rpFillW>0){
    roundedRect(ctx,rpX,rpBarY,rpFillW,rpBarH,999);
    const rpf=ctx.createLinearGradient(rpX,rpBarY,rpX+rpFillW,rpBarY);
    rpf.addColorStop(0,rankTint); rpf.addColorStop(0.6,"#7C3AED"); rpf.addColorStop(1,"#0EA5E9"); ctx.fillStyle=rpf; ctx.fill();
    roundedRect(ctx,rpX,rpBarY,rpFillW,rpBarH*0.44,999); ctx.fillStyle="rgba(255,255,255,0.22)"; ctx.fill();
    if(rpFillW>10){
      const tx=rpX+rpFillW,ty=rpBarY+rpBarH/2;
      ctx.save(); ctx.shadowColor="#FFF"; ctx.shadowBlur=16;
      ctx.beginPath(); ctx.arc(tx,ty,5,0,Math.PI*2); ctx.fillStyle="#FFFFFF"; ctx.fill(); ctx.restore();
      ctx.beginPath(); ctx.arc(tx,ty,10,0,Math.PI*2); ctx.strokeStyle="rgba(255,255,255,0.30)"; ctx.lineWidth=1.5; ctx.stroke();
    }
  }
  [0.25,0.5,0.75].forEach(f=>{
    const tx=rpX+rpW*f; ctx.strokeStyle="rgba(255,255,255,0.10)"; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(tx,rpBarY+3); ctx.lineTo(tx,rpBarY+rpBarH-3); ctx.stroke();
  });
  if(rpFillW>30){
    ctx.font=numFont(11); ctx.fillStyle="#F8FAFC"; ctx.textAlign="center";
    ctx.fillText(Math.floor(rankPct*100)+"%",rpX+rpFillW/2,rpBarY+15); ctx.textAlign="left";
  }

  // ─── DIVIDER ─────────────────────────────────────────────────────
  const divY=rpBarY+rpBarH+16;
  ctx.strokeStyle=rankTint+"30"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(LP_X+20,divY); ctx.lineTo(LP_X+LP_W-20,divY); ctx.stroke();

  // ─── RESOURCE CARDS ──────────────────────────────────────────────
  const resources=[
    {key:"gold",  label:"GOLD",     value:Number(hunter.gold||0),           color:"#FBBF24"},
    {key:"mana",  label:"MANA",     value:Number(hunter.mana||0),           color:"#A78BFA"},
    {key:"level", label:"LEVEL",    value:Number(hunter.level||1),          color:"#06B6D4"},
    {key:null,    label:"STAT PTS", value:Number(hunter.stat_points||0),     color:"#10B981"},
    {key:null,    label:"SHADOWS",  value:equippedShadows+"/"+shadowSlots,  color:"#8B5CF6"},
    {key:null,    label:"CARDS",    value:ownedCards,                        color:"#F97316"},
  ];
  const resW=(LP_W-48)/2, resH=78, resGap=10, resStartY=divY+12;

  for(let i=0;i<resources.length;i++){
    const res=resources[i], col=i%2, row=Math.floor(i/2);
    const rx=LP_X+16+col*(resW+resGap), ry=resStartY+row*(resH+resGap);

    // card
    roundedRect(ctx,rx,ry,resW,resH,14);
    const rbg=ctx.createLinearGradient(rx,ry,rx,ry+resH);
    rbg.addColorStop(0,"rgba(15,24,55,0.94)"); rbg.addColorStop(1,"rgba(7,12,32,0.98)");
    ctx.fillStyle=rbg; ctx.fill();
    ctx.strokeStyle=res.color+"55"; ctx.lineWidth=1.5; ctx.stroke();
    // top colored stripe
    roundedRect(ctx,rx+2,ry+2,resW-4,4,3); ctx.fillStyle=res.color; ctx.fill();
    // gloss
    roundedRect(ctx,rx+4,ry+7,resW-8,resH*0.32,10);
    const rgl=ctx.createLinearGradient(rx,ry,rx,ry+resH*0.4);
    rgl.addColorStop(0,"rgba(255,255,255,0.08)"); rgl.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=rgl; ctx.fill();
    // right color accent
    roundedRect(ctx,rx+resW-4,ry,4,resH,4); ctx.fillStyle=res.color+"33"; ctx.fill();

    const emoji=res.key?await loadDiscordEmojiById(STAT_EMOJI_IDS[res.key]):null;
    let lx=rx+12;
    if(emoji){ctx.drawImage(emoji,lx,ry+12,18,18);lx+=24;}
    ctx.fillStyle="#4B5563"; ctx.font=lblFont(12); ctx.fillText(res.label,lx,ry+27);

    const resValStr = typeof res.value === "number" ? fmtNum(res.value) : String(res.value);
    const resvSz = fitNumText(resValStr, 24, 12, resW - 24);
    ctx.fillStyle = res.color; ctx.font = numFont(resvSz);
    ctx.fillText(resValStr, rx + 12, ry + resH - 10);
  }

  // ─── MAIN AREA ───────────────────────────────────────────────────
  const MX=LP_X+LP_W+24, MY=28, MW=W-MX-32;

  // SECTION HEADER HELPER
  function sysHeader(x,y,label,color) {
    ctx.font=lblFont(13); ctx.fillStyle="#1E3A5F";
    ctx.fillText("═".repeat(70),x,y+16);
    ctx.fillStyle=color; ctx.fillText("[ SYSTEM ]  "+label,x,y+16);
  }

  sysHeader(MX,MY,"HUNTER STATISTICS PANEL  v3.0","#3B82F6");

  // ─── STAT GAUGE CARDS ────────────────────────────────────────────
  const coreStats=[
    {key:"strength",    abbr:"STR",label:"Strength",    value:hunter.strength,    color:"#EF4444",glow:"#FF7B7B",bg:"rgba(100,20,20,0.18)"},
    {key:"agility",     abbr:"AGI",label:"Agility",     value:hunter.agility,     color:"#10B981",glow:"#34D399",bg:"rgba(16,100,60,0.18)"},
    {key:"intelligence",abbr:"INT",label:"Intelligence",value:hunter.intelligence,color:"#3B82F6",glow:"#60A5FA",bg:"rgba(20,50,120,0.18)"},
    {key:"vitality",    abbr:"VIT",label:"Vitality",    value:hunter.vitality,    color:"#F59E0B",glow:"#FCD34D",bg:"rgba(100,70,10,0.18)"},
  ];

  const gaugeGap=20, gaugeW=(MW-gaugeGap*3)/4, gaugeH=200, gaugeY=MY+38, gaugeR=54, maxStat=200;

  for(let i=0;i<coreStats.length;i++){
    const s=coreStats[i], gx=MX+i*(gaugeW+gaugeGap), gcx=gx+gaugeW/2, gcy=gaugeY+gaugeR+28;

    // card bg with tinted gradient
    roundedRect(ctx,gx,gaugeY,gaugeW,gaugeH,20);
    const gbg=ctx.createLinearGradient(gx,gaugeY,gx,gaugeY+gaugeH);
    gbg.addColorStop(0,s.bg); gbg.addColorStop(0.5,"rgba(8,14,35,0.97)"); gbg.addColorStop(1,"rgba(4,8,22,0.99)");
    ctx.fillStyle=gbg; ctx.fill();
    ctx.strokeStyle=s.color+"55"; ctx.lineWidth=2; ctx.stroke();

    // top gloss on card
    roundedRect(ctx,gx+2,gaugeY+2,gaugeW-4,gaugeH*0.28,18);
    const cg=ctx.createLinearGradient(gx,gaugeY,gx,gaugeY+gaugeH*0.28);
    cg.addColorStop(0,"rgba(255,255,255,0.08)"); cg.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=cg; ctx.fill();

    // colored bottom accent line
    roundedRect(ctx,gx+8,gaugeY+gaugeH-6,gaugeW-16,4,4); ctx.fillStyle=s.color; ctx.fill();

    // gauge track
    const arcS=Math.PI*0.75, arcE=Math.PI*2.25;
    const arcF=arcS+(arcE-arcS)*Math.min(s.value/maxStat,1);
    ctx.beginPath(); ctx.arc(gcx,gcy,gaugeR,arcS,arcE);
    ctx.strokeStyle="rgba(25,40,80,0.9)"; ctx.lineWidth=12; ctx.lineCap="round"; ctx.stroke();
    // outer dim ring
    ctx.beginPath(); ctx.arc(gcx,gcy,gaugeR+7,arcS,arcE);
    ctx.strokeStyle=s.color+"18"; ctx.lineWidth=3; ctx.lineCap="round"; ctx.stroke();

    // gauge fill with glow
    ctx.save(); ctx.shadowColor=s.glow; ctx.shadowBlur=22;
    ctx.beginPath(); ctx.arc(gcx,gcy,gaugeR,arcS,arcF);
    const ag=ctx.createLinearGradient(gcx-gaugeR,gcy,gcx+gaugeR,gcy);
    ag.addColorStop(0,s.color+"CC"); ag.addColorStop(0.6,s.color); ag.addColorStop(1,s.glow);
    ctx.strokeStyle=ag; ctx.lineWidth=12; ctx.lineCap="round"; ctx.stroke(); ctx.restore();

    // inner circle bg
    ctx.beginPath(); ctx.arc(gcx,gcy,gaugeR-16,0,Math.PI*2); ctx.fillStyle="rgba(4,8,22,0.97)"; ctx.fill();
    // inner ring
    ctx.beginPath(); ctx.arc(gcx,gcy,gaugeR-16,0,Math.PI*2); ctx.strokeStyle=s.color+"22"; ctx.lineWidth=2; ctx.stroke();

    // value inside gauge — use abbreviated number to prevent overflow
    const gaugeInnerW = (gaugeR - 16) * 1.8;
    const valRaw = fmtNum(s.value);
    const inSz = fitNumText(valRaw, 34, 12, gaugeInnerW);
    ctx.font = numFont(inSz); ctx.fillStyle = s.glow; ctx.textAlign = "center";
    ctx.save(); ctx.shadowColor = s.glow; ctx.shadowBlur = 14;
    ctx.fillText(valRaw, gcx, gcy + Math.floor(inSz * 0.38));
    ctx.restore();

    // emoji + abbr
    const emoji=await loadDiscordEmojiById(STAT_EMOJI_IDS[s.key]);
    const lby=gaugeY+gaugeH-64;
    if(emoji){ctx.drawImage(emoji,gcx-30,lby,24,24);ctx.font=lblFont(15);ctx.fillStyle=s.color;ctx.fillText(s.abbr,gcx+10,lby+18);}
    else{ctx.font=lblFont(16);ctx.fillStyle=s.color;ctx.fillText(s.abbr,gcx,lby+18);}
    ctx.font=lblFont(12); ctx.fillStyle="#374151"; ctx.textAlign="center";
    ctx.fillText(s.label.toUpperCase(),gcx,lby+38);

    // bottom mini bar
    const pctX=gx+14,pctY2=gaugeY+gaugeH-14,pctW=gaugeW-28,pctH=6;
    roundedRect(ctx,pctX,pctY2,pctW,pctH,999); ctx.fillStyle="rgba(20,32,70,0.9)"; ctx.fill();
    const pf=Math.max(0,pctW*Math.min(s.value/maxStat,1));
    if(pf>0){
      roundedRect(ctx,pctX,pctY2,pf,pctH,999);
      const pg=ctx.createLinearGradient(pctX,pctY2,pctX+pf,pctY2);
      pg.addColorStop(0,s.color); pg.addColorStop(1,s.glow); ctx.fillStyle=pg; ctx.fill();
    }
    ctx.textAlign="left";
  }

  // ─── POWER ANALYSIS SECTION ──────────────────────────────────────
  const pwSecY=gaugeY+gaugeH+26;
  sysHeader(MX,pwSecY,"COMBAT POWER ANALYSIS","#7C3AED");

  const powerEntries=[
    {label:"BASE PWR",  value:basePower,  color:"#22C55E",glow:"#4ADE80",pct:Math.min(basePower/Math.max(finalPower,1),1)},
    {label:"SHADOW+",   value:shadowPower,color:"#A78BFA",glow:"#C4B5FD",pct:Math.min(shadowPower/Math.max(finalPower,1),1),prefix:"+"},
    {label:"CARD+",     value:cardPower,  color:"#F59E0B",glow:"#FCD34D",pct:Math.min(cardPower/Math.max(finalPower,1),1),prefix:"+"},
    {label:"⚡ POWER",  value:finalPower, color:"#EF4444",glow:"#FCA5A5",pct:1,                                             final:true},
  ];
  const pwW=(MW-gaugeGap*3)/4, pwH=132, pwY=pwSecY+28;

  for(let i=0;i<powerEntries.length;i++){
    const pe=powerEntries[i], px=MX+i*(pwW+gaugeGap), fin=pe.final;
    const peDisp=(pe.prefix?pe.prefix:"")+fmtNum(pe.value);
    const peLabelMaxW=pwW-28;

    roundedRect(ctx,px,pwY,pwW,pwH,16);
    if(fin){
      const fbg=ctx.createLinearGradient(px,pwY,px,pwY+pwH);
      fbg.addColorStop(0,"rgba(120,20,20,0.45)"); fbg.addColorStop(1,"rgba(60,5,5,0.65)");
      ctx.fillStyle=fbg;
    } else {
      const pbg=ctx.createLinearGradient(px,pwY,px,pwY+pwH);
      pbg.addColorStop(0,"rgba(10,18,48,0.96)"); pbg.addColorStop(1,"rgba(5,9,28,0.99)");
      ctx.fillStyle=pbg;
    }
    ctx.fill();
    if(fin){ctx.save();ctx.shadowColor=pe.color;ctx.shadowBlur=18;}
    ctx.strokeStyle=pe.color+(fin?"99":"44"); ctx.lineWidth=fin?2.5:1.5; ctx.stroke();
    if(fin)ctx.restore();

    // top tinted band
    roundedRect(ctx,px,pwY,pwW,32,16);
    ctx.fillStyle=pe.color+(fin?"28":"18"); ctx.fill();

    ctx.font=lblFont(12); ctx.fillStyle=fin?"#E2E8F0":"#4B5563";
    ctx.fillText(pe.label,px+14,pwY+22);

    const pvSz = fitNumText(peDisp, fin ? 46 : 38, 16, peLabelMaxW);
    ctx.font = numFont(pvSz); ctx.fillStyle = pe.glow;
    if(fin){ctx.save();ctx.shadowColor=pe.color;ctx.shadowBlur=24;ctx.fillText(peDisp,px+14,pwY+90);ctx.restore();}
    else ctx.fillText(peDisp,px+14,pwY+86);

    // power mini bar
    const mbY=pwY+pwH-15,mbW=pwW-28;
    roundedRect(ctx,px+14,mbY,mbW,8,999); ctx.fillStyle="rgba(15,28,62,0.9)"; ctx.fill();
    const mf=Math.max(0,mbW*pe.pct);
    if(mf>0){
      roundedRect(ctx,px+14,mbY,mf,8,999);
      const mg=ctx.createLinearGradient(px+14,mbY,px+14+mf,mbY);
      mg.addColorStop(0,pe.color); mg.addColorStop(1,pe.glow); ctx.fillStyle=mg; ctx.fill();
      roundedRect(ctx,px+14,mbY,mf,4,999); ctx.fillStyle="rgba(255,255,255,0.18)"; ctx.fill();
    }
  }

  // ─── XP BAR (ULTRA) ──────────────────────────────────────────────
  const xpSecY=pwY+pwH+26;
  sysHeader(MX,xpSecY,"EXPERIENCE PROGRESS  ─  LV."+hunter.level,"#0EA5E9");

  const xpPct=Math.min(hunter.exp/expNeeded,1);
  const xpBY=xpSecY+28, xpBH=54;

  // outer glow
  ctx.save(); ctx.shadowColor="#1D4ED8"; ctx.shadowBlur=20;
  roundedRect(ctx,MX-2,xpBY-2,MW+4,xpBH+4,18); ctx.strokeStyle="#1D4ED822"; ctx.lineWidth=2; ctx.stroke(); ctx.restore();

  // track
  roundedRect(ctx,MX,xpBY,MW,xpBH,16);
  const xpT=ctx.createLinearGradient(MX,xpBY,MX,xpBY+xpBH);
  xpT.addColorStop(0,"rgba(10,18,52,0.97)"); xpT.addColorStop(1,"rgba(4,9,28,0.99)");
  ctx.fillStyle=xpT; ctx.fill(); ctx.strokeStyle="#1E3E6A"; ctx.lineWidth=1.5; ctx.stroke();

  // fill
  const xpFW=Math.max(0,(MW-4)*xpPct);
  if(xpFW>0){
    roundedRect(ctx,MX+2,xpBY+2,xpFW,xpBH-4,14);
    const xpF=ctx.createLinearGradient(MX+2,xpBY,MX+2+xpFW,xpBY);
    xpF.addColorStop(0,"#1D4ED8"); xpF.addColorStop(0.3,"#2563EB"); xpF.addColorStop(0.65,"#06B6D4"); xpF.addColorStop(1,"#7DD3FC");
    ctx.fillStyle=xpF; ctx.fill();
    // depth
    roundedRect(ctx,MX+2,xpBY+xpBH*0.55,xpFW,xpBH*0.43,14); ctx.fillStyle="rgba(0,0,0,0.20)"; ctx.fill();
    // gloss
    roundedRect(ctx,MX+2,xpBY+2,xpFW,xpBH*0.42,14);
    const gl=ctx.createLinearGradient(MX,xpBY,MX,xpBY+xpBH*0.42);
    gl.addColorStop(0,"rgba(255,255,255,0.36)"); gl.addColorStop(1,"rgba(255,255,255,0)"); ctx.fillStyle=gl; ctx.fill();
    // bottom glow
    roundedRect(ctx,MX+2,xpBY+xpBH*0.72,xpFW,xpBH*0.25,14);
    const bl=ctx.createLinearGradient(MX,xpBY+xpBH*0.72,MX,xpBY+xpBH);
    bl.addColorStop(0,"rgba(56,189,248,0)"); bl.addColorStop(1,"rgba(56,189,248,0.26)"); ctx.fillStyle=bl; ctx.fill();
    // tip flare
    if(xpFW>12){
      const tipX=MX+2+xpFW, tipY=xpBY+xpBH/2;
      [22,14,8].forEach((r,ri)=>{ctx.beginPath();ctx.arc(tipX,tipY,r,0,Math.PI*2);ctx.fillStyle="rgba(125,211,252,"+(0.07-ri*0.018)+")";ctx.fill();});
      ctx.save();ctx.shadowColor="#FFF";ctx.shadowBlur=22;ctx.beginPath();ctx.arc(tipX,tipY,5,0,Math.PI*2);ctx.fillStyle="#FFFFFF";ctx.fill();ctx.restore();
      [-0.4,0,0.4,Math.PI-0.3,Math.PI,Math.PI+0.3].forEach(a=>{
        ctx.strokeStyle="rgba(255,255,255,0.50)";ctx.lineWidth=1.5;ctx.lineCap="round";
        ctx.beginPath();ctx.moveTo(tipX+Math.cos(a)*8,tipY+Math.sin(a)*8);ctx.lineTo(tipX+Math.cos(a)*17,tipY+Math.sin(a)*17);ctx.stroke();
      });
    }
  }

  // 10-segment markers
  for(let seg=1;seg<10;seg++){
    const sx=MX+2+(MW-4)*(seg/10);
    ctx.strokeStyle=seg%5===0?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.06)";
    ctx.lineWidth=seg%5===0?2:1;
    ctx.beginPath();ctx.moveTo(sx,xpBY+4);ctx.lineTo(sx,xpBY+xpBH-4);ctx.stroke();
  }

  // ── XP LABELS: left and right BELOW bar ──────────────────────────
  const xpLabelY = xpBY + xpBH + 20;
  // left: current XP
  ctx.font = numFont(15); ctx.fillStyle = "#38BDF8";
  ctx.fillText(hunter.exp.toLocaleString() + " XP", MX + 4, xpLabelY);
  // center: percentage
  ctx.font = numFont(15); ctx.fillStyle = "#FFFFFF"; ctx.textAlign = "center";
  ctx.fillText(Math.floor(xpPct * 100) + "%", MX + MW / 2, xpLabelY);
  // right: max XP
  ctx.font = lblFont(14); ctx.fillStyle = "#4B5563"; ctx.textAlign = "right";
  ctx.fillText("MAX  " + expNeeded.toLocaleString() + " XP", MX + MW - 4, xpLabelY);
  ctx.textAlign = "left";

  // ─── BOTTOM INFO ROW ─────────────────────────────────────────────
  const infoY=xpLabelY+18, infoH=62;
  roundedRect(ctx,MX,infoY,MW,infoH,14);
  const iBg=ctx.createLinearGradient(MX,infoY,MX+MW,infoY);
  iBg.addColorStop(0,"rgba(8,14,38,0.97)");iBg.addColorStop(0.5,"rgba(12,22,50,0.93)");iBg.addColorStop(1,"rgba(8,14,38,0.97)");
  ctx.fillStyle=iBg;ctx.fill();ctx.strokeStyle="#1E3A5F";ctx.lineWidth=1.5;ctx.stroke();

  const infoItems=[
    {label:"SHADOWS",   value:equippedShadows+" / "+shadowSlots, color:"#A78BFA"},
    {label:"CARDS",     value:String(ownedCards),                  color:"#F97316"},
    {label:"TOP CARDS", value:topCards,                            color:"#06B6D4"},
    {label:"STAT PTS",  value:String(hunter.stat_points||0),       color:"#10B981"},
    {label:"GOLD",      value:Number(hunter.gold||0).toLocaleString(),color:"#FBBF24"},
  ];
  const iiW=MW/infoItems.length;
  for(let i=0;i<infoItems.length;i++){
    const itm=infoItems[i],ix=MX+i*iiW+14;
    ctx.font=lblFont(11);ctx.fillStyle="#334155";ctx.fillText(itm.label,ix,infoY+20);
    ctx.font=numFont(17);ctx.fillStyle=itm.color;ctx.fillText(ellipsizeText(ctx,itm.value,iiW-28),ix,infoY+48);
    if(i<infoItems.length-1){ctx.strokeStyle="#1E3A5F";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(MX+(i+1)*iiW,infoY+10);ctx.lineTo(MX+(i+1)*iiW,infoY+infoH-10);ctx.stroke();}
  }

  // ─── WATERMARK ───────────────────────────────────────────────────
  ctx.fillStyle="rgba(100,116,139,0.30)"; ctx.font=lblFont(13); ctx.textAlign="right";
  ctx.fillText("Solo Leveling RPG  •  Hunter Database",W-36,H-22); ctx.textAlign="left";

  return toBuffer(canvas);
}

async function generateHuntResultCard(user, result, levelsGained) {
  const W = 1440;
  const H = 810;
  const canvas = new Canvas(W, H);
  const ctx = canvas.getContext("2d");

  // Cinematic Background
  ctx.fillStyle = "#000000"; ctx.fillRect(0,0,W,H);
  try {
    const bg = await loadImage(MAIN_BACKGROUND_PATH);
    ctx.globalAlpha = 0.3;
    ctx.drawImage(bg, 0, 0, W, H);
    ctx.globalAlpha = 1.0;
  } catch (e) {}

  const grad = ctx.createRadialGradient(W/2, H/2, 50, W/2, H/2, W);
  grad.addColorStop(0, "rgba(239, 68, 68, 0.15)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0.95)");
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);

  drawDigitalGrid(ctx, W, H, "#EF4444");
  drawHUDBrackets(ctx, 40, 40, W-80, H-80, "#EF4444", 60);

  // Header
  ctx.textAlign = "left";
  ctx.fillStyle = "#EF4444";
  ctx.font = "900 24px Orbitron";
  ctx.shadowColor = "#EF4444"; ctx.shadowBlur = 15;
  ctx.fillText("[ SYSTEM OVERRIDE ] STATUS: TARGET ELIMINATED", 80, 100);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 80px Orbitron";
  ctx.fillText("MONSTER SLAIN", 80, 180);

  // Main Display
  drawNeoUIBacking(ctx, 80, 220, W-160, 500, "#EF4444");
  
  // Telemetry Decoration
  ctx.font = "700 14px Rajdhani"; ctx.fillStyle = "#475569";
  for(let i=0; i<8; i++) {
    ctx.fillText("DATA_" + Math.random().toString(16).slice(2,8).toUpperCase(), 110, 260 + i*60);
    ctx.fillText("VAL_" + (Math.random()*100).toFixed(2), W-200, 260 + i*60);
  }

  // Large Reward Circle for Gold
  const cx1 = 450, cy = 460, r = 160;
  drawTechCircles(ctx, cx1, cy, r, "#FBBF24");
  ctx.textAlign = "center";
  ctx.fillStyle = "#FBBF24";
  ctx.font = "900 70px Orbitron";
  ctx.shadowColor = "#FBBF24"; ctx.shadowBlur = 20;
  ctx.fillText("+" + (result.gold || 0), cx1, cy + 20);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#FFF"; ctx.font = "700 24px Rajdhani";
  ctx.fillText("GOLD ACQUIRED", cx1, cy + 60);

  // Large Reward Circle for XP
  const cx2 = 990;
  drawTechCircles(ctx, cx2, cy, r, "#3B82F6");
  ctx.fillStyle = "#3B82F6";
  ctx.font = "900 70px Orbitron";
  ctx.shadowColor = "#3B82F6"; ctx.shadowBlur = 20;
  ctx.fillText("+" + (result.xp || 0), cx2, cy + 20);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#FFF"; ctx.font = "700 24px Rajdhani";
  ctx.fillText("EXP VESTED", cx2, cy + 60);

  // Level Up Alert
  if (levelsGained > 0) {
    ctx.save();
    ctx.translate(W/2, 220);
    ctx.rotate(-0.02);
    drawEpic3DBox(ctx, -200, -40, 400, 80, "#10B981");
    ctx.fillStyle = "#FFF"; ctx.font = "900 40px Orbitron"; ctx.textAlign = "center";
    ctx.shadowColor = "#10B981"; ctx.shadowBlur = 20;
    ctx.fillText("LEVEL UP", 0, 15);
    ctx.restore();
  }

  // Footer Tag
  ctx.textAlign = "center";
  ctx.fillStyle = "#1E293B"; ctx.font = "700 16px Rajdhani";
  ctx.fillText("OPERATOR: " + (user.username||"UNKNOWN").toUpperCase() + " | SESSION_ID: " + Date.now().toString(36).toUpperCase(), W/2, H-60);

  return await canvas.toBuffer("png");
}

async function generateBattleResultCard(attacker, defender, result) {
  const attackerName = formatDisplayName(attacker.username);
  const defenderName = formatDisplayName(defender.username);
  const W = 1440;
  const H = 820;
  const canvas = new Canvas(W, H);
  const ctx = canvas.getContext("2d");

  const FONT_NUM = "Orbitron";
  const FONT_LBL = "Rajdhani";
  const FONT_FB = "Inter";
  function numFont(sz) { return "900 " + sz + "px " + FONT_NUM + ", " + FONT_FB; }
  function lblFont(sz) { return "700 " + sz + "px " + FONT_LBL + ", " + FONT_FB; }

  // ── BACKGROUND 
  await drawMainBackground(ctx, W, H);
  const clrAtt = "#3B82F6";  // Blue for attacker
  const clrDef = "#EF4444";  // Red for defender

  // Split diagonal background: Blue left/top, Red right/bottom
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(0, H); ctx.closePath();
  const grdAtt = ctx.createLinearGradient(0, 0, W/2, H/2);
  grdAtt.addColorStop(0, "rgba(10, 20, 50, 0.95)"); grdAtt.addColorStop(1, "rgba(5, 10, 25, 0.95)");
  ctx.fillStyle = grdAtt; ctx.fill();

  ctx.beginPath();
  ctx.moveTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  const grdDef = ctx.createLinearGradient(W, H, W/2, H/2);
  grdDef.addColorStop(0, "rgba(50, 10, 15, 0.95)"); grdDef.addColorStop(1, "rgba(25, 5, 8, 0.95)");
  ctx.fillStyle = grdDef; ctx.fill();
  ctx.restore();

  // Dark wash over center
  const centerWash = ctx.createRadialGradient(W/2, H/2, 50, W/2, H/2, W/2);
  centerWash.addColorStop(0, "rgba(0,0,0,0.4)");
  centerWash.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = centerWash; ctx.fillRect(0, 0, W, H);

  // ── Lightning in the middle line
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 3;
  ctx.shadowColor = "#FFFFFF"; ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(W - 100, 0);
  // draw jagged line down to (100, H)
  let cx = W - 100, cy = 0;
  while(cy < H) {
    cy += randomInt(30, 80);
    cx -= randomInt(30, 80) * (W/H);
    ctx.lineTo(cx + randomInt(-40, 40), cy);
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(167, 139, 250, 0.4)";
  ctx.lineWidth = 8; ctx.stroke();
  ctx.restore();

  // ── CENTER "VS" Badge
  const vsR = 80;
  ctx.save();
  ctx.shadowColor = "#F59E0B"; ctx.shadowBlur = 30;
  ctx.beginPath(); ctx.arc(W/2, H/2 - 60, vsR, 0, Math.PI*2);
  ctx.fillStyle = "#1E293B"; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = "#F59E0B"; ctx.stroke();
  ctx.fillStyle = "#F59E0B";
  ctx.font = numFont(64); ctx.textAlign = "center";
  ctx.fillText("VS", W/2, H/2 - 40);
  ctx.restore();
  ctx.textAlign = "left";

  // ── PLAYER CARDS function
  function drawFighter(isAttacker, x, y) {
    const isWin = isAttacker ? result.attackerWon : !result.attackerWon;
    const clr = isAttacker ? clrAtt : clrDef;
    const name = isAttacker ? attackerName : defenderName;
    const power = isAttacker ? result.attScore : result.defScore;
    const hp = isAttacker ? result.attackerHp : result.defenderHp;
    const maxHp = isAttacker ? result.attackerMaxHp : result.defenderMaxHp;
    const rew = isAttacker ? result.rewards?.attacker : result.rewards?.defender;

    const fw = 440;
    const fh = 260;

    // Outer glow if win
    if (isWin) {
      ctx.save();
      ctx.shadowColor = clr; ctx.shadowBlur = 40;
      roundedRect(ctx, x, y, fw, fh, 16); ctx.fillStyle = clr; ctx.fill();
      ctx.restore();
    }

    roundedRect(ctx, x, y, fw, fh, 16);
    ctx.fillStyle = "rgba(10, 15, 30, 0.85)"; ctx.fill();
    ctx.lineWidth = isWin ? 5 : 2; ctx.strokeStyle = isWin ? clr : "#334155"; ctx.stroke();

    // Inner top accent
    roundedRect(ctx, x, y, fw, 60, 16);
    ctx.fillStyle = clr + "33"; ctx.fill();
    ctx.fillStyle = clr; ctx.font = numFont(24);
    ctx.textAlign = "center";
    ctx.fillText(isAttacker ? "ATTACKER" : "DEFENDER", x + fw/2, y + 40);

    // WIN/LOSE Stamp
    ctx.save();
    ctx.translate(x + fw/2, y + fh/2);
    ctx.rotate((isAttacker ? -15 : 15) * Math.PI / 180);
    ctx.textAlign = "center";
    ctx.font = numFont(60);
    ctx.fillStyle = isWin ? clr+"22" : "rgba(255,255,255,0.05)";
    ctx.fillText(isWin ? "VICTORY" : "DEFEAT", 0, 0);
    ctx.restore();

    ctx.textAlign = "center";
    ctx.fillStyle = "#F8FAFC";
    const nSz = fitFontSize(ctx, name, 45, 24, fw - 40);
    ctx.font = `900 ${nSz}px ${FONT_NUM}`;
    ctx.fillText(ellipsizeText(ctx, name, fw - 40), x + fw/2, y + 105);

    ctx.fillStyle = "#94A3B8"; ctx.font = lblFont(20);
    ctx.fillText("COMBAT POWER", x + fw/2, y + 145);
    ctx.fillStyle = clr; ctx.font = numFont(32);
    ctx.fillText(power.toLocaleString(), x + fw/2, y + 175);

    // HP Bar
    const barW = fw - 60;
    const barX = x + 30;
    const barY = y + 195;
    roundedRect(ctx, barX, barY, barW, 14, 7);
    ctx.fillStyle = "#1E293B"; ctx.fill();
    const hpPct = Math.max(0, Math.min(1, hp / maxHp));
    if (hpPct > 0) {
      roundedRect(ctx, barX, barY, barW * hpPct, 14, 7);
      ctx.fillStyle = isWin ? "#10B981" : "#EF4444"; ctx.fill();
    }
    ctx.fillStyle = "#E2E8F0"; ctx.font = lblFont(14);
    ctx.fillText(`HP: ${hp} / ${maxHp}`, x + fw/2, barY + 30);
    ctx.textAlign = "left";
  }

  // Draw fighters
  drawFighter(true, 80, 180);
  drawFighter(false, W - 440 - 80, 180);

  // ── COMBAT LOG (Bottom Center)
  const lw = 900;
  const lh = 220;
  const lx = W/2 - lw/2;
  const ly = H - lh - 40;

  roundedRect(ctx, lx, ly, lw, lh, 16);
  ctx.fillStyle = "rgba(10, 12, 25, 0.85)"; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = "#475569"; ctx.stroke();

  ctx.fillStyle = "#94A3B8"; ctx.font = numFont(24);
  ctx.textAlign = "center";
  ctx.fillText("COMBAT LOG", W/2, ly + 40);

  const logs = Array.isArray(result.combatLog) && result.combatLog.length ? result.combatLog : ["No combat log available."];
  ctx.textAlign = "left";
  ctx.font = lblFont(18);
  
  // Draw logs
  const startY = ly + 75;
  const lineHeight = 28;
  for (let i = 0; i < Math.min(5, logs.length); i++) {
    let text = logs[i];
    
    // Highlight A->D or D->A
    ctx.fillStyle = "#64748B"; // default gray
    if (text.includes("A->D")) ctx.fillStyle = clrAtt;
    if (text.includes("D->A")) ctx.fillStyle = clrDef;
    if (text.includes("[CRIT]")) ctx.fillStyle = "#F59E0B";

    ctx.fillText(ellipsizeText(ctx, text, lw - 60), lx + 30, startY + i * lineHeight);
  }

  // Draw overall battle result on bottom log right
  ctx.textAlign = "right";
  ctx.fillStyle = "#E2E8F0"; ctx.font = lblFont(20);
  ctx.fillText(`Length: ${result.rounds || 0} Rounds`, lx + lw - 30, ly + 80);
  ctx.fillStyle = "#A78BFA";
  ctx.fillText(`Win Probability: ${result.winChance.toFixed(1)}%`, lx + lw - 30, ly + 110);
  ctx.textAlign = "left";

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
  ctx.fillText("🎖️ Rank Up!", 48, 100);

  
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
  ctx.fillText("→", 560 + boxW / 2, startY + 150);
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

async function generateSalaryCard(user, goldGained, totalGold) {
  const W = 1200;
  const H = 600;
  const canvas = new Canvas(W, H);
  const ctx = canvas.getContext("2d");

  // Deep Premium Gradient
  ctx.fillStyle = "#050505"; ctx.fillRect(0,0,W,H);
  const grad = ctx.createLinearGradient(0,0,W,H);
  grad.addColorStop(0, "#1c1405");
  grad.addColorStop(0.5, "#0a0a0a");
  grad.addColorStop(1, "#1c1405");
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);

  drawDigitalGrid(ctx, W, H, "#FBBF24");
  drawHUDBrackets(ctx, 30, 30, W-60, H-60, "#FBBF24", 50);

  // Gilded Header
  ctx.textAlign = "center";
  ctx.fillStyle = "#FBBF24";
  ctx.font = "700 20px Rajdhani";
  ctx.fillText("— MONARCH'S TREASURY DISPERSEMENT —", W/2, 80);
  
  ctx.font = "900 60px Orbitron";
  ctx.shadowColor = "#FBBF24"; ctx.shadowBlur = 25;
  ctx.fillText("GUILD SALARY", W/2, 160);
  ctx.shadowBlur = 0;

  // Transaction Display
  drawNeoUIBacking(ctx, 100, 200, 1000, 320, "#FBBF24");
  
  // Center Piece
  ctx.fillStyle = "rgba(251, 191, 36, 0.05)";
  ctx.beginPath(); ctx.arc(W/2, 360, 120, 0, Math.PI*2); ctx.fill();
  
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 100px Orbitron";
  ctx.shadowColor = "#10B981"; ctx.shadowBlur = 20;
  ctx.fillText("+" + goldGained.toLocaleString(), W/2, 400);
  ctx.shadowBlur = 0;
  
  ctx.font = "700 28px Rajdhani"; ctx.fillStyle = "#10B981";
  ctx.fillText("GOLD CREDITS ADDED", W/2, 440);

  // Side Details
  ctx.textAlign = "left";
  ctx.font = "700 18px Rajdhani"; ctx.fillStyle = "#94A3B8";
  ctx.fillText("RECIPIENT", 140, 260);
  ctx.fillStyle = "#FFF"; ctx.font = "900 24px Orbitron";
  ctx.fillText((user.username||"HUNTER").toUpperCase(), 140, 290);

  ctx.textAlign = "right";
  ctx.fillStyle = "#94A3B8"; ctx.font = "700 18px Rajdhani";
  ctx.fillText("TOTAL BALANCE", W-140, 260);
  ctx.fillStyle = "#FBBF24"; ctx.font = "900 24px Orbitron";
  ctx.fillText(totalGold.toLocaleString() + " G", W-140, 290);

  // Authenticity Stamp
  ctx.strokeStyle = "rgba(251, 191, 36, 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(100, 480); ctx.lineTo(1100, 480); ctx.stroke();

  return await canvas.toBuffer("png");
}

async function generateGateCard(user, difficultyText, results, isSuccess) {
  const W = 1300;
  const H = 750;
  const canvas = new Canvas(W, H);
  const ctx = canvas.getContext("2d");

  const color = isSuccess ? "#10B981" : "#EF4444";
  
  // Atmospheric Background
  ctx.fillStyle = "#020202"; ctx.fillRect(0,0,W,H);
  const grad = ctx.createRadialGradient(W/2, H/2, 50, W/2, H/2, W);
  grad.addColorStop(0, color + "33");
  grad.addColorStop(1, "rgba(0,0,0,0.95)");
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);

  drawDigitalGrid(ctx, W, H, color);
  drawHUDBrackets(ctx, 40, 40, W-80, H-80, color, 80);

  // Dynamic Title
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.font = "900 20px Orbitron";
  ctx.fillText("[ SYSTEM REPORT ]", W/2, 100);
  
  ctx.shadowColor = color; ctx.shadowBlur = 30;
  ctx.font = "900 90px Orbitron";
  ctx.fillText(isSuccess ? "GATE CLEARED" : "GATE COMPROMISED", W/2, 200);
  ctx.shadowBlur = 0;

  // Main Display
  drawNeoUIBacking(ctx, 100, 260, 1100, 400, color);

  // Difficulty Badge
  drawEpic3DBox(ctx, W/2 - 150, 230, 300, 60, color);
  ctx.fillStyle = "#FFF"; ctx.font = "900 28px Orbitron";
  ctx.fillText(difficultyText.toUpperCase(), W/2, 272);

  if (isSuccess) {
    // Rewards Flow
    const rx = W/2;
    ctx.textAlign = "center";
    ctx.font = "700 24px Rajdhani"; ctx.fillStyle = "#94A3B8";
    ctx.fillText("ANALYSIS: MISSION OBJECTIVES MET. LOOT DISTRIBUTION ENHANCED.", rx, 350);

    // Gold Block
    drawNeoUIBacking(ctx, 180, 400, 440, 200, "#FBBF24");
    ctx.fillStyle = "#FBBF24"; ctx.font = "900 80px Orbitron";
    ctx.fillText("+" + (results.gold || 0), 400, 520);
    ctx.font = "700 22px Rajdhani"; ctx.fillStyle = "#FFF";
    ctx.fillText("GOLD RECOVERED", 400, 560);

    // XP Block
    drawNeoUIBacking(ctx, 680, 400, 440, 200, "#3B82F6");
    ctx.fillStyle = "#3B82F6"; ctx.font = "900 80px Orbitron";
    ctx.fillText("+" + (results.xp || 0), 900, 520);
    ctx.font = "700 22px Rajdhani"; ctx.fillStyle = "#FFF";
    ctx.fillText("XP SYNCED", 900, 560);
  } else {
    // Failure UI
    ctx.textAlign = "center";
    ctx.font = "900 50px Orbitron"; ctx.fillStyle = "#EF4444";
    ctx.shadowColor = "#EF4444"; ctx.shadowBlur = 20;
    ctx.fillText("PENALTY APPLIED", W/2, 420);
    ctx.shadowBlur = 0;
    
    drawNeoUIBacking(ctx, W/2 - 300, 460, 600, 140, "#EF4444");
    ctx.fillStyle = "#FFF"; ctx.font = "900 70px Orbitron";
    ctx.fillText("-" + (results.penalty || 0) + " G", W/2, 555);
    
    ctx.font = "700 20px Rajdhani"; ctx.fillStyle = "#475569";
    ctx.fillText("CRITICAL FAILURE: THE DUNGEON WAS NOT CLOSED IN TIME.", W/2, 640);
  }

  // Scanning Line effect (decorative)
  ctx.strokeStyle = color + "22"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(40, H/2 + Math.sin(Date.now()/500)*100); ctx.lineTo(W-40, H/2 + Math.sin(Date.now()/500)*100); ctx.stroke();

  return await canvas.toBuffer("png");
}

async function generateStartCard(user, hunter) {
  const displayName = formatDisplayName(user.username);
  const W = 1400, H = 820;
  const canvas = new Canvas(W, H);
  const ctx = canvas.getContext("2d");
  await drawMainBackground(ctx, W, H);

  const rankLabel = normalizeRank(hunter.rank);
  const rankTint  = rankColor(rankLabel);
  const rankBadge = rankBadgeText(rankLabel);

  const FONT_NUM = "Orbitron";
  const FONT_LBL = "Rajdhani";
  const FONT_FB  = "Inter";
  function numFont(sz) { return "900 " + sz + "px " + FONT_NUM + ", " + FONT_FB; }
  function lblFont(sz) { return "700 " + sz + "px " + FONT_LBL + ", " + FONT_FB; }

  // Abbreviate large numbers
  function fmtNum(n) {
    const v = Number(n);
    if (isNaN(v)) return String(n);
    if (Math.abs(v) >= 1_000_000_000) return (v/1_000_000_000).toFixed(1).replace(/.0$/,"")+"B";
    if (Math.abs(v) >= 1_000_000)     return (v/1_000_000).toFixed(1).replace(/.0$/,"")+"M";
    if (Math.abs(v) >= 10_000)        return (v/1_000).toFixed(1).replace(/.0$/,"")+"K";
    return v.toLocaleString();
  }
  // Fit Orbitron text within maxW, stepping down from maxSz to minSz
  function fitNumText(str, maxSz, minSz, maxW) {
    let sz = maxSz;
    while (sz > minSz) {
      ctx.font = numFont(sz);
      if (ctx.measureText(str).width <= maxW) return sz;
      sz -= 1;
    }
    return minSz;
  }

  // ─── DARK WASH ───────────────────────────────────────────────────
  const wash = ctx.createLinearGradient(0,0,W,H);
  wash.addColorStop(0,"rgba(2,4,18,0.82)"); wash.addColorStop(1,"rgba(1,2,12,0.92)");
  ctx.fillStyle=wash; ctx.fillRect(0,0,W,H);

  // ─── GRID ────────────────────────────────────────────────────────
  ctx.save(); ctx.globalAlpha=0.04; ctx.strokeStyle="#4A90D9"; ctx.lineWidth=1;
  for(let gx=0;gx<W;gx+=48){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();}
  for(let gy=0;gy<H;gy+=48){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}
  ctx.restore();

  // ─── SCAN LINES ──────────────────────────────────────────────────
  ctx.save(); ctx.globalAlpha=0.02; ctx.strokeStyle="#7C3AED"; ctx.lineWidth=1;
  for(let i=-H;i<W+H;i+=26){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+H,H);ctx.stroke();}
  ctx.restore();

  // ─── TOP + BOTTOM ACCENT BARS ────────────────────────────────────
  const barGrad = ctx.createLinearGradient(0,0,W,0);
  barGrad.addColorStop(0,"#7C3AED"); barGrad.addColorStop(0.4,"#4F46E5");
  barGrad.addColorStop(0.7,"#0EA5E9"); barGrad.addColorStop(1,"#7C3AED");
  ctx.fillStyle=barGrad; ctx.fillRect(0,0,W,8);
  const tGlow=ctx.createLinearGradient(0,8,0,80);
  tGlow.addColorStop(0,"rgba(124,58,237,0.40)"); tGlow.addColorStop(1,"transparent");
  ctx.fillStyle=tGlow; ctx.fillRect(0,8,W,72);
  ctx.fillStyle=barGrad; ctx.fillRect(0,H-8,W,8);
  const bGlow=ctx.createLinearGradient(0,H-80,0,H-8);
  bGlow.addColorStop(0,"transparent"); bGlow.addColorStop(1,"rgba(14,165,233,0.30)");
  ctx.fillStyle=bGlow; ctx.fillRect(0,H-80,W,72);

  // ─── CORNER BRACKETS ─────────────────────────────────────────────
  function drawCorner(bx,by,size,flipX,flipY,color) {
    ctx.save(); ctx.translate(bx,by); ctx.scale(flipX?-1:1,flipY?-1:1);
    ctx.strokeStyle=color; ctx.lineWidth=3; ctx.lineCap="square";
    ctx.beginPath(); ctx.moveTo(0,size); ctx.lineTo(0,0); ctx.lineTo(size,0); ctx.stroke();
    ctx.globalAlpha=0.22; ctx.lineWidth=10; ctx.stroke(); ctx.restore();
  }
  drawCorner(16,16,48,false,false,"#7C3AED"); drawCorner(W-16,16,48,true,false,"#7C3AED");
  drawCorner(16,H-16,48,false,true,"#0EA5E9"); drawCorner(W-16,H-16,48,true,true,"#0EA5E9");

  // ─── SYSTEM AWAKENING BANNER ─────────────────────────────────────
  const bannerY = 28;
  const bannerH = 80;
  roundedRect(ctx, 32, bannerY, W-64, bannerH, 18);
  const bannerBg = ctx.createLinearGradient(32, bannerY, W-32, bannerY+bannerH);
  bannerBg.addColorStop(0,"rgba(79,46,158,0.70)");
  bannerBg.addColorStop(0.5,"rgba(30,40,90,0.80)");
  bannerBg.addColorStop(1,"rgba(14,60,100,0.70)");
  ctx.fillStyle=bannerBg; ctx.fill();
  ctx.strokeStyle="#7C3AED88"; ctx.lineWidth=1.5; ctx.stroke();
  // banner gloss
  roundedRect(ctx,34,bannerY+2,W-68,bannerH*0.45,16);
  const bgl=ctx.createLinearGradient(32,bannerY,32,bannerY+bannerH*0.45);
  bgl.addColorStop(0,"rgba(255,255,255,0.10)"); bgl.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=bgl; ctx.fill();

  // system tag left
  ctx.font=lblFont(14); ctx.fillStyle="#7C3AED";
  ctx.fillText("[ SYSTEM ]", 52, bannerY+32);
  // big title
  ctx.font=numFont(28); ctx.fillStyle="#F8FAFC";
  ctx.textAlign="center";
  ctx.fillText("HUNTER REGISTRATION COMPLETE", W/2, bannerY+48);
  // sub label right
  ctx.font=lblFont(13); ctx.fillStyle="#4B5563"; ctx.textAlign="right";
  ctx.fillText("INITIALIZATION v1.0", W-52, bannerY+32);
  ctx.textAlign="left";

  // ─── LEFT: AVATAR PANEL ──────────────────────────────────────────
  const LP_X=32, LP_Y=bannerY+bannerH+16, LP_W=320, LP_H=H-LP_Y-36;
  roundedRect(ctx,LP_X,LP_Y,LP_W,LP_H,20);
  const lpBg=ctx.createLinearGradient(LP_X,LP_Y,LP_X,LP_Y+LP_H);
  lpBg.addColorStop(0,"rgba(10,18,48,0.96)"); lpBg.addColorStop(1,"rgba(4,8,24,0.99)");
  ctx.fillStyle=lpBg; ctx.fill();
  ctx.strokeStyle=rankTint+"66"; ctx.lineWidth=1.5; ctx.stroke();
  // left accent bar
  roundedRect(ctx,LP_X,LP_Y,5,LP_H,4);
  const lab=ctx.createLinearGradient(LP_X,LP_Y,LP_X,LP_Y+LP_H);
  lab.addColorStop(0,"#7C3AED"); lab.addColorStop(0.5,"#0EA5E9"); lab.addColorStop(1,"#7C3AED");
  ctx.fillStyle=lab; ctx.fill();

  // avatar
  const AV_CX=LP_X+LP_W/2, AV_CY=LP_Y+130, AV_R=90;
  [AV_R+32,AV_R+20,AV_R+10].forEach((r,i)=>{
    ctx.beginPath(); ctx.arc(AV_CX,AV_CY,r,0,Math.PI*2);
    ctx.strokeStyle="#7C3AED"; ctx.globalAlpha=0.10-i*0.02; ctx.lineWidth=3-i; ctx.stroke(); ctx.globalAlpha=1;
    ctx.fillStyle="#7C3AED"+(i===0?"15":i===1?"0D":"07"); ctx.fill();
  });
  // orbit dots
  for(let d=0;d<8;d++){
    const ang=(d/8)*Math.PI*2, or=AV_R+22;
    ctx.beginPath(); ctx.arc(AV_CX+Math.cos(ang)*or,AV_CY+Math.sin(ang)*or,d%2===0?3.5:2,0,Math.PI*2);
    ctx.fillStyle=d%2===0?"#7C3AED":"#0EA5E9"; ctx.globalAlpha=d%2===0?0.9:0.5; ctx.fill(); ctx.globalAlpha=1;
  }
  ctx.beginPath(); ctx.arc(AV_CX,AV_CY,AV_R,0,Math.PI*2); ctx.fillStyle="#0D1528"; ctx.fill();
  ctx.strokeStyle="#7C3AED"; ctx.lineWidth=3; ctx.stroke();
  try {
    const au=user.displayAvatarURL({size:512});
    if(au){const ai=await loadImage(au);ctx.save();ctx.beginPath();ctx.arc(AV_CX,AV_CY,AV_R-2,0,Math.PI*2);ctx.clip();ctx.drawImage(ai,AV_CX-AV_R,AV_CY-AV_R,AV_R*2,AV_R*2);ctx.restore();}
  } catch(e){}
  // sheen
  ctx.save(); ctx.beginPath(); ctx.arc(AV_CX,AV_CY,AV_R-2,0,Math.PI*2); ctx.clip();
  const sh=ctx.createLinearGradient(AV_CX-AV_R,AV_CY-AV_R,AV_CX-AV_R,AV_CY+AV_R);
  sh.addColorStop(0,"rgba(255,255,255,0.18)"); sh.addColorStop(0.4,"rgba(255,255,255,0)"); sh.addColorStop(1,"rgba(0,0,0,0.35)");
  ctx.fillStyle=sh; ctx.fillRect(AV_CX-AV_R,AV_CY-AV_R,AV_R*2,AV_R*2); ctx.restore();
  // rank badge
  const BD_X=AV_CX+AV_R*0.66, BD_Y=AV_CY+AV_R*0.66, BD_R=34;
  ctx.beginPath(); ctx.arc(BD_X,BD_Y,BD_R+4,0,Math.PI*2); ctx.fillStyle=rankTint+"44"; ctx.fill();
  ctx.beginPath(); ctx.arc(BD_X,BD_Y,BD_R,0,Math.PI*2); ctx.fillStyle=rankTint; ctx.fill();
  ctx.strokeStyle="#060E24"; ctx.lineWidth=3.5; ctx.stroke();
  ctx.fillStyle="#FFF"; ctx.font=numFont(rankBadge.length>1?14:20); ctx.textAlign="center";
  ctx.fillText(rankBadge,BD_X,BD_Y+8); ctx.textAlign="left";

  // Name + rank
  ctx.textAlign="center";
  const nmSz=Math.min(28, Math.floor(240/Math.max(displayName.length*0.6,1)));
  ctx.font=lblFont(Math.min(nmSz+4,30)); ctx.fillStyle="#F8FAFC";
  ctx.fillText(ellipsizeText(ctx,displayName,LP_W-32),AV_CX,AV_CY+AV_R+42);
  ctx.font=lblFont(14); ctx.fillStyle=rankTint;
  ctx.fillText(rankLabel+" RANK", AV_CX, AV_CY+AV_R+64);
  // NEW HUNTER pill
  const nhW=160,nhH=32,nhX=AV_CX-80,nhY=AV_CY+AV_R+78;
  roundedRect(ctx,nhX,nhY,nhW,nhH,999);
  const nhg=ctx.createLinearGradient(nhX,nhY,nhX+nhW,nhY);
  nhg.addColorStop(0,"#7C3AED"); nhg.addColorStop(1,"#0EA5E9"); ctx.fillStyle=nhg; ctx.fill();
  ctx.font=numFont(12); ctx.fillStyle="#FFF";
  ctx.fillText("✦  NEW HUNTER",AV_CX,nhY+21); ctx.textAlign="left";

  // starter stat mini-cards in left panel
  const miniStats=[
    {key:"rank",  label:"RANK",  value:rankLabel,              color:rankTint},
    {key:"level", label:"LEVEL", value:hunter.level,           color:"#06B6D4"},
    {key:"gold",  label:"GOLD",  value:hunter.gold,            color:"#FBBF24"},
    {key:"mana",  label:"MANA",  value:hunter.mana,            color:"#A78BFA"},
  ];
  const msW=(LP_W-44)/2, msH=58, msGap=8;
  const msStartY=nhY+nhH+14;
  for(let i=0;i<miniStats.length;i++){
    const ms=miniStats[i], col=i%2, row=Math.floor(i/2);
    const mx=LP_X+14+col*(msW+msGap), my=msStartY+row*(msH+msGap);
    roundedRect(ctx,mx,my,msW,msH,12);
    const msBg=ctx.createLinearGradient(mx,my,mx,my+msH);
    msBg.addColorStop(0,"rgba(15,22,52,0.95)"); msBg.addColorStop(1,"rgba(6,10,28,0.99)");
    ctx.fillStyle=msBg; ctx.fill();
    ctx.strokeStyle=ms.color+"55"; ctx.lineWidth=1.5; ctx.stroke();
    // top accent
    roundedRect(ctx,mx+2,my+2,msW-4,3,2); ctx.fillStyle=ms.color; ctx.fill();
    const mEmoji=ms.key&&STAT_EMOJI_IDS[ms.key]?await loadDiscordEmojiById(STAT_EMOJI_IDS[ms.key]):null;
    let mlx=mx+10;
    if(mEmoji){ctx.drawImage(mEmoji,mlx,my+10,16,16);mlx+=20;}
    ctx.fillStyle="#4B5563"; ctx.font=lblFont(11); ctx.fillText(ms.label,mlx,my+22);
    const msVal = typeof ms.value === "number" ? fmtNum(ms.value) : String(ms.value);
    const msSz = fitNumText(msVal, 18, 10, msW - 20);
    ctx.fillStyle=ms.color; ctx.font=numFont(msSz); ctx.fillText(ellipsizeText(ctx, msVal, msW-20), mx+10, my+msH-8);
  }

  // ─── CENTER: ATTRIBUTES ──────────────────────────────────────────
  const CP_X=LP_X+LP_W+18, CP_Y=LP_Y, CP_W=440, CP_H=LP_H;
  roundedRect(ctx,CP_X,CP_Y,CP_W,CP_H,20);
  const cpBg=ctx.createLinearGradient(CP_X,CP_Y,CP_X,CP_Y+CP_H);
  cpBg.addColorStop(0,"rgba(8,14,40,0.97)"); cpBg.addColorStop(1,"rgba(4,8,24,0.99)");
  ctx.fillStyle=cpBg; ctx.fill(); ctx.strokeStyle="#1E3A5F"; ctx.lineWidth=1.5; ctx.stroke();

  // section title
  ctx.font=lblFont(13); ctx.fillStyle="#1E3A5F";
  ctx.fillText("═".repeat(52),CP_X+16,CP_Y+22);
  ctx.fillStyle="#10B981"; ctx.fillText("[ SYSTEM ]  BASE ATTRIBUTES",CP_X+16,CP_Y+22);

  const attrs=[
    {key:"strength",     abbr:"STR",label:"Strength",    value:hunter.strength,    color:"#EF4444",glow:"#FF7B7B"},
    {key:"agility",      abbr:"AGI",label:"Agility",     value:hunter.agility,     color:"#10B981",glow:"#34D399"},
    {key:"intelligence", abbr:"INT",label:"Intelligence",value:hunter.intelligence,color:"#3B82F6",glow:"#60A5FA"},
    {key:"vitality",     abbr:"VIT",label:"Vitality",    value:hunter.vitality,    color:"#F59E0B",glow:"#FCD34D"},
  ];

  const atW=(CP_W-48)/2, atH=112, atGap=12;
  for(let i=0;i<attrs.length;i++){
    const a=attrs[i];
    const col=i%2, row=Math.floor(i/2);
    const ax=CP_X+16+col*(atW+atGap), ay=CP_Y+36+row*(atH+atGap);

    // card bg
    roundedRect(ctx,ax,ay,atW,atH,16);
    const abg=ctx.createLinearGradient(ax,ay,ax,ay+atH);
    abg.addColorStop(0,"rgba(12,20,50,0.95)"); abg.addColorStop(1,"rgba(5,9,26,0.99)");
    ctx.fillStyle=abg; ctx.fill();
    ctx.strokeStyle=a.color+"55"; ctx.lineWidth=1.5; ctx.stroke();
    // left accent
    roundedRect(ctx,ax,ay,5,atH,4); ctx.fillStyle=a.color; ctx.fill();
    // bottom accent
    roundedRect(ctx,ax+8,ay+atH-5,atW-16,4,4); ctx.fillStyle=a.color+"88"; ctx.fill();
    // gloss
    roundedRect(ctx,ax+2,ay+2,atW-4,atH*0.30,14);
    const agl=ctx.createLinearGradient(ax,ay,ax,ay+atH*0.30);
    agl.addColorStop(0,"rgba(255,255,255,0.09)"); agl.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=agl; ctx.fill();

    // emoji + label
    const aEmoji=await loadDiscordEmojiById(STAT_EMOJI_IDS[a.key]);
    let alx=ax+14;
    if(aEmoji){ctx.drawImage(aEmoji,alx,ay+14,22,22);alx+=28;}
    ctx.font=lblFont(14); ctx.fillStyle=a.color; ctx.fillText(a.abbr,alx,ay+30);
    ctx.font=lblFont(11); ctx.fillStyle="#374151"; ctx.fillText(a.label.toUpperCase(),ax+14,ay+50);

    // big value — abbreviated + auto-fit so nothing overflows
    const aValStr = fmtNum(a.value);
    const avSz = fitNumText(aValStr, 34, 14, atW - 28);
    ctx.font = numFont(avSz);
    ctx.save(); ctx.shadowColor = a.glow; ctx.shadowBlur = 18;
    ctx.fillStyle = a.glow; ctx.fillText(aValStr, ax+14, ay+atH-18); ctx.restore();
  }

  // ─── RIGHT: GUIDE PANEL ──────────────────────────────────────────
  const RP_X=CP_X+CP_W+18, RP_Y=LP_Y, RP_W=W-RP_X-36, RP_H=LP_H;
  roundedRect(ctx,RP_X,RP_Y,RP_W,RP_H,20);
  const rpBg=ctx.createLinearGradient(RP_X,RP_Y,RP_X,RP_Y+RP_H);
  rpBg.addColorStop(0,"rgba(8,14,42,0.97)"); rpBg.addColorStop(1,"rgba(4,8,24,0.99)");
  ctx.fillStyle=rpBg; ctx.fill(); ctx.strokeStyle="#1E3A5F"; ctx.lineWidth=1.5; ctx.stroke();
  // right accent bar
  roundedRect(ctx,RP_X+RP_W-5,RP_Y,5,RP_H,4);
  const rab=ctx.createLinearGradient(RP_X,RP_Y,RP_X,RP_Y+RP_H);
  rab.addColorStop(0,"#0EA5E9"); rab.addColorStop(0.5,"#7C3AED"); rab.addColorStop(1,"#0EA5E9");
  ctx.fillStyle=rab; ctx.fill();

  // section title
  ctx.font=lblFont(13); ctx.fillStyle="#1E3A5F";
  ctx.fillText("═".repeat(44),RP_X+16,RP_Y+22);
  ctx.fillStyle="#0EA5E9"; ctx.fillText("[ SYSTEM ]  AVAILABLE COMMANDS",RP_X+16,RP_Y+22);

  // command entries
  const commands=[
    {cmd:"/stats",   desc:"View your detailed combat stats card",    color:"#3B82F6"},
    {cmd:"/profile", desc:"Open your full hunter profile card",      color:"#10B981"},
    {cmd:"/hunt",    desc:"Go on a solo hunt for XP and gold",       color:"#F59E0B"},
    {cmd:"/dungeon", desc:"Enter a dungeon for epic rewards",        color:"#8B5CF6"},
    {cmd:"/battle",  desc:"Challenge another hunter to PvP",         color:"#EF4444"},
    {cmd:"/shop",    desc:"Visit the hunter shop to buy upgrades",   color:"#06B6D4"},
    {cmd:"/leaderboard",desc:"Check the global rank leaderboard",    color:"#FBBF24"},
    {cmd:"/shadows", desc:"Manage your shadow army",                  color:"#A78BFA"},
  ];

  let cmdY=RP_Y+38;
  const cmdRowH=54;
  for(let i=0;i<commands.length;i++){
    const cmd=commands[i], cy=cmdY+i*cmdRowH;
    // row bg
    roundedRect(ctx,RP_X+12,cy,RP_W-24,42,10);
    const rowBg=ctx.createLinearGradient(RP_X+12,cy,RP_X+RP_W-12,cy);
    rowBg.addColorStop(0,"rgba(12,20,50,0.80)"); rowBg.addColorStop(1,"rgba(6,10,28,0.60)");
    ctx.fillStyle=rowBg; ctx.fill();
    ctx.strokeStyle=cmd.color+"30"; ctx.lineWidth=1; ctx.stroke();
    // left micro bar
    roundedRect(ctx,RP_X+12,cy,4,42,4); ctx.fillStyle=cmd.color; ctx.fill();
    // cmd name
    ctx.font=numFont(13); ctx.fillStyle=cmd.color;
    ctx.fillText(cmd.cmd,RP_X+24,cy+27);
    // description
    const cmdW=ctx.measureText(cmd.cmd).width+14;
    ctx.font=lblFont(13); ctx.fillStyle="#4B5563";
    ctx.fillText("—  "+cmd.desc,RP_X+24+cmdW,cy+27);
  }

  // ─── BOTTOM BANNER (MOTIVATION) ──────────────────────────────────
  const btY=LP_Y+LP_H+10, btH=36;
  roundedRect(ctx,32,btY,W-64,btH,12);
  const btBg=ctx.createLinearGradient(32,btY,W-32,btY);
  btBg.addColorStop(0,"rgba(79,46,158,0.50)"); btBg.addColorStop(0.5,"rgba(14,60,100,0.55)"); btBg.addColorStop(1,"rgba(79,46,158,0.50)");
  ctx.fillStyle=btBg; ctx.fill(); ctx.strokeStyle="#7C3AED44"; ctx.lineWidth=1; ctx.stroke();
  ctx.font=lblFont(15); ctx.fillStyle="#94A3B8"; ctx.textAlign="center";
  ctx.fillText("I ALONE LEVEL UP  •  Rise from E-Rank and claim your place among the Shadow Monarch's chosen hunters", W/2, btY+23);
  ctx.textAlign="left";

  // watermark
  ctx.fillStyle="rgba(100,116,139,0.25)"; ctx.font=lblFont(12); ctx.textAlign="right";
  ctx.fillText("Solo Leveling RPG  •  Hunter Database",W-36,H-16); ctx.textAlign="left";

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



