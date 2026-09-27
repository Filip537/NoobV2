const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// Cooking simulator
const cooking = require("./cooking.js");

const LEVELS_PATH = path.join(__dirname, "../levels.json");

// ==========================================
// CONFIG
// ==========================================

const DASHBOARD_CHANNEL_ID = "1553581259064745985";
const COOKING_COST = 1000;


// ==========================================
// LEVELS.JSON
// ==========================================

function loadLevels() {
  try {
    if (!fs.existsSync(LEVELS_PATH)) {
      return {};
    }

    return JSON.parse(
      fs.readFileSync(LEVELS_PATH, "utf8")
    );
  } catch (err) {
    console.error(
      "Failed to load levels.json:",
      err
    );

    return {};
  }
}


function saveLevels(data) {
  try {
    fs.writeFileSync(
      LEVELS_PATH,
      JSON.stringify(data, null, 2)
    );
  } catch (err) {
    console.error(
      "Failed to save levels.json:",
      err
    );

    throw err;
  }
}


// ==========================================
// USER DATA
// ==========================================

function getUserData(levels, userId) {
  if (!levels[userId]) {
    levels[userId] = {
      wl: 0,
      level: 1,
      xp: 0,
      items: {},
      fishBackpack: [],
      professions: {}
    };
  }

  if (!levels[userId].items) {
    levels[userId].items = {};
  }

  if (!Array.isArray(levels[userId].fishBackpack)) {
    levels[userId].fishBackpack = [];
  }

  if (!levels[userId].professions) {
    levels[userId].professions = {};
  }

  return levels[userId];
}


// ==========================================
// PUBLIC DASHBOARD EMBED
// ==========================================
//
// IMPORTANT:
// This dashboard is NOT built from user data.
// Everyone sees exactly the same dashboard.
//

function buildRoleEmbed() {
  return new EmbedBuilder()
    .setColor(0xFEE75C)

    .setTitle(
      "<:bulletin:1447778065512923217> Build Your Role"
    )

    .setThumbnail(
      "https://media.discordapp.net/attachments/1522529403337183376/1553610092836954153/chocoride.png?ex=6ab9dfa6&is=6ab88e26&hm=68fd2cf1d879835600e1a7e0fe3100ed38a121f34c17af56421046aefd9e6dd4&=&format=webp&quality=lossless"
    )

    .setDescription(
      "Choose a profession to unlock and build your character.\n\n" +

      "**Cooking**\n" +
      "Learn recipes, use ingredients and cook different foods.\n\n" +

      `Cost: **${COOKING_COST.toLocaleString()} WL**\n\n` +

      "Click the button below to unlock or open Cooking."
    )

    .setFooter({
      text: "More professions will be added later."
    });
}


// ==========================================
// PUBLIC DASHBOARD BUTTONS
// ==========================================
//
// The public button NEVER changes.
//
// We check whether the person owns Cooking
// only after THEY click it.
//

function buildRoleButtons() {
  const cookingButton = new ButtonBuilder()
    .setCustomId("profession_cooking")
    .setLabel("Cooking")
    .setStyle(ButtonStyle.Primary);

  return new ActionRowBuilder()
    .addComponents(cookingButton);
}


// ==========================================
// SEND DASHBOARD
// ==========================================

async function sendDashboard(interaction) {
  try {

    // Find the exact dashboard channel
    const channel =
      interaction.client.channels.cache.get(
        DASHBOARD_CHANNEL_ID
      ) ||
      await interaction.client.channels.fetch(
        DASHBOARD_CHANNEL_ID
      ).catch(() => null);


    if (!channel) {
      await safeReply(interaction, {
        content:
          `Could not find dashboard channel <#${DASHBOARD_CHANNEL_ID}>.`,
        ephemeral: true
      });

      return;
    }


    if (!channel.isTextBased()) {
      await safeReply(interaction, {
        content:
          "The configured dashboard channel is not a text channel.",
        ephemeral: true
      });

      return;
    }


    // Send PUBLIC dashboard
    await channel.send({
      embeds: [
        buildRoleEmbed()
      ],

      components: [
        buildRoleButtons()
      ]
    });


    // Confirmation only visible to command user
    await safeReply(interaction, {
      content:
        `Build Your Role dashboard sent to <#${DASHBOARD_CHANNEL_ID}>.`,
      ephemeral: true
    });


  } catch (error) {

    console.error(
      "Failed to send Build Your Role dashboard:",
      error
    );


    await safeReply(interaction, {
      content:
        "Failed to send the Build Your Role dashboard.",
      ephemeral: true
    });
  }
}


// ==========================================
// SAFE REPLY
// ==========================================

async function safeReply(interaction, payload) {
  try {

    if (
      interaction.replied ||
      interaction.deferred
    ) {
      return await interaction.followUp(payload);
    }

    return await interaction.reply(payload);

  } catch (error) {

    console.error(
      "Failed to reply to interaction:",
      error
    );
  }
}


// ==========================================
// EXECUTE
// ==========================================

async function execute(interaction) {
  return sendDashboard(interaction);
}


// ==========================================
// BUTTON HANDLER
// ==========================================

async function handleButton(interaction) {

  if (!interaction.isButton()) {
    return false;
  }


  // New universal public button
  if (
    interaction.customId !==
    "profession_cooking"
  ) {
    return false;
  }


  const levels = loadLevels();

  const userData = getUserData(
    levels,
    interaction.user.id
  );


  // Save in case missing default fields
  levels[interaction.user.id] = userData;
  saveLevels(levels);


  // ========================================
  // USER ALREADY OWNS COOKING
  // ========================================

  if (
    userData.professions?.cooking?.unlocked === true
  ) {

    try {

      // Opens THEIR Cooking Simulator
      await cooking.open(interaction);

    } catch (error) {

      console.error(
        "Failed to open Cooking Simulator:",
        error
      );


      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await interaction.reply({
          content:
            "Failed to open the Cooking Simulator.",
          ephemeral: true
        }).catch(() => {});
      }

    }

    return true;
  }


  // ========================================
  // USER DOES NOT OWN COOKING
  // ========================================

  const currentWL =
    Number(userData.wl || 0);


  // ========================================
  // NOT ENOUGH WL
  // ========================================

  if (currentWL < COOKING_COST) {

    await interaction.reply({
      content:
        `🔒 **Cooking Profession Locked**\n\n` +
        `Cost: **${COOKING_COST.toLocaleString()} WL**\n` +
        `Your Balance: **${currentWL.toLocaleString()} WL**\n\n` +
        `You need **${(
          COOKING_COST - currentWL
        ).toLocaleString()} more WL** to unlock Cooking.`,
      ephemeral: true
    });

    return true;
  }


  // ========================================
  // UNLOCK COOKING
  // ========================================

  userData.wl =
    currentWL - COOKING_COST;


  userData.professions.cooking = {
    unlocked: true,
    level: 1,
    xp: 0,
    unlockedAt: Date.now()
  };


  levels[interaction.user.id] =
    userData;


  saveLevels(levels);


  // ========================================
  // PRIVATE SUCCESS MESSAGE
  // ========================================

  await interaction.reply({
    content:
      `🍳 **Cooking Profession Unlocked!**\n\n` +
      `**${COOKING_COST.toLocaleString()} WL** has been deducted.\n` +
      `Remaining Balance: **${userData.wl.toLocaleString()} WL**\n\n` +
      `Click **Cooking** on the dashboard again to enter the Cooking Simulator.`,
    ephemeral: true
  });


  return true;
}


// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  execute,
  sendDashboard,
  handleButton,
  buildRoleEmbed,
  buildRoleButtons
};