// feature/profile.js
const fs = require("fs");
const path = require("path");
const {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder
} = require("discord.js");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

const levelsFile = path.join(__dirname, "..", "levels.json");
const bgFolder = path.join(__dirname, "..", "cardbg");

const defaultBgPath = path.join(__dirname, "..", "images", "profilebg.png");
const headPath = path.join(__dirname, "..", "images", "gthead.png");
const fontPath = path.join(__dirname, "..", "fonts", "Nourd.ttf");

const maskFolder = path.join(__dirname, "..", "maskitem");

try {
  GlobalFonts.registerFromPath(fontPath, "Nourd");
} catch {}

const COLORS = {
  red: "rgba(220, 40, 40, ALPHA)",
  blue: "rgba(25, 115, 170, ALPHA)",
  yellow: "rgba(230, 210, 40, ALPHA)",
  green: "rgba(40, 170, 80, ALPHA)",
  black: "rgba(0, 0, 0, ALPHA)",
  white: "rgba(255, 255, 255, ALPHA)",
  pink: "rgba(255, 105, 180, ALPHA)",
  purple: "rgba(138, 43, 226, ALPHA)"
};

function ensureFolder(folder) {
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
}

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

function shorten(text, max = 18) {
  if (!text) return "USER";
  return text.length > max ? text.slice(0, max - 2) + ".." : text;
}

function getPngFiles(folder) {
  ensureFolder(folder);

  return fs.readdirSync(folder)
    .filter(file => file.toLowerCase().endsWith(".png"))
    .slice(0, 25);
}

function getBackgroundFiles() {
  ensureFolder(bgFolder);
  return getPngFiles(bgFolder);
}

function getMaskFiles() {
  ensureFolder(maskFolder);
  return getPngFiles(maskFolder).slice(0, 24);
}

function cleanLabel(file) {
  return file
    .replace(".png", "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .slice(0, 100);
}

function getUserProfileSettings(data) {
  return {
    background: data.cardBackground || null,
    rectangleColor: data.cardRectangleColor || "blue",
    transparency: Number(data.cardTransparency || 72),
    mask: data.avatarMask || null
  };
}

async function drawAvatar(ctx, data) {
  const settings = getUserProfileSettings(data);

  const avatarX = 75;
  const avatarY = 75;
  const avatarW = 260;
  const avatarH = 190;

  const head = await loadImage(headPath).catch(() => null);
  if (head) ctx.drawImage(head, avatarX, avatarY, avatarW, avatarH);

  if (settings.mask) {
    const maskPath = path.join(maskFolder, settings.mask);
    const mask = await loadImage(maskPath).catch(() => null);

    if (mask) {
      ctx.drawImage(mask, avatarX, avatarY, avatarW, avatarH);
    }
  }
}

async function createProfileCard(member, data) {
  const canvas = createCanvas(1200, 335);
  const ctx = canvas.getContext("2d");

  const settings = getUserProfileSettings(data);

  ctx.fillStyle = "#7fd6ea";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let bgPath = defaultBgPath;

  if (settings.background) {
    const customPath = path.join(bgFolder, settings.background);
    if (fs.existsSync(customPath)) bgPath = customPath;
  }

  const bg = await loadImage(bgPath).catch(() => null);
  if (bg) ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

  const alpha = Math.max(1, Math.min(settings.transparency, 100)) / 100;
  const colorTemplate = COLORS[settings.rectangleColor] || COLORS.blue;

  ctx.fillStyle = colorTemplate.replace("ALPHA", alpha);
  ctx.fillRect(30, 30, 1140, 275);

  await drawAvatar(ctx, data);

  const name = shorten(member.displayName || member.user.username, 22).toUpperCase();
  const level = data.level || 1;
  const xp = data.xp || 0;
  const wl = data.wl || 0;

  ctx.font = '72px "Nourd", Arial';
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`@${name}`, 410, 125);

  ctx.font = '72px "Nourd", Arial';
  ctx.fillStyle = "#dfff4f";
  ctx.fillText(`LEVEL ${level}`, 410, 220);

  ctx.font = '34px "Nourd", Arial';
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`XP: ${xp}`, 410, 275);
  ctx.fillText(`WL: ${wl}`, 620, 275);

  return canvas.encode("png");
}

function buildProfileButtons(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`profile_customize_card_${userId}`)
      .setLabel("Customize Card")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`profile_customize_mask_${userId}`)
      .setLabel("Equip Mask")
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildCustomizeMenus(userId) {
  const bgFiles = getBackgroundFiles();

  const transparencyMenu = new StringSelectMenuBuilder()
    .setCustomId(`profile_transparency_${userId}`)
    .setPlaceholder("Choose panel transparency")
    .addOptions(
      [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(num => ({
        label: `${num}% Transparency`,
        value: String(num)
      }))
    );

  const colorMenu = new StringSelectMenuBuilder()
    .setCustomId(`profile_color_${userId}`)
    .setPlaceholder("Choose glow panel color")
    .addOptions(
      Object.keys(COLORS).map(color => ({
        label: color.charAt(0).toUpperCase() + color.slice(1),
        value: color
      }))
    );

  const bgMenu = new StringSelectMenuBuilder()
    .setCustomId(`profile_background_${userId}`)
    .setPlaceholder("Choose card background")
    .addOptions(
      bgFiles.length
        ? bgFiles.map(file => ({
            label: cleanLabel(file),
            value: file
          }))
        : [{ label: "No backgrounds found", value: "none" }]
    );

  return [
    new ActionRowBuilder().addComponents(transparencyMenu),
    new ActionRowBuilder().addComponents(bgMenu),
    new ActionRowBuilder().addComponents(colorMenu)
  ];
}

function buildMaskMenu(userId) {
  const masks = getMaskFiles();

  const maskMenu = new StringSelectMenuBuilder()
    .setCustomId(`profile_mask_${userId}`)
    .setPlaceholder("Equip mask")
    .addOptions(
      [
        { label: "Remove Mask", value: "none" },
        ...(masks.length
          ? masks.map(file => ({
              label: cleanLabel(file),
              value: file
            }))
          : [{ label: "No masks found", value: "no_mask" }])
      ].slice(0, 25)
    );

  return [
    new ActionRowBuilder().addComponents(maskMenu)
  ];
}

async function executeProfile(interaction) {
  await interaction.deferReply();

  const levels = loadLevels();
  const data = levels[interaction.user.id] || { level: 1, xp: 0, wl: 0 };

  const image = await createProfileCard(interaction.member, data);

  const attachment = new AttachmentBuilder(image, {
    name: "profile-card.png"
  });

  return interaction.editReply({
    content: `Hello ${interaction.user},`,
    files: [attachment],
    components: [buildProfileButtons(interaction.user.id)],
    allowedMentions: { users: [interaction.user.id] }
  });
}

async function handleButton(interaction) {
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith("profile_customize_")) return false;

  const parts = interaction.customId.split("_");
  const type = parts[2];
  const ownerId = parts[3];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: "❌ This is not your profile card.",
      ephemeral: true
    });
    return true;
  }

  if (type === "mask") {
    const embed = new EmbedBuilder()
      .setTitle("Equip a Mask")
      .setColor("Purple")
      .setDescription(
        "Choose a mask to equip on your Growtopia character.\n\n" +
        "All mask PNG files are loaded automatically from the `/maskitem` folder."
      );

    await interaction.reply({
      embeds: [embed],
      components: buildMaskMenu(ownerId),
      ephemeral: true
    });

    return true;
  }

  const embed = new EmbedBuilder()
    .setTitle("Customize Your Profile Card")
    .setColor("Blue")
    .setDescription(
      "Which part of your profile card would you like to customize?\n\n" +
      "**Transparency** changes the see-through rectangle over your background.\n" +
      "**Card Background** changes the background image.\n" +
      "**Glow Panel Color** changes the rectangle color."
    );

  await interaction.reply({
    embeds: [embed],
    components: buildCustomizeMenus(ownerId),
    ephemeral: true
  });

  return true;
}

async function handleSelect(interaction) {
  if (!interaction.isStringSelectMenu()) return false;
  if (!interaction.customId.startsWith("profile_")) return false;

  const parts = interaction.customId.split("_");
  const type = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: "❌ This is not your profile customization menu.",
      ephemeral: true
    });
    return true;
  }

  const levels = loadLevels();
  const data = levels[ownerId] || { level: 1, xp: 0, wl: 0 };

  const value = interaction.values[0];

  if (value === "no_mask") {
    await interaction.reply({
      content: "❌ No masks found in `/maskitem`.",
      ephemeral: true
    });
    return true;
  }

  if (type === "transparency") {
    data.cardTransparency = Number(value);
  }

  if (type === "background") {
    if (value === "none") {
      await interaction.reply({
        content: "❌ No card backgrounds found in `/cardbg`.",
        ephemeral: true
      });
      return true;
    }

    data.cardBackground = value;
  }

  if (type === "color") {
    data.cardRectangleColor = value;
  }

  if (type === "mask") {
    data.avatarMask = value === "none" ? null : value;
  }

  levels[ownerId] = data;
  saveLevels(levels);

  await interaction.reply({
    content: "✅ Profile updated. Use `/profile` again to see the new look.",
    ephemeral: true
  });

  return true;
}

module.exports = {
  executeProfile,
  handleButton,
  handleSelect
};