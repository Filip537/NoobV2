"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const ROOT = path.join(__dirname, "..");
const ASSETS = path.join(ROOT, "assets", "setplanner");
const ITEMS_PATH = path.join(ASSETS, "items.json");
const SPRITES_PATH = path.join(ASSETS, "sprites.png");
const SAVES_PATH = path.join(ASSETS, "saved-sets.json");

const SLOTS = [
  "Hat",
  "Hair",
  "Face",
  "Shirt",
  "Pants",
  "Feet",
  "Hand",
  "Back"
];

const sessions = new Map();

function loadItems() {
  const raw = JSON.parse(fs.readFileSync(ITEMS_PATH, "utf8"));

  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.items)
      ? raw.items
      : null;

  if (!list) {
    throw new Error(
      "items.json must contain an array or an object with an items array."
    );
  }

  return list
    .filter(item => item && typeof item.name === "string")
    .map((item, index) => ({
      ...item,
      plannerId: index
    }));
}

let items;

function getItems() {
  if (!items) items = loadItems();
  return items;
}

function readSaves() {
  if (!fs.existsSync(SAVES_PATH)) return {};

  try {
    return JSON.parse(fs.readFileSync(SAVES_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeSaves(data) {
  fs.mkdirSync(ASSETS, { recursive: true });

  const temp = `${SAVES_PATH}.tmp`;

  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, SAVES_PATH);
}

function newSession(userId) {
  return {
    userId,
    slot: "Hat",
    query: "",
    page: 0,
    equipped: {}
  };
}

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, newSession(userId));
  }

  return sessions.get(userId);
}

/*
 * Your current JSON has item names and icon positions.
 * It does not reliably identify every item's equipment slot.
 *
 * This function uses an explicit "type" or "slot" field IF
 * you add one to items.json later. Otherwise the item remains
 * uncategorised rather than being assigned an incorrect slot.
 */
function itemSlot(item) {
  const value = String(item.slot ?? item.type ?? "")
    .trim()
    .toLowerCase();

  const aliases = {
    hat: "Hat",
    head: "Hat",
    hair: "Hair",
    face: "Face",
    shirt: "Shirt",
    body: "Shirt",
    pants: "Pants",
    legs: "Pants",
    feet: "Feet",
    shoes: "Feet",
    hand: "Hand",
    back: "Back",
    wings: "Back"
  };

  return aliases[value] || null;
}

function matches(session) {
  const query = session.query.toLowerCase();

  return getItems().filter(item => {
    const nameMatches = item.name.toLowerCase().includes(query);

    /*
     * Search all items when no slot metadata is available.
     * The user chooses which slot to equip the selected item in.
     */
    const slot = itemSlot(item);
    const slotMatches = !slot || slot === session.slot;

    return nameMatches && slotMatches;
  });
}

function parseSpritePosition(item) {
  const match = String(item.position || "").match(
    /(-?\d+)px\s+(-?\d+)px/
  );

  if (!match) return null;

  return {
    x: Math.abs(Number(match[1])),
    y: Math.abs(Number(match[2]))
  };
}

async function iconBuffer(item, size = 64) {
  if (!fs.existsSync(SPRITES_PATH)) return null;

  const position = parseSpritePosition(item);
  if (!position) return null;

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
  } catch {
    return null;
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function labelSvg(text, x, y, size = 20) {
  return `
    <text
      x="${x}"
      y="${y}"
      fill="#ffffff"
      font-size="${size}"
      font-family="sans-serif"
    >${escapeXml(text)}</text>
  `;
}

/*
 * This renders an item-based outfit card.
 * It deliberately does NOT place inventory icons on a
 * Growtopian and pretend they are wearable graphics.
 */
async function renderOutfitCard(session) {
  const width = 800;
  const height = 620;

  const background = Buffer.from(`
    <svg width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="#151923"/>
      <rect x="24" y="24" width="752" height="572"
            rx="22" fill="#25364a"/>
      ${labelSvg("NOOBV2 SET PLANNER", 48, 67, 30)}
      ${labelSvg("Equipped items", 48, 105, 19)}
      ${labelSvg(
        "Character wearable preview: awaiting wearable artwork",
        48,
        574,
        16
      )}
    </svg>
  `);

  const overlays = [];
  const equippedEntries = SLOTS.map(slot => ({
    slot,
    item: session.equipped[slot]
  }));

  for (let i = 0; i < equippedEntries.length; i++) {
    const { slot, item } = equippedEntries[i];

    const column = i % 2;
    const row = Math.floor(i / 2);

    const x = 50 + column * 370;
    const y = 135 + row * 100;

    const text = Buffer.from(`
      <svg width="350" height="80">
        <rect width="350" height="80" rx="12"
              fill="#344b64"/>
        ${labelSvg(slot, 85, 29, 17)}
        ${labelSvg(
          item ? item.name.slice(0, 29) : "Nothing equipped",
          85,
          56,
          15
        )}
      </svg>
    `);

    overlays.push({
      input: text,
      left: x,
      top: y
    });

    if (item) {
      const icon = await iconBuffer(item, 56);

      if (icon) {
        overlays.push({
          input: icon,
          left: x + 12,
          top: y + 12
        });
      }
    }
  }

  return sharp(background)
    .composite(overlays)
    .png()
    .toBuffer();
}

function buildEmbed(session, results) {
  const start = session.page * 25;
  const pageItems = results.slice(start, start + 25);

  const equipped = SLOTS.map(slot => {
    const item = session.equipped[slot];
    return `**${slot}:** ${item ? item.name : "Empty"}`;
  }).join("\n");

  const resultText = pageItems.length
    ? pageItems
        .map((item, index) => {
          const slot = itemSlot(item);
          return (
            `**${start + index + 1}.** ${item.name}` +
            (slot ? ` · ${slot}` : "")
          );
        })
        .join("\n")
    : "No matching items.";

  return new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle("NoobV2 Set Planner")
    .setDescription(
      `**Selected slot:** ${session.slot}\n` +
      `**Search:** ${session.query || "All items"}\n\n` +
      equipped
    )
    .addFields({
      name: `Items · Page ${session.page + 1}`,
      value: resultText.slice(0, 1024)
    })
    .setFooter({
      text: `${results.length} matching items · Item icons are not wearable layers`
    });
}

function buildComponents(session, results) {
  const start = session.page * 25;
  const pageItems = results.slice(start, start + 25);

  const slotMenu = new StringSelectMenuBuilder()
    .setCustomId("setplanner:slot")
    .setPlaceholder(`Equipment slot: ${session.slot}`)
    .addOptions(
      SLOTS.map(slot => ({
        label: slot,
        value: slot,
        default: slot === session.slot
      }))
    );

  const rows = [
    new ActionRowBuilder().addComponents(slotMenu)
  ];

  if (pageItems.length) {
    const itemMenu = new StringSelectMenuBuilder()
      .setCustomId("setplanner:item")
      .setPlaceholder("Choose an item to equip")
      .addOptions(
        pageItems.map(item => ({
          label: item.name.slice(0, 100),
          value: String(item.plannerId),
          description:
            `Equip in ${session.slot}`.slice(0, 100)
        }))
      );

    rows.push(
      new ActionRowBuilder().addComponents(itemMenu)
    );
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("setplanner:search")
        .setLabel("Search")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("setplanner:remove")
        .setLabel("Remove item")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("setplanner:save")
        .setLabel("Save set")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("setplanner:load")
        .setLabel("Load set")
        .setStyle(ButtonStyle.Secondary)
    )
  );

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("setplanner:previous")
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(session.page === 0),

      new ButtonBuilder()
        .setCustomId("setplanner:next")
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(start + 25 >= results.length),

      new ButtonBuilder()
        .setCustomId("setplanner:reset")
        .setLabel("Reset")
        .setStyle(ButtonStyle.Danger)
    )
  );

  return rows;
}

async function panelPayload(session) {
  const results = matches(session);
  const maxPage = Math.max(0, Math.ceil(results.length / 25) - 1);

  session.page = Math.min(session.page, maxPage);

  const image = await renderOutfitCard(session);

  return {
    embeds: [buildEmbed(session, results)],
    components: buildComponents(session, results),
    files: [
      new AttachmentBuilder(image, {
        name: "setplanner.png"
      })
    ]
  };
}

async function openPlanner(interaction) {
  const session = getSession(interaction.user.id);

  await interaction.deferReply();

  return interaction.editReply(
    await panelPayload(session)
  );
}

async function updatePanel(interaction, session) {
  await interaction.deferUpdate();

  return interaction.editReply(
    await panelPayload(session)
  );
}

async function handlePlannerInteraction(interaction) {
  if (
    !interaction.isButton() &&
    !interaction.isStringSelectMenu() &&
    !interaction.isModalSubmit()
  ) {
    return false;
  }

  if (!interaction.customId.startsWith("setplanner:")) {
    return false;
  }

  const session = getSession(interaction.user.id);
  const action = interaction.customId.split(":")[1];

  try {
    if (interaction.isModalSubmit()) {
      if (action === "search-submit") {
        session.query =
          interaction.fields.getTextInputValue("query").trim();

        session.page = 0;
        return updatePanel(interaction, session);
      }

      if (action === "save-submit") {
        const name = interaction.fields
          .getTextInputValue("setname")
          .trim()
          .slice(0, 40);

        const saves = readSaves();

        saves[interaction.user.id] ||= {};
        saves[interaction.user.id][name] =
          Object.fromEntries(
            Object.entries(session.equipped).map(
              ([slot, item]) => [slot, item.plannerId]
            )
          );

        writeSaves(saves);

        return interaction.reply({
          content: `Saved your set as **${name}**.`,
          ephemeral: true
        });
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (action === "slot") {
        session.slot = interaction.values[0];
        session.page = 0;

        return updatePanel(interaction, session);
      }

      if (action === "item") {
        const id = Number(interaction.values[0]);
        const item = getItems().find(
          entry => entry.plannerId === id
        );

        if (!item) {
          return interaction.reply({
            content: "That item could not be found.",
            ephemeral: true
          });
        }

        const actualSlot = itemSlot(item);

        if (actualSlot && actualSlot !== session.slot) {
          return interaction.reply({
            content:
              `${item.name} belongs to ${actualSlot}, ` +
              `not ${session.slot}.`,
            ephemeral: true
          });
        }

        session.equipped[session.slot] = item;

        return updatePanel(interaction, session);
      }

      if (action === "load-select") {
        const name = interaction.values[0];
        const saves = readSaves();
        const saved = saves[interaction.user.id]?.[name];

        if (!saved) {
          return interaction.reply({
            content: "That saved set no longer exists.",
            ephemeral: true
          });
        }

        const allItems = getItems();
        session.equipped = {};

        for (const [slot, id] of Object.entries(saved)) {
          if (!SLOTS.includes(slot)) continue;

          const item = allItems.find(
            entry => entry.plannerId === id
          );

          if (item) session.equipped[slot] = item;
        }

        return updatePanel(interaction, session);
      }
    }

    if (interaction.isButton()) {
      if (action === "search") {
        const input = new TextInputBuilder()
          .setCustomId("query")
          .setLabel("Item name")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(80)
          .setValue(session.query);

        const modal = new ModalBuilder()
          .setCustomId("setplanner:search-submit")
          .setTitle("Search Growtopia items")
          .addComponents(
            new ActionRowBuilder().addComponents(input)
          );

        return interaction.showModal(modal);
      }

      if (action === "save") {
        const input = new TextInputBuilder()
          .setCustomId("setname")
          .setLabel("Set name")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(40);

        const modal = new ModalBuilder()
          .setCustomId("setplanner:save-submit")
          .setTitle("Save your outfit")
          .addComponents(
            new ActionRowBuilder().addComponents(input)
          );

        return interaction.showModal(modal);
      }

      if (action === "load") {
        const saves = readSaves();
        const names = Object.keys(
          saves[interaction.user.id] || {}
        ).slice(0, 25);

        if (!names.length) {
          return interaction.reply({
            content: "You haven't saved any sets yet.",
            ephemeral: true
          });
        }

        const menu = new StringSelectMenuBuilder()
          .setCustomId("setplanner:load-select")
          .setPlaceholder("Choose a saved set")
          .addOptions(
            names.map(name => ({
              label: name,
              value: name
            }))
          );

        return interaction.reply({
          content: "Choose a set to load:",
          components: [
            new ActionRowBuilder().addComponents(menu)
          ],
          ephemeral: true
        });
      }

      if (action === "remove") {
        delete session.equipped[session.slot];
      }

      if (action === "previous") {
        session.page = Math.max(0, session.page - 1);
      }

      if (action === "next") {
        session.page++;
      }

      if (action === "reset") {
        sessions.set(
          interaction.user.id,
          newSession(interaction.user.id)
        );

        return updatePanel(
          interaction,
          getSession(interaction.user.id)
        );
      }

      return updatePanel(interaction, session);
    }

    return true;
  } catch (error) {
    console.error("Set Planner error:", error);

    const message = {
      content: "Something went wrong with Set Planner.",
      ephemeral: true
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(message).catch(() => {});
    } else {
      await interaction.reply(message).catch(() => {});
    }

    return true;
  }
}

module.exports = {
  openPlanner,
  handlePlannerInteraction
};