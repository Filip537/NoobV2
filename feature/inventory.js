const fs = require("fs");
const path = require("path");
const dev = require("./dev.js");

const {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const {
  createCanvas,
  loadImage,
  GlobalFonts
} = require("@napi-rs/canvas");

// ==========================================
// FILE PATHS
// ==========================================

const levelsFile = path.join(
  __dirname, "..", "levels.json"
);

const itemBoxPath = path.join(
  __dirname, "..", "images", "itembox.png"
);

const wlPath = path.join(
  __dirname, "..", "images", "wl.png"
);

const dlPath = path.join(
  __dirname, "..", "images", "dl.png"
);

const fishingRodPath = path.join(
  __dirname, "..", "images", "rod.webp"
);

const wigglyWormPath = path.join(
  __dirname, "..", "images", "wiggly-worm.webp"
);

const fishFolder = path.join(
  __dirname, "..", "fish"
);

const cookingFolder = path.join(
  __dirname, "..", "images", "cooking"
);

const fontPath = path.join(
  __dirname, "..", "fonts", "Grobold.ttf"
);

// ==========================================
// COOKING ITEMS
// ==========================================

const COOKING_ITEM_IMAGES = {
  apple: "Apple.webp",
  avocado: "Avocado.webp",
  bacon: "Bacon.webp",
  bakingChocolate: "Baking_Chocolate.webp",
  blueberry: "Blueberry.webp",
  caramel: "Caramel.webp",
  cherry: "Cherry.webp",
  chickenMeat: "Chicken_Meat.webp",
  coconutMilk: "Coconut_Milk.webp",
  cornMeal: "Corn_Meal.webp",
  crushedIce: "Crushed_Ice.webp",
  dough: "Dough.webp",
  egg: "Egg.webp",
  fishChunk: "Fish_Chunk.webp",
  flour: "Flour.webp",
  groundBeef: "Ground_Beef.webp",
  groundNutmeg: "Ground_Nutmeg.webp",
  habaneroPepper: "Habanero_Pepper.webp",
  honey: "Honey.webp",
  lemon: "Lemon.webp",
  lettuce: "Lettuce.webp",
  marshmallow: "Marshmallow.webp",
  milk: "Milk.webp",
  onion: "Onion.webp",
  orangeJuice: "Orange_Juice.webp",
  pepper: "Pepper.webp",
  pineappleSlice: "Pineapple_Slice.webp",
  potato: "Potato.webp",
  rice: "Rice.webp",
  salsa: "Salsa.webp",
  salt: "Salt.webp",
  sprigOfMint: "Sprig_of_Mint.webp",
  sugar: "Sugar.webp",
  sweetPotatoMash: "Sweet_Potato_Mash.webp",
  sweetPotatoTots: "Sweet_Potato_Tots.webp",
  swissCheeseBlock: "Swiss_Cheese_Block.webp",
  tomato: "Tomato.webp",
  waterBucket: "Water_Bucket.webp",
  chipsAndGuacamole: "Chips_And_Guacamole.webp"
};

// ==========================================
// INVENTORY CONFIGURATION
// ==========================================

const BASE_EXTRA_SLOT_COST = 100;
const SLOTS_PER_PAGE = 11;
const SLOTS_PER_UPGRADE = 11;

const MYSTAT_CONFIG = {
  width: 1600,
  height: 800,

  columns: 5,
  rows: 5,

  slotSize: 142,
  slotGap: 9,

  inventoryX: 810,
  inventoryY: 27,

  characterCenterX: 390,
  characterY: 245,
  characterScale: 16,

  background: "#000000"
};

// ==========================================
// FONT
// ==========================================

try {
  if (fs.existsSync(fontPath)) {
    GlobalFonts.registerFromPath(
      fontPath,
      "Grobold"
    );
  }
} catch (error) {
  console.error(
    "[INVENTORY] Font error:",
    error.message
  );
}

// ==========================================
// DATABASE
// ==========================================

function loadLevels() {
  if (!fs.existsSync(levelsFile)) {
    fs.writeFileSync(levelsFile, "{}");
  }

  return JSON.parse(
    fs.readFileSync(levelsFile, "utf8")
  );
}

function saveLevels(data) {
  fs.writeFileSync(
    levelsFile,
    JSON.stringify(data, null, 2)
  );
}

// ==========================================
// HELPERS
// ==========================================

function shorten(text, max = 14) {
  if (!text) return "USER";

  return text.length > max
    ? text.slice(0, max - 2) + ".."
    : text;
}

function getTotalSlots(data) {
  const upgradeLevel = Number(
    data.extraBackpackLevel || 0
  );

  return (
    SLOTS_PER_PAGE +
    upgradeLevel * SLOTS_PER_UPGRADE
  );
}

function getNextUpgradeCost(data) {
  const upgradeLevel = Number(
    data.extraBackpackLevel || 0
  );

  return (
    BASE_EXTRA_SLOT_COST +
    upgradeLevel * 100
  );
}

function drawAmount(ctx, amount, x, y) {
  ctx.save();

  ctx.font = '30px "Grobold", Arial';
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#5f5f5f";

  ctx.strokeText(String(amount), x, y);
  ctx.fillText(String(amount), x, y);

  ctx.restore();
}

async function safeLoadImage(imagePath) {
  if (
    !imagePath ||
    !fs.existsSync(imagePath)
  ) {
    return null;
  }

  return loadImage(imagePath)
    .catch(() => null);
}

// ==========================================
// PIXEL RECTANGLE
// ==========================================

function pixelRect(
  ctx,
  x,
  y,
  width,
  height,
  color
) {
  ctx.fillStyle = color;

  ctx.fillRect(
    Math.round(x),
    Math.round(y),
    Math.round(width),
    Math.round(height)
  );
}

// ==========================================
// PIXEL BEVEL SHAPE
// ==========================================

function pixelShape(
  ctx,
  x,
  y,
  width,
  height,
  cut,
  color
) {
  ctx.fillStyle = color;

  ctx.beginPath();

  ctx.moveTo(x + cut, y);

  ctx.lineTo(
    x + width - cut,
    y
  );

  ctx.lineTo(
    x + width - cut,
    y + cut / 2
  );

  ctx.lineTo(
    x + width,
    y + cut / 2
  );

  ctx.lineTo(
    x + width,
    y + height - cut / 2
  );

  ctx.lineTo(
    x + width - cut,
    y + height - cut / 2
  );

  ctx.lineTo(
    x + width - cut,
    y + height
  );

  ctx.lineTo(
    x + cut,
    y + height
  );

  ctx.lineTo(
    x + cut,
    y + height - cut / 2
  );

  ctx.lineTo(
    x,
    y + height - cut / 2
  );

  ctx.lineTo(
    x,
    y + cut / 2
  );

  ctx.lineTo(
    x + cut,
    y + cut / 2
  );

  ctx.closePath();
  ctx.fill();
}

// ==========================================
// GROWTOPIA INVENTORY SLOT
// ==========================================

function drawInventorySlot(
  ctx,
  x,
  y,
  size
) {
  ctx.save();

  // Outer white border

  pixelShape(
    ctx,
    x,
    y,
    size,
    size,
    12,
    "#f5fbff"
  );

  // Subtle grey border

  pixelShape(
    ctx,
    x + 7,
    y + 7,
    size - 14,
    size - 14,
    8,
    "#b5d1dd"
  );

  // Inner dark blue bevel

  pixelShape(
    ctx,
    x + 12,
    y + 12,
    size - 24,
    size - 24,
    6,
    "#477f98"
  );

  // Dark inset

  pixelShape(
    ctx,
    x + 17,
    y + 17,
    size - 34,
    size - 34,
    5,
    "#092d3d"
  );

  // Main blue interior

  pixelShape(
    ctx,
    x + 23,
    y + 23,
    size - 46,
    size - 46,
    4,
    "#183b49"
  );

  // Top inner shadow

  pixelRect(
    ctx,
    x + 23,
    y + 18,
    size - 46,
    7,
    "#0c2633"
  );

  // Left inner shadow

  pixelRect(
    ctx,
    x + 18,
    y + 25,
    7,
    size - 50,
    "#102c3a"
  );

  // Bottom highlight

  pixelRect(
    ctx,
    x + 23,
    y + size - 23,
    size - 46,
    6,
    "#3c7c98"
  );

  // Right highlight

  pixelRect(
    ctx,
    x + size - 23,
    y + 25,
    6,
    size - 50,
    "#326b84"
  );

  ctx.restore();
}

// ==========================================
// INVENTORY BUTTONS
// ==========================================

function buildButtons(
  userId,
  page,
  data
) {
  const totalSlots = getTotalSlots(data);

  const maxPage = Math.max(
    1,
    Math.ceil(totalSlots / SLOTS_PER_PAGE)
  );

  const nextCost = getNextUpgradeCost(data);

  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          `inv_buy_${userId}_${page}`
        )
        .setLabel(
          `Upgrade Slots - ${nextCost} WL`
        )
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(
          `inv_prev_${userId}_${page}`
        )
        .setLabel("<")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),

      new ButtonBuilder()
        .setCustomId(
          `inv_next_${userId}_${page}`
        )
        .setLabel(">")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= maxPage)
    );
}

// ==========================================
// COLLECT INVENTORY ITEMS
// ==========================================

function getAllInventoryItems(data) {
  const items = [];

  const totalWl = Number(data.wl || 0);

  const dl = Math.floor(totalWl / 100);
  const wl = totalWl % 100;

  // Diamond Locks

  if (dl > 0) {
    items.push({
      type: "image",
      imagePath: dlPath,
      amount: dl
    });
  }

  // World Locks

  if (wl > 0) {
    items.push({
      type: "image",
      imagePath: wlPath,
      amount: wl
    });
  }

  // Fishing Rod

  if ((data.items?.fishingRod || 0) > 0) {
    items.push({
      type: "image",
      imagePath: fishingRodPath,
      amount: data.items.fishingRod
    });
  }

  // Wiggly Worm

  if ((data.items?.wigglyWorm || 0) > 0) {
    items.push({
      type: "image",
      imagePath: wigglyWormPath,
      amount: data.items.wigglyWorm
    });
  }

  // Cooking Items

  for (
    const [key, file] of Object.entries(
      COOKING_ITEM_IMAGES
    )
  ) {
    const amount = Number(
      data.items?.[key] || 0
    );

    if (amount <= 0) continue;

    items.push({
      type: "image",

      imagePath: path.join(
        cookingFolder,
        file
      ),

      amount
    });
  }

  // Fishing Items

  const fishes = Array.isArray(
    data.fishBackpack
  )
    ? data.fishBackpack
    : [];

  const mergedFish = new Map();

  for (const fish of fishes) {
    if (!fish?.file) continue;

    const amount = Number(
      fish.amount || 1
    );

    if (amount <= 0) continue;

    mergedFish.set(
      fish.file,
      (mergedFish.get(fish.file) || 0) +
        amount
    );
  }

  for (
    const [file, amount] of mergedFish
  ) {
    items.push({
      type: "image",

      imagePath: path.join(
        fishFolder,
        file
      ),

      amount
    });
  }

  return items;
}

// ==========================================
// ORIGINAL INVENTORY CANVAS
// ==========================================

async function createInventoryCard(
  member,
  data,
  page = 1
) {
  const canvas = createCanvas(900, 515);
  const ctx = canvas.getContext("2d");

  const totalSlots = getTotalSlots(data);

  const maxPage = Math.max(
    1,
    Math.ceil(totalSlots / SLOTS_PER_PAGE)
  );

  page = Math.min(
    Math.max(page, 1),
    maxPage
  );

  ctx.fillStyle = "#000000";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const username = shorten(
    member.displayName ||
    member.user.username,
    14
  ).toUpperCase();

  // Username

  ctx.font = '58px "Grobold", Arial';
  ctx.fillStyle = "#ffffff";

  ctx.fillText(
    `@${username} INV`,
    30,
    70
  );

  // Backpack Slots

  ctx.font = '40px "Grobold", Arial';

  ctx.fillText(
    `BP SLOTS: ${totalSlots}`,
    37,
    124
  );

  // Page

  ctx.font = '28px "Grobold", Arial';

  ctx.fillText(
    `PAGE ${page}/${maxPage}`,
    650,
    124
  );

  // Inventory Background

  ctx.fillStyle = "#8edbf0";
  ctx.fillRect(0, 162, 900, 350);

  ctx.fillStyle = "#164d5c";
  ctx.fillRect(6, 168, 888, 340);

  const itemBox = await safeLoadImage(
    itemBoxPath
  );

  const slotSize = 120;
  const gap = 7;
  const startX = 76;

  const slots = [];

  // First Row

  for (let i = 0; i < 6; i++) {
    slots.push({
      x: startX + i * (slotSize + gap),
      y: 230
    });
  }

  // Second Row

  for (let i = 0; i < 5; i++) {
    slots.push({
      x: startX + i * (slotSize + gap),
      y: 350
    });
  }

  // Draw Inventory Slots

  for (const slot of slots) {
    if (itemBox) {
      ctx.drawImage(
        itemBox,
        slot.x,
        slot.y,
        slotSize,
        slotSize
      );
    } else {
      drawInventorySlot(
        ctx,
        slot.x,
        slot.y,
        slotSize
      );
    }
  }

  // Draw Items

  const allItems = getAllInventoryItems(
    data
  );

  const startIndex =
    (page - 1) * SLOTS_PER_PAGE;

  const pageItems = allItems.slice(
    startIndex,
    startIndex + SLOTS_PER_PAGE
  );

  let itemIndex = 0;

  for (const item of pageItems) {
    if (!slots[itemIndex]) break;

    const image = await safeLoadImage(
      item.imagePath
    );

    if (!image) continue;

    const slot = slots[itemIndex++];

    ctx.drawImage(
      image,
      slot.x + 14,
      slot.y + 12,
      92,
      92
    );

    if ((item.amount || 0) > 1) {
      drawAmount(
        ctx,
        item.amount,
        slot.x + 78,
        slot.y + 102
      );
    }
  }

  return canvas.encode("png");
}

// ==========================================
// SEND ORIGINAL INVENTORY
// ==========================================

async function sendInventory(
  interaction,
  targetUser,
  page = 1,
  update = false
) {
  const member =
    await interaction.guild.members
      .fetch(targetUser.id)
      .catch(() => null) ||
    {
      displayName:
        targetUser.globalName ||
        targetUser.username,

      user: targetUser
    };

  const levels = loadLevels();

  const data = levels[targetUser.id] || {
    wl: 0,
    level: 1,
    xp: 0,
    items: {},
    fishBackpack: []
  };

  dev.applyDeveloperPerks(
    targetUser.id,
    data
  );

  const totalSlots = getTotalSlots(data);

  const maxPage = Math.max(
    1,
    Math.ceil(totalSlots / SLOTS_PER_PAGE)
  );

  page = Math.min(
    Math.max(page, 1),
    maxPage
  );

  const image = await createInventoryCard(
    member,
    data,
    page
  );

  const attachment = new AttachmentBuilder(
    image,
    {
      name: "inventory.png"
    }
  );

  const payload = {
    content:
      `${targetUser}, here's your inventory,`,

    files: [attachment],

    components: [
      buildButtons(
        targetUser.id,
        page,
        data
      )
    ],

    allowedMentions: {
      users: [targetUser.id]
    }
  };

  if (update) {
    payload.attachments = [];
  }

  if (update && !interaction.deferred) {
    return interaction.update(payload);
  }

  return interaction.editReply(payload);
}

// ==========================================
// /INVENTORY COMMAND
// ==========================================

async function executeInventory(interaction) {
  await interaction.deferReply();

  try {
    const targetUser =
      interaction.options.getUser("user") ||
      interaction.user;

    return await sendInventory(
      interaction,
      targetUser,
      1,
      false
    );

  } catch (error) {
    console.error(
      "[INVENTORY ERROR]",
      error
    );

    return interaction.editReply({
      content: "Could not load the inventory."
    }).catch(console.error);
  }
}

// ==========================================
// GROWTOPIA CHARACTER
// PROGRAMMATIC PIXEL ART
// ==========================================

function drawGrowtopiaCharacter(
  ctx,
  centerX,
  startY,
  scale = 16
) {
  ctx.save();

  ctx.imageSmoothingEnabled = false;

  const spriteWidth = 23;

  const startX = Math.round(
    centerX - spriteWidth * scale / 2
  );

  const colors = {
    base: "#a17b6a",
    shadow: "#896758",
    deepShadow: "#765547",
    light: "#b48975",
    highlight: "#c09580",
    body: "#bd907c",
    bodyLight: "#c99c88",
    bodyShadow: "#a77d69",
    eyeWhite: "#f7f5f2",
    eyeGrey: "#e1dfdc",
    pupil: "#0e0c0b",
    mouth: "#664639"
  };

  function rect(x, y, w, h, color) {
    pixelRect(
      ctx,
      startX + x * scale,
      startY + y * scale,
      w * scale,
      h * scale,
      color
    );
  }

  // ======================================
  // HEAD SILHOUETTE
  // ======================================

  rect(3, 0, 17, 1, colors.base);
  rect(2, 1, 19, 1, colors.base);
  rect(1, 2, 21, 13, colors.base);
  rect(2, 15, 19, 1, colors.base);
  rect(4, 16, 15, 1, colors.base);

  // Head Highlights

  rect(3, 1, 16, 1, colors.light);
  rect(2, 2, 9, 1, colors.light);
  rect(3, 3, 5, 1, colors.highlight);
  rect(13, 2, 2, 1, colors.light);
  rect(17, 2, 1, 1, colors.light);

  // Head Shadows

  rect(21, 3, 1, 11, colors.shadow);
  rect(20, 5, 1, 9, colors.shadow);
  rect(19, 4, 2, 1, colors.shadow);
  rect(19, 7, 1, 1, colors.shadow);
  rect(19, 10, 2, 1, colors.shadow);

  rect(1, 10, 1, 4, colors.shadow);
  rect(2, 15, 3, 1, colors.shadow);
  rect(5, 16, 13, 1, colors.shadow);

  // ======================================
  // BROWS
  // ======================================

  rect(1, 4, 5, 1, colors.light);
  rect(2, 5, 5, 1, colors.light);

  rect(10, 4, 5, 1, colors.light);
  rect(9, 5, 6, 1, colors.light);

  // ======================================
  // LEFT EYE
  // ======================================

  rect(1, 6, 7, 2, colors.eyeWhite);
  rect(2, 8, 5, 1, colors.eyeGrey);

  // Pupil looking left

  rect(2, 6, 2, 2, colors.pupil);

  // ======================================
  // RIGHT EYE
  // ======================================

  rect(9, 6, 7, 2, colors.eyeWhite);
  rect(10, 8, 5, 1, colors.eyeGrey);

  rect(10, 6, 2, 2, colors.pupil);

  // ======================================
  // NOSE
  // ======================================

  rect(8, 8, 1, 1, colors.light);
  rect(7, 9, 2, 1, colors.light);

  rect(6, 10, 5, 1, colors.shadow);

  // ======================================
  // SMIRK
  // ======================================

  rect(6, 13, 7, 1, colors.mouth);
  rect(13, 12, 1, 1, colors.mouth);

  // ======================================
  // NECK
  // ======================================

  rect(7, 17, 9, 2, colors.shadow);
  rect(8, 17, 7, 2, colors.base);

  // ======================================
  // BODY
  // ======================================

  rect(5, 19, 13, 1, colors.base);
  rect(4, 20, 15, 1, colors.base);
  rect(3, 21, 17, 6, colors.base);

  // Front torso

  rect(6, 20, 11, 1, colors.body);
  rect(6, 21, 11, 4, colors.body);
  rect(5, 25, 13, 2, colors.body);
  rect(5, 27, 13, 2, colors.body);

  // Torso highlights

  rect(7, 21, 9, 3, colors.bodyLight);
  rect(5, 25, 12, 1, colors.bodyLight);

  // Shoulder details

  rect(6, 18, 1, 3, colors.light);
  rect(16, 18, 1, 3, colors.light);

  // Torso Shadows

  rect(17, 22, 1, 3, colors.bodyShadow);
  rect(5, 26, 1, 2, colors.bodyShadow);

  // ======================================
  // LEFT ARM
  // ======================================

  rect(3, 20, 2, 1, colors.base);
  rect(2, 21, 3, 5, colors.base);
  rect(1, 26, 3, 3, colors.base);

  rect(2, 22, 1, 3, colors.light);
  rect(1, 27, 1, 1, colors.shadow);

  rect(2, 29, 2, 1, colors.shadow);

  // ======================================
  // RIGHT ARM
  // ======================================

  rect(18, 20, 2, 1, colors.base);
  rect(18, 21, 3, 5, colors.base);
  rect(19, 26, 3, 3, colors.base);

  rect(19, 22, 1, 3, colors.light);
  rect(21, 27, 1, 1, colors.shadow);

  rect(19, 29, 2, 1, colors.shadow);

  // ======================================
  // LEGS
  // ======================================

  // Left Leg

  rect(5, 28, 5, 2, colors.body);
  rect(5, 30, 4, 3, colors.base);
  rect(4, 33, 5, 1, colors.base);

  rect(5, 30, 1, 2, colors.light);

  // Left Foot

  rect(3, 33, 6, 2, colors.base);
  rect(3, 34, 6, 1, colors.shadow);

  rect(4, 33, 3, 1, colors.light);

  // Right Leg

  rect(13, 28, 5, 2, colors.body);
  rect(14, 30, 4, 3, colors.base);
  rect(14, 33, 5, 1, colors.base);

  rect(17, 30, 1, 2, colors.shadow);

  // Right Foot

  rect(13, 33, 6, 2, colors.base);
  rect(13, 34, 6, 1, colors.shadow);

  rect(14, 33, 3, 1, colors.light);

  ctx.restore();
}

// ==========================================
// DRAW DISCORD USERNAME
// ==========================================

function drawMyStatUsername(
  ctx,
  username,
  centerX
) {
  ctx.save();

  const name = String(
    username || "discord_user"
  ).slice(0, 32);

  let fontSize = 72;

  const maxWidth = 720;

  ctx.font =
    `bold ${fontSize}px Arial`;

  while (
    ctx.measureText(name).width > maxWidth &&
    fontSize > 24
  ) {
    fontSize -= 2;

    ctx.font =
      `bold ${fontSize}px Arial`;
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#ffffff";

  ctx.fillText(
    name,
    centerX,
    150
  );

  ctx.restore();
}

// ==========================================
// DRAW 5X5 EMPTY BACKPACK
// ==========================================

function drawMyStatBackpack(ctx) {
  const {
    columns,
    rows,
    slotSize,
    slotGap,
    inventoryX,
    inventoryY
  } = MYSTAT_CONFIG;

  // No surrounding background.
  // No equipment bar.
  // No scrollbar.
  // Individual squares only.

  for (let row = 0; row < rows; row++) {
    for (
      let col = 0;
      col < columns;
      col++
    ) {
      const x =
        inventoryX +
        col * (slotSize + slotGap);

      const y =
        inventoryY +
        row * (slotSize + slotGap);

      drawInventorySlot(
        ctx,
        x,
        y,
        slotSize
      );
    }
  }
}

// ==========================================
// NEW /MYSTAT CANVAS
// ==========================================

async function createMyStatCard(user) {
  const canvas = createCanvas(
    MYSTAT_CONFIG.width,
    MYSTAT_CONFIG.height
  );

  const ctx = canvas.getContext("2d");

  ctx.imageSmoothingEnabled = false;

  // ======================================
  // BLACK BACKGROUND
  // ======================================

  ctx.fillStyle =
    MYSTAT_CONFIG.background;

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  // ======================================
  // USERNAME ABOVE CHARACTER
  // ======================================

  drawMyStatUsername(
    ctx,
    user.username,
    MYSTAT_CONFIG.characterCenterX
  );

  // ======================================
  // CHARACTER ON LEFT
  // ======================================

  drawGrowtopiaCharacter(
    ctx,
    MYSTAT_CONFIG.characterCenterX,
    MYSTAT_CONFIG.characterY,
    MYSTAT_CONFIG.characterScale - 2
  );

  // ======================================
  // 25 EMPTY BACKPACK SLOTS ON RIGHT
  // ======================================

  drawMyStatBackpack(ctx);

  // ======================================
  // RETURN GENERATED PNG
  // ======================================

  return canvas.encode("png");
}

// ==========================================
// /MYSTAT COMMAND
// ==========================================

async function executeMyStat(interaction) {
  await interaction.deferReply();

  try {
    const image = await createMyStatCard(
      interaction.user
    );

    const attachment = new AttachmentBuilder(
      image,
      {
        name: "mystat.png"
      }
    );

    // Public image.
    // No buttons or extra messages.

    return await interaction.editReply({
      files: [attachment]
    });

  } catch (error) {
    console.error(
      "[MYSTAT ERROR]",
      error
    );

    return interaction.editReply({
      content:
        "Could not generate your backpack."
    }).catch(console.error);
  }
}

// ==========================================
// INVENTORY BUTTON HANDLER
// ==========================================

async function handleButton(interaction) {
  if (!interaction.isButton()) {
    return false;
  }

  if (
    !interaction.customId.startsWith("inv_")
  ) {
    return false;
  }

  const parts =
    interaction.customId.split("_");

  const action = parts[1];
  const ownerId = parts[2];

  const currentPage = Number(
    parts[3] || 1
  );

  // Owner-only button protection

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content:
        "❌ This is not your inventory.",

      ephemeral: true
    });

    return true;
  }

  try {
    const levels = loadLevels();

    const data = levels[ownerId] || {
      wl: 0,
      level: 1,
      xp: 0,
      items: {},
      fishBackpack: []
    };

    if (!data.items) {
      data.items = {};
    }

    if (
      !Array.isArray(data.fishBackpack)
    ) {
      data.fishBackpack = [];
    }

    // ======================================
    // NEXT PAGE
    // ======================================

    if (action === "next") {
      await interaction.deferUpdate();

      const totalSlots = getTotalSlots(
        data
      );

      const maxPage = Math.max(
        1,
        Math.ceil(
          totalSlots / SLOTS_PER_PAGE
        )
      );

      const nextPage = Math.min(
        currentPage + 1,
        maxPage
      );

      await sendInventory(
        interaction,
        interaction.user,
        nextPage,
        true
      );

      return true;
    }

    // ======================================
    // PREVIOUS PAGE
    // ======================================

    if (action === "prev") {
      await interaction.deferUpdate();

      const prevPage = Math.max(
        currentPage - 1,
        1
      );

      await sendInventory(
        interaction,
        interaction.user,
        prevPage,
        true
      );

      return true;
    }

    // ======================================
    // BUY BACKPACK UPGRADE
    // ======================================

    if (action === "buy") {
      const cost = getNextUpgradeCost(
        data
      );

      if ((data.wl || 0) < cost) {
        await interaction.reply({
          content:
            `❌ You need **${cost} World Locks** to upgrade your backpack.\n` +
            `You currently have **${data.wl || 0} WL**.`,

          ephemeral: true
        });

        return true;
      }

      data.wl -= cost;

      data.extraBackpackLevel =
        Number(
          data.extraBackpackLevel || 0
        ) + 1;

      data.extraBackpack = true;

      levels[ownerId] = data;

      saveLevels(levels);

      await interaction.reply({
        content:
          `✅ Backpack upgraded for **${cost} WL**!\n` +
          `You now have **${getTotalSlots(data)} slots**.`,

        ephemeral: true
      });

      return true;
    }

    return false;

  } catch (error) {
    console.error(
      "[INVENTORY BUTTON ERROR]",
      error
    );

    const payload = {
      content:
        "Could not process your inventory action.",

      ephemeral: true
    };

    if (
      interaction.deferred ||
      interaction.replied
    ) {
      await interaction.followUp(
        payload
      ).catch(console.error);

    } else {
      await interaction.reply(
        payload
      ).catch(console.error);
    }

    return true;
  }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  executeInventory,
  executeMyStat,
  handleButton
};
