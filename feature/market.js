
const fs = require("fs");
const path = require("path");

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  PermissionFlagsBits
} = require("discord.js");

// ==========================================
// NOOBV2 MARKETPLACE SETTINGS
// ==========================================

const MARKET_CHANNEL = "1559717417859547317";
const MARKET_FILE = path.join(__dirname, "market-data.json");

const MARKET_COMMANDS = [
  "marketlist",
  "marketsearch",
  "mymarket",
  "editmarket",
  "marketfilter",
  "marketprofile",
  "removemarket",
  "sendmarketpanel"
];

const MAX_LISTINGS_PER_USER = 20;
const PAGE_SIZE = 5;

// ==========================================
// DATABASE
// ==========================================

function loadMarket() {
  if (!fs.existsSync(MARKET_FILE)) {
    fs.writeFileSync(MARKET_FILE, "[]");
    return [];
  }

  const data = JSON.parse(
    fs.readFileSync(MARKET_FILE, "utf8")
  );

  if (!Array.isArray(data)) {
    throw new Error("Invalid marketplace database");
  }

  return data;
}

function saveMarket(data) {
  const temporary = MARKET_FILE + ".tmp";

  fs.writeFileSync(
    temporary,
    JSON.stringify(data, null, 2)
  );

  fs.renameSync(temporary, MARKET_FILE);
}

function createMarketID() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 7)
  ).toUpperCase();
}

// ==========================================
// HELPERS
// ==========================================

function clean(value, max = 80) {
  return String(value || "")
    .trim()
    .slice(0, max)
    .replace(/@/g, "＠")
    .replace(/[`*_~|]/g, "");
}

function formatPrice(price) {
  return `${Number(price).toLocaleString()} WL`;
}

function parsePrice(value) {
  const text = String(value || "").trim();

  if (!/^\d+$/.test(text)) return null;

  const price = Number(text);

  if (!Number.isSafeInteger(price) || price < 1) {
    return null;
  }

  return price;
}

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(
    PermissionFlagsBits.Administrator
  ) || false;
}

async function replyPrivate(interaction, content) {
  const payload = {
    content,
    flags: MessageFlags.Ephemeral
  };

  if (interaction.deferred || interaction.replied) {
    return interaction.followUp(payload);
  }

  return interaction.reply(payload);
}

// ==========================================
// MARKETPLACE PANEL
// ==========================================

function buildMarketPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("🛒 NoobV2 Marketplace")
    .setDescription(
      "**List Your Growtopia Items for Sale!**\n\n" +

      "Welcome to the NoobV2 Marketplace! " +
      "Buy, sell, and discover items from other Growtopia players.\n\n" +

      "**📦 How to Add Your Item**\n" +
      "1. Click **Add Market Item** below.\n" +
      "2. Enter your item name, price, and world.\n" +
      "3. Submit your listing.\n" +
      "4. Your item will automatically be saved to our database.\n\n" +

      "**📝 Listing Format**\n" +
      "`Item Name | Price | World`\n\n" +

      "**Example:**\n" +
      "`Golden Angel Wings | 250 | BUYWINGS`\n\n" +

      "**📋 Marketplace Commands**\n" +
      "`/marketlist` — Browse available items\n" +
      "`/marketsearch` — Search for an item\n" +
      "`/mymarket` — Manage your listings\n" +
      "`/editmarket` — Update your prices\n" +
      "`/marketfilter` — Search within your budget\n" +
      "`/marketprofile` — View seller profiles\n" +
      "`/removemarket` — Remove your listing\n\n" +

      "**⚠️ Important**\n" +
      "• Maximum 20 active listings per user.\n" +
      "• Only list items you actually own.\n" +
      "• Remove listings after selling your items.\n" +
      "• Contact sellers directly to arrange trades.\n" +
      "• NoobV2 does not guarantee trades."
    )
    .setFooter({
      text: "NoobV2 Marketplace • Community Trading"
    });

  const buttons = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId("market_add")
        .setLabel("Add Market Item")
        .setEmoji("🛒")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("market_browse")
        .setLabel("Browse Market")
        .setEmoji("🔎")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("market_mine")
        .setLabel("My Listings")
        .setEmoji("📦")
        .setStyle(ButtonStyle.Secondary)
    );

  return {
    embeds: [embed],
    components: [buttons]
  };
}

// ==========================================
// SEND / REFRESH MARKET PANEL
// ==========================================

async function sendMarketPanel(client) {
  const channel = await client.channels.fetch(
    MARKET_CHANNEL
  );

  if (!channel || !channel.isTextBased()) {
    throw new Error("Marketplace channel not found");
  }

  return channel.send(buildMarketPanel());
}

// ==========================================
// ADD MARKET ITEM MODAL
// ==========================================

function buildMarketModal() {
  const modal = new ModalBuilder()
    .setCustomId("market_submit")
    .setTitle("Add Your Market Item");

  const item = new TextInputBuilder()
    .setCustomId("market_item")
    .setLabel("Item Name")
    .setPlaceholder("Golden Angel Wings")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(80)
    .setRequired(true);

  const price = new TextInputBuilder()
    .setCustomId("market_price")
    .setLabel("Price in World Locks")
    .setPlaceholder("250")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(15)
    .setRequired(true);

  const world = new TextInputBuilder()
    .setCustomId("market_world")
    .setLabel("World Name (Optional)")
    .setPlaceholder("BUYWINGS")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(24)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(item),
    new ActionRowBuilder().addComponents(price),
    new ActionRowBuilder().addComponents(world)
  );

  return modal;
}

// ==========================================
// ADD LISTING
// ==========================================

async function addListing(interaction) {
  const item = clean(
    interaction.fields.getTextInputValue("market_item")
  );

  const price = parsePrice(
    interaction.fields.getTextInputValue("market_price")
  );

  const world = clean(
    interaction.fields.getTextInputValue("market_world"),
    24
  ).toUpperCase();

  if (!item || price === null) {
    return replyPrivate(
      interaction,
      "❌ Invalid item or price. Enter a valid item name and a positive whole-number price."
    );
  }

  if (world && !/^[A-Z0-9]+$/.test(world)) {
    return replyPrivate(
      interaction,
      "❌ World names must contain only letters and numbers."
    );
  }

  const data = loadMarket();

  const mine = data.filter(
    x => x.sellerId === interaction.user.id
  );

  if (mine.length >= MAX_LISTINGS_PER_USER) {
    return replyPrivate(
      interaction,
      "❌ You have reached the maximum of 20 listings. Remove an old listing first."
    );
  }

  const duplicate = mine.find(
    x =>
      x.item.toLowerCase() === item.toLowerCase() &&
      x.world === world
  );

  if (duplicate) {
    return replyPrivate(
      interaction,
      "❌ You already listed this item in the same world. Use `/editmarket` to update its price."
    );
  }

  const listing = {
    id: createMarketID(),
    sellerId: interaction.user.id,
    item,
    price,
    world,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  data.push(listing);
  saveMarket(data);

  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle("✅ Marketplace Listing Created")
    .addFields(
      {
        name: "📦 Item",
        value: listing.item,
        inline: true
      },
      {
        name: "💰 Price",
        value: formatPrice(listing.price),
        inline: true
      },
      {
        name: "🌎 World",
        value: listing.world || "Not specified",
        inline: true
      },
      {
        name: "👤 Seller",
        value: `<@${listing.sellerId}>`,
        inline: true
      },
      {
        name: "🆔 Listing ID",
        value: `\`${listing.id}\``,
        inline: true
      }
    )
    .setDescription(
      "Your item has been saved and is now searchable by other members."
    )
    .setTimestamp();

  return interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral
  });
}

// ==========================================
// LISTING DISPLAY
// ==========================================

function listingText(listing) {
  return (
    `**📦 ${listing.item}**\n` +
    `💰 Price: **${formatPrice(listing.price)}**\n` +
    `🌎 World: ${listing.world || "Not specified"}\n` +
    `👤 Seller: <@${listing.sellerId}>\n` +
    `🆔 ID: \`${listing.id}\`\n` +
    `🕒 Listed: <t:${Math.floor(listing.createdAt / 1000)}:R>`
  );
}

function buildMarketList(
  listings,
  title = "🛒 Marketplace Listings",
  page = 1
) {
  const totalPages = Math.max(
    1,
    Math.ceil(listings.length / PAGE_SIZE)
  );

  const currentPage = Math.min(
    Math.max(page, 1),
    totalPages
  );

  const start = (currentPage - 1) * PAGE_SIZE;

  const selected = listings.slice(
    start,
    start + PAGE_SIZE
  );

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(title)
    .setDescription(
      selected.length
        ? selected.map(listingText).join("\n\n━━━━━━━━━━━━━━\n\n")
        : "No marketplace listings found."
    )
    .setFooter({
      text:
        `Page ${currentPage}/${totalPages} • ` +
        `${listings.length} listings`
    });

  return embed;
}

// ==========================================
// /marketlist
// ==========================================

async function marketList(interaction) {
  const data = loadMarket()
    .sort((a, b) => b.createdAt - a.createdAt);

  const page = interaction.options?.getInteger("page") || 1;

  return interaction.reply({
    embeds: [
      buildMarketList(
        data,
        "🛒 Available Marketplace Items",
        page
      )
    ]
  });
}

// ==========================================
// /marketsearch
// ==========================================

async function marketSearch(interaction) {
  const query = interaction.options
    .getString("item")
    .trim()
    .toLowerCase();

  const page = interaction.options.getInteger("page") || 1;

  const results = loadMarket()
    .filter(x => x.item.toLowerCase().includes(query))
    .sort((a, b) => a.price - b.price);

  return interaction.reply({
    embeds: [
      buildMarketList(
        results,
        `🔎 Search Results: ${clean(query)}`,
        page
      )
    ]
  });
}

// ==========================================
// /mymarket
// ==========================================

async function myMarket(interaction) {
  const page = interaction.options?.getInteger("page") || 1;

  const mine = loadMarket()
    .filter(x => x.sellerId === interaction.user.id)
    .sort((a, b) => b.createdAt - a.createdAt);

  return interaction.reply({
    embeds: [
      buildMarketList(
        mine,
        "📦 My Marketplace Listings",
        page
      )
    ],
    flags: MessageFlags.Ephemeral
  });
}

// ==========================================
// /editmarket
// ==========================================

async function editMarket(interaction) {
  const id = interaction.options.getString("id")
    .trim()
    .toUpperCase();

  const price = interaction.options.getInteger("price");

  const data = loadMarket();

  const listing = data.find(x => x.id === id);

  if (!listing) {
    return replyPrivate(
      interaction,
      "❌ Marketplace listing not found."
    );
  }

  if (
    listing.sellerId !== interaction.user.id &&
    !isAdmin(interaction)
  ) {
    return replyPrivate(
      interaction,
      "❌ You can only edit your own listings."
    );
  }

  if (!Number.isSafeInteger(price) || price < 1) {
    return replyPrivate(
      interaction,
      "❌ Please enter a valid price."
    );
  }

  const oldPrice = listing.price;

  listing.price = price;
  listing.updatedAt = Date.now();

  saveMarket(data);

  return replyPrivate(
    interaction,
    `✅ **Marketplace Price Updated!**\n\n` +
    `**Item:** ${listing.item}\n` +
    `**Old Price:** ${formatPrice(oldPrice)}\n` +
    `**New Price:** ${formatPrice(price)}`
  );
}

// ==========================================
// /marketfilter
// ==========================================

async function marketFilter(interaction) {
  const min = interaction.options.getInteger("minprice") || 0;
  const max = interaction.options.getInteger("maxprice");
  const page = interaction.options.getInteger("page") || 1;

  if (min > max) {
    return replyPrivate(
      interaction,
      "❌ Minimum price cannot exceed maximum price."
    );
  }

  const results = loadMarket()
    .filter(x => x.price >= min && x.price <= max)
    .sort((a, b) => a.price - b.price);

  return interaction.reply({
    embeds: [
      buildMarketList(
        results,
        `💰 Marketplace Budget: ${min}–${max} WL`,
        page
      )
    ]
  });
}

// ==========================================
// /marketprofile
// ==========================================

async function marketProfile(interaction) {
  const seller =
    interaction.options?.getUser("seller") ||
    interaction.user;

  const page = interaction.options?.getInteger("page") || 1;

  const listings = loadMarket()
    .filter(x => x.sellerId === seller.id)
    .sort((a, b) => b.createdAt - a.createdAt);

  const embed = buildMarketList(
    listings,
    `👤 ${clean(seller.username)}'s Marketplace`,
    page
  );

  embed.setThumbnail(seller.displayAvatarURL());

  return interaction.reply({
    embeds: [embed]
  });
}

// ==========================================
// /removemarket
// ==========================================

async function removeMarket(interaction) {
  const id = interaction.options
    .getString("id")
    .trim()
    .toUpperCase();

  const data = loadMarket();

  const index = data.findIndex(x => x.id === id);

  if (index === -1) {
    return replyPrivate(
      interaction,
      "❌ Listing not found."
    );
  }

  const listing = data[index];

  if (
    listing.sellerId !== interaction.user.id &&
    !isAdmin(interaction)
  ) {
    return replyPrivate(
      interaction,
      "❌ You cannot remove another seller's listing."
    );
  }

  data.splice(index, 1);
  saveMarket(data);

  return replyPrivate(
    interaction,
    `✅ Removed **${listing.item}** from the marketplace.`
  );
}

// ==========================================
// MARKETPLACE INTERACTIONS
// ==========================================

async function handleInteraction(interaction) {
  // ----------------------------------------
  // BUTTONS
  // ----------------------------------------

  if (interaction.isButton()) {
    if (interaction.customId === "market_add") {
      if (interaction.channelId !== MARKET_CHANNEL) {
        return replyPrivate(
          interaction,
          `Please use the marketplace panel in <#${MARKET_CHANNEL}>.`
        );
      }

      return interaction.showModal(buildMarketModal());
    }

    if (interaction.customId === "market_browse") {
      const data = loadMarket()
        .sort((a, b) => b.createdAt - a.createdAt);

      return interaction.reply({
        embeds: [
          buildMarketList(
            data,
            "🛒 Marketplace Listings"
          )
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    if (interaction.customId === "market_mine") {
      const mine = loadMarket()
        .filter(x => x.sellerId === interaction.user.id);

      return interaction.reply({
        embeds: [
          buildMarketList(
            mine,
            "📦 My Marketplace Listings"
          )
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    return false;
  }

  // ----------------------------------------
  // MODAL SUBMISSION
  // ----------------------------------------

  if (interaction.isModalSubmit()) {
    if (interaction.customId === "market_submit") {
      return addListing(interaction);
    }

    return false;
  }

  // ----------------------------------------
  // SLASH COMMANDS
  // ----------------------------------------

  if (!interaction.isChatInputCommand()) {
    return false;
  }

  switch (interaction.commandName) {
    case "sendmarketpanel":
      if (!isAdmin(interaction)) {
        return replyPrivate(
          interaction,
          "❌ Administrator permission required."
        );
      }

      await interaction.deferReply({
        flags: MessageFlags.Ephemeral
      });

      await sendMarketPanel(interaction.client);

      return interaction.editReply(
        `✅ Marketplace panel sent to <#${MARKET_CHANNEL}>.`
      );

    case "marketlist":
      return marketList(interaction);

    case "marketsearch":
      return marketSearch(interaction);

    case "mymarket":
      return myMarket(interaction);

    case "editmarket":
      return editMarket(interaction);

    case "marketfilter":
      return marketFilter(interaction);

    case "marketprofile":
      return marketProfile(interaction);

    case "removemarket":
      return removeMarket(interaction);

    default:
      return false;
  }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  MARKET_CHANNEL,
  MARKET_COMMANDS,
  sendMarketPanel,
  handleInteraction,
  loadMarket,
  saveMarket
};
