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

const ROD_COST = 1;
const WORM_PRICE_WL = 1;
const WORM_AMOUNT_PER_BUY = 25;
const ROD_BREAK_CHANCE = 0.10;
const BONUS_WL_CHANCE = 0.20;

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
  }
};

const COMMON_FISH = ["bass", "catfish", "dogfish", "gar", "goldfish", "mahi"];

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

  const totalWl = data.wl || 0;
  const dl = Math.floor(totalWl / 100);
  const wl = totalWl % 100;

  if (dl > 0) slots++;
  if (wl > 0) slots++;

  if ((data.items?.fishingRod || 0) > 0) slots++;
  if ((data.items?.wigglyWorm || 0) > 0) slots++;

  const fishes = Array.isArray(data.fishBackpack) ? data.fishBackpack : [];
  slots += fishes.filter(fish => (fish.amount || 0) > 0).length;

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

function pickFish() {
  const roll = Math.random() * 100;

  if (roll < 10) return "alpha_shark";

  if (roll < 90) {
    return COMMON_FISH[Math.floor(Math.random() * COMMON_FISH.length)];
  }

  if (roll < 96) return "whale";

  return null;
}

function getReelTime(fishKey) {
  if (fishKey === "whale") return Math.floor(Math.random() * 1000) + 1000; // 1-2 sec
  if (fishKey === "alpha_shark") return Math.floor(Math.random() * 2000) + 1000; // 1-3 sec
  return 7000; // common fish
}

function shopEmbed() {
  return new EmbedBuilder()
    .setTitle("NoobV2 Shop")
    .setColor("Green")
    .setDescription(
      "**Fishing Rod**\n" +
      `Cost: **${ROD_COST} World Lock**\n\n` +
      "**Wiggly Worm Bait**\n" +
      `Cost: **${WORM_PRICE_WL} WL** for **${WORM_AMOUNT_PER_BUY} Wiggly Worms**\n\n` +
      "You need both a **Fishing Rod** and **Wiggly Worm bait** before you can fish."
    );
}

function shopRows(userId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`shop_buy_rod_${userId}`)
        .setLabel("Buy Fishing Rod - 1 WL")
        .setStyle(ButtonStyle.Success)
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`shop_buy_worm_${userId}`)
        .setPlaceholder("Buy Wiggly Worm bait")
        .addOptions(
          { label: "25 Wiggly Worms", value: "1", description: "Costs 1 WL" },
          { label: "50 Wiggly Worms", value: "2", description: "Costs 2 WL" },
          { label: "75 Wiggly Worms", value: "3", description: "Costs 3 WL" },
          { label: "100 Wiggly Worms", value: "4", description: "Costs 4 WL" },
          { label: "250 Wiggly Worms", value: "10", description: "Costs 10 WL" }
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

  return [
    new ActionRowBuilder().addComponents(buttons.slice(0, 4)),
    new ActionRowBuilder().addComponents(buttons.slice(4, 8))
  ];
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

    if ((userData.items.fishingRod || 0) <= 0) {
      await interaction.reply({
        content: "❌ You need a **Fishing Rod** first. Buy one from `/shop` for **1 WL**.",
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

    if ((userData.items.fishingRod || 0) <= 0) {
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
          .setDescription("You equipped your fishing rod and **Wiggly Worm** bait.\n\nClick **Cast Line** to start fishing.")
      ],
      components: [row]
    });

    return true;
  }

  return false;
}

async function handleButton(interaction) {
  if (!interaction.isButton()) return false;

  if (interaction.customId.startsWith("shop_buy_rod_")) {
    const ownerId = interaction.customId.replace("shop_buy_rod_", "");

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content: "❌ This shop button is not for you.",
        ephemeral: true
      });
      return true;
    }

    const levels = loadLevels();
    const userData = ensureUser(levels, ownerId);

    if ((userData.wl || 0) < ROD_COST) {
      await interaction.reply({
        content: "❌ You need **1 World Lock** to buy a Fishing Rod.",
        ephemeral: true
      });
      return true;
    }

    userData.wl -= ROD_COST;
    userData.items.fishingRod = (userData.items.fishingRod || 0) + 1;

    levels[ownerId] = userData;
    saveLevels(levels);

    await interaction.reply({
      content: "✅ You bought **1 Fishing Rod** for **1 WL**.",
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

    if ((userData.items.fishingRod || 0) <= 0) {
      await interaction.reply({
        content: "❌ You do not have a fishing rod anymore.",
        ephemeral: true
      });
      return true;
    }

    if (bait !== "wigglyWorm" || (userData.items.wigglyWorm || 0) <= 0) {
      await interaction.reply({
        content: "❌ You do not have enough bait.",
        ephemeral: true
      });
      return true;
    }

    userData.items.wigglyWorm -= 1;
    levels[ownerId] = userData;
    saveLevels(levels);
const pendingFish = pickFish();
const reelTime = pendingFish ? getReelTime(pendingFish) : 7000;
activeFishing.set(ownerId, {
  bait,
  pendingFish,
  reelTime,
  startedAt: Date.now()
});

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("Fishing")
          .setColor("Blue")
          .setDescription(
            "You used **1 Wiggly Worm** and cast your fishing line into the water...\n\n" +
            "Waiting for a fish to bite..."
          )
      ],
      components: []
    });

    const waitTime = Math.floor(Math.random() * 4000) + 3000;

    setTimeout(async () => {
      if (!activeFishing.has(ownerId)) return;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`fish_reel_${ownerId}`)
          .setLabel("Reel In!")
          .setStyle(ButtonStyle.Success)
      );

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("A Fish Is Biting!")
            .setColor("Yellow")
            .setDescription("Quick! Click **Reel In!** before it escapes!")
        ],
        components: [row]
      }).catch(() => {});

      setTimeout(async () => {
        if (activeFishing.has(ownerId)) {
          activeFishing.delete(ownerId);

          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle("The Fish Escaped")
                .setColor("Red")
                .setDescription("You waited too long and the fish escaped.")
            ],
            components: []
          }).catch(() => {});
        }
}, activeFishing.get(ownerId)?.reelTime || 7000);    }, waitTime);

    return true;
  }

  if (interaction.customId.startsWith("fish_reel_")) {
    const ownerId = interaction.customId.replace("fish_reel_", "");

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content: "❌ This fishing session is not yours.",
        ephemeral: true
      });
      return true;
    }

    if (!activeFishing.has(ownerId)) {
      await interaction.reply({
        content: "❌ This fish already escaped.",
        ephemeral: true
      });
      return true;
    }

const session = activeFishing.get(ownerId);
const pickedKey = session?.pendingFish || null;

activeFishing.delete(ownerId);

const levels = loadLevels();
const userData = ensureUser(levels, ownerId);

if (Math.random() < ROD_BREAK_CHANCE) {
  userData.items.fishingRod = Math.max(
    0,
    Number(userData.items.fishingRod || 0) - 1
  );

  if (userData.items.fishingRod <= 0) {
    delete userData.items.fishingRod;
  }

  levels[ownerId] = userData;
  saveLevels(levels);

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setTitle("Fishing Rod Broke!")
        .setColor("Red")
        .setDescription(
          "Your **Fishing Rod** snapped while fishing!\n\n" +
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
            .setDescription("You reeled in your line, but nothing was there.")
        ],
        components: []
      });

      return true;
    }

    const fishInfo = FISH_DATA[pickedKey];
    const fishFile = getFishFile(fishInfo.file);

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
              "Buy extra backpack slots from `/inventory` before catching more new fish."
            )
        ],
        components: []
      });

      return true;
    }

    const caughtFish = addFish(userData, pickedKey);

    let rewardText = "";

    if (Math.random() < BONUS_WL_CHANCE) {
      userData.wl = (userData.wl || 0) + 1;
      rewardText = "\nYou also found **1 World Lock** while fishing!";
    }

    levels[ownerId] = userData;
    saveLevels(levels);

    const fishPath = path.join(fishFolder, caughtFish.file);
    const attachment = fs.existsSync(fishPath)
      ? new AttachmentBuilder(fishPath, { name: caughtFish.file })
      : null;

    const embed = new EmbedBuilder()
      .setTitle("Fish Caught!")
      .setColor("Green")
      .setDescription(
        `You caught a **${caughtFish.rarity} ${caughtFish.name}**!\n` +
        "It has been added to your backpack." +
        rewardText
      );

    if (attachment) embed.setThumbnail(`attachment://${caughtFish.file}`);

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