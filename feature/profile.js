const fs = require("fs");
const path = require("path");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

const levelsFile = path.join(__dirname, "..", "levels.json");

const bgPath = path.join(__dirname, "..", "images", "profilebg.png");
const headPath = path.join(__dirname, "..", "images", "gthead.png");
const fontPath = path.join(__dirname, "..", "fonts", "Nourd.ttf");

try {
  GlobalFonts.registerFromPath(fontPath, "Nourd");
} catch {}

function loadLevels() {
  if (!fs.existsSync(levelsFile)) {
    fs.writeFileSync(levelsFile, "{}");
  }

  try {
    return JSON.parse(fs.readFileSync(levelsFile, "utf8"));
  } catch {
    fs.writeFileSync(levelsFile, "{}");
    return {};
  }
}

function shorten(text, max = 18) {
  if (!text) return "USER";
  return text.length > max ? text.slice(0, max - 2) + ".." : text;
}

async function createProfileCard(member, data) {
  const canvas = createCanvas(1200, 335);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#7fd6ea";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const bg = await loadImage(bgPath).catch(() => null);
  if (bg) {
    ctx.globalAlpha = 0.55;
    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = "rgba(25, 115, 170, 0.72)";
  ctx.fillRect(30, 30, 1140, 275);

  const head = await loadImage(headPath).catch(() => null);
  if (head) {
    ctx.drawImage(head, 75, 75, 260, 190);
  }

  const name = shorten(member.displayName || member.user.username, 22).toUpperCase();
  const level = data.level || 1;
  const xp = data.xp || 0;
  const wl = data.wl || 0;

  ctx.font = '72px "Nourd", Arial';
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`@${name}`, 410, 125);

  ctx.font = '72px "Nourd", Arial';
  ctx.fillStyle = "#dfff4f";
  ctx.fillText(`LEVEL ${level}`, 410, 220);

  ctx.font = '34px "Nourd", Arial';
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`XP: ${xp}`, 410, 275);
  ctx.fillText(`WL: ${wl}`, 620, 275);

  return canvas.encode("png");
}

async function executeProfile(interaction) {
  await interaction.deferReply();

  const levels = loadLevels();
  const data = levels[interaction.user.id] || {
    level: 1,
    xp: 0,
    wl: 0
  };

  const image = await createProfileCard(interaction.member, data);

  const attachment = new AttachmentBuilder(image, {
    name: "profile-card.png"
  });

  return interaction.editReply({
    content: `Hello ${interaction.user},`,
    files: [attachment],
    allowedMentions: {
      users: [interaction.user.id]
    }
  });
}

module.exports = {
  executeProfile
};