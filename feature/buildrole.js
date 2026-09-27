const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const LEVELS_PATH = path.join(__dirname, "../levels.json");

const COOKING_COST = 1000;

function loadLevels() {
  try {
    if (!fs.existsSync(LEVELS_PATH)) return {};
    return JSON.parse(fs.readFileSync(LEVELS_PATH, "utf8"));
  } catch (err) {
    console.error("Failed to load levels.json:", err);
    return {};
  }
}

function saveLevels(data) {
  fs.writeFileSync(
    LEVELS_PATH,
    JSON.stringify(data, null, 2)
  );
}

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

  if (!levels[userId].professions) {
    levels[userId].professions = {};
  }

  return levels[userId];
}

function buildRoleEmbed(userData) {
  const cooking =
    userData.professions?.cooking?.unlocked === true;

  const cookingStatus = cooking
    ? "Unlocked"
    : "Locked";

  return new EmbedBuilder()
    .setColor(cooking ? 0x57F287 : 0xFEE75C)
    .setTitle("Build Your Role")
    .setDescription(
      "Choose a profession to unlock and build your character.\n\n" +

      "**Cooking**\n" +
      "Learn recipes, use ingredients and cook different foods.\n\n" +

      `Cost: **${COOKING_COST.toLocaleString()} WL**\n` +
      `Status: **${cookingStatus}**\n\n` +

      `Your Balance: **${(userData.wl || 0).toLocaleString()} WL**`
    )
    .setFooter({
      text: "More professions will be added later."
    });
}

function buildRoleButtons(userData) {
  const cooking =
    userData.professions?.cooking?.unlocked === true;

  const button = new ButtonBuilder()
    .setCustomId(
      cooking
        ? "profession_open_cooking"
        : "profession_unlock_cooking"
    )
    .setLabel(
      cooking
        ? "Open Cooking"
        : "Unlock Cooking"
    )
    .setStyle(
      cooking
        ? ButtonStyle.Success
        : ButtonStyle.Primary
    );

  return new ActionRowBuilder()
    .addComponents(button);
}

async function execute(interaction) {
  const levels = loadLevels();

  const userData = getUserData(
    levels,
    interaction.user.id
  );

  saveLevels(levels);

  return interaction.reply({
    embeds: [buildRoleEmbed(userData)],
    components: [buildRoleButtons(userData)]
  });
}

async function handleButton(interaction) {
  if (!interaction.isButton()) return false;

  if (
    interaction.customId !== "profession_unlock_cooking" &&
    interaction.customId !== "profession_open_cooking"
  ) {
    return false;
  }

  const levels = loadLevels();

  const userData = getUserData(
    levels,
    interaction.user.id
  );

  // ==============================
  // OPEN COOKING
  // ==============================

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

    await interaction.reply({
      content:
        "Cooking Simulator is unlocked!\n\n" +
        "The full cooking interface will be added next.",
      ephemeral: true
    });

    return true;
  }

  // ==============================
  // ALREADY UNLOCKED
  // ==============================

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

  // ==============================
  // CHECK MONEY
  // ==============================

  if ((userData.wl || 0) < COOKING_COST) {
    await interaction.reply({
      content:
        `You need **${COOKING_COST.toLocaleString()} WL** to unlock Cooking.\n` +
        `You currently have **${(userData.wl || 0).toLocaleString()} WL**.`,
      ephemeral: true
    });

    return true;
  }

  // ==============================
  // BUY PROFESSION
  // ==============================

  userData.wl -= COOKING_COST;

  userData.professions.cooking = {
    unlocked: true,
    level: 1,
    xp: 0,
    unlockedAt: Date.now()
  };

  levels[interaction.user.id] = userData;

  saveLevels(levels);

  await interaction.update({
    embeds: [buildRoleEmbed(userData)],
    components: [buildRoleButtons(userData)]
  });

  await interaction.followUp({
    content:
      "Cooking profession unlocked! **1,000 WL** has been deducted from your balance.",
    ephemeral: true
  });

  return true;
}

module.exports = {
  execute,
  handleButton
};