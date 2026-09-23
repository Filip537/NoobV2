"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const {
  AttachmentBuilder,
  EmbedBuilder
} = require("discord.js");

const ROOT = path.join(__dirname, "..");
const ASSETS = path.join(ROOT, "assets", "setplanner");

const ITEMS_PATH = path.join(ASSETS, "items.json");
const SPRITES_PATH = path.join(ASSETS, "sprites.png");
const SETS_PATH = path.join(ASSETS, "user-sets.json");

// Discord option name -> display name
const SLOT_CONFIG = {
  hat: "Hat",
  hair: "Hair",
  face: "Face",
  shirt: "Shirt",
  pants: "Pants",
  feet: "Feet",
  hand: "Hand",
  wings: "Wings",
  back: "Back"
};

let itemsCache = null;

/* =========================================================
   LOAD ITEMS
========================================================= */

function getItems() {
  if (itemsCache) return itemsCache;

  const raw = JSON.parse(
    fs.readFileSync(ITEMS_PATH, "utf8")
  );

  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.items)
      ? raw.items
      : [];

  itemsCache = list
    .filter(item => item && typeof item.name === "string")
    .map((item, index) => ({
      ...item,
      plannerId: index
    }));

  console.log(
    `[SetPlanner] Loaded ${itemsCache.length} items.`
  );

  return itemsCache;
}

/* =========================================================
   USER SET STORAGE
========================================================= */

function loadSets() {
  if (!fs.existsSync(SETS_PATH)) {
    return {};
  }

  try {
    return JSON.parse(
      fs.readFileSync(SETS_PATH, "utf8")
    );
  } catch (error) {
    console.error(
      "[SetPlanner] Failed to load user sets:",
      error
    );

    return {};
  }
}

function saveSets(sets) {
  fs.mkdirSync(ASSETS, {
    recursive: true
  });

  const temp = `${SETS_PATH}.tmp`;

  fs.writeFileSync(
    temp,
    JSON.stringify(sets, null, 2)
  );

  fs.renameSync(temp, SETS_PATH);
}

function getUserSet(userId) {
  const sets = loadSets();

  if (!sets[userId]) {
    sets[userId] = {};
  }

  return {
    sets,
    outfit: sets[userId]
  };
}

/* =========================================================
   ITEM SEARCH
========================================================= */

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findItem(name) {
  if (!name) return null;

  const items = getItems();

  const exact = items.find(
    item =>
      item.name.toLowerCase() ===
      name.toLowerCase()
  );

  if (exact) return exact;

  const normalizedName = normalize(name);

  const normalizedExact = items.find(
    item =>
      normalize(item.name) === normalizedName
  );

  if (normalizedExact) return normalizedExact;

  return items.find(
    item =>
      item.name
        .toLowerCase()
        .includes(name.toLowerCase())
  ) || null;
}

/* =========================================================
   SPRITE ICON
========================================================= */

function getSpritePosition(item) {
  const match = String(
    item.position || ""
  ).match(
    /(-?\d+)px\s+(-?\d+)px/
  );

  if (!match) {
    return null;
  }

  return {
    x: Math.abs(Number(match[1])),
    y: Math.abs(Number(match[2]))
  };
}

async function getItemIcon(
  item,
  size = 72
) {
  if (!item) return null;

  if (!fs.existsSync(SPRITES_PATH)) {
    return null;
  }

  const position =
    getSpritePosition(item);

  if (!position) {
    return null;
  }

  try {
    return await sharp(SPRITES_PATH)
      .extract({
        left: position.x,
        top: position.y,
        width: 32,
        height: 32
      })
      .resize(size, size, {
        kernel: sharp.kernel.nearest
      })
      .png()
      .toBuffer();

  } catch (error) {
    console.error(
      `[SetPlanner] Sprite error for ${item.name}:`,
      error.message
    );

    return null;
  }
}

/* =========================================================
   XML
========================================================= */

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* =========================================================
   CURRENT PREVIEW

   IMPORTANT:
   This currently displays the selected item icons.

   Later this function can be replaced with the actual
   Growtopian wearable-layer renderer without changing
   /setplanner.
========================================================= */

async function renderSet(outfit) {
  const width = 700;
  const height = 600;

  const background = Buffer.from(`
    <svg width="${width}" height="${height}">
      <rect
        width="700"
        height="600"
        fill="#171a21"
      />

      <rect
        x="20"
        y="20"
        width="660"
        height="560"
        rx="22"
        fill="#242b38"
      />

      <text
        x="350"
        y="65"
        text-anchor="middle"
        fill="white"
        font-size="30"
        font-family="sans-serif"
        font-weight="bold"
      >
        NOOBV2 SET PLANNER
      </text>

      <text
        x="350"
        y="100"
        text-anchor="middle"
        fill="#b9c1ce"
        font-size="16"
        font-family="sans-serif"
      >
        Current outfit
      </text>
    </svg>
  `);

  const composites = [];

  const slots =
    Object.entries(SLOT_CONFIG);

  for (
    let index = 0;
    index < slots.length;
    index++
  ) {
    const [
      optionName,
      displayName
    ] = slots[index];

    const item =
      outfit[optionName];

    const column =
      index % 3;

    const row =
      Math.floor(index / 3);

    const x =
      60 + column * 205;

    const y =
      145 + row * 140;

    const card = Buffer.from(`
      <svg
        width="175"
        height="115"
      >
        <rect
          width="175"
          height="115"
          rx="14"
          fill="#303949"
        />

        <text
          x="87"
          y="90"
          text-anchor="middle"
          fill="#ffffff"
          font-size="14"
          font-family="sans-serif"
        >
          ${escapeXml(displayName)}
        </text>

        <text
          x="87"
          y="108"
          text-anchor="middle"
          fill="#aeb8c7"
          font-size="11"
          font-family="sans-serif"
        >
          ${
            item
              ? escapeXml(
                  item.name.slice(0, 23)
                )
              : "Empty"
          }
        </text>
      </svg>
    `);

    composites.push({
      input: card,
      left: x,
      top: y
    });

    if (item) {
      const icon =
        await getItemIcon(
          item,
          64
        );

      if (icon) {
        composites.push({
          input: icon,
          left: x + 55,
          top: y + 10
        });
      }
    }
  }

  return sharp(background)
    .composite(composites)
    .png()
    .toBuffer();
}

/* =========================================================
   EMBED
========================================================= */

function createEmbed(
  user,
  outfit
) {
  const equipped = [];

  for (
    const [
      optionName,
      displayName
    ] of Object.entries(
      SLOT_CONFIG
    )
  ) {
    const item =
      outfit[optionName];

    if (item) {
      equipped.push(
        `**${displayName}:** ${item.name}`
      );
    }
  }

  return new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle(
      `${user.username}'s Set`
    )
    .setDescription(
      equipped.length
        ? equipped.join("\n")
        : "No items equipped."
    )
    .setImage(
      "attachment://set.png"
    )
    .setFooter({
      text:
        "Use /setplanner again to change individual items."
    });
}

/* =========================================================
   /SETPLANNER
========================================================= */

async function handleSetPlanner(
  interaction
) {
  await interaction.deferReply();

  try {
    const {
      sets,
      outfit
    } = getUserSet(
      interaction.user.id
    );

    const notFound = [];

    let changed = false;

    for (
      const optionName of Object.keys(
        SLOT_CONFIG
      )
    ) {
      const value =
        interaction.options.getString(
          optionName
        );

      if (!value) {
        continue;
      }

      const item =
        findItem(value);

      if (!item) {
        notFound.push(value);
        continue;
      }

      outfit[optionName] =
        item;

      changed = true;
    }

    if (changed) {
      sets[
        interaction.user.id
      ] = outfit;

      saveSets(sets);
    }

    const image =
      await renderSet(
        outfit
      );

    const embed =
      createEmbed(
        interaction.user,
        outfit
      );

    let content;

    if (notFound.length) {
      content =
        "Could not find: " +
        notFound
          .map(
            name =>
              `**${name}**`
          )
          .join(", ");
    }

    return interaction.editReply({
      content,
      embeds: [embed],
      files: [
        new AttachmentBuilder(
          image,
          {
            name: "set.png"
          }
        )
      ]
    });

  } catch (error) {
    console.error(
      "[SetPlanner] Error:",
      error
    );

    return interaction.editReply({
      content:
        "Set Planner failed to generate your set."
    });
  }
}

/* =========================================================
   /CLEARSET
========================================================= */

async function handleClearSet(
  interaction
) {
  try {
    const sets =
      loadSets();

    delete sets[
      interaction.user.id
    ];

    saveSets(sets);

    return interaction.reply({
      content:
        "Your entire set has been cleared.",
      ephemeral: true
    });

  } catch (error) {
    console.error(
      "[SetPlanner] Clear error:",
      error
    );

    return interaction.reply({
      content:
        "Failed to clear your set.",
      ephemeral: true
    });
  }
}

/* =========================================================
   AUTOCOMPLETE
========================================================= */

async function handleAutocomplete(
  interaction
) {
  const focused =
    interaction.options.getFocused(
      true
    );

  if (
    !Object.prototype.hasOwnProperty.call(
      SLOT_CONFIG,
      focused.name
    )
  ) {
    return interaction.respond([]);
  }

  const query =
    focused.value
      .toLowerCase()
      .trim();

  const results =
    getItems()
      .filter(item =>
        item.name
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 25);

  return interaction.respond(
    results.map(item => ({
      name:
        item.name.slice(0, 100),

      value:
        item.name.slice(0, 100)
    }))
  );
}

module.exports = {
  handleSetPlanner,
  handleClearSet,
  handleAutocomplete
};