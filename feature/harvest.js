
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

// ==========================================
// CUSTOM GROWTOPIA EMOJIS
// ==========================================

const EMOJIS = {
  gems: "<:dumbgem192x192:1575743139522674688>",
  xp: "<:experiencepotion192x192:1575743137010417755>",
  seed: "<:unknownseedicon192x192:1575743134267342858>"
};

// ==========================================
// CONFIGURATION
// ==========================================

const MAX_TREES = 10000000;
const CACHE_DURATION = 24 * 60 * 60 * 1000;
const SESSION_DURATION = 15 * 60 * 1000;

const WIKI_API =
  "https://growtopia.fandom.com/api.php";

const thumbnailCache = new Map();
const sessions = new Map();

// ==========================================
// ITEM DATABASE
// ==========================================

const ITEMS = [
  ["Rice", 23, 28],
  ["Sugar Cane", 24, 25],
  ["Ladder", 26, 25],
  ["Sheet Music: Sharp Bass", 32, 22],
  ["Steel Block", 35, 22],
  ["Steam Tubes", 36, 20],
  ["Golden Block", 41, 18],
  ["Venus Guytrap", 41, 18],
  ["Hanging Guytrap", 41, 18],
  ["Blackrock Wall", 42, 18],
  ["Fish Tank", 42, 18],
  ["Lovewillow's Lace", 42, 18],
  ["Space Connector", 43, 18],
  ["Starship Light Wall", 45, 18],
  ["Pepper Tree", 47, 18],
  ["Starship Floor Grill", 51, 16],
  ["Pinball Bumper", 53, 16],
  ["Treasure Chest", 55, 16],
  ["Director's Chair", 64, 14],
  ["Laser Grid", 68, 14],
  ["High Tech Block", 69, 14],
  ["Roshambo Block", 71, 14],
  ["Chandelier", 87, 12],
  ["Sorcerer Stone", 87, 12],
  ["Magic Bell", 95, 10],
  ["Clouds Background", 119, 10]
].map(([name, rarity, seeds]) => ({
  name,
  rarity,
  seeds,
  averageBlocks: 3.75
}));

// ==========================================
// ITEM ALIASES
// ==========================================

const ALIASES = {
  pepper: "Pepper Tree",
  pep: "Pepper Tree",
  peppertrees: "Pepper Tree",
  chand: "Chandelier",
  chands: "Chandelier",
  chandeliers: "Chandelier",
  lgrid: "Laser Grid",
  lg: "Laser Grid",
  htb: "High Tech Block",
  fishtank: "Fish Tank",
  fish: "Fish Tank",
  pinball: "Pinball Bumper",
  sugar: "Sugar Cane",
  cane: "Sugar Cane",
  steel: "Steel Block",
  gold: "Golden Block",
  venus: "Venus Guytrap",
  cloud: "Clouds Background",
  sharpbass: "Sheet Music: Sharp Bass",
  sorcerer: "Sorcerer Stone",
  bell: "Magic Bell",
  steam: "Steam Tubes",
  treasure: "Treasure Chest",
  director: "Director's Chair"
};

// ==========================================
// HARVEST BUFFS
// ==========================================

const BUFFS = [
  {
    id: "staff",
    name: "Dreamcatcher Staff",
    description: "Estimated chance of extra harvested fruit"
  },
  {
    id: "harvester",
    name: "Harvester",
    description: "Chance of double fruit using Fuel Packs"
  },
  {
    id: "sorrow",
    name: "Harvester of Sorrows",
    description: "Chance of double fruit using Fuel Packs"
  },
  {
    id: "xp",
    name: "Experience Potion",
    description: "Additional experience from potions"
  },
  {
    id: "farmer",
    name: "Farmer Role",
    description: "Farmer role bonus rewards"
  }
];

function defaultBuffs() {
  return {
    selected: [],
    fuel: 0,
    potions: 0,
    farmer: 0
  };
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function format(value) {
  return Math.round(value).toLocaleString("en-US");
}

function findItem(query) {
  const key = normalize(query);
  const alias = ALIASES[key];

  return ITEMS.find(item =>
    normalize(item.name) ===
    normalize(alias || query)
  );
}

function hasBuff(buffs, id) {
  return buffs.selected.includes(id);
}

function hasHarvester(buffs) {
  return (
    hasBuff(buffs, "harvester") ||
    hasBuff(buffs, "sorrow")
  );
}

// ==========================================
// AUTOMATIC ITEM THUMBNAIL
// ==========================================

async function getItemThumbnail(itemName) {
  const key = normalize(itemName);

  const cached = thumbnailCache.get(key);

  if (cached && cached.expires > Date.now()) {
    return cached.url;
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 3500);

  try {
    const params = new URLSearchParams({
      action: "query",
      titles: itemName,
      redirects: "1",
      prop: "pageimages",
      piprop: "original|thumbnail",
      pithumbsize: "256",
      pilicense: "any",
      format: "json"
    });

    const response = await fetch(
      `${WIKI_API}?${params.toString()}`,
      {
        signal: controller.signal,
        headers: {
          "User-Agent": "NoobV2/1.0",
          "Accept": "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Wiki HTTP ${response.status}`);
    }

    const data = await response.json();

    const pages = Object.values(
      data.query?.pages || {}
    );

    const page = pages.find(
      p => p.missing === undefined
    );

    const imageURL =
      page?.original?.source ||
      page?.thumbnail?.source ||
      null;

    thumbnailCache.set(key, {
      url: imageURL,
      expires: Date.now() +
        (imageURL ? CACHE_DURATION : 60000)
    });

    return imageURL;

  } catch (error) {
    console.warn(
      `[HARVEST] Thumbnail failed for ${itemName}:`,
      error.message
    );

    thumbnailCache.set(key, {
      url: null,
      expires: Date.now() + 60000
    });

    return null;

  } finally {
    clearTimeout(timeout);
  }
}

// ==========================================
// ITEM AUTOCOMPLETE
// ==========================================

async function autocomplete(interaction) {
  try {
    const query = interaction.options.getFocused();
    const key = normalize(query);
    const alias = ALIASES[key];

    const results = ITEMS.filter(item =>
      normalize(item.name).includes(key) ||
      (alias && item.name === alias)
    );

    await interaction.respond(
      results.slice(0, 25).map(item => ({
        name: `${item.name} (Rarity ${item.rarity})`,
        value: item.name
      }))
    );

  } catch (error) {
    console.error(
      "[HARVEST AUTOCOMPLETE]",
      error
    );
  }
}

// ==========================================
// BASE HARVEST CALCULATOR
// ==========================================

function calculateHarvest(amount, item) {
  const blocks = Math.round(
    amount * item.averageBlocks
  );

  const seeds = Math.round(
    amount * item.seeds / 200
  );

  const averageGems = item.rarity > 30
    ? item.rarity / 4.5
    : item.rarity / 6.75;

  const gems = Math.round(
    amount * averageGems
  );

  const xpPerTree =
    1 + Math.floor(item.rarity / 5);

  const xp = amount * xpPerTree;

  return {
    blocks,
    seeds,
    gems,
    xp,
    xpPerTree,
    averageGems
  };
}

// ==========================================
// FARMER ROLE SPECIAL DROPS
// ==========================================

function getFarmerDrops(level, rarity) {
  const drops = [
    [3, 1, 20, "Beat-root Block"],
    [4, 16, 35, "Fallen Pillar"],
    [5, 21, 40, "Carrot Block"],
    [7, 41, 60, "Bloccoli Mini-Tree"],
    [8, 60, 80, "Strawberry Block"],
    [10, 81, 100, "Saffron Crocus Flower"]
  ];

  return drops
    .filter(([required, min, max]) =>
      level >= required &&
      rarity >= min &&
      rarity <= max
    )
    .map(entry => entry[3]);
}

// ==========================================
// BUFF CALCULATIONS
// ==========================================

function boosted(amount, item, buffs) {
  const base = calculateHarvest(amount, item);

  const eligible = item.rarity < 100;

  let staffBonus = 0;
  let harvesterBonus = 0;
  let fuelUsed = 0;
  let potionXP = 0;

  // Dreamcatcher Staff estimate
  if (eligible && hasBuff(buffs, "staff")) {
    staffBonus = Math.round(amount * 0.02);
  }

  // Harvester estimated double-fruit activations
  if (eligible && hasHarvester(buffs)) {
    fuelUsed = Math.min(
      buffs.fuel,
      amount * 0.10
    );

    harvesterBonus = Math.round(
      fuelUsed * item.averageBlocks
    );
  }

  // Potion XP is separate from harvest XP.
  if (hasBuff(buffs, "xp")) {
    potionXP = buffs.potions * 10000;
  }

  const farmerLevel = hasBuff(buffs, "farmer")
    ? buffs.farmer
    : 0;

  const farmerDrops = getFarmerDrops(
    farmerLevel,
    item.rarity
  );

  const extraBlocks =
    staffBonus + harvesterBonus;

  return {
    base,
    staffBonus,
    harvesterBonus,
    extraBlocks,
    extraXP: potionXP,
    fuelUsed,
    farmerDrops,

    totalBlocks: base.blocks + extraBlocks,
    totalSeeds: base.seeds,
    totalGems: base.gems,
    totalXP: base.xp + potionXP
  };
}

// ==========================================
// CONFIGURATION AND RESULTS EMBED
// ==========================================

function buildPanel(session, showResults = false) {
  const buffs = session.buffs;
  const item = session.item;

  const wikiURL =
    "https://growtopia.fandom.com/wiki/" +
    encodeURIComponent(
      item.name.replace(/ /g, "_")
    );

  const embed = new EmbedBuilder()
    .setColor("#2B2D31")
    .setTitle(
      showResults
        ? "Harvest Results"
        : "Harvest Configuration"
    )
    .setDescription(
      `**Item:** [${item.name}](${wikiURL})\n` +
      `**Amount:** ${format(session.amount)} trees\n` +
      `**Rarity:** ${item.rarity}`
    );

  if (session.thumbnail) {
    embed.setThumbnail(session.thumbnail);
  }

  // Show selected buffs
  const buffText = BUFFS.map(buff => {
    const selected = hasBuff(buffs, buff.id);

    return `${selected ? "☑" : "☐"} ${buff.name}`;
  }).join("\n");

  embed.addFields({
    name: "Select your buffs",
    value: buffText
  });

  // Display quantities
  const quantities = [];

  if (hasHarvester(buffs)) {
    quantities.push(
      `**Available Fuel Packs:** ${format(buffs.fuel)}`
    );
  }

  if (hasBuff(buffs, "xp")) {
    quantities.push(
      `**Experience Potions:** ${format(buffs.potions)}`
    );
  }

  if (hasBuff(buffs, "farmer")) {
    quantities.push(
      `**Farmer Role Level:** ${buffs.farmer}/10`
    );
  }

  if (quantities.length > 0) {
    embed.addFields({
      name: "Buff Quantities",
      value: quantities.join("\n")
    });
  }

  // ==========================================
  // HARVEST RESULTS
  // ==========================================

  if (showResults) {
    const result = boosted(
      session.amount,
      item,
      buffs
    );

    const base = result.base;

    embed.addFields(
      {
        name: "Blocks / Fruit",
        value:
          `**${format(result.totalBlocks)}**\n` +
          `Base: ${format(base.blocks)}\n` +
          `Bonus: +${format(result.extraBlocks)}`,
        inline: true
      },
      {
        name: `${EMOJIS.seed} Seeds`,
        value:
          `**${format(result.totalSeeds)}**\n` +
          `Base: ${format(base.seeds)}`,
        inline: true
      },
      {
        name: `${EMOJIS.gems} Gems`,
        value:
          `**${format(result.totalGems)}**\n` +
          `Base estimate`,
        inline: true
      },
      {
        name: `${EMOJIS.xp} Experience`,
        value:
          `**${format(result.totalXP)} XP**\n` +
          `Harvest: ${format(base.xp)} XP\n` +
          `Potions: +${format(result.extraXP)} XP`,
        inline: true
      },
      {
        name: "XP per Tree",
        value: `${base.xpPerTree} XP`,
        inline: true
      },
      {
        name: "Average Gems per Tree",
        value: `~${base.averageGems.toFixed(2)}`,
        inline: true
      }
    );

    const bonuses = [];

    if (hasBuff(buffs, "staff")) {
      bonuses.push(
        `**Dreamcatcher Staff:** ` +
        `+${format(result.staffBonus)} fruit`
      );
    }

    if (hasHarvester(buffs)) {
      bonuses.push(
        `**Harvester Bonus:** ` +
        `+${format(result.harvesterBonus)} fruit`
      );

      bonuses.push(
        `**Estimated Fuel Used:** ` +
        `${format(result.fuelUsed)}/${format(buffs.fuel)}`
      );

      bonuses.push(
        `**Estimated Fuel Remaining:** ` +
        `${format(Math.max(0, buffs.fuel - result.fuelUsed))}`
      );
    }

    if (hasBuff(buffs, "xp")) {
      bonuses.push(
        `**Experience Potions:** ` +
        `+${format(result.extraXP)} XP`
      );
    }

    if (bonuses.length > 0) {
      embed.addFields({
        name: "Buff Breakdown",
        value: bonuses.join("\n")
      });
    }

    if (hasBuff(buffs, "farmer")) {
      embed.addFields({
        name: "Farmer Role Bonuses",
        value:
          `**Level:** ${buffs.farmer}/10\n` +
          `**Eligible Drops:** ${
            result.farmerDrops.join(", ") || "None"
          }\n\n` +
          `Special drop and gem bonus rates are not ` +
          `included in the estimated totals.`
      });
    }

    if (
      item.rarity >= 100 &&
      (
        hasBuff(buffs, "staff") ||
        hasHarvester(buffs)
      )
    ) {
      embed.addFields({
        name: "Equipment Restriction",
        value:
          "These extra-fruit buffs are disabled " +
          "for items with rarity 100 or higher."
      });
    }
  }

  embed.setFooter({
    text:
      "Estimated rewards • Session expires after 15 minutes of inactivity"
  });

  // ==========================================
  // BUTTONS AND DROPDOWN
  // ==========================================

  const customId = action =>
    `harvest:${session.id}:${action}`;

  const components = [];

  if (!showResults) {
    const buffMenu = new StringSelectMenuBuilder()
      .setCustomId(customId("select"))
      .setPlaceholder("Select your harvest buffs")
      .setMinValues(0)
      .setMaxValues(BUFFS.length)
      .addOptions(
        BUFFS.map(buff => ({
          label: buff.name,
          description: buff.description,
          value: buff.id,
          default: hasBuff(buffs, buff.id)
        }))
      );

    components.push(
      new ActionRowBuilder()
        .addComponents(buffMenu)
    );

    if (quantities.length > 0) {
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(customId("quantity"))
            .setLabel("Set Quantities")
            .setStyle(ButtonStyle.Primary)
        )
      );
    }

    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(customId("calculate"))
          .setLabel("Calculate Harvest")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(customId("reset"))
          .setLabel("Reset Buffs")
          .setStyle(ButtonStyle.Secondary)
      )
    );

  } else {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(customId("edit"))
          .setLabel("Edit Buffs")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId(customId("reset"))
          .setLabel("Reset Buffs")
          .setStyle(ButtonStyle.Secondary)
      )
    );
  }

  return {
    embeds: [embed],
    components
  };
}

// ==========================================
// MAIN /HARVEST COMMAND
// ==========================================

async function execute(interaction) {
  try {
    const amount =
      interaction.options.getInteger("amount");

    const itemName =
      interaction.options.getString("item_name");

    if (
      !Number.isSafeInteger(amount) ||
      amount < 1 ||
      amount > MAX_TREES
    ) {
      return interaction.reply({
        content:
          `Enter between 1 and ${format(MAX_TREES)} trees.`,
        ephemeral: true
      });
    }

    const item = findItem(itemName);

    if (!item) {
      return interaction.reply({
        content:
          "Item not found. Select a supported item.",
        ephemeral: true
      });
    }

    await interaction.deferReply();

    // Remove expired sessions
    for (const [id, session] of sessions) {
      if (session.expires < Date.now()) {
        sessions.delete(id);
      }
    }

    const thumbnail = await getItemThumbnail(
      item.name
    );

    const session = {
      id: interaction.id,
      owner: interaction.user.id,
      amount,
      item,
      thumbnail,
      buffs: defaultBuffs(),
      expires: Date.now() + SESSION_DURATION
    };

    sessions.set(session.id, session);

    return await interaction.editReply(
      buildPanel(session)
    );

  } catch (error) {
    console.error("[HARVEST COMMAND]", error);

    const message = {
      content: "Could not open the harvest calculator.",
      embeds: [],
      components: []
    };

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(message)
        .catch(() => {});
    }

    return interaction.reply({
      ...message,
      ephemeral: true
    }).catch(() => {});
  }
}

// ==========================================
// QUANTITY MODAL
// ==========================================

function buildQuantityModal(session) {
  const buffs = session.buffs;

  const modal = new ModalBuilder()
    .setCustomId(`harvest:${session.id}:save`)
    .setTitle("Harvest Buff Quantities");

  function addInput(id, label, value, placeholder) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(id)
          .setLabel(label)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(placeholder)
          .setValue(String(value))
          .setRequired(true)
          .setMaxLength(8)
      )
    );
  }

  if (hasHarvester(buffs)) {
    addInput(
      "fuel",
      "Available Fuel Packs",
      buffs.fuel,
      "Example: 500"
    );
  }

  if (hasBuff(buffs, "xp")) {
    addInput(
      "potions",
      "Experience Potion Quantity",
      buffs.potions,
      "Example: 5"
    );
  }

  if (hasBuff(buffs, "farmer")) {
    addInput(
      "farmer",
      "Farmer Role Level (0-10)",
      buffs.farmer,
      "Example: 10"
    );
  }

  return modal;
}

// ==========================================
// HANDLE BUTTONS, MENUS AND MODALS
// ==========================================

async function handleInteraction(interaction) {
  try {
    const [, sessionId, action] =
      interaction.customId.split(":");

    const session = sessions.get(sessionId);

    // Expired session
    if (
      !session ||
      session.expires < Date.now()
    ) {
      sessions.delete(sessionId);

      return interaction.reply({
        content:
          "This harvest session has expired. " +
          "Use /harvest again.",
        ephemeral: true
      });
    }

    // Only original command user can edit
    if (interaction.user.id !== session.owner) {
      return interaction.reply({
        content:
          "Only the person who opened this " +
          "calculator can modify its buffs.",
        ephemeral: true
      });
    }

    session.expires =
      Date.now() + SESSION_DURATION;

    // ==========================================
    // SELECT BUFFS
    // ==========================================

    if (
      action === "select" &&
      interaction.isStringSelectMenu()
    ) {
      const selected = interaction.values;

      if (
        selected.includes("harvester") &&
        selected.includes("sorrow")
      ) {
        return interaction.reply({
          content:
            "You can only select one Harvester.",
          ephemeral: true
        });
      }

      session.buffs.selected = selected;

      return interaction.update(
        buildPanel(session)
      );
    }

    // ==========================================
    // OPEN QUANTITY MODAL
    // ==========================================

    if (
      action === "quantity" &&
      interaction.isButton()
    ) {
      const modal = buildQuantityModal(session);

      if (!modal.components.length) {
        return interaction.reply({
          content:
            "Select a buff that requires a quantity first.",
          ephemeral: true
        });
      }

      return interaction.showModal(modal);
    }

    // ==========================================
    // SAVE QUANTITIES
    // ==========================================

    if (
      action === "save" &&
      interaction.isModalSubmit()
    ) {
      const updates = {};

      for (const key of [
        "fuel",
        "potions",
        "farmer"
      ]) {
        if (!interaction.fields.fields.has(key)) {
          continue;
        }

        const raw = interaction.fields
          .getTextInputValue(key)
          .trim();

        const value = Number(raw);

        const max = key === "farmer"
          ? 10
          : MAX_TREES;

        if (
          !/^\d+$/.test(raw) ||
          !Number.isSafeInteger(value) ||
          value < 0 ||
          value > max
        ) {
          return interaction.reply({
            content:
              `Invalid quantity for ${key}. ` +
              `Enter a whole number from 0 to ${format(max)}.`,
            ephemeral: true
          });
        }

        updates[key] = value;
      }

      Object.assign(session.buffs, updates);

      return interaction.update(
        buildPanel(session)
      );
    }

    // ==========================================
    // CALCULATE HARVEST
    // ==========================================

    if (
      action === "calculate" &&
      interaction.isButton()
    ) {
      return interaction.update(
        buildPanel(session, true)
      );
    }

    // ==========================================
    // RESET BUFFS
    // ==========================================

    if (
      action === "reset" &&
      interaction.isButton()
    ) {
      session.buffs = defaultBuffs();

      return interaction.update(
        buildPanel(session)
      );
    }

    // ==========================================
    // EDIT BUFFS
    // ==========================================

    if (
      action === "edit" &&
      interaction.isButton()
    ) {
      return interaction.update(
        buildPanel(session)
      );
    }

    return interaction.reply({
      content: "Unknown harvest action.",
      ephemeral: true
    });

  } catch (error) {
    console.error(
      "[HARVEST INTERACTION]",
      error
    );

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {
      return interaction.reply({
        content:
          "Something went wrong. Please try again.",
        ephemeral: true
      }).catch(() => {});
    }
  }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  execute,
  autocomplete,
  handleInteraction,
  calculateHarvest,
  getItemThumbnail,
  boosted
};
