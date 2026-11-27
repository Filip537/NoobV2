
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
  seed: "<:unknownseedicon192x192:1575743134267342858>",
  check: "<:emoji_28:1439046091201839225>"
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
    description: "Chance of additional harvested fruit"
  },
  {
    id: "harvester",
    name: "Harvester",
    description: "Double fruit chance using Fuel Packs"
  },
  {
    id: "sorrow",
    name: "Harvester of Sorrows",
    description: "Double fruit chance using Fuel Packs"
  },
  {
    id: "xp",
    name: "Experience Potion",
    description: "Additional XP from consuming potions"
  },
  {
    id: "farmer",
    name: "Farmer Role",
    description: "Unlock special farmer role rewards"
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
      throw new Error(
        `Wiki HTTP ${response.status}`
      );
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
      `[HARVEST THUMBNAIL] ${itemName}:`,
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
// AUTOCOMPLETE
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

    results.sort((a, b) => {
      const aStarts =
        normalize(a.name).startsWith(key);

      const bStarts =
        normalize(b.name).startsWith(key);

      return (
        Number(bStarts) - Number(aStarts) ||
        a.name.localeCompare(b.name)
      );
    });

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
// FARMER ROLE DROPS
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

  if (
    eligible &&
    hasBuff(buffs, "staff")
  ) {
    staffBonus = Math.round(
      amount * 0.02
    );
  }

  if (
    eligible &&
    hasHarvester(buffs)
  ) {
    fuelUsed = Math.min(
      buffs.fuel,
      amount * 0.10
    );

    harvesterBonus = Math.round(
      fuelUsed * item.averageBlocks
    );
  }

  if (hasBuff(buffs, "xp")) {
    potionXP = buffs.potions * 10000;
  }

  const farmerLevel =
    hasBuff(buffs, "farmer")
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
// CLEAN HARVEST EMBED
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
    );

  if (session.thumbnail) {
    embed.setThumbnail(session.thumbnail);
  }

  const description = [
    `**Item:** [${item.name}](${wikiURL})`,
    `**Amount:** ${format(session.amount)} trees`,
    `**Rarity:** ${item.rarity}`
  ];

  // ==========================================
  // CONFIGURATION PANEL
  // ==========================================

  if (!showResults) {
    description.push(
      "",
      "━━━━━━━━━━━━━━━━━━━━",
      "",
      "### Select Your Buffs"
    );

    for (const buff of BUFFS) {
      const selected = hasBuff(
        buffs,
        buff.id
      );

      description.push(
        selected
          ? `${EMOJIS.check} **${buff.name}**`
          : `☐ ${buff.name}`
      );
    }

    const quantities = [];

    if (hasHarvester(buffs)) {
      quantities.push(
        `Fuel Packs: **${format(buffs.fuel)}**`
      );
    }

    if (hasBuff(buffs, "xp")) {
      quantities.push(
        `Experience Potions: **${format(buffs.potions)}**`
      );
    }

    if (hasBuff(buffs, "farmer")) {
      quantities.push(
        `Farmer Role: **Level ${buffs.farmer}**`
      );
    }

    if (quantities.length) {
      description.push(
        "",
        "### Consumables & Levels",
        ...quantities
      );
    }

    description.push(
      "",
      "━━━━━━━━━━━━━━━━━━━━",
      "",
      "Select your buffs and set their quantities before calculating."
    );

    embed.setFooter({
      text:
        "NoobV2 • Harvest Configuration"
    });
  }

  // ==========================================
  // RESULTS PANEL
  // ==========================================

  if (showResults) {
    const result = boosted(
      session.amount,
      item,
      buffs
    );

    description.push(
      "",
      "━━━━━━━━━━━━━━━━━━━━",
      "",
      "### Harvest Rewards",
      `**Blocks:** ${format(result.totalBlocks)}`,
      `${EMOJIS.seed} **Seeds:** ${format(result.totalSeeds)}`,
      `${EMOJIS.gems} **Gems:** ${format(result.totalGems)}`,
      `${EMOJIS.xp} **Experience:** ${format(result.totalXP)} XP`
    );

    // ==========================================
    // SELECTED BUFFS ONLY
    // ==========================================

    const selectedBuffs = BUFFS.filter(
      buff => hasBuff(buffs, buff.id)
    );

    description.push(
      "",
      "━━━━━━━━━━━━━━━━━━━━",
      "",
      "### Selected Buffs"
    );

    if (!selectedBuffs.length) {
      description.push("None");
    }

    for (const buff of selectedBuffs) {
      let suffix = "";

      if (
        buff.id === "harvester" ||
        buff.id === "sorrow"
      ) {
        suffix =
          ` — ${format(buffs.fuel)} Fuel Packs`;
      }

      if (buff.id === "xp") {
        suffix =
          ` ×${format(buffs.potions)}`;
      }

      if (buff.id === "farmer") {
        suffix =
          ` — Level ${buffs.farmer}`;
      }

      description.push(
        `${EMOJIS.check} ${buff.name}${suffix}`
      );
    }

    // ==========================================
    // ADDITIONAL REWARDS
    // ==========================================

    const bonuses = [];

    if (result.extraBlocks > 0) {
      bonuses.push(
        `**Extra Blocks:** +${format(result.extraBlocks)}`
      );
    }

    if (result.extraXP > 0) {
      bonuses.push(
        `${EMOJIS.xp} **Potion XP:** +${format(result.extraXP)} XP`
      );
    }

    description.push(
      "",
      "### Bonus Rewards"
    );

    if (bonuses.length) {
      description.push(...bonuses);
    } else {
      description.push(
        "No additional rewards."
      );
    }

    // ==========================================
    // CONSUMABLE USAGE
    // ==========================================

    const consumables = [];

    if (hasHarvester(buffs) && buffs.fuel > 0) {
      consumables.push(
        `Fuel Used: **~${format(result.fuelUsed)}**`,
        `Fuel Remaining: **~${format(
          Math.max(
            0,
            buffs.fuel - result.fuelUsed
          )
        )}**`
      );
    }

    if (
      hasBuff(buffs, "xp") &&
      buffs.potions > 0
    ) {
      consumables.push(
        `Potions Used: **${format(buffs.potions)}**`
      );
    }

    if (consumables.length) {
      description.push(
        "",
        "### Consumable Usage",
        ...consumables
      );
    }

    // ==========================================
    // FARMER ROLE SPECIAL REWARDS
    // ==========================================

    if (hasBuff(buffs, "farmer")) {
      description.push(
        "",
        "### Possible Farmer Rewards"
      );

      if (result.farmerDrops.length) {
        description.push(
          ...result.farmerDrops.map(
            drop => `• ${drop}`
          )
        );

        description.push(
          "Drop quantities are not estimated."
        );
      } else {
        description.push(
          "No eligible special drops."
        );
      }

      description.push(
        "Farmer gem bonuses are not included."
      );
    }

    // ==========================================
    // RESTRICTIONS AND WARNINGS
    // ==========================================

    const warnings = [];

    if (
      item.rarity >= 100 &&
      (
        hasBuff(buffs, "staff") ||
        hasHarvester(buffs)
      )
    ) {
      warnings.push(
        "Extra-fruit buffs are unavailable for this rarity."
      );
    }

    if (
      hasHarvester(buffs) &&
      buffs.fuel === 0
    ) {
      warnings.push(
        "Harvester bonus was not applied because no Fuel Packs were entered."
      );
    }

    if (
      hasBuff(buffs, "xp") &&
      buffs.potions === 0
    ) {
      warnings.push(
        "No Experience Potions were entered."
      );
    }

    if (warnings.length) {
      description.push(
        "",
        "### Notes",
        ...warnings.map(
          warning => `• ${warning}`
        )
      );
    }

    embed.setFooter({
      text:
        "NoobV2 • Estimated harvest rewards"
    });
  }

  embed.setDescription(
    description.join("\n")
  );

  // ==========================================
  // COMPONENTS
  // ==========================================

  const customId = action =>
    `harvest:${session.id}:${action}`;

  const components = [];

  if (!showResults) {
    const buffMenu =
      new StringSelectMenuBuilder()
        .setCustomId(customId("select"))
        .setPlaceholder(
          "Select your harvest buffs"
        )
        .setMinValues(0)
        .setMaxValues(BUFFS.length)
        .addOptions(
          BUFFS.map(buff => ({
            label: buff.name,
            description: buff.description,
            value: buff.id,
            default: hasBuff(
              buffs,
              buff.id
            )
          }))
        );

    components.push(
      new ActionRowBuilder()
        .addComponents(buffMenu)
    );

    const needsQuantities =
      hasHarvester(buffs) ||
      hasBuff(buffs, "xp") ||
      hasBuff(buffs, "farmer");

    if (needsQuantities) {
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(
              customId("quantity")
            )
            .setLabel("Set Quantities")
            .setStyle(ButtonStyle.Primary)
        )
      );
    }

    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(
            customId("calculate")
          )
          .setLabel("Calculate Harvest")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(
            customId("reset")
          )
          .setLabel("Reset Buffs")
          .setStyle(ButtonStyle.Secondary)
      )
    );

  } else {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(
            customId("edit")
          )
          .setLabel("Edit Buffs")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId(
            customId("reset")
          )
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
// EXECUTE /HARVEST
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

    const thumbnail =
      await getItemThumbnail(item.name);

    const session = {
      id: interaction.id,
      owner: interaction.user.id,
      amount,
      item,
      thumbnail,
      buffs: defaultBuffs(),
      expires:
        Date.now() + SESSION_DURATION
    };

    sessions.set(
      session.id,
      session
    );

    return await interaction.editReply(
      buildPanel(session)
    );

  } catch (error) {
    console.error(
      "[HARVEST COMMAND]",
      error
    );

    const message = {
      content:
        "Could not open the harvest calculator.",
      embeds: [],
      components: []
    };

    if (
      interaction.deferred ||
      interaction.replied
    ) {
      return interaction.editReply(
        message
      ).catch(() => {});
    }

    return interaction.reply({
      ...message,
      ephemeral: true
    }).catch(() => {});
  }
}

// ==========================================
// BUFF QUANTITY MODAL
// ==========================================

function buildQuantityModal(session) {
  const buffs = session.buffs;

  const modal = new ModalBuilder()
    .setCustomId(
      `harvest:${session.id}:save`
    )
    .setTitle("Harvest Buff Quantities");

  function addInput(
    id,
    label,
    value,
    placeholder
  ) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(id)
          .setLabel(label)
          .setStyle(
            TextInputStyle.Short
          )
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
// HANDLE INTERACTIONS
// ==========================================

async function handleInteraction(interaction) {
  try {
    const [, sessionId, action] =
      interaction.customId.split(":");

    const session =
      sessions.get(sessionId);

    // ==========================================
    // SESSION VALIDATION
    // ==========================================

    if (
      !session ||
      session.expires < Date.now()
    ) {
      sessions.delete(sessionId);

      return interaction.reply({
        content:
          "This harvest session has expired. Use /harvest again.",
        ephemeral: true
      });
    }

    if (
      interaction.user.id !== session.owner
    ) {
      return interaction.reply({
        content:
          "Only the person who opened this calculator can modify it.",
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
      const selected =
        interaction.values.filter(
          value => BUFFS.some(
            buff => buff.id === value
          )
        );

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
      const modal =
        buildQuantityModal(session);

      if (!modal.components.length) {
        return interaction.reply({
          content:
            "Select a buff that requires a quantity first.",
          ephemeral: true
        });
      }

      return interaction.showModal(
        modal
      );
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
        if (
          !interaction.fields.fields.has(key)
        ) {
          continue;
        }

        const raw =
          interaction.fields
            .getTextInputValue(key)
            .trim();

        const value = Number(raw);

        const max =
          key === "farmer"
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

      Object.assign(
        session.buffs,
        updates
      );

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
      const buffs = session.buffs;

      // Prevent calculating with empty fuel
      if (
        session.item.rarity < 100 &&
        hasHarvester(buffs) &&
        buffs.fuel === 0
      ) {
        return interaction.reply({
          content:
            "You selected a Harvester but entered 0 Fuel Packs. " +
            "Use **Set Quantities** or remove the Harvester buff.",
          ephemeral: true
        });
      }

      // Prevent calculating with empty potions
      if (
        hasBuff(buffs, "xp") &&
        buffs.potions === 0
      ) {
        return interaction.reply({
          content:
            "You selected Experience Potion but entered 0 potions. " +
            "Use **Set Quantities** or remove the potion buff.",
          ephemeral: true
        });
      }

      // Prevent calculating without a farmer level
      if (
        hasBuff(buffs, "farmer") &&
        buffs.farmer === 0
      ) {
        return interaction.reply({
          content:
            "Please enter your Farmer Role level or remove the Farmer Role buff.",
          ephemeral: true
        });
      }

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
      content:
        "Unknown harvest action.",
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
