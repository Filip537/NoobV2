const fs = require("fs");
const path = require("path");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} = require("discord.js");

const levelsFile = path.join(__dirname, "..", "levels.json");
const fishFolder = path.join(__dirname, "..", "fish");

const activeFishing = new Map();

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

function ensureUser(data, userId) {
  if (!data[userId]) data[userId] = { level: 1, xp: 0, wl: 0 };
  if (!data[userId].items) data[userId].items = {};
  if (!data[userId].fishBackpack) data[userId].fishBackpack = [];
  return data[userId];
}

function getFishFiles() {
  if (!fs.existsSync(fishFolder)) fs.mkdirSync(fishFolder, { recursive: true });

  return fs.readdirSync(fishFolder).filter(file =>
    [".png", ".jpg", ".jpeg", ".webp"].includes(path.extname(file).toLowerCase())
  );
}

function cleanName(file) {
  return file
    .replace(/\.(png|jpg|jpeg|webp)$/i, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ");
}

function randomRarity() {
  const roll = Math.random() * 100;
  if (roll < 5) return "Legendary";
  if (roll < 20) return "Epic";
  if (roll < 45) return "Rare";
  return "Common";
}

function shopEmbed() {
  return new EmbedBuilder()
    .setTitle("NoobV2 Shop")
    .setColor("Green")
    .setDescription(
      "**Fishing Rod**\n" +
      "Cost: **1 World Lock**\n\n" +
      "You need a fishing rod before you can use `/fish`."
    );
}

async function handleCommand(interaction) {
  if (!interaction.isChatInputCommand()) return false;

  if (interaction.commandName === "shop") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`shop_buy_rod_${interaction.user.id}`)
        .setLabel("Buy Fishing Rod - 1 WL")
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({
      embeds: [shopEmbed()],
      components: [row]
    });

    return true;
  }

  if (interaction.commandName === "fish") {
    const levels = loadLevels();
    const userData = ensureUser(levels, interaction.user.id);

    if (!userData.items.fishingRod) {
      await interaction.reply({
        content: "❌ You need a **Fishing Rod** first. Buy one from `/shop` for **1 WL**.",
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

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`fish_cast_${interaction.user.id}`)
        .setLabel("Cast Line")
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Fishing")
          .setColor("Blue")
          .setDescription("You equipped your fishing rod. Click **Cast Line** to start fishing.")
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
      await interaction.reply({ content: "❌ This shop button is not for you.", ephemeral: true });
      return true;
    }

    const levels = loadLevels();
    const userData = ensureUser(levels, ownerId);

    if (userData.items.fishingRod) {
      await interaction.reply({ content: "❌ You already own a **Fishing Rod**.", ephemeral: true });
      return true;
    }

    if ((userData.wl || 0) < 1) {
      await interaction.reply({ content: "❌ You need **1 World Lock** to buy a Fishing Rod.", ephemeral: true });
      return true;
    }

    userData.wl -= 1;
    userData.items.fishingRod = 1;

    levels[ownerId] = userData;
    saveLevels(levels);

    await interaction.reply({
      content: "✅ You bought a **Fishing Rod** for **1 WL**. You can now use `/fish`.",
      ephemeral: true
    });

    return true;
  }

  if (interaction.customId.startsWith("fish_cast_")) {
    const ownerId = interaction.customId.replace("fish_cast_", "");

    if (interaction.user.id !== ownerId) {
      await interaction.reply({ content: "❌ This fishing session is not yours.", ephemeral: true });
      return true;
    }

    activeFishing.set(ownerId, true);

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("Fishing")
          .setColor("Blue")
          .setDescription("You cast your fishing line into the water...\n\nWaiting for a fish to bite...")
      ],
      components: []
    });

    const waitTime = Math.floor(Math.random() * 4000) + 3000;

    setTimeout(async () => {
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
      });

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
      }, 7000);
    }, waitTime);

    return true;
  }

  if (interaction.customId.startsWith("fish_reel_")) {
    const ownerId = interaction.customId.replace("fish_reel_", "");

    if (interaction.user.id !== ownerId) {
      await interaction.reply({ content: "❌ This fishing session is not yours.", ephemeral: true });
      return true;
    }

    if (!activeFishing.has(ownerId)) {
      await interaction.reply({ content: "❌ This fish already escaped.", ephemeral: true });
      return true;
    }

    activeFishing.delete(ownerId);

    const levels = loadLevels();
    const userData = ensureUser(levels, ownerId);

    const fishFiles = getFishFiles();
    const caughtWL = Math.random() < 0.20;

    let rewardText = "";

    if (caughtWL) {
      userData.wl = (userData.wl || 0) + 1;
      rewardText += "You also found **1 World Lock** while fishing!\n";
    }

    let attachment = null;
    let fishName = "Mystery Fish";
    let rarity = randomRarity();

    if (fishFiles.length > 0) {
      const picked = fishFiles[Math.floor(Math.random() * fishFiles.length)];
      fishName = cleanName(picked);

      userData.fishBackpack.push({
        name: fishName,
        file: picked,
        rarity,
        caughtAt: Date.now()
      });

      attachment = new AttachmentBuilder(path.join(fishFolder, picked), {
        name: picked
      });
    }

    levels[ownerId] = userData;
    saveLevels(levels);

    const embed = new EmbedBuilder()
      .setTitle("Fish Caught!")
      .setColor("Green")
      .setDescription(
        `You caught a **${rarity} ${fishName}**!\n` +
        "It has been added to your backpack.\n\n" +
        rewardText
      );

    if (attachment) embed.setThumbnail(`attachment://${attachment.name}`);

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
  handleButton
};