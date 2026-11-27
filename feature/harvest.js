
const { EmbedBuilder } = require("discord.js");

// ==============================
// CUSTOM GROWTOPIA EMOJIS
// ==============================

const EMOJIS = {
  gems: "<:dumbgem192x192:1575743139522674688>",
  xp: "<:experiencepotion192x192:1575743137010417755>",
  seed: "<:unknownseedicon192x192:1575743134267342858>"
};

// ==============================
// CONFIGURATION
// ==============================

const MAX_TREES = 10000000;
const CACHE_DURATION = 24 * 60 * 60 * 1000;

const WIKI_API =
  "https://growtopia.fandom.com/api.php";

const thumbnailCache = new Map();

// ==============================
// GROWTOPIA ITEM DATABASE
// ==============================

// Format:
// Name, rarity, estimated seeds per 200 trees

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

// ==============================
// ITEM ALIASES
// ==============================

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

// ==============================
// UTILITY FUNCTIONS
// ==============================

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

// ==============================
// GROWTOPIA WIKI THUMBNAIL
// ==============================

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

    const page = pages.find(p =>
      p.missing === undefined
    );

    const imageURL =
      page?.original?.source ||
      page?.thumbnail?.source ||
      null;

    if (imageURL) {
      thumbnailCache.set(key, {
        url: imageURL,
        expires: Date.now() + CACHE_DURATION
      });
    } else {
      thumbnailCache.set(key, {
        url: null,
        expires: Date.now() + 60000
      });
    }

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

// ==============================
// AUTOCOMPLETE
// ==============================

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

// ==============================
// HARVEST CALCULATOR
// ==============================

function calculateHarvest(amount, item) {
  const blocks = Math.round(
    amount * item.averageBlocks
  );

  const seeds = Math.round(
    amount * item.seeds / 200
  );

  // Estimated gem yield.
  const averageGems = item.rarity > 30
    ? item.rarity / 4.5
    : item.rarity / 6.75;

  const gems = Math.round(
    amount * averageGems
  );

  // Base Growtopia XP formula.
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

// ==============================
// MAIN COMMAND
// ==============================

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
          `Please enter between 1 and ` +
          `${format(MAX_TREES)} trees.`,
        ephemeral: true
      });
    }

    const item = findItem(itemName);

    if (!item) {
      return interaction.reply({
        content:
          "Item not found. Please select a " +
          "supported item from the suggestions.",
        ephemeral: true
      });
    }

    // Prevent application did not respond.
    await interaction.deferReply();

    const result = calculateHarvest(
      amount,
      item
    );

    const thumbnail =
      await getItemThumbnail(item.name);

    const wikiURL =
      "https://growtopia.fandom.com/wiki/" +
      encodeURIComponent(
        item.name.replace(/ /g, "_")
      );

    // ==============================
    // HARVEST EMBED
    // ==============================

    const embed = new EmbedBuilder()
      .setColor("#2B2D31")
      .setTitle("Harvest Calculator")
      .setDescription(
        `Estimated rewards from harvesting ` +
        `**${format(amount)}** mature trees.\n\n` +
        `**Item:** [${item.name}](${wikiURL})\n` +
        `**Rarity:** ${item.rarity}\n` +
        `**Amount:** ${format(amount)} trees`
      )
      .addFields(
        {
          name: "Estimated Blocks",
          value: `**${format(result.blocks)}**`,
          inline: true
        },
        {
          name: `${EMOJIS.seed} Seeds`,
          value: `**${format(result.seeds)}**`,
          inline: true
        },
        {
          name: `${EMOJIS.gems} Gems`,
          value: `**${format(result.gems)}**`,
          inline: true
        },
        {
          name: `${EMOJIS.xp} Experience`,
          value: `**${format(result.xp)} XP**`,
          inline: true
        },
        {
          name: "Experience per Tree",
          value: `${result.xpPerTree} XP`,
          inline: true
        },
        {
          name: "Average Gems per Tree",
          value: `~${result.averageGems.toFixed(2)}`,
          inline: true
        }
      )
      .setFooter({
        text:
          "Estimated rewards • No equipment or event bonuses"
      });

    if (thumbnail) {
      embed.setThumbnail(thumbnail);
    }

    return await interaction.editReply({
      embeds: [embed]
    });

  } catch (error) {
    console.error("[HARVEST ERROR]", error);

    const message = {
      content:
        "Something went wrong while calculating " +
        "the harvest rewards.",
      embeds: []
    };

    if (interaction.deferred) {
      return interaction.editReply(message)
        .catch(() => {});
    }

    if (!interaction.replied) {
      return interaction.reply({
        ...message,
        ephemeral: true
      }).catch(() => {});
    }
  }
}

// ==============================
// EXPORTS
// ==============================

module.exports = {
  execute,
  autocomplete,
  calculateHarvest,
  getItemThumbnail
};
