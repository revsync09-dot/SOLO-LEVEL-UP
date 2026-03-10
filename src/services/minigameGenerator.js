const { Canvas } = require("skia-canvas");

function drawRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

const RARITY_COLORS = {
  Common: "#94a3b8",
  Uncommon: "#22c55e",
  Rare: "#3b82f6",
  Epic: "#a855f7",
  Legendary: "#eab308",
};

/** Daily reward card — clean UI, no gambling wording. */
async function generateSpinCard(username, slot, rarity, rewardXp, rewardGold, rewardItem, currentGold) {
  const w = 900;
  const h = 500;
  const canvas = new Canvas(w, h);
  const ctx = canvas.getContext("2d");

  const rarityColor = RARITY_COLORS[rarity] || "#64748b";
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, "#0f172a");
  bgGrad.addColorStop(0.5, "#1e293b");
  bgGrad.addColorStop(1, "#0f172a");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  const innerPad = 24;
  drawRoundRect(ctx, innerPad, innerPad, w - innerPad * 2, h - innerPad * 2, 16);
  ctx.strokeStyle = rarityColor + "99";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("DAILY REWARD", w / 2, 58);
  ctx.font = "18px sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`${username} claimed today’s reward`, w / 2, 88);

  const boxX = w / 2 - 200;
  const boxY = 130;
  const boxW = 400;
  const boxH = 160;
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  drawRoundRect(ctx, boxX, boxY, boxW, boxH, 12);
  ctx.fill();
  ctx.strokeStyle = rarityColor + "66";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = "72px sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(slot.emoji || "🎁", w / 2, boxY + boxH / 2 - 20);
  ctx.font = "bold 26px sans-serif";
  ctx.fillStyle = rarityColor;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(slot.label || "Reward").toUpperCase(), w / 2, boxY + boxH - 28);

  const rewardY = 340;
  ctx.font = "bold 24px sans-serif";
  ctx.fillStyle = "#22c55e";
  let rewardLine = `+${rewardXp} XP   ·   +${rewardGold} Gold`;
  if (rewardItem) rewardLine += "   ·   +1 Item";
  ctx.fillText(rewardLine, w / 2, rewardY);

  ctx.font = "18px sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText(`Balance: ${Number(currentGold || 0).toLocaleString()} G`, w / 2, h - 42);

  return await canvas.toBuffer("image/png");
}

/** Loot box opened — reward-style UI. */
async function generateLootboxCard(username, boxLabel, rarity, rewardXp, rewardGold, items, currentGold) {
  const w = 880;
  const h = 520;
  const canvas = new Canvas(w, h);
  const ctx = canvas.getContext("2d");

  const rarityColor = RARITY_COLORS[rarity] || "#64748b";
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, "#0f172a");
  bgGrad.addColorStop(0.4, "#1e293b");
  bgGrad.addColorStop(1, "#0f172a");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  const innerPad = 20;
  drawRoundRect(ctx, innerPad, innerPad, w - innerPad * 2, h - innerPad * 2, 14);
  ctx.strokeStyle = rarityColor + "aa";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("REWARD BOX OPENED", w / 2, 62);
  ctx.font = "18px sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`${username} opened a ${String(boxLabel).toLowerCase()} box`, w / 2, 96);

  const frameW = 560;
  const frameH = 260;
  const frameX = w / 2 - frameW / 2;
  const frameY = 118;
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  drawRoundRect(ctx, frameX, frameY, frameW, frameH, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = "bold 28px sans-serif";
  ctx.fillStyle = "#22c55e";
  ctx.fillText(`+${Number(rewardXp).toLocaleString()} XP`, w / 2, frameY + 52);
  ctx.fillStyle = "#eab308";
  ctx.fillText(`+${Number(rewardGold).toLocaleString()} Gold`, w / 2, frameY + 102);

  if (items && items.length > 0) {
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("Items found", w / 2, frameY + 158);
    ctx.font = "18px sans-serif";
    ctx.fillStyle = rarityColor;
    const names = items.map((i) => String(i).split(":").slice(-1)[0].replace(/_/g, " "));
    ctx.fillText(names.slice(0, 4).join("  ·  "), w / 2, frameY + 198);
    if (names.length > 4) ctx.fillText(names.slice(4, 8).join("  ·  "), w / 2, frameY + 228);
  } else {
    ctx.fillStyle = "#64748b";
    ctx.font = "italic 20px sans-serif";
    ctx.fillText("No extra items in this box.", w / 2, frameY + 180);
  }

  ctx.fillStyle = "#64748b";
  ctx.font = "18px sans-serif";
  ctx.fillText(`Balance: ${Number(currentGold || 0).toLocaleString()} G`, w / 2, h - 38);

  return await canvas.toBuffer("image/png");
}

/** Training complete — hunter trained and got rewards. */
async function generateTrainingCard(username, xp, gold, statBonus, currentGold, exerciseName = "Training", emoji = "🏋️") {
  const w = 860;
  const h = 480;
  const canvas = new Canvas(w, h);
  const ctx = canvas.getContext("2d");

  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, "#0c4a6e");
  bgGrad.addColorStop(0.5, "#0f172a");
  bgGrad.addColorStop(1, "#0c4a6e");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  drawRoundRect(ctx, 20, 20, w - 40, h - 40, 18);
  ctx.strokeStyle = "#38bdf8aa";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#7dd3fc";
  ctx.font = "bold 30px sans-serif";
  ctx.fillText(`${exerciseName.toUpperCase()} COMPLETE`, w / 2, 62);
  ctx.font = "18px sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`${username} finished a ${exerciseName.toLowerCase()} session ${emoji}`, w / 2, 98);

  const boxY = 130;
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  drawRoundRect(ctx, 80, boxY, w - 160, 180, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#22c55e";
  ctx.font = "bold 36px sans-serif";
  ctx.fillText(`+${xp} XP`, w / 2, boxY + 58);
  ctx.fillStyle = "#eab308";
  ctx.font = "bold 36px sans-serif";
  ctx.fillText(`+${gold} Gold`, w / 2, boxY + 118);
  if (statBonus) {
    ctx.fillStyle = "#a78bfa";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(statBonus, w / 2, boxY + 168);
  }

  ctx.fillStyle = "#64748b";
  ctx.font = "18px sans-serif";
  ctx.fillText(`Balance: ${Number(currentGold || 0).toLocaleString()} G`, w / 2, h - 40);

  return await canvas.toBuffer("image/png");
}

/** Expedition returned — rewards from the expedition. */
async function generateExpeditionCard(username, xp, gold, itemFound, currentGold, durationHours) {
  const w = 880;
  const h = 500;
  const canvas = new Canvas(w, h);
  const ctx = canvas.getContext("2d");

  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, "#14532d");
  bgGrad.addColorStop(0.5, "#0f172a");
  bgGrad.addColorStop(1, "#14532d");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  drawRoundRect(ctx, 22, 22, w - 44, h - 44, 16);
  ctx.strokeStyle = "#4ade80aa";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#86efac";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("EXPEDITION COMPLETE", w / 2, 58);
  ctx.font = "17px sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`${username} returned from the expedition`, w / 2, 92);

  const boxY = 120;
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  drawRoundRect(ctx, 60, boxY, w - 120, 200, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(74, 222, 128, 0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#22c55e";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText(`+${xp} XP   ·   +${gold} Gold`, w / 2, boxY + 70);
  if (itemFound) {
    ctx.fillStyle = "#a78bfa";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(`+1 ${itemFound}`, w / 2, boxY + 130);
  }
  ctx.fillStyle = "#64748b";
  ctx.font = "18px sans-serif";
  ctx.fillText(`Duration: ~${durationHours}h`, w / 2, boxY + 178);

  ctx.fillStyle = "#64748b";
  ctx.font = "18px sans-serif";
  ctx.fillText(`Balance: ${Number(currentGold || 0).toLocaleString()} G`, w / 2, h - 38);

  return await canvas.toBuffer("image/png");
}

/** Daily boss fight result. */
async function generateBossResultCard(username, bossName, won, xp, gold, penalty, currentGold) {
  const w = 900;
  const h = 520;
  const canvas = new Canvas(w, h);
  const ctx = canvas.getContext("2d");

  const color = won ? "#15803d" : "#b91c1c";
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, won ? "#052e16" : "#450a0a");
  bgGrad.addColorStop(0.5, "#0f172a");
  bgGrad.addColorStop(1, won ? "#052e16" : "#450a0a");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  drawRoundRect(ctx, 24, 24, w - 48, h - 48, 16);
  ctx.strokeStyle = (won ? "#22c55e" : "#ef4444") + "99";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = won ? "#4ade80" : "#fca5a5";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText(won ? "BOSS DEFEATED" : "DEFEAT", w / 2, 64);
  ctx.font = "20px sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`${username} vs ${bossName}`, w / 2, 102);

  const boxY = 140;
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  drawRoundRect(ctx, 80, boxY, w - 160, 200, 14);
  ctx.fill();
  ctx.strokeStyle = color + "66";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (won) {
    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 30px sans-serif";
    ctx.fillText(`+${xp} XP   ·   +${gold} Gold`, w / 2, boxY + 80);
  } else {
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(`Penalty: -${penalty} Gold`, w / 2, boxY + 80);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "20px sans-serif";
    ctx.fillText(`Small XP gain for participation`, w / 2, boxY + 130);
  }

  ctx.fillStyle = "#64748b";
  ctx.font = "18px sans-serif";
  ctx.fillText(`Balance: ${Number(currentGold || 0).toLocaleString()} G`, w / 2, h - 42);

  return await canvas.toBuffer("image/png");
}

/** Streak status / claim card. */
async function generateStreakCard(username, currentStreak, longestStreak, nextReward, claimedToday) {
  const w = 840;
  const h = 440;
  const canvas = new Canvas(w, h);
  const ctx = canvas.getContext("2d");

  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, "#1e1b4b");
  bgGrad.addColorStop(0.5, "#0f172a");
  bgGrad.addColorStop(1, "#1e1b4b");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  drawRoundRect(ctx, 20, 20, w - 40, h - 40, 16);
  ctx.strokeStyle = "#a78bfaaa";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#c4b5fd";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("DAILY STREAK", w / 2, 58);
  ctx.font = "17px sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(username, w / 2, 90);

  const boxY = 118;
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  drawRoundRect(ctx, 60, boxY, w - 120, 200, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(167, 139, 253, 0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText(`Current: ${currentStreak} day(s)`, w / 2, boxY + 52);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "22px sans-serif";
  ctx.fillText(`Longest: ${longestStreak} day(s)`, w / 2, boxY + 98);
  ctx.fillStyle = "#a78bfa";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(`Next: +${nextReward.xp} XP, +${nextReward.gold} Gold${nextReward.bonus ? " + item" : ""}`, w / 2, boxY + 148);
  ctx.fillStyle = claimedToday ? "#22c55e" : "#eab308";
  ctx.font = "20px sans-serif";
  ctx.fillText(claimedToday ? "Already claimed today" : "Use !streak claim", w / 2, boxY + 188);

  return await canvas.toBuffer("image/png");
}

module.exports = {
  generateSpinCard,
  generateLootboxCard,
  generateTrainingCard,
  generateExpeditionCard,
  generateBossResultCard,
  generateStreakCard,
};
