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
  fs.writeFileSync(
    LEVELS_PATH,
    JSON.stringify(data, null, 2)
  );
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
      fishBackpack: []
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
// DASHBOARD EMBED
// ==========================================

function buildRoleEmbed(userData) {
  const cookingUnlocked =
    userData.professions?.cooking?.unlocked === true;

  const cookingStatus =
    cookingUnlocked
      ? "Unlocked"
      : "Locked";

  const cookingLevel =
    userData.professions?.cooking?.level || 1;

  const cookingXP =
    userData.professions?.cooking?.xp || 0;

  let cookingInfo =
    `Cost: **${COOKING_COST.toLocaleString()} WL**\n` +
    `Status: **${cookingStatus}**`;

  if (cookingUnlocked) {
    cookingInfo +=
      `\nCooking Level: **${cookingLevel}**` +
      `\nCooking XP: **${cookingXP}**`;
  }

return new EmbedBuilder()
  .setColor(
    cookingUnlocked
      ? 0x57F287
      : 0xFEE75C
  )
  .setTitle("<:bulletin:1447778065512923217> Build Your Role")
  .setThumbnail(
    "https://media.discordapp.net/attachments/1522529403337183376/1553610092836954153/chocoride.png?ex=6ab9dfa6&is=6ab88e26&hm=68fd2cf1d879835600e1a7e0fe3100ed38a121f34c17af56421046aefd9e6dd4&=&format=webp&quality=lossless"
  )
  .setDescription(
    "Choose a profession to unlock and build your character.\n\n" +

    "**Cooking**\n" +
    "Learn recipes, use ingredients and cook different foods.\n\n" +

    cookingInfo +

    `\n\nYour Balance: **${(userData.wl || 0).toLocaleString()} WL**`
  )
  .setFooter({
    text: "More professions will be added later."
  });
}

function buildRoleButtons(userData) {
  const cookingUnlocked =
    userData.professions?.cooking?.unlocked === true;

  const button = new ButtonBuilder()
    .setCustomId(
      cookingUnlocked
        ? "profession_open_cooking"
        : "profession_unlock_cooking"
    )
    .setLabel(
      cookingUnlocked
        ? "Open Cooking"
        : "Unlock Cooking"
    )
    .setStyle(
      cookingUnlocked
        ? ButtonStyle.Success
        : ButtonStyle.Primary
    );

  return new ActionRowBuilder()
    .addComponents(button);
}


// ==========================================
// SEND DASHBOARD
// ==========================================

async function sendDashboard(interaction) {
  const levels = loadLevels();

  const userData = getUserData(
    levels,
    interaction.user.id
  );

  saveLevels(levels);

  const payload = {
    embeds: [
      buildRoleEmbed(userData)
    ],

    components: [
      buildRoleButtons(userData)
    ]
  };

  if (
    interaction.replied ||
    interaction.deferred
  ) {
    return interaction.followUp(payload);
  }

  return interaction.reply(payload);
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

  if (
    interaction.customId !==
      "profession_unlock_cooking" &&
    interaction.customId !==
      "profession_open_cooking"
  ) {
    return false;
  }

  const levels = loadLevels();

  const userData = getUserData(
    levels,
    interaction.user.id
  );


  // ========================================
  // OPEN COOKING
  // ========================================

  if (
    interaction.customId ===
    "profession_open_cooking"
  ) {
    if (
      !userData.professions?.cooking?.unlocked
    ) {
      await interaction.reply({
        content:
          "You haven't unlocked Cooking yet.",
        ephemeral: true
      });

      return true;
    }

    try {
      await cooking.openCooking(interaction);
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
  // ALREADY UNLOCKED
  // ========================================

  if (
    userData.professions?.cooking?.unlocked
  ) {
    await interaction.reply({
      content:
        "You already unlocked Cooking.",
      ephemeral: true
    });

    return true;
  }


  // ========================================
  // CHECK WL
  // ========================================

  const currentWL =
    Number(userData.wl || 0);

  if (currentWL < COOKING_COST) {
    await interaction.reply({
      content:
        `You need **${COOKING_COST.toLocaleString()} WL** to unlock Cooking.\n` +
        `You currently have **${currentWL.toLocaleString()} WL**.`,
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
  // UPDATE DASHBOARD
  // ========================================

  await interaction.update({
    embeds: [
      buildRoleEmbed(userData)
    ],

    components: [
      buildRoleButtons(userData)
    ]
  });


  // ========================================
  // SUCCESS MESSAGE
  // ========================================

  await interaction.followUp({
    content:
      "Cooking profession unlocked! " +
      "**1,000 WL** has been deducted from your balance.\n\n" +
      "Press **Open Cooking** to enter the Cooking Simulator.",
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