const fs = require("fs");
const path = require("path");
const dev = require("./dev.js");
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
const fishingRodPath = path.join(
  __dirname,
  "..",
  "images",
  "rod.webp"
);

const rainbowRodPath = path.join(
  __dirname,
  "..",
  "images",
  "rainbowrod.webp"
);

const pristineRodPath = path.join(
  __dirname,
  "..",
  "images",
  "pristinerod.webp"
);

const goldenRodPath = path.join(
  __dirname,
  "..",
  "images",
  "goldenrod.webp"
);

const wigglyWormPath = path.join(
  __dirname,
  "..",
  "images",
  "wiggly-worm.webp"
);const fishFolder = path.join(__dirname, "..", "fish");

const fontPath = path.join(__dirname, "..", "fonts", "Grobold.ttf");

const BASE_EXTRA_SLOT_COST = 100;
const SLOTS_PER_PAGE = 11;
const SLOTS_PER_UPGRADE = 11;

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

function getTotalSlots(data) {
  const upgradeLevel = Number(data.extraBackpackLevel || 0);
  return SLOTS_PER_PAGE + upgradeLevel * SLOTS_PER_UPGRADE;
}

function getNextUpgradeCost(data) {
  const upgradeLevel = Number(data.extraBackpackLevel || 0);
  return BASE_EXTRA_SLOT_COST + upgradeLevel * 100;
}

function drawAmount(ctx, amount, x, y) {
  ctx.font = '30px "Grobold", Arial';
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#5f5f5f";
  ctx.strokeText(String(amount), x, y);
  ctx.fillText(String(amount), x, y);
}

function buildButtons(userId, page, data) {
  const totalSlots = getTotalSlots(data);
  const maxPage = Math.max(1, Math.ceil(totalSlots / SLOTS_PER_PAGE));
  const nextCost = getNextUpgradeCost(data);

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`inv_buy_${userId}_${page}`)
      .setLabel(`Upgrade Slots - ${nextCost} WL`)
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`inv_prev_${userId}_${page}`)
      .setLabel("<")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),

    new ButtonBuilder()
      .setCustomId(`inv_next_${userId}_${page}`)
      .setLabel(">")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= maxPage)
  );
}

async function safeLoadImage(imagePath) {
  if (!imagePath || !fs.existsSync(imagePath)) return null;
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

  if ((data.items?.rainbowRod || 0) > 0) {
  items.push({
    type: "image",
    imagePath: rainbowRodPath,
    amount: data.items.rainbowRod
  });
}

if ((data.items?.pristineRod || 0) > 0) {
  items.push({
    type: "image",
    imagePath: pristineRodPath,
    amount: data.items.pristineRod
  });
}

if ((data.items?.goldenRod || 0) > 0) {
  items.push({
    type: "image",
    imagePath: goldenRodPath,
    amount: data.items.goldenRod
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

  const mergedFish = new Map();

  for (const fish of fishes) {
    if (!fish?.file) continue;

    const amount = Number(fish.amount || 1);
    if (amount <= 0) continue;

    mergedFish.set(
      fish.file,
      (mergedFish.get(fish.file) || 0) + amount
    );
  }

  for (const [file, amount] of mergedFish) {
    items.push({
      type: "image",
      imagePath: path.join(fishFolder, file),
      amount
    });
  }

  return items;
}

async function createInventoryCard(member, data, page = 1) {
  const canvas = createCanvas(900, 515);
  const ctx = canvas.getContext("2d");

  const totalSlots = getTotalSlots(data);
  const maxPage = Math.max(1, Math.ceil(totalSlots / SLOTS_PER_PAGE));
  page = Math.min(Math.max(page, 1), maxPage);

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const username = shorten(member.displayName || member.user.username, 14).toUpperCase();

  ctx.font = '58px "Grobold", Arial';
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`@${username} INV`, 30, 70);

  ctx.font = '40px "Grobold", Arial';
  ctx.fillText(`BP SLOTS: ${totalSlots}`, 37, 124);

  ctx.font = '28px "Grobold", Arial';
  ctx.fillText(`PAGE ${page}/${maxPage}`, 650, 124);

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

  for (const slot of slots) {
    ctx.drawImage(itemBox, slot.x, slot.y, slotSize, slotSize);
  }

  const allItems = getAllInventoryItems(data);
  const startIndex = (page - 1) * SLOTS_PER_PAGE;
  const pageItems = allItems.slice(startIndex, startIndex + SLOTS_PER_PAGE);

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
const data = levels[targetUser.id] || { wl: 0, level: 1, xp: 0, items: {}, fishBackpack: [] };

dev.applyDeveloperPerks(targetUser.id, data);

const totalSlots = getTotalSlots(data);
  const maxPage = Math.max(1, Math.ceil(totalSlots / SLOTS_PER_PAGE));
  page = Math.min(Math.max(page, 1), maxPage);

  const image = await createInventoryCard(member, data, page);

  const attachment = new AttachmentBuilder(image, {
    name: "inventory.png"
  });

  const payload = {
    content: `${targetUser}, here's your inventory,`,
    files: [attachment],
    components: [buildButtons(targetUser.id, page, data)],
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
  const currentPage = Number(parts[3] || 1);

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: "❌ This is not your inventory.",
      ephemeral: true
    });
    return true;
  }

  const levels = loadLevels();
  const data = levels[ownerId] || { wl: 0, level: 1, xp: 0, items: {}, fishBackpack: [] };

  if (!data.items) data.items = {};
  if (!Array.isArray(data.fishBackpack)) data.fishBackpack = [];

  if (action === "next") {
    const totalSlots = getTotalSlots(data);
    const maxPage = Math.max(1, Math.ceil(totalSlots / SLOTS_PER_PAGE));
    const nextPage = Math.min(currentPage + 1, maxPage);

    return sendInventory(interaction, interaction.user, nextPage, true);
  }

  if (action === "prev") {
    const prevPage = Math.max(currentPage - 1, 1);

    return sendInventory(interaction, interaction.user, prevPage, true);
  }

  if (action === "buy") {
    const cost = getNextUpgradeCost(data);

    if ((data.wl || 0) < cost) {
      await interaction.reply({
        content: `❌ You need **${cost} World Locks** to upgrade your backpack.\nYou currently have **${data.wl || 0} WL**.`,
        ephemeral: true
      });
      return true;
    }

    data.wl -= cost;
    data.extraBackpackLevel = Number(data.extraBackpackLevel || 0) + 1;
    data.extraBackpack = true;

    levels[ownerId] = data;
    saveLevels(levels);

    await interaction.reply({
      content: `✅ Backpack upgraded for **${cost} WL**!\nYou now have **${getTotalSlots(data)} slots**.`,
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
