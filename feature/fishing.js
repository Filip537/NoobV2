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

const RODS = {
  fishingRod: {
    name: "Fishing Rod",
    priceWL: 1,
    breakChance: 0.10,
    baitSaveChance: 0,
    failedCatchSaveChance: 0,
    xpMultiplier: 1,
    rareMultiplier: 1,
    megalodonMultiplier: 1,
    alphaMultiplier: 1,
    reelMinMultiplier: 1,
    reelMaxMultiplier: 1,
    doubleCommonChance: 0,
    treasureChance: 0,
    image: "rod.webp"
  },

  rainbowRod: {
    name: "Rainbow Rod",
    priceWL: 45,
    breakChance: 0.08,
    baitSaveChance: 0,
    failedCatchSaveChance: 0,
    xpMultiplier: 1,
    rareMultiplier: 1.2,
    megalodonMultiplier: 1.2,
    alphaMultiplier: 1.2,
    reelMinMultiplier: 0.80,
    reelMaxMultiplier: 0.90,
    doubleCommonChance: 0.05,
    treasureChance: 0,
    image: "rainbowrod.webp"
  },

  pristineRod: {
    name: "Pristine Rod",
    priceWL: 120,
    breakChance: 0.04,
    baitSaveChance: 0.20,
    failedCatchSaveChance: 0.50,
    xpMultiplier: 1.10,
    rareMultiplier: 1,
    megalodonMultiplier: 1,
    alphaMultiplier: 1,
    reelMinMultiplier: 1,
    reelMaxMultiplier: 1,
    doubleCommonChance: 0,
    treasureChance: 0,
    image: "pristinerod.webp"
  },

  goldenRod: {
    name: "Golden Rod",
    priceWL: 1000,
    breakChance: 0,
    baitSaveChance: 0.35,
    failedCatchSaveChance: 1,
    xpMultiplier: 1.50,
    rareMultiplier: 1,
    megalodonMultiplier: 2,
    alphaMultiplier: 1.5,
    reelMinMultiplier: 1,
    reelMaxMultiplier: 1,
    doubleCommonChance: 0,
    treasureChance: 0.05,
    image: "goldenrod.webp"
  }
};

const FISH_DATA = {
  megalodon: {
    name: "Megalodon",
    file: "megal.webp",
    folder: "images",
    rarity: "Ancient",
    baseWeight: 1,
    xp: 100,
    sellNeed: 1,
    sellReward: 100
  },

  alpha_shark: {
    name: "Alpha Shark",
    file: "Alpha-Shark.webp",
    folder: "fish",
    rarity: "Legendary",
    baseWeight: 10,
    xp: 30,
    sellNeed: 5,
    sellReward: 22
  },

  whale: {
    name: "Whale",
    file: "Whale.webp",
    folder: "fish",
    rarity: "Mythic",
    baseWeight: 6,
    xp: 45,
    sellNeed: 3,
    sellReward: 35
  },

  bass: {
    name: "Bass",
    file: "Bass.webp",
    folder: "fish",
    rarity: "Common",
    baseWeight: 13.83,
    xp: 5,
    sellNeed: 2,
    sellReward: 2
  },

  catfish: {
    name: "Catfish",
    file: "Catfish.webp",
    folder: "fish",
    rarity: "Common",
    baseWeight: 13.83,
    xp: 5,
    sellNeed: 2,
    sellReward: 2
  },

  dogfish: {
    name: "Dogfish",
    file: "Dogfish.webp",
    folder: "fish",
    rarity: "Common",
    baseWeight: 13.83,
    xp: 5,
    sellNeed: 2,
    sellReward: 2
  },

  gar: {
    name: "Gar",
    file: "Gar.webp",
    folder: "fish",
    rarity: "Common",
    baseWeight: 13.83,
    xp: 5,
    sellNeed: 2,
    sellReward: 2
  },

  goldfish: {
    name: "Goldfish",
    file: "Goldfish.webp",
    folder: "fish",
    rarity: "Common",
    baseWeight: 13.83,
    xp: 5,
    sellNeed: 2,
    sellReward: 2
  },

  mahi: {
    name: "Mahi",
    file: "Mahi.webp",
    folder: "fish",
    rarity: "Common",
    baseWeight: 13.85,
    xp: 5,
    sellNeed: 2,
    sellReward: 2
  }
};

const COMMON_FISH = [
  "bass",
  "catfish",
  "dogfish",
  "gar",
  "goldfish",
  "mahi"
];

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

function saveLevels(data) {
  fs.writeFileSync(
    levelsFile,
    JSON.stringify(data, null, 2)
  );
}

function ensureUser(levels, userId) {
  if (!levels[userId]) {
    levels[userId] = {
      level: 1,
      xp: 0,
      wl: 0
    };
  }

  if (!levels[userId].items) {
    levels[userId].items = {};
  }

  if (!Array.isArray(levels[userId].fishBackpack)) {
    levels[userId].fishBackpack = [];
  }

  return levels[userId];
}

function getOwnedRods(data) {
  return Object.keys(RODS).filter(
    rodKey => Number(data.items?.[rodKey] || 0) > 0
  );
}

function getRod(data, rodKey) {
  if (!RODS[rodKey]) return null;

  if (Number(data.items?.[rodKey] || 0) <= 0) {
    return null;
  }

  return RODS[rodKey];
}

function getFishPath(fish) {
  const folder =
    fish.folder === "images"
      ? imagesFolder
      : fishFolder;

  return path.join(folder, fish.file);
}

function getTotalSlots(data) {
  return 11 + Number(data.extraBackpackLevel || 0) * 11;
}

function countUsedSlots(data) {
  let slots = 0;

  const totalWL = Number(data.wl || 0);
  const diamondLocks = Math.floor(totalWL / 100);
  const worldLocks = totalWL % 100;

  if (diamondLocks > 0) slots++;
  if (worldLocks > 0) slots++;

  for (const rodKey of Object.keys(RODS)) {
    if (Number(data.items?.[rodKey] || 0) > 0) {
      slots++;
    }
  }

  if (Number(data.items?.wigglyWorm || 0) > 0) {
    slots++;
  }

  const fishes = Array.isArray(data.fishBackpack)
    ? data.fishBackpack
    : [];

  slots += fishes.filter(
    fish => Number(fish.amount || 0) > 0
  ).length;

  return slots;
}

function hasSpaceForFish(data, fishKey) {
  const existing = data.fishBackpack.find(
    fish =>
      fish.key === fishKey &&
      Number(fish.amount || 0) > 0
  );

  if (existing) return true;

  return countUsedSlots(data) < getTotalSlots(data);
}

function addFish(data, fishKey, amount = 1) {
  const fish = FISH_DATA[fishKey];

  const existing = data.fishBackpack.find(
    item =>
      item.key === fishKey ||
      item.file === fish.file
  );

  if (existing) {
    existing.amount =
      Number(existing.amount || 1) + amount;

    existing.caughtAt = Date.now();
  } else {
    data.fishBackpack.push({
      key: fishKey,
      name: fish.name,
      file: fish.file,
      folder: fish.folder,
      rarity: fish.rarity,
      amount,
      caughtAt: Date.now()
    });
  }

  return fish;
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

  const targets = [
    fishKey,
    fishInfo.name,
    fishInfo.file
  ].map(normalizeFishName);

  return (data.fishBackpack || []).reduce(
    (total, fish) => {
      const values = [
        fish.key,
        fish.name,
        fish.file
      ].map(normalizeFishName);

      const matches = values.some(
        value => targets.includes(value)
      );

      return matches
        ? total + Number(fish.amount || 1)
        : total;
    },
    0
  );
}

function removeFish(data, fishKey, amount) {
  const fishInfo = FISH_DATA[fishKey];

  if (!fishInfo) return false;

  const targets = [
    fishKey,
    fishInfo.name,
    fishInfo.file
  ].map(normalizeFishName);

  let remaining = amount;

  for (const fish of data.fishBackpack || []) {
    const values = [
      fish.key,
      fish.name,
      fish.file
    ].map(normalizeFishName);

    const matches = values.some(
      value => targets.includes(value)
    );

    if (!matches) continue;

    const currentAmount = Number(fish.amount || 1);
    const removedAmount = Math.min(
      currentAmount,
      remaining
    );

    fish.amount = currentAmount - removedAmount;
    remaining -= removedAmount;

    if (remaining <= 0) break;
  }

  if (remaining > 0) return false;

  data.fishBackpack = data.fishBackpack.filter(
    fish => Number(fish.amount || 0) > 0
  );

  return true;
}

function pickFish(rod) {
  const fishWeights = Object.entries(FISH_DATA).map(
    ([fishKey, fish]) => {
      let weight = fish.baseWeight;

      if (fishKey === "megalodon") {
        weight *= rod.megalodonMultiplier || 1;
      } else if (fishKey === "alpha_shark") {
        weight *= rod.alphaMultiplier || 1;
      } else if (fish.rarity !== "Common") {
        weight *= rod.rareMultiplier || 1;
      }

      return [fishKey, weight];
    }
  );

  const totalWeight = fishWeights.reduce(
    (total, [, weight]) => total + weight,
    0
  );

  let randomRoll = Math.random() * totalWeight;

  for (const [fishKey, weight] of fishWeights) {
    randomRoll -= weight;

    if (randomRoll <= 0) {
      return fishKey;
    }
  }

  return null;
}

function getReelTime(fishKey, rod) {
  let minimumTime;
  let maximumTime;

  if (fishKey === "megalodon") {
    minimumTime = 800;
    maximumTime = 1600;
  } else if (fishKey === "whale") {
    minimumTime = 1000;
    maximumTime = 2000;
  } else if (fishKey === "alpha_shark") {
    minimumTime = 1000;
    maximumTime = 3000;
  } else {
    minimumTime = 5000;
    maximumTime = 7000;
  }

  const reelMultiplier =
    rod.reelMinMultiplier +
    Math.random() *
      (rod.reelMaxMultiplier - rod.reelMinMultiplier);

  const baseTime =
    minimumTime +
    Math.random() * (maximumTime - minimumTime);

  return Math.max(
    700,
    Math.floor(baseTime * reelMultiplier)
  );
}

function shopEmbed() {
  return new EmbedBuilder()
    .setTitle("NoobV2 Fishing Shop")
    .setColor("Green")
    .setDescription(
      "**Fishing Rod — 1 WL**\n" +
      "• 10% break chance\n\n" +

      "**Rainbow Rod — 45 WL**\n" +
      "• 8% break chance\n" +
      "• 1.2× rare-fish chance\n" +
      "• 10–20% faster reel time\n" +
      "• 5% chance to catch two common fish\n\n" +

      "**Pristine Rod — 120 WL**\n" +
      "• 3–5% break chance\n" +
      "• 20% chance bait is not consumed\n" +
      "• 10% more fishing XP\n" +
      "• Higher chance to survive failed catches\n\n" +

      "**Golden Rod — 10 DL**\n" +
      "• Never breaks\n" +
      "• 35% bait refund chance\n" +
      "• 50% more fishing XP\n" +
      "• 2× Megalodon chance\n" +
      "• 1.5× Alpha Shark chance\n" +
      "• 5% Treasure Chest chance\n\n" +

      "**Wiggly Worm Bait**\n" +
      "• 25 worms for 1 WL"
    );
}

function shopRows(userId) {
  const rodMenu =
    new StringSelectMenuBuilder()
      .setCustomId(`shop_buy_rod_${userId}`)
      .setPlaceholder("Choose a fishing rod")
      .addOptions(
        {
          label: "Fishing Rod",
          value: "fishingRod",
          description: "Costs 1 WL"
        },
        {
          label: "Rainbow Rod",
          value: "rainbowRod",
          description: "Costs 45 WL"
        },
        {
          label: "Pristine Rod",
          value: "pristineRod",
          description: "Costs 120 WL"
        },
        {
          label: "Golden Rod",
          value: "goldenRod",
          description: "Costs 10 DL"
        }
      );

  const wormMenu =
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
      );

  return [
    new ActionRowBuilder().addComponents(rodMenu),
    new ActionRowBuilder().addComponents(wormMenu)
  ];
}

function rodMenu(userId, data) {
  const ownedRods = getOwnedRods(data);

  const options = ownedRods.map(rodKey => ({
    label: RODS[rodKey].name,
    value: rodKey,
    description:
      `You own ${Number(data.items[rodKey] || 0)}`
  }));

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`fish_rod_${userId}`)
      .setPlaceholder("Choose your fishing rod")
      .addOptions(options)
  );
}

function baitMenu(userId, rodKey) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`fish_bait_${userId}_${rodKey}`)
      .setPlaceholder("Choose bait to use")
      .addOptions({
        label: "Wiggly Worm",
        value: "wigglyWorm",
        description: "Uses one bait per attempt"
      })
  );
}

function salesmanEmbed(data) {
  const lines = Object.entries(FISH_DATA).map(
    ([fishKey, fish]) => {
      const owned = getFishAmount(data, fishKey);

      return (
        `**${fish.sellNeed} ${fish.name}** → ` +
        `**${fish.sellReward} WL** | ` +
        `You have: **${owned}**`
      );
    }
  );

  const embed = new EmbedBuilder()
    .setTitle("Fish Salesman")
    .setColor("Gold")
    .setDescription(
      "Exchange your fish for World Locks.\n\n" +
      lines.join("\n")
    );

  if (fs.existsSync(salesmanPath)) {
    embed.setThumbnail("attachment://salesman.png");
  }

  return embed;
}

function salesmanRows(userId) {
  const buttons = Object.entries(FISH_DATA).map(
    ([fishKey, fish]) =>
      new ButtonBuilder()
        .setCustomId(
          `salesman_sell_${fishKey}_${userId}`
        )
        .setLabel(`Sell ${fish.name}`)
        .setStyle(ButtonStyle.Success)
  );

  return [
    new ActionRowBuilder().addComponents(
      buttons.slice(0, 5)
    ),
    new ActionRowBuilder().addComponents(
      buttons.slice(5, 9)
    )
  ];
}

function treasureReward(userData) {
  const roll = Math.random() * 100;

  if (roll < 45) {
    const worldLocks =
      Math.floor(Math.random() * 3) + 1;

    userData.wl =
      Number(userData.wl || 0) + worldLocks;

    return `${worldLocks} World Lock${
      worldLocks === 1 ? "" : "s"
    }`;
  }

  if (roll < 60) {
    userData.wl =
      Number(userData.wl || 0) + 100;

    return "1 Diamond Lock";
  }

  if (roll < 80) {
    const specialBait =
      Math.floor(Math.random() * 4) + 2;

    userData.items.specialBait =
      Number(userData.items.specialBait || 0) +
      specialBait;

    return `${specialBait} Special Bait`;
  }

  if (roll < 95) {
    const decorations = [
      "goldenAnchor",
      "pirateBarrel",
      "coralStatue",
      "ancientCompass",
      "treasureMap",
      "captainsHat"
    ];

    const decoration =
      decorations[
        Math.floor(Math.random() * decorations.length)
      ];

    userData.items[decoration] =
      Number(userData.items[decoration] || 0) + 1;

    return decoration
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, letter => letter.toUpperCase());
  }

  const collectibles = [
    "pearl",
    "ancientCoin",
    "krakenTooth",
    "lostCrown",
    "oceanRelic"
  ];

  const collectible =
    collectibles[
      Math.floor(Math.random() * collectibles.length)
    ];

  userData.items[collectible] =
    Number(userData.items[collectible] || 0) + 1;

  return collectible
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, letter => letter.toUpperCase());
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
    const userData = ensureUser(
      levels,
      interaction.user.id
    );

    const files = fs.existsSync(salesmanPath)
      ? [
          new AttachmentBuilder(salesmanPath, {
            name: "salesman.png"
          })
        ]
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
    const userData = ensureUser(
      levels,
      interaction.user.id
    );

    const ownedRods = getOwnedRods(userData);

    if (ownedRods.length === 0) {
      await interaction.reply({
        content:
          "❌ You need a **Fishing Rod** first. " +
          "Buy one from `/shop`.",
        ephemeral: true
      });

      return true;
    }

    if (
      Number(userData.items.wigglyWorm || 0) <= 0
    ) {
      await interaction.reply({
        content:
          "❌ You need **Wiggly Worm bait** to fish. " +
          "Buy bait from `/shop`.",
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
          .setTitle("Choose Your Fishing Rod")
          .setColor("Blue")
          .setDescription(
            `You have **${
              userData.items.wigglyWorm || 0
            } Wiggly Worms**.\n\n` +
            "Choose which fishing rod you want to use."
          )
      ],
      components: [
        rodMenu(interaction.user.id, userData)
      ]
    });

    return true;
  }

  return false;
}

async function handleSelect(interaction) {
  if (!interaction.isStringSelectMenu()) {
    return false;
  }

  /*
   * BUY A FISHING ROD
   */
  if (
    interaction.customId.startsWith(
      "shop_buy_rod_"
    )
  ) {
    const ownerId = interaction.customId.replace(
      "shop_buy_rod_",
      ""
    );

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content:
          "❌ This shop menu is not for you.",
        ephemeral: true
      });

      return true;
    }

    const rodKey = interaction.values[0];
    const selectedRod = RODS[rodKey];

    if (!selectedRod) {
      await interaction.reply({
        content: "❌ Invalid fishing rod.",
        ephemeral: true
      });

      return true;
    }

    const levels = loadLevels();
    const userData = ensureUser(levels, ownerId);

    const price = Number(
      selectedRod.priceWL || 0
    );

    if (Number(userData.wl || 0) < price) {
      const displayPrice =
        price >= 100 && price % 100 === 0
          ? `${price / 100} DL`
          : `${price} WL`;

      await interaction.reply({
        content:
          `❌ You need **${displayPrice}** to buy ` +
          `a **${selectedRod.name}**.\n` +
          `You currently have **${
            userData.wl || 0
          } WL**.`,
        ephemeral: true
      });

      return true;
    }

    userData.wl -= price;

    userData.items[rodKey] =
      Number(userData.items[rodKey] || 0) + 1;

    levels[ownerId] = userData;
    saveLevels(levels);

    const displayPrice =
      price >= 100 && price % 100 === 0
        ? `${price / 100} DL`
        : `${price} WL`;

    await interaction.reply({
      content:
        `✅ You bought **1 ${selectedRod.name}** ` +
        `for **${displayPrice}**.`,
      ephemeral: true
    });

    return true;
  }

  /*
   * BUY WIGGLY WORMS
   */
  if (
    interaction.customId.startsWith(
      "shop_buy_worm_"
    )
  ) {
    const ownerId = interaction.customId.replace(
      "shop_buy_worm_",
      ""
    );

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content:
          "❌ This shop menu is not for you.",
        ephemeral: true
      });

      return true;
    }

    const packs = Number(interaction.values[0]);
    const cost = packs * WORM_PRICE_WL;
    const worms =
      packs * WORM_AMOUNT_PER_BUY;

    const levels = loadLevels();
    const userData = ensureUser(levels, ownerId);

    if (Number(userData.wl || 0) < cost) {
      await interaction.reply({
        content:
          `❌ You need **${cost} WL** to buy ` +
          `**${worms} Wiggly Worms**.\n` +
          `You currently have **${
            userData.wl || 0
          } WL**.`,
        ephemeral: true
      });

      return true;
    }

    userData.wl -= cost;

    userData.items.wigglyWorm =
      Number(userData.items.wigglyWorm || 0) +
      worms;

    levels[ownerId] = userData;
    saveLevels(levels);

    await interaction.reply({
      content:
        `✅ You bought **${worms} Wiggly Worms** ` +
        `for **${cost} WL**.`,
      ephemeral: true
    });

    return true;
  }

  /*
   * CHOOSE FISHING ROD
   */
  if (
    interaction.customId.startsWith(
      "fish_rod_"
    )
  ) {
    const ownerId = interaction.customId.replace(
      "fish_rod_",
      ""
    );

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content:
          "❌ This fishing menu is not yours.",
        ephemeral: true
      });

      return true;
    }

    const rodKey = interaction.values[0];

    const levels = loadLevels();
    const userData = ensureUser(levels, ownerId);
    const selectedRod = getRod(
      userData,
      rodKey
    );

    if (!selectedRod) {
      await interaction.reply({
        content:
          "❌ You no longer own this fishing rod.",
        ephemeral: true
      });

      return true;
    }

    if (
      Number(userData.items.wigglyWorm || 0) <= 0
    ) {
      await interaction.reply({
        content:
          "❌ You have no **Wiggly Worm bait** left.",
        ephemeral: true
      });

      return true;
    }

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("Choose Your Bait")
          .setColor("Blue")
          .setDescription(
            `You equipped your **${selectedRod.name}**.\n\n` +
            `You have **${
              userData.items.wigglyWorm || 0
            } Wiggly Worms**.\n\n` +
            "Choose the bait you want to use."
          )
      ],
      components: [
        baitMenu(ownerId, rodKey)
      ]
    });

    return true;
  }

  /*
   * CHOOSE BAIT
   */
  if (
    interaction.customId.startsWith(
      "fish_bait_"
    )
  ) {
    const raw = interaction.customId.replace(
      "fish_bait_",
      ""
    );

    const lastUnderscore =
      raw.lastIndexOf("_");

    const ownerId = raw.slice(
      0,
      lastUnderscore
    );

    const rodKey = raw.slice(
      lastUnderscore + 1
    );

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content:
          "❌ This fishing menu is not yours.",
        ephemeral: true
      });

      return true;
    }

    const bait = interaction.values[0];

    if (bait !== "wigglyWorm") {
      await interaction.reply({
        content: "❌ Invalid bait.",
        ephemeral: true
      });

      return true;
    }

    const levels = loadLevels();
    const userData = ensureUser(levels, ownerId);
    const selectedRod = getRod(
      userData,
      rodKey
    );

    if (!selectedRod) {
      await interaction.reply({
        content:
          "❌ Your selected fishing rod is missing.",
        ephemeral: true
      });

      return true;
    }

    if (
      Number(userData.items.wigglyWorm || 0) <= 0
    ) {
      await interaction.reply({
        content:
          "❌ You have no **Wiggly Worm bait** left.",
        ephemeral: true
      });

      return true;
    }

    const row =
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(
            `fish_cast_${ownerId}_${rodKey}_${bait}`
          )
          .setLabel("Cast Line")
          .setStyle(ButtonStyle.Primary)
      );

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("Fishing")
          .setColor("Blue")
          .setDescription(
            `You equipped your **${selectedRod.name}** ` +
            "and **Wiggly Worm** bait.\n\n" +
            "Click **Cast Line** to start fishing."
          )
      ],
      components: [row]
    });

    return true;
  }

  return false;
}

async function handleButton(interaction) {
  if (!interaction.isButton()) return false;

  /*
   * SALESMAN
   */
  if (
    interaction.customId.startsWith(
      "salesman_sell_"
    )
  ) {
    const raw = interaction.customId.replace(
      "salesman_sell_",
      ""
    );

    const lastUnderscore =
      raw.lastIndexOf("_");

    const fishKey = raw.slice(
      0,
      lastUnderscore
    );

    const ownerId = raw.slice(
      lastUnderscore + 1
    );

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content:
          "❌ This salesman menu is not for you.",
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

    const owned = getFishAmount(
      userData,
      fishKey
    );

    if (owned < fish.sellNeed) {
      await interaction.reply({
        content:
          `❌ You need **${fish.sellNeed} ${fish.name}** ` +
          "to exchange.\n" +
          `You currently have **${owned}**.`,
        ephemeral: true
      });

      return true;
    }

    removeFish(
      userData,
      fishKey,
      fish.sellNeed
    );

    userData.wl =
      Number(userData.wl || 0) +
      fish.sellReward;

    levels[ownerId] = userData;
    saveLevels(levels);

    await interaction.reply({
      content:
        `✅ You exchanged **${fish.sellNeed} ` +
        `${fish.name}** for **${fish.sellReward} WL**.`,
      ephemeral: true
    });

    return true;
  }

  /*
   * CAST FISHING LINE
   */
  if (
    interaction.customId.startsWith(
      "fish_cast_"
    )
  ) {
    const raw = interaction.customId.replace(
      "fish_cast_",
      ""
    );

    const parts = raw.split("_");

    const ownerId = parts[0];
    const rodKey = parts[1];
    const bait = parts[2];

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content:
          "❌ This fishing session is not yours.",
        ephemeral: true
      });

      return true;
    }

    if (activeFishing.has(ownerId)) {
      await interaction.reply({
        content:
          "❌ You are already fishing.",
        ephemeral: true
      });

      return true;
    }

    const levels = loadLevels();
    const userData = ensureUser(levels, ownerId);
    const selectedRod = getRod(
      userData,
      rodKey
    );

    if (!selectedRod) {
      await interaction.reply({
        content:
          "❌ You do not own this fishing rod anymore.",
        ephemeral: true
      });

      return true;
    }

    if (
      bait !== "wigglyWorm" ||
      Number(userData.items.wigglyWorm || 0) <= 0
    ) {
      await interaction.reply({
        content:
          "❌ You do not have enough bait.",
        ephemeral: true
      });

      return true;
    }

    const baitWasSaved =
      Math.random() <
      Number(selectedRod.baitSaveChance || 0);

    if (!baitWasSaved) {
      userData.items.wigglyWorm =
        Math.max(
          0,
          Number(
            userData.items.wigglyWorm || 0
          ) - 1
        );

      if (userData.items.wigglyWorm <= 0) {
        delete userData.items.wigglyWorm;
      }
    }

    const pendingFish = pickFish(selectedRod);

    const reelTime = pendingFish
      ? getReelTime(
          pendingFish,
          selectedRod
        )
      : 7000;

    activeFishing.set(ownerId, {
      bait,
      rodKey,
      pendingFish,
      reelTime,
      baitWasSaved,
      startedAt: Date.now()
    });

    levels[ownerId] = userData;
    saveLevels(levels);

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("Fishing")
          .setColor("Blue")
          .setDescription(
            `You cast your **${selectedRod.name}** ` +
            "into the water...\n\n" +
            (
              baitWasSaved
                ? "Your rod preserved the bait!\n\n"
                : "You used **1 Wiggly Worm**.\n\n"
            ) +
            "Waiting for a fish to bite..."
          )
      ],
      components: []
    });

    const waitTime =
      Math.floor(Math.random() * 4000) +
      3000;

    setTimeout(async () => {
      const currentSession =
        activeFishing.get(ownerId);

      if (!currentSession) return;

      const row =
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(
              `fish_reel_${ownerId}`
            )
            .setLabel("Reel In!")
            .setStyle(ButtonStyle.Success)
        );

      await interaction
        .editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("A Fish Is Biting!")
              .setColor("Yellow")
              .setDescription(
                "Quick! Click **Reel In!** " +
                "before it escapes!"
              )
          ],
          components: [row]
        })
        .catch(() => {});

      setTimeout(async () => {
        const expiredSession =
          activeFishing.get(ownerId);

        if (!expiredSession) return;

        activeFishing.delete(ownerId);

        const freshLevels = loadLevels();
        const freshUserData = ensureUser(
          freshLevels,
          ownerId
        );

        const failedRod = RODS[
          expiredSession.rodKey
        ];

        let rodBroke = false;

        if (
          failedRod &&
          Number(
            freshUserData.items?.[
              expiredSession.rodKey
            ] || 0
          ) > 0
        ) {
          const rodProtectionWorked =
            Math.random() <
            Number(
              failedRod.failedCatchSaveChance ||
              0
            );

          if (
            !rodProtectionWorked &&
            Math.random() <
              Number(
                failedRod.breakChance || 0
              )
          ) {
            freshUserData.items[
              expiredSession.rodKey
            ] = Math.max(
              0,
              Number(
                freshUserData.items[
                  expiredSession.rodKey
                ] || 0
              ) - 1
            );

            if (
              freshUserData.items[
                expiredSession.rodKey
              ] <= 0
            ) {
              delete freshUserData.items[
                expiredSession.rodKey
              ];
            }

            rodBroke = true;
          }
        }

        freshLevels[ownerId] =
          freshUserData;

        saveLevels(freshLevels);

        await interaction
          .editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle(
                  rodBroke
                    ? "The Fish Escaped!"
                    : "The Fish Escaped"
                )
                .setColor("Red")
                .setDescription(
                  "You waited too long and the fish escaped." +
                  (
                    rodBroke && failedRod
                      ? `\n\nYour **${failedRod.name}** also broke.`
                      : ""
                  )
                )
            ],
            components: []
          })
          .catch(() => {});
      }, currentSession.reelTime);
    }, waitTime);

    return true;
  }

  /*
   * REEL IN FISH
   */
  if (
    interaction.customId.startsWith(
      "fish_reel_"
    )
  ) {
    const ownerId =
      interaction.customId.replace(
        "fish_reel_",
        ""
      );

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content:
          "❌ This fishing session is not yours.",
        ephemeral: true
      });

      return true;
    }

    const session =
      activeFishing.get(ownerId);

    if (!session) {
      await interaction.reply({
        content:
          "❌ This fish already escaped.",
        ephemeral: true
      });

      return true;
    }

    activeFishing.delete(ownerId);

    const levels = loadLevels();
    const userData = ensureUser(
      levels,
      ownerId
    );

    const selectedRod = RODS[
      session.rodKey
    ];

    if (
      !selectedRod ||
      Number(
        userData.items?.[session.rodKey] || 0
      ) <= 0
    ) {
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("Fishing Failed")
            .setColor("Red")
            .setDescription(
              "Your selected fishing rod is missing."
            )
        ],
        components: []
      });

      return true;
    }

    /*
     * ROD BREAK CHECK
     */
    const rodBroke =
      Math.random() <
      Number(selectedRod.breakChance || 0);

    if (rodBroke) {
      userData.items[session.rodKey] =
        Math.max(
          0,
          Number(
            userData.items[session.rodKey] ||
            0
          ) - 1
        );

      if (
        userData.items[session.rodKey] <= 0
      ) {
        delete userData.items[
          session.rodKey
        ];
      }

      levels[ownerId] = userData;
      saveLevels(levels);

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              `${selectedRod.name} Broke!`
            )
            .setColor("Red")
            .setDescription(
              `Your **${selectedRod.name}** snapped ` +
              "while fishing!\n\n" +
              "The broken rod has been removed " +
              "from your backpack."
            )
        ],
        components: []
      });

      return true;
    }

    /*
     * GOLDEN ROD TREASURE CHEST
     */
    if (
      Math.random() <
      Number(
        selectedRod.treasureChance || 0
      )
    ) {
      const reward =
        treasureReward(userData);

      const treasurePath = path.join(
        imagesFolder,
        "treasurechest.webp"
      );

      const attachment =
        fs.existsSync(treasurePath)
          ? new AttachmentBuilder(
              treasurePath,
              {
                name: "treasurechest.webp"
              }
            )
          : null;

      levels[ownerId] = userData;
      saveLevels(levels);

      const embed =
        new EmbedBuilder()
          .setTitle(
            "Treasure Chest Found!"
          )
          .setColor("Gold")
          .setDescription(
            `Your **${selectedRod.name}** found ` +
            "a hidden Treasure Chest!\n\n" +
            `You received **${reward}**.`
          );

      if (attachment) {
        embed.setThumbnail(
          "attachment://treasurechest.webp"
        );
      }

      await interaction.update({
        embeds: [embed],
        files: attachment
          ? [attachment]
          : [],
        components: []
      });

      return true;
    }

    const pickedKey =
      session.pendingFish || null;

    if (!pickedKey) {
      levels[ownerId] = userData;
      saveLevels(levels);

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("Nothing Caught")
            .setColor("Grey")
            .setDescription(
              "You reeled in your line, " +
              "but nothing was there."
            )
        ],
        components: []
      });

      return true;
    }

    const fishInfo =
      FISH_DATA[pickedKey];

    if (!fishInfo) {
      levels[ownerId] = userData;
      saveLevels(levels);

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("Fishing Error")
            .setColor("Red")
            .setDescription(
              "The selected fish could not be found."
            )
        ],
        components: []
      });

      return true;
    }

    if (
      !hasSpaceForFish(
        userData,
        pickedKey
      )
    ) {
      levels[ownerId] = userData;
      saveLevels(levels);

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("Backpack Full")
            .setColor("Red")
            .setDescription(
              `You caught a **${fishInfo.name}**, ` +
              "but your backpack is full!\n\n" +
              "Buy extra backpack slots from " +
              "`/inventory` before catching " +
              "more new fish."
            )
        ],
        components: []
      });

      return true;
    }

    let caughtAmount = 1;

    if (
      fishInfo.rarity === "Common" &&
      Math.random() <
        Number(
          selectedRod.doubleCommonChance ||
          0
        )
    ) {
      caughtAmount = 2;
    }

    const caughtFish = addFish(
      userData,
      pickedKey,
      caughtAmount
    );

    const baseXP =
      Number(caughtFish.xp || 0);

    const earnedXP = Math.max(
      1,
      Math.round(
        baseXP *
          Number(
            selectedRod.xpMultiplier || 1
          )
      )
    );

    userData.xp =
      Number(userData.xp || 0) +
      earnedXP;

    let rewardText =
      `\nYou earned **${earnedXP} fishing XP**.`;

    if (caughtAmount > 1) {
      rewardText +=
        `\nYour **${selectedRod.name}** caught ` +
        `**${caughtAmount} ${caughtFish.name}** at once!`;
    }

    if (
      Math.random() <
      BONUS_WL_CHANCE
    ) {
      userData.wl =
        Number(userData.wl || 0) + 1;

      rewardText +=
        "\nYou also found **1 World Lock**!";
    }

    levels[ownerId] = userData;
    saveLevels(levels);

    const fishPath =
      getFishPath(caughtFish);

    const attachment =
      fs.existsSync(fishPath)
        ? new AttachmentBuilder(
            fishPath,
            {
              name: caughtFish.file
            }
          )
        : null;

    const embed =
      new EmbedBuilder()
        .setTitle("Fish Caught!")
        .setColor("Green")
        .setDescription(
          `You caught **${caughtAmount}× ` +
          `${caughtFish.rarity} ` +
          `${caughtFish.name}**!\n` +
          "It has been added to your backpack." +
          rewardText
        );

    if (attachment) {
      embed.setThumbnail(
        `attachment://${caughtFish.file}`
      );
    }

    await interaction.update({
      embeds: [embed],
      files: attachment
        ? [attachment]
        : [],
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