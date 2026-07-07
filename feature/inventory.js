const fs = require("fs");
const path = require("path");
const {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

const levelsFile = path.join(__dirname, "..", "levels.json");

const itemBoxPath = path.join(__dirname, "..", "images", "itembox.png");
const wlPath = path.join(__dirname, "..", "images", "wl.png");
const dlPath = path.join(__dirname, "..", "images", "dl.png");
const fishingRodPath = path.join(__dirname, "..", "images", "fish-rod.png");
const wigglyWormPath = path.join(__dirname, "..", "images", "wiggly-worm.webp");
const fishFolder = path.join(__dirname, "..", "fish");

const fontPath = path.join(__dirname, "..", "fonts", "Grobold.ttf");
const EXTRA_SLOT_COST = 500;

try {
  GlobalFonts.registerFromPath(fontPath, "Grobold");
} catch (err) {
  console.log("Failed to load Grobold font:", err);
}

function loadLevels() {
  if (!fs.existsSync(levelsFile)) fs.writeFileSync(levelsFile, "{}");

  try {
    return JSON.parse(fs.readFileSync(levelsFile, "utf8"));
  } catch {
    fs.writeFileSync(levelsFile, "{}");
    return {};
  }
}

function saveLevels(data) {
  fs.writeFileSync(levelsFile, JSON.stringify(data, null, 2));
}

function shorten(text, max = 14) {
  if (!text) return "USER";
  return text.length > max ? text.slice(0, max - 2) + ".." : text;
}

function drawAmount(ctx, amount, x, y) {
  ctx.font = '30px "Grobold", Arial';
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#5f5f5f";
  ctx.strokeText(String(amount), x, y);
  ctx.fillText(String(amount), x, y);
}

function buildButtons(userId, page, hasExtraBag) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`inv_buy_${userId}`)
      .setLabel("Buy Extra Slots")
      .setStyle(ButtonStyle.Success)
      .setDisabled(hasExtraBag),

    new ButtonBuilder()
      .setCustomId(`inv_prev_${userId}`)
      .setLabel("<")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 1),

    new ButtonBuilder()
      .setCustomId(`inv_next_${userId}`)
      .setLabel(">")
      .setStyle(ButtonStyle.Primary)
  );
}

async function safeLoadImage(imagePath) {
  if (!fs.existsSync(imagePath)) return null;
  return await loadImage(imagePath).catch(() => null);
}

function getAllInventoryItems(data) {
  const items = [];

  const totalWl = data.wl || 0;
  const dl = Math.floor(totalWl / 100);
  const wl = totalWl % 100;

  if (dl > 0) {
    items.push({
      type: "image",
      imagePath: dlPath,
      amount: dl
    });
  }

  if (wl > 0) {
    items.push({
      type: "image",
      imagePath: wlPath,
      amount: wl
    });
  }

  if ((data.items?.fishingRod || 0) > 0) {
    items.push({
      type: "image",
      imagePath: fishingRodPath,
      amount: data.items.fishingRod
    });
  }

  if ((data.items?.wigglyWorm || 0) > 0) {
    items.push({
      type: "image",
      imagePath: wigglyWormPath,
      amount: data.items.wigglyWorm
    });
  }

  const fishes = Array.isArray(data.fishBackpack) ? data.fishBackpack : [];

  for (const fish of fishes) {
    if (!fish.file) continue;

    const amount = fish.amount || 1;
    if (amount <= 0) continue;

    items.push({
      type: "image",
      imagePath: path.join(fishFolder, fish.file),
      amount
    });
  }

  return items;
}

async function createInventoryCard(member, data, page = 1) {
  const canvas = createCanvas(900, 515);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const username = shorten(member.displayName || member.user.username, 14).toUpperCase();

  const hasExtraBag = data.extraBackpack === true;
  const totalSlots = hasExtraBag ? 22 : 11;

  ctx.font = '58px "Grobold", Arial';
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`@${username} INV`, 30, 70);

  ctx.font = '40px "Grobold", Arial';
  ctx.fillText(`BP SLOTS: ${totalSlots}`, 37, 124);

  ctx.fillStyle = "#8edbf0";
  ctx.fillRect(0, 162, 900, 350);

  ctx.fillStyle = "#164d5c";
  ctx.fillRect(6, 168, 888, 340);

  const itemBox = await loadImage(itemBoxPath);

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

  if (!hasExtraBag && page === 1) {
    ctx.drawImage(itemBox, plusSlot.x, plusSlot.y, slotSize, slotSize);

    ctx.fillStyle = "#b8ff70";
    ctx.fillRect(plusSlot.x + 12, plusSlot.y + 12, slotSize - 24, slotSize - 24);

    ctx.font = '92px "Grobold", Arial';
    ctx.fillStyle = "#f29b2f";
    ctx.fillText("+", plusSlot.x + 36, plusSlot.y + 88);
  } else {
    ctx.drawImage(itemBox, plusSlot.x, plusSlot.y, slotSize, slotSize);
    slots.push(plusSlot);
  }

  const allItems = getAllInventoryItems(data);

  const startIndex = page === 1 ? 0 : 11;
  const pageItems = allItems.slice(startIndex, startIndex + 11);

  let itemIndex = 0;

  for (const item of pageItems) {
    if (!slots[itemIndex]) break;

    const image = await safeLoadImage(item.imagePath);
    if (!image) continue;

    const slot = slots[itemIndex++];
    ctx.drawImage(image, slot.x + 14, slot.y + 12, 92, 92);

    if ((item.amount || 0) > 1) {
      drawAmount(ctx, item.amount, slot.x + 78, slot.y + 102);
    }
  }

  return canvas.encode("png");
}

async function sendInventory(interaction, targetUser, page = 1, update = false) {
  const member =
    await interaction.guild.members.fetch(targetUser.id).catch(() => null) ||
    interaction.member;

  const levels = loadLevels();
  const data = levels[targetUser.id] || { wl: 0 };

  const image = await createInventoryCard(member, data, page);

  const attachment = new AttachmentBuilder(image, {
    name: "inventory.png"
  });

  const payload = {
    content: `${targetUser}, here's your inventory,`,
    files: [attachment],
    components: [buildButtons(targetUser.id, page, data.extraBackpack === true)],
    allowedMentions: {
      users: [targetUser.id]
    }
  };

  if (update) return interaction.update(payload);
  return interaction.editReply(payload);
}

async function executeInventory(interaction) {
  await interaction.deferReply();

  const targetUser = interaction.options.getUser("user") || interaction.user;

  return sendInventory(interaction, targetUser, 1, false);
}

async function handleButton(interaction) {
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith("inv_")) return false;

  const parts = interaction.customId.split("_");
  const action = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: "❌ This is not your inventory.",
      ephemeral: true
    });
    return true;
  }

  const levels = loadLevels();
  const data = levels[ownerId] || { wl: 0, level: 1, xp: 0 };

  if (action === "next") {
    if (!data.extraBackpack) {
      await interaction.reply({
        content: "❌ You don't have extra backpack slots yet. The extra backpack costs **500 World Locks**.",
        ephemeral: true
      });
      return true;
    }

    return sendInventory(interaction, interaction.user, 2, true);
  }

  if (action === "prev") {
    return sendInventory(interaction, interaction.user, 1, true);
  }

  if (action === "buy") {
    if (data.extraBackpack) {
      await interaction.reply({
        content: "❌ You already bought extra backpack slots.",
        ephemeral: true
      });
      return true;
    }

    if ((data.wl || 0) < EXTRA_SLOT_COST) {
      await interaction.reply({
        content: `❌ You need **500 World Locks** to buy extra backpack slots.\nYou currently have **${data.wl || 0} WL**.`,
        ephemeral: true
      });
      return true;
    }

    data.wl -= EXTRA_SLOT_COST;
    data.extraBackpack = true;

    levels[ownerId] = data;
    saveLevels(levels);

    await interaction.reply({
      content: "✅ You bought extra backpack slots for **500 WL**.",
      ephemeral: true
    });

    return true;
  }

  return false;
}

module.exports = {
  executeInventory,
  handleButton
};