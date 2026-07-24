const fs = require("fs");
const path = require("path");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  StringSelectMenuBuilder
} = require("discord.js");

const levelsFile = path.join(__dirname, "..", "levels.json");
const fishFolder = path.join(__dirname, "..", "fish");
const imagesFolder = path.join(__dirname, "..", "images");

const salesmanPath = path.join(imagesFolder, "salesman.png");

const activeFishing = new Map();

const WORM_PRICE_WL = 1;
const WORM_AMOUNT_PER_BUY = 25;
const BONUS_WL_CHANCE = 0.20;

const ROD_DATA = {
  fishingRod: {
    name: "Fishing Rod",
    priceWL: 1,
    breakChance: 0.10,
    baitRefundChance: 0,
    xpMultiplier: 1,
    rareMultiplier: 1,
    alphaMultiplier: 1,
    megalodonMultiplier: 1,
    doubleCommonChance: 0,
    treasureChance: 0,
    failedBreakSaveChance: 0
  },

  rainbowRod: {
    name: "Rainbow Rod",
    priceWL: 45,
    breakChance: 0.08,
    baitRefundChance: 0,
    xpMultiplier: 1,
    rareMultiplier: 1.2,
    alphaMultiplier: 1,
    megalodonMultiplier: 1,
    doubleCommonChance: 0.05,
    treasureChance: 0,
    failedBreakSaveChance: 0
  },

  pristineRod: {
    name: "Pristine Rod",
    priceWL: 120,
    breakChance: 0.04,
    baitRefundChance: 0.20,
    xpMultiplier: 1.10,
    rareMultiplier: 1,
    alphaMultiplier: 1,
    megalodonMultiplier: 1,
    doubleCommonChance: 0,
    treasureChance: 0,
    failedBreakSaveChance: 0.15
  },

  goldenRod: {
    name: "Golden Rod",
    priceWL: 5000, // 50 DL
    breakChance: 0,
    baitRefundChance: 0.35,
    xpMultiplier: 1.50,
    rareMultiplier: 1,
    alphaMultiplier: 1.50,
    megalodonMultiplier: 2,
    doubleCommonChance: 0,
    treasureChance: 0.05,
    failedBreakSaveChance: 1
  }
};

const ROD_PRIORITY = [
  "goldenRod",
  "pristineRod",
  "rainbowRod",
  "fishingRod"
];

const FISH_DATA = {
  alpha_shark: {
    name: "Alpha Shark",
    file: "Alpha-Shark.webp",
    rarity: "Legendary",
    sellNeed: 5,
    sellReward: 22
  },
  bass: {
    name: "Bass",
    file: "Bass.webp",
    rarity: "Common",
    sellNeed: 2,
    sellReward: 2
  },
  catfish: {
    name: "Catfish",
    file: "Catfish.webp",
    rarity: "Common",
    sellNeed: 2,
    sellReward: 2
  },
  dogfish: {
    name: "Dogfish",
    file: "Dogfish.webp",
    rarity: "Common",
    sellNeed: 2,
    sellReward: 2
  },
  gar: {
    name: "Gar",
    file: "Gar.webp",
    rarity: "Common",
    sellNeed: 2,
    sellReward: 2
  },
  goldfish: {
    name: "Goldfish",
    file: "Goldfish.webp",
    rarity: "Common",
    sellNeed: 2,
    sellReward: 2
  },
  mahi: {
    name: "Mahi",
    file: "Mahi.webp",
    rarity: "Common",
    sellNeed: 2,
    sellReward: 2
  },
  whale: {
    name: "Whale",
    file: "Whale.webp",
    rarity: "Mythic",
    sellNeed: 3,
    sellReward: 35
  },
    megalodon: {
    name: "Megalodon",
    file: "Megalodon.webp",
    rarity: "Ancient",
    sellNeed: 1,
    sellReward: 100
  }
};

const COMMON_FISH = ["bass", "catfish", "dogfish", "gar", "goldfish", "mahi"];

function getOwnedRod(data) {
  if (!data.items) data.items = {};

  for (const rodKey of ROD_PRIORITY) {
    if (Number(data.items[rodKey] || 0) > 0) {
      return {
        key: rodKey,
        ...ROD_DATA[rodKey]
      };
    }
  }

  return null;
}

function removeRod(data, rodKey) {
  if (!data.items) data.items = {};

  data.items[rodKey] = Math.max(
    0,
    Number(data.items[rodKey] || 0) - 1
  );

  if (data.items[rodKey] <= 0) {
    delete data.items[rodKey];
  }
}

function getFishingXP(fishKey, rod) {
  const baseXP = {
    bass: 5,
    catfish: 5,
    dogfish: 5,
    gar: 5,
    goldfish: 5,
    mahi: 5,
    alpha_shark: 20,
    whale: 30,
    megalodon: 60
  };

  const amount = baseXP[fishKey] || 3;

  return Math.max(
    1,
    Math.round(amount * Number(rod.xpMultiplier || 1))
  );
}

function getTreasureReward(data) {
  const roll = Math.random() * 100;

  if (roll < 40) {
    const reward = Math.floor(Math.random() * 11) + 5;
    data.wl = Number(data.wl || 0) + reward;

    return `💎 **${reward} World Locks**`;
  }

  if (roll < 60) {
    const reward = Math.floor(Math.random() * 2) + 1;
    data.wl = Number(data.wl || 0) + reward * 100;

    return `💠 **${reward} Diamond Lock${reward > 1 ? "s" : ""}**`;
  }

  if (roll < 80) {
    const baitAmount = [25, 50, 75, 100][
      Math.floor(Math.random() * 4)
    ];

    data.items.wigglyWorm =
      Number(data.items.wigglyWorm || 0) + baitAmount;

    return `🪱 **${baitAmount} Special Wiggly Worm Bait**`;
  }

  if (roll < 95) {
    data.items.rareDecoration =
      Number(data.items.rareDecoration || 0) + 1;

    return "🏆 **1 Rare Decoration**";
  }

  data.items.limitedCollectible =
    Number(data.items.limitedCollectible || 0) + 1;

  return "👑 **1 Limited Collectible**";
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

function ensureUser(levels, userId) {
  if (!levels[userId]) levels[userId] = { level: 1, xp: 0, wl: 0 };
  if (!levels[userId].items) levels[userId].items = {};
  if (!Array.isArray(levels[userId].fishBackpack)) levels[userId].fishBackpack = [];
  return levels[userId];
}

function getFishFile(fileName) {
  const direct = path.join(fishFolder, fileName);
  if (fs.existsSync(direct)) return fileName;

  if (!fs.existsSync(fishFolder)) fs.mkdirSync(fishFolder, { recursive: true });

  const files = fs.readdirSync(fishFolder);
  const found = files.find(file => file.toLowerCase() === fileName.toLowerCase());

  return found || fileName;
}

function getTotalSlots(data) {
  const upgradeLevel = Number(data.extraBackpackLevel || 0);
  return 11 + upgradeLevel * 11;
}

function countUsedSlots(data) {
  let slots = 0;

  const totalWl = Number(data.wl || 0);
  const dl = Math.floor(totalWl / 100);
  const wl = totalWl % 100;

  if (dl > 0) slots++;
  if (wl > 0) slots++;

  if ((data.items?.fishingRod || 0) > 0) slots++;
  if ((data.items?.rainbowRod || 0) > 0) slots++;
  if ((data.items?.pristineRod || 0) > 0) slots++;
  if ((data.items?.goldenRod || 0) > 0) slots++;

  if ((data.items?.wigglyWorm || 0) > 0) slots++;
  if ((data.items?.rareDecoration || 0) > 0) slots++;
  if ((data.items?.limitedCollectible || 0) > 0) slots++;

  const fishes = Array.isArray(data.fishBackpack)
    ? data.fishBackpack
    : [];

  slots += fishes.filter(
    fish => Number(fish.amount || 0) > 0
  ).length;

  return slots;
}

function hasSpaceForFish(data, fishFile) {
  const existing = data.fishBackpack.find(fish => fish.file === fishFile && (fish.amount || 0) > 0);
  if (existing) return true;

  return countUsedSlots(data) < getTotalSlots(data);
}

function addFish(data, fishKey) {
  const fish = FISH_DATA[fishKey];
  const realFile = getFishFile(fish.file);

  const existing = data.fishBackpack.find(item => item.file === realFile);

  if (existing) {
    existing.amount = (existing.amount || 1) + 1;
    existing.caughtAt = Date.now();
  } else {
    data.fishBackpack.push({
      key: fishKey,
      name: fish.name,
      file: realFile,
      rarity: fish.rarity,
      amount: 1,
      caughtAt: Date.now()
    });
  }

  return {
    ...fish,
    file: realFile
  };
}

function removeFish(data, fishKey, amount) {
  const fishInfo = FISH_DATA[fishKey];
  if (!fishInfo) return false;

  const targetKey = normalizeFishName(fishKey);
  const targetName = normalizeFishName(fishInfo.name);
  const targetFile = normalizeFishName(fishInfo.file);

  const fishes = Array.isArray(data.fishBackpack) ? data.fishBackpack : [];

  let remaining = amount;

  for (const fish of fishes) {
    const fishKeyNorm = normalizeFishName(fish.key);
    const fishNameNorm = normalizeFishName(fish.name);
    const fishFileNorm = normalizeFishName(fish.file);

    const matches =
      fishKeyNorm === targetKey ||
      fishNameNorm === targetName ||
      fishFileNorm === targetFile;

    if (!matches) continue;

    const currentAmount = Number(fish.amount || 1);
    const take = Math.min(currentAmount, remaining);

    fish.amount = currentAmount - take;
    remaining -= take;

    if (remaining <= 0) break;
  }

  if (remaining > 0) return false;

  data.fishBackpack = fishes.filter(fish => Number(fish.amount || 0) > 0);
  return true;
}

function normalizeFishName(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/\.(webp|png|jpg|jpeg)$/i, "")
    .replace(/[^a-z0-9]/g, "");
}

function getFishAmount(data, fishKey) {
  const fishInfo = FISH_DATA[fishKey];
  if (!fishInfo) return 0;

  const targetKey = normalizeFishName(fishKey);
  const targetName = normalizeFishName(fishInfo.name);
  const targetFile = normalizeFishName(fishInfo.file);

  const fishes = Array.isArray(data.fishBackpack) ? data.fishBackpack : [];

  let total = 0;

  for (const fish of fishes) {
    const fishKeyNorm = normalizeFishName(fish.key);
    const fishNameNorm = normalizeFishName(fish.name);
    const fishFileNorm = normalizeFishName(fish.file);

    if (
      fishKeyNorm === targetKey ||
      fishNameNorm === targetName ||
      fishFileNorm === targetFile
    ) {
      total += Number(fish.amount || 1);
    }
  }

  return total;
}

function pickFish(rod) {
  const rareMultiplier = Number(rod?.rareMultiplier || 1);
  const alphaMultiplier = Number(rod?.alphaMultiplier || 1);
  const megalodonMultiplier = Number(rod?.megalodonMultiplier || 1);

  const weights = [
    {
      key: "alpha_shark",
      weight: 10 * rareMultiplier * alphaMultiplier
    },
    {
      key: "whale",
      weight: 6 * rareMultiplier
    },
    {
      key: "megalodon",
      weight: 1 * rareMultiplier * megalodonMultiplier
    },
    {
      key: "common",
      weight: 80
    },
    {
      key: null,
      weight: 3
    }
  ];

  const totalWeight = weights.reduce(
    (total, item) => total + item.weight,
    0
  );

  let roll = Math.random() * totalWeight;

  for (const item of weights) {
    roll -= item.weight;

    if (roll <= 0) {
      if (item.key === "common") {
        return COMMON_FISH[
          Math.floor(Math.random() * COMMON_FISH.length)
        ];
      }

      return item.key;
    }
  }

  return null;
}

function getReelTime(fishKey, rod) {
  let reelTime;

  if (fishKey === "megalodon") {
    reelTime = Math.floor(Math.random() * 800) + 800;
  } else if (fishKey === "whale") {
    reelTime = Math.floor(Math.random() * 1000) + 1000;
  } else if (fishKey === "alpha_shark") {
    reelTime = Math.floor(Math.random() * 2000) + 1000;
  } else {
    reelTime = 7000;
  }

  if (rod?.key === "rainbowRod") {
    const fasterMultiplier = 0.80 + Math.random() * 0.10;
    reelTime = Math.floor(reelTime * fasterMultiplier);
  }

  return Math.max(700, reelTime);
}

function shopEmbed() {
  return new EmbedBuilder()
    .setTitle("NoobV2 Fishing Shop")
    .setColor("Green")
    .setDescription(
      "## Fishing Rod\n" +
      "Price: **1 WL**\n" +
      "- Rod break chance: **10%**\n\n" +

      "## Rainbow Rod\n" +
      "Price: **45 WL**\n" +
      "- Rod break chance: **8%**\n" +
      "- Rare fish chance multiplied by **1.2x**\n" +
      "- Reel-in time **10–20% faster**\n" +
      "- **5% chance** to catch 2 Common Fish\n\n" +

      "## Pristine Rod\n" +
      "Price: **120 WL**\n" +
      "- Rod break chance: **3–5%**\n" +
      "- **20% chance** bait is not consumed\n" +
      "- **+10% Fishing XP**\n" +
      "- Higher chance to survive rod damage\n\n" +

      "## Golden Rod\n" +
      "Price: **50 DL**\n" +
      "- Never breaks\n" +
      "- **35% bait refund**\n" +
      "- **+50% Fishing XP**\n" +
      "- **2x Megalodon chance**\n" +
      "- **1.5x Alpha Shark chance**\n" +
      "- **5% Treasure Chest chance**\n\n" +

      "## 🪱 Wiggly Worm Bait\n" +
      `Price: **${WORM_PRICE_WL} WL** for **${WORM_AMOUNT_PER_BUY} Worms**`
    );
}

function shopRows(userId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`shop_buy_rod_fishingRod_${userId}`)
        .setLabel("Fishing Rod - 1 WL")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId(`shop_buy_rod_rainbowRod_${userId}`)
        .setLabel("Rainbow Rod - 45 WL")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId(`shop_buy_rod_pristineRod_${userId}`)
        .setLabel("Pristine Rod - 120 WL")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`shop_buy_rod_goldenRod_${userId}`)
        .setLabel("Golden Rod - 50 DL")
        .setStyle(ButtonStyle.Danger)
    ),

    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`shop_buy_worm_${userId}`)
        .setPlaceholder("Buy Wiggly Worm bait")
        .addOptions(
          {
            label: "25 Wiggly Worms",
            value: "1",
            description: "Costs 1 WL"
          },
          {
            label: "50 Wiggly Worms",
            value: "2",
            description: "Costs 2 WL"
          },
          {
            label: "75 Wiggly Worms",
            value: "3",
            description: "Costs 3 WL"
          },
          {
            label: "100 Wiggly Worms",
            value: "4",
            description: "Costs 4 WL"
          },
          {
            label: "250 Wiggly Worms",
            value: "10",
            description: "Costs 10 WL"
          }
        )
    )
  ];
}

function baitMenu(userId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`fish_bait_${userId}`)
      .setPlaceholder("Choose bait to use")
      .addOptions({
        label: "Wiggly Worm",
        value: "wigglyWorm",
        description: "Uses 1 bait per fishing attempt"
      })
  );
}

function salesmanEmbed(data) {
  const lines = Object.entries(FISH_DATA).map(([key, fish]) => {
    const owned = getFishAmount(data, key);
    return `**${fish.sellNeed} ${fish.name}** → **${fish.sellReward} WL** | You have: **${owned}**`;
  });

  const embed = new EmbedBuilder()
    .setTitle("Fish Salesman")
    .setColor("Gold")
    .setDescription(
      "Do you want to exchange your fishes for World Locks?\n\n" +
      lines.join("\n")
    );

  if (fs.existsSync(salesmanPath)) {
    embed.setThumbnail("attachment://salesman.png");
  }

  return embed;
}

function salesmanRows(userId) {
  const buttons = Object.entries(FISH_DATA).map(([key, fish]) =>
    new ButtonBuilder()
      .setCustomId(`salesman_sell_${key}_${userId}`)
      .setLabel(`Sell ${fish.name}`)
      .setStyle(ButtonStyle.Success)
  );

  const rows = [];

  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(
      new ActionRowBuilder().addComponents(
        buttons.slice(i, i + 5)
      )
    );
  }

  return rows;
}

async function handleCommand(interaction) {
  if (!interaction.isChatInputCommand()) return false;

  if (interaction.commandName === "shop") {
    await interaction.reply({
      embeds: [shopEmbed()],
      components: shopRows(interaction.user.id)
    });

    return true;
  }

  if (interaction.commandName === "salesman") {
    const levels = loadLevels();
    const userData = ensureUser(levels, interaction.user.id);

    const files = fs.existsSync(salesmanPath)
      ? [new AttachmentBuilder(salesmanPath, { name: "salesman.png" })]
      : [];

    await interaction.reply({
      embeds: [salesmanEmbed(userData)],
      components: salesmanRows(interaction.user.id),
      files
    });

    return true;
  }

  if (interaction.commandName === "fish") {
    const levels = loadLevels();
    const userData = ensureUser(levels, interaction.user.id);

const equippedRod = getOwnedRod(userData);

if (!equippedRod) {
  await interaction.reply({
    content: "❌ You need a fishing rod first. Buy one from `/shop`.",
    ephemeral: true
  });

  return true;
}

    if ((userData.items.wigglyWorm || 0) <= 0) {
      await interaction.reply({
        content: "❌ You need **Wiggly Worm bait** to fish. Buy bait from `/shop`.",
        ephemeral: true
      });
      return true;
    }

    if (activeFishing.has(interaction.user.id)) {
      await interaction.reply({
        content: "❌ You are already fishing.",
        ephemeral: true
      });
      return true;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Choose Your Bait")
          .setColor("Blue")
          .setDescription(
            `You have **${userData.items.wigglyWorm || 0} Wiggly Worms**.\n\n` +
            "Choose which bait you want to use for fishing."
          )
      ],
      components: [baitMenu(interaction.user.id)]
    });

    return true;
  }

  return false;
}

async function handleSelect(interaction) {
  if (!interaction.isStringSelectMenu()) return false;

  if (interaction.customId.startsWith("shop_buy_worm_")) {
    const ownerId = interaction.customId.replace("shop_buy_worm_", "");

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content: "❌ This shop menu is not for you.",
        ephemeral: true
      });
      return true;
    }

    const packs = Number(interaction.values[0]);
    const cost = packs * WORM_PRICE_WL;
    const worms = packs * WORM_AMOUNT_PER_BUY;

    const levels = loadLevels();
    const userData = ensureUser(levels, ownerId);

    if ((userData.wl || 0) < cost) {
      await interaction.reply({
        content: `❌ You need **${cost} WL** to buy **${worms} Wiggly Worms**.\nYou currently have **${userData.wl || 0} WL**.`,
        ephemeral: true
      });
      return true;
    }

    userData.wl -= cost;
    userData.items.wigglyWorm = (userData.items.wigglyWorm || 0) + worms;

    levels[ownerId] = userData;
    saveLevels(levels);

    await interaction.reply({
      content: `✅ You bought **${worms} Wiggly Worms** for **${cost} WL**.`,
      ephemeral: true
    });

    return true;
  }

  if (interaction.customId.startsWith("fish_bait_")) {
    const ownerId = interaction.customId.replace("fish_bait_", "");

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content: "❌ This fishing menu is not yours.",
        ephemeral: true
      });
      return true;
    }

    const bait = interaction.values[0];

    const levels = loadLevels();
    const userData = ensureUser(levels, ownerId);

    if (bait !== "wigglyWorm") {
      await interaction.reply({
        content: "❌ Invalid bait.",
        ephemeral: true
      });
      return true;
    }

const equippedRod = getOwnedRod(userData);

if (!equippedRod) {
  await interaction.reply({
    content: "❌ Your fishing rod is missing.",
    ephemeral: true
  });

  return true;
}

    if ((userData.items.wigglyWorm || 0) <= 0) {
      await interaction.reply({
        content: "❌ You have no **Wiggly Worm bait** left.",
        ephemeral: true
      });
      return true;
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`fish_cast_${ownerId}_${bait}`)
        .setLabel("Cast Line")
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("Fishing")
          .setColor("Blue")
.setDescription(
  `You equipped your **${equippedRod.name}** and **Wiggly Worm** bait.\n\n` +
  "Click **Cast Line** to start fishing."
)      ],
      components: [row]
    });

    return true;
  }

  return false;
}

async function handleButton(interaction) {
  if (!interaction.isButton()) return false;

if (interaction.customId.startsWith("shop_buy_rod_")) {
  const raw = interaction.customId.replace("shop_buy_rod_", "");
  const lastUnderscore = raw.lastIndexOf("_");

  const rodKey = raw.slice(0, lastUnderscore);
  const ownerId = raw.slice(lastUnderscore + 1);

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: "❌ This shop button is not for you.",
      ephemeral: true
    });

    return true;
  }

  const rod = ROD_DATA[rodKey];

  if (!rod) {
    await interaction.reply({
      content: "❌ Invalid fishing rod.",
      ephemeral: true
    });

    return true;
  }

  const levels = loadLevels();
  const userData = ensureUser(levels, ownerId);

  if (Number(userData.wl || 0) < rod.priceWL) {
    const displayedPrice =
      rodKey === "goldenRod"
        ? "50 DL"
        : `${rod.priceWL} WL`;

    await interaction.reply({
      content:
        `❌ You need **${displayedPrice}** to buy a **${rod.name}**.\n` +
        `You currently have **${Math.floor(Number(userData.wl || 0) / 100)} DL ` +
        `${Number(userData.wl || 0) % 100} WL**.`,
      ephemeral: true
    });

    return true;
  }

  userData.wl -= rod.priceWL;
  userData.items[rodKey] =
    Number(userData.items[rodKey] || 0) + 1;

  levels[ownerId] = userData;
  saveLevels(levels);

  const displayedPrice =
    rodKey === "goldenRod"
      ? "50 DL"
      : `${rod.priceWL} WL`;

  await interaction.reply({
    content:
      `✅ You bought **1 ${rod.name}** for **${displayedPrice}**.`,
    ephemeral: true
  });

  return true;
}

  if (interaction.customId.startsWith("salesman_sell_")) {
const raw = interaction.customId.replace("salesman_sell_", "");
const lastUnderscore = raw.lastIndexOf("_");
const fishKey = raw.slice(0, lastUnderscore);
const ownerId = raw.slice(lastUnderscore + 1);
    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content: "❌ This salesman menu is not for you.",
        ephemeral: true
      });
      return true;
    }

    const fish = FISH_DATA[fishKey];

    if (!fish) {
      await interaction.reply({
        content: "❌ Invalid fish.",
        ephemeral: true
      });
      return true;
    }

    const levels = loadLevels();
    const userData = ensureUser(levels, ownerId);

    const owned = getFishAmount(userData, fishKey);

    if (owned < fish.sellNeed) {
      await interaction.reply({
        content: `❌ You need **${fish.sellNeed} ${fish.name}** to exchange.\nYou currently have **${owned}**.`,
        ephemeral: true
      });
      return true;
    }

    removeFish(userData, fishKey, fish.sellNeed);
    userData.wl = (userData.wl || 0) + fish.sellReward;

    levels[ownerId] = userData;
    saveLevels(levels);

    await interaction.reply({
      content: `✅ You exchanged **${fish.sellNeed} ${fish.name}** for **${fish.sellReward} WL**.`,
      ephemeral: true
    });

    return true;
  }

  if (interaction.customId.startsWith("fish_cast_")) {
    const parts = interaction.customId.split("_");
    const ownerId = parts[2];
    const bait = parts[3];

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content: "❌ This fishing session is not yours.",
        ephemeral: true
      });
      return true;
    }

    const levels = loadLevels();
    const userData = ensureUser(levels, ownerId);

const equippedRod = getOwnedRod(userData);

if (!equippedRod) {
  await interaction.reply({
    content: "❌ You do not have a fishing rod anymore.",
    ephemeral: true
  });

  return true;
}

if (
  bait !== "wigglyWorm" ||
  Number(userData.items.wigglyWorm || 0) <= 0
) {
  await interaction.reply({
    content: "❌ You do not have enough **Wiggly Worm bait**.",
    ephemeral: true
  });

  return true;
}

if (activeFishing.has(ownerId)) {
  await interaction.reply({
    content: "❌ You are already fishing.",
    ephemeral: true
  });

  return true;
}

let baitRefunded = false;

if (Math.random() < equippedRod.baitRefundChance) {
  baitRefunded = true;
} else {
  userData.items.wigglyWorm -= 1;
}

levels[ownerId] = userData;
saveLevels(levels);

const pendingFish = pickFish(equippedRod);
const reelTime = pendingFish
  ? getReelTime(pendingFish, equippedRod)
  : getReelTime(null, equippedRod);

const sessionId = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
activeFishing.set(ownerId, {
  sessionId,
  bait,
  pendingFish,
  reelTime,
  rodKey: equippedRod.key,
  rodName: equippedRod.name,
  baitRefunded,
  startedAt: Date.now()
});

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("Fishing")
          .setColor("Blue")
          .setDescription(
`You cast your **${equippedRod.name}** into the water.\n` +
(
  baitRefunded
    ? "Your bait was **not consumed**!\n\n"
    : "You used **1 Wiggly Worm**.\n\n"
) +
"Waiting for a fish to bite..."
          )
      ],
      components: []
    });

    const waitTime = Math.floor(Math.random() * 4000) + 3000;

setTimeout(async () => {
  const currentSession = activeFishing.get(ownerId);

  if (currentSession?.sessionId !== sessionId) return;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`fish_reel_${ownerId}_${sessionId}`)
      .setLabel("Reel In!")
      .setStyle(ButtonStyle.Success)
  );

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle("A Fish Is Biting!")
        .setColor("Yellow")
        .setDescription(
          "Quick! Click **Reel In!** before it escapes!"
        )
    ],
    components: [row]
  }).catch(() => {});

  setTimeout(async () => {
    const latestSession = activeFishing.get(ownerId);

    if (latestSession?.sessionId !== sessionId) return;

    activeFishing.delete(ownerId);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("The Fish Escaped")
          .setColor("Red")
          .setDescription(
            "You waited too long and the fish escaped."
          )
      ],
      components: []
    }).catch(() => {});
  }, reelTime);
}, waitTime);

    return true;
  }

if (interaction.customId.startsWith("fish_reel_")) {
  const raw = interaction.customId.replace("fish_reel_", "");
  const firstUnderscore = raw.indexOf("_");

  const ownerId = raw.slice(0, firstUnderscore);
  const sessionId = raw.slice(firstUnderscore + 1);

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: "❌ This fishing session is not yours.",
      ephemeral: true
    });

    return true;
  }

const session = activeFishing.get(ownerId);

if (!session || session.sessionId !== sessionId) {
  await interaction.reply({
    content: "❌ This fish already escaped.",
    ephemeral: true
  });

  return true;
}

activeFishing.delete(ownerId);

  const levels = loadLevels();
  const userData = ensureUser(levels, ownerId);

  const rodKey = session?.rodKey || "fishingRod";
  const rod = {
    key: rodKey,
    ...(ROD_DATA[rodKey] || ROD_DATA.fishingRod)
  };

  const pickedKey = session?.pendingFish || null;

  let rodBroke = false;

  if (rod.breakChance > 0 && Math.random() < rod.breakChance) {
    const savedFromBreaking =
      Math.random() < Number(rod.failedBreakSaveChance || 0);

    if (!savedFromBreaking) {
      rodBroke = true;
      removeRod(userData, rodKey);
    }
  }

  if (rodBroke) {
    levels[ownerId] = userData;
    saveLevels(levels);

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("Fishing Rod Broke!")
          .setColor("Red")
          .setDescription(
            `Your **${rod.name}** snapped while fishing!\n\n` +
            "The broken rod has been removed from your backpack."
          )
      ],
      components: []
    });

    return true;
  }

  if (!pickedKey) {
    levels[ownerId] = userData;
    saveLevels(levels);

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("Nothing Caught")
          .setColor("Grey")
          .setDescription(
            `You reeled in your **${rod.name}**, but nothing was there.`
          )
      ],
      components: []
    });

    return true;
  }

  if (
    rod.treasureChance > 0 &&
    Math.random() < rod.treasureChance
  ) {
    const treasureReward = getTreasureReward(userData);

    const treasureXP = Math.round(25 * rod.xpMultiplier);
    userData.xp = Number(userData.xp || 0) + treasureXP;

    levels[ownerId] = userData;
    saveLevels(levels);

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("Treasure Chest Caught!")
          .setColor("Gold")
          .setDescription(
            "Your **Golden Rod** pulled up a Treasure Chest!\n\n" +
            `You received: ${treasureReward}\n` +
            `Fishing XP: **+${treasureXP} XP**`
          )
      ],
      components: []
    });

    return true;
  }

  const fishInfo = FISH_DATA[pickedKey];
  const fishFile = getFishFile(fishInfo.file);

  let catchAmount = 1;

  if (
    COMMON_FISH.includes(pickedKey) &&
    Math.random() < Number(rod.doubleCommonChance || 0)
  ) {
    catchAmount = 2;
  }

  if (!hasSpaceForFish(userData, fishFile)) {
    levels[ownerId] = userData;
    saveLevels(levels);

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("Backpack Full")
          .setColor("Red")
          .setDescription(
            `You caught a **${fishInfo.name}**, but your backpack is full!\n\n` +
            "Buy extra backpack slots from `/inventory`."
          )
      ],
      components: []
    });

    return true;
  }

  let caughtFish;

  for (let i = 0; i < catchAmount; i++) {
    caughtFish = addFish(userData, pickedKey);
  }

  const gainedXP = getFishingXP(pickedKey, rod);
  userData.xp = Number(userData.xp || 0) + gainedXP;

  let rewardText = "";

  if (Math.random() < BONUS_WL_CHANCE) {
    userData.wl = Number(userData.wl || 0) + 1;
    rewardText += "\nYou also found **1 World Lock**!";
  }

  if (catchAmount === 2) {
    rewardText +=
      "\n🌈 Your Rainbow Rod caught **2 Common Fish instead of 1**!";
  }

  levels[ownerId] = userData;
  saveLevels(levels);

  const fishPath = path.join(fishFolder, caughtFish.file);

  const attachment = fs.existsSync(fishPath)
    ? new AttachmentBuilder(fishPath, {
        name: caughtFish.file
      })
    : null;

  const embed = new EmbedBuilder()
    .setTitle("Fish Caught!")
    .setColor("Green")
    .setDescription(
      `You caught **${catchAmount}x ${caughtFish.rarity} ${caughtFish.name}**!\n` +
      `Rod used: **${rod.name}**\n` +
      `Fishing XP: **+${gainedXP} XP**\n` +
      "The fish has been added to your backpack." +
      rewardText
    );

  if (attachment) {
    embed.setThumbnail(`attachment://${caughtFish.file}`);
  }

  await interaction.update({
    embeds: [embed],
    files: attachment ? [attachment] : [],
    components: []
  });

  return true;
}
  return false;
}

module.exports = {
  handleCommand,
  handleButton,
  handleSelect
};
