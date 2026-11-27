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
// INVENTORY SETTINGS
// ==========================================

const BASE_EXTRA_SLOT_COST = 100;
const SLOTS_PER_PAGE = 11;
const SLOTS_PER_UPGRADE = 11;

try {
  if (fs.existsSync(fontPath)) {
    GlobalFonts.registerFromPath(
      fontPath,
      "Grobold"
    );
  }
} catch (error) {
  console.log(
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

  return BASE_EXTRA_SLOT_COST +
    upgradeLevel * 100;
}

function drawAmount(ctx, amount, x, y) {
  ctx.font = '30px "Grobold", Arial';
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#5f5f5f";

  ctx.strokeText(String(amount), x, y);
  ctx.fillText(String(amount), x, y);
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
// INVENTORY BUTTONS
// ==========================================

function buildButtons(userId, page, data) {
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

  const totalWl = data.wl || 0;
  const dl = Math.floor(totalWl / 100);
  const wl = totalWl % 100;

  // DIAMOND LOCKS

  if (dl > 0) {
    items.push({
      type: "image",
      imagePath: dlPath,
      amount: dl
    });
  }

  // WORLD LOCKS

  if (wl > 0) {
    items.push({
      type: "image",
      imagePath: wlPath,
      amount: wl
    });
  }

  // FISHING ROD

  if ((data.items?.fishingRod || 0) > 0) {
    items.push({
      type: "image",
      imagePath: fishingRodPath,
      amount: data.items.fishingRod
    });
  }

  // WIGGLY WORM

  if ((data.items?.wigglyWorm || 0) > 0) {
    items.push({
      type: "image",
      imagePath: wigglyWormPath,
      amount: data.items.wigglyWorm
    });
  }

  // COOKING INGREDIENTS

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

  // FISHING BACKPACK

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
// GENERATED INVENTORY SLOT
// ==========================================

function drawInventorySlot(ctx, x, y, size) {
  // Dark outer border

  ctx.fillStyle = "#092f3e";
  ctx.fillRect(x, y, size, size);

  // Bright cyan border

  ctx.fillStyle = "#91d9ec";
  ctx.fillRect(
    x + 3,
    y + 3,
    size - 6,
    size - 6
  );

  // Inner bevel

  ctx.fillStyle = "#397e94";
  ctx.fillRect(
    x + 7,
    y + 7,
    size - 14,
    size - 14
  );

  // Empty slot background

  ctx.fillStyle = "#23596e";
  ctx.fillRect(
    x + 11,
    y + 11,
    size - 22,
    size - 22
  );

  // Top shadow

  ctx.fillStyle = "#153e50";
  ctx.fillRect(
    x + 11,
    y + 11,
    size - 22,
    6
  );

  // Left shadow

  ctx.fillRect(
    x + 11,
    y + 11,
    6,
    size - 22
  );

  // Bottom highlight

  ctx.fillStyle = "#38768a";
  ctx.fillRect(
    x + 11,
    y + size - 17,
    size - 22,
    6
  );

  // Right highlight

  ctx.fillRect(
    x + size - 17,
    y + 11,
    6,
    size - 22
  );
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

  // USERNAME

  ctx.font = '58px "Grobold", Arial';
  ctx.fillStyle = "#ffffff";

  ctx.fillText(
    `@${username} INV`,
    30,
    70
  );

  // BACKPACK SLOTS

  ctx.font = '40px "Grobold", Arial';

  ctx.fillText(
    `BP SLOTS: ${totalSlots}`,
    37,
    124
  );

  // PAGE

  ctx.font = '28px "Grobold", Arial';

  ctx.fillText(
    `PAGE ${page}/${maxPage}`,
    650,
    124
  );

  // INVENTORY BACKGROUND

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

  const row1Y = 230;
  const row2Y = 350;

  const slots = [];

  // FIRST ROW

  for (let i = 0; i < 6; i++) {
    slots.push({
      x: startX + i * (slotSize + gap),
      y: row1Y
    });
  }

  // SECOND ROW

  for (let i = 0; i < 5; i++) {
    slots.push({
      x: startX + i * (slotSize + gap),
      y: row2Y
    });
  }

  // DRAW SLOTS

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

  // DRAW ITEMS

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
// PIXEL ART DRAWING HELPER
// ==========================================

function drawPixelArt(
  ctx,
  sprite,
  palette,
  x,
  y,
  scale = 5
) {
  ctx.imageSmoothingEnabled = false;

  for (
    let row = 0;
    row < sprite.length;
    row++
  ) {
    for (
      let col = 0;
      col < sprite[row].length;
      col++
    ) {
      const pixel = sprite[row][col];

      if (
        pixel === "." ||
        !palette[pixel]
      ) {
        continue;
      }

      ctx.fillStyle = palette[pixel];

      ctx.fillRect(
        x + col * scale,
        y + row * scale,
        scale,
        scale
      );
    }
  }
}

// ==========================================
// GENERATED GROWTOPIA STYLE CHARACTER
// ==========================================

function drawGrowtopiaCharacter(
  ctx,
  centerX,
  bottomY,
  scale = 6
) {
  const palette = {
    X: "#38261d",
    H: "#693e23",
    L: "#a66a36",
    D: "#482d20",

    S: "#f0ad70",
    A: "#ffd59c",
    T: "#cb8050",

    W: "#ffffff",
    E: "#252525",

    G: "#79b448",
    F: "#a2d568",
    R: "#477d2d",

    B: "#496b9d",
    C: "#304a78",

    K: "#302b2b",
    J: "#60514a"
  };

  const sprite = [
    ".......XXXXXX.......",
    ".....XXHHHHHHXX.....",
    "....XHLLLLHHHHHX....",
    "...XHLLLHHHHDDDDX...",
    "...XHHHHHHHDDDDDX...",
    "...XHHHXXXXXXXDDX...",
    "...XHHXAAAAAAAXHX...",
    "...XHXAAAAAAAASXX...",
    "...XXAAWWAAWWASXX...",
    "...XAAAWEAAWEAASX...",
    "...XAAAAAAAAAAASX...",
    "...XAAAATTTAAAASX...",
    "....XAAATXXTAASX....",
    ".....XSSSSSSSXX.....",
    "......XXXXXXX.......",
    ".......XASX.........",
    ".....XXGGGGXX.......",
    "....XFFGGGGGRX......",
    "...XASXGGGGRXASX....",
    "...XSSXGGGGRXSSX....",
    "...XSSXGGGGRXSSX....",
    "....XXGGGGGRXX......",
    ".....XGGGGRX........",
    ".....XBBBBBX........",
    ".....XBBCBBX........",
    ".....XBCXCBX........",
    ".....XBC.XBX........",
    "....XKKX.XKKX.......",
    "...XJJJX.XJJJX......",
    "...XXXXX.XXXXX......"
  ];

  const width = Math.max(
    ...sprite.map(row => row.length)
  ) * scale;

  const height = sprite.length * scale;

  drawPixelArt(
    ctx,
    sprite,
    palette,
    Math.round(centerX - width / 2),
    Math.round(bottomY - height),
    scale
  );
}

// ==========================================
// GENERATED GRASS BLOCK
// ==========================================

function drawGrassBlock(ctx, x, y, size) {
  const scale = size / 16;

  const palette = {
    X: "#39291b",

    G: "#488d25",
    L: "#80ca40",
    H: "#a5e45a",
    D: "#326b1e",

    B: "#855126",
    C: "#a56c35",
    E: "#69411f",
    F: "#bd8248",
    R: "#50331c"
  };

  const sprite = [
    "XXXXXXXXXXXXXXXX",
    "XHHHLHHHLLHHHHLX",
    "XLLLLGLLGLLLLGLX",
    "XGGGGGGGGGGGGGGX",
    "XDDGDDGGDDGDDDGX",
    "XBBDBBDDBBDBBDBX",
    "XBCCBBFCCBBCCBBX",
    "XCBBEBBBCBBEBBCX",
    "XBBBBCCBBBBCCBBX",
    "XBEFBBBBEBBBBBBX",
    "XBBBBEBCBBBFBBBX",
    "XBCCBBBBBBCBBEBX",
    "XBBBBRBBEBBBBBBX",
    "XEBBBBBBBBBBCCBX",
    "XRRERERRERERRERX",
    "XXXXXXXXXXXXXXXX"
  ];

  drawPixelArt(
    ctx,
    sprite,
    palette,
    x,
    y,
    scale
  );
}

// ==========================================
// GENERATED GROWTOPIA BACKPACK PANEL
// ==========================================

function drawMyStatBackpack(ctx, canvasWidth) {
  const columns = 6;
  const rows = 4;

  const slotSize = 126;
  const gap = 6;

  const gridWidth =
    columns * slotSize +
    (columns - 1) * gap;

  const gridHeight =
    rows * slotSize +
    (rows - 1) * gap;

  const padding = 15;

  const panelWidth =
    gridWidth + padding * 2;

  const panelHeight =
    gridHeight + padding * 2;

  const panelX = Math.round(
    (canvasWidth - panelWidth) / 2
  );

  const panelY = 325;

  // OUTER BORDER

  ctx.fillStyle = "#0a2834";

  ctx.fillRect(
    panelX - 4,
    panelY - 4,
    panelWidth + 8,
    panelHeight + 8
  );

  // CYAN FRAME

  ctx.fillStyle = "#a0dce9";

  ctx.fillRect(
    panelX,
    panelY,
    panelWidth,
    panelHeight
  );

  // DARK INNER FRAME

  ctx.fillStyle = "#377b90";

  ctx.fillRect(
    panelX + 5,
    panelY + 5,
    panelWidth - 10,
    panelHeight - 10
  );

  // BACKPACK BACKGROUND

  ctx.fillStyle = "#153f50";

  ctx.fillRect(
    panelX + 10,
    panelY + 10,
    panelWidth - 20,
    panelHeight - 20
  );

  // DRAW ALL 24 EMPTY SLOTS

  for (let row = 0; row < rows; row++) {
    for (
      let col = 0;
      col < columns;
      col++
    ) {
      const x =
        panelX +
        padding +
        col * (slotSize + gap);

      const y =
        panelY +
        padding +
        row * (slotSize + gap);

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
// /MYSTAT CANVAS
// NO EXTERNAL IMAGE REQUIRED
// ==========================================

async function createMyStatCard() {
  const canvas = createCanvas(
    900,
    900
  );

  const ctx = canvas.getContext("2d");

  ctx.imageSmoothingEnabled = false;

  // BLACK BACKGROUND

  ctx.fillStyle = "#000000";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const centerX = canvas.width / 2;

  // CHARACTER PLATFORM

  const blockSize = 96;
  const blockY = 205;

  drawGrassBlock(
    ctx,
    centerX - blockSize / 2,
    blockY,
    blockSize
  );

  // GROWTOPIA STYLE CHARACTER

  drawGrowtopiaCharacter(
    ctx,
    centerX,
    blockY,
    6
  );

  // EMPTY BACKPACK

  drawMyStatBackpack(
    ctx,
    canvas.width
  );

  return canvas.encode("png");
}

// ==========================================
// /MYSTAT COMMAND
// ==========================================

async function executeMyStat(interaction) {
  await interaction.deferReply();

  try {
    // Generate everything using Canvas.
    // No mystat.png template required.

    const image = await createMyStatCard();

    const attachment = new AttachmentBuilder(
      image,
      {
        name: "mystat.png"
      }
    );

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

    // NEXT PAGE

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

    // PREVIOUS PAGE

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

    // UPGRADE BACKPACK

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
