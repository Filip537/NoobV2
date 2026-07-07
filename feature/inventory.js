const fs = require("fs");
const path = require("path");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

const levelsFile = path.join(__dirname, "..", "levels.json");

const itemBoxPath = path.join(__dirname, "..", "images", "itembox.png");
const wlPath = path.join(__dirname, "..", "images", "wl.png");
const dlPath = path.join(__dirname, "..", "images", "dl.png");
const fontPath = path.join(__dirname, "..", "fonts", "Nourd.ttf");

try {
  GlobalFonts.registerFromPath(fontPath, "Nourd");
} catch {}

function loadLevels() {
  if (!fs.existsSync(levelsFile)) fs.writeFileSync(levelsFile, "{}");

  try {
    return JSON.parse(fs.readFileSync(levelsFile, "utf8"));
  } catch {
    fs.writeFileSync(levelsFile, "{}");
    return {};
  }
}

function shorten(text, max = 14) {
  if (!text) return "USER";
  return text.length > max ? text.slice(0, max - 2) + ".." : text;
}

function drawAmount(ctx, amount, x, y) {
  ctx.font = '30px "Nourd", Arial';
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#5f5f5f";
  ctx.strokeText(String(amount), x, y);
  ctx.fillText(String(amount), x, y);
}

async function createInventoryCard(member, data) {
  const canvas = createCanvas(900, 515);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const username = shorten(member.displayName || member.user.username, 14).toUpperCase();

  const totalWl = data.wl || 0;
  const dl = Math.floor(totalWl / 100);
  const wl = totalWl % 100;

  const totalSlots = 11;

  ctx.font = '58px "Nourd", Arial';
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`@${username} INV`, 30, 70);

  ctx.font = '40px "Nourd", Arial';
  ctx.fillText(`BP SLOTS: ${totalSlots}`, 37, 124);

  ctx.fillStyle = "#8edbf0";
  ctx.fillRect(0, 162, 900, 350);

  ctx.fillStyle = "#164d5c";
  ctx.fillRect(6, 168, 888, 340);

  const itemBox = await loadImage(itemBoxPath);
  const wlImage = await loadImage(wlPath);
  const dlImage = await loadImage(dlPath);

  const slotSize = 120;
  const gap = 7;
  const startX = 76;
  const row1Y = 230;
  const row2Y = 350;

  const slots = [];

  for (let i = 0; i < 6; i++) {
    slots.push({ x: startX + i * (slotSize + gap), y: row1Y });
  }

  for (let i = 0; i < 5; i++) {
    slots.push({ x: startX + i * (slotSize + gap), y: row2Y });
  }

  const plusSlot = {
    x: startX + 5 * (slotSize + gap),
    y: row2Y
  };

  for (const slot of slots) {
    ctx.drawImage(itemBox, slot.x, slot.y, slotSize, slotSize);
  }

  ctx.drawImage(itemBox, plusSlot.x, plusSlot.y, slotSize, slotSize);

  ctx.fillStyle = "#b8ff70";
  ctx.fillRect(plusSlot.x + 12, plusSlot.y + 12, slotSize - 24, slotSize - 24);

  ctx.font = '92px "Nourd", Arial';
  ctx.fillStyle = "#f29b2f";
  ctx.fillText("+", plusSlot.x + 36, plusSlot.y + 88);

  let itemIndex = 0;

  if (dl > 0) {
    const slot = slots[itemIndex++];
    ctx.drawImage(dlImage, slot.x + 14, slot.y + 12, 92, 92);
    drawAmount(ctx, dl, slot.x + 78, slot.y + 102);
  }

  if (wl > 0) {
    const slot = slots[itemIndex++];
    ctx.drawImage(wlImage, slot.x + 14, slot.y + 12, 92, 92);
    drawAmount(ctx, wl, slot.x + 78, slot.y + 102);
  }

  return canvas.encode("png");
}

async function executeInventory(interaction) {
  await interaction.deferReply();

  const targetUser = interaction.options.getUser("user") || interaction.user;
  const member =
    await interaction.guild.members.fetch(targetUser.id).catch(() => null) ||
    interaction.member;

  const levels = loadLevels();
  const data = levels[targetUser.id] || { wl: 0 };

  const image = await createInventoryCard(member, data);

  const attachment = new AttachmentBuilder(image, {
    name: "inventory.png"
  });

  return interaction.editReply({
    content: `${targetUser}, here's your inventory,`,
    files: [attachment],
    allowedMentions: {
      users: [targetUser.id]
    }
  });
}

module.exports = {
  executeInventory
};