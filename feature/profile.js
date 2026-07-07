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
  pink: "rgba(255, 105, 180, ALPHA)"
};

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

function getBackgroundFiles() {
  if (!fs.existsSync(bgFolder)) fs.mkdirSync(bgFolder);

  return fs.readdirSync(bgFolder)
    .filter(file => file.toLowerCase().endsWith(".png"))
    .slice(0, 25);
}

function getUserProfileSettings(data) {
  return {
    background: data.cardBackground || null,
    rectangleColor: data.cardRectangleColor || "blue",
    transparency: Number(data.cardTransparency || 72)
  };
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
  if (bg) {
    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
  }

  const alpha = Math.max(1, Math.min(settings.transparency, 100)) / 100;
  const colorTemplate = COLORS[settings.rectangleColor] || COLORS.blue;

  ctx.fillStyle = colorTemplate.replace("ALPHA", alpha);
  ctx.fillRect(30, 30, 1140, 275);

  const head = await loadImage(headPath).catch(() => null);
  if (head) ctx.drawImage(head, 75, 75, 260, 190);

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
      .setCustomId(`profile_customize_avatar_${userId}`)
      .setLabel("Customize Avatar")
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
            label: file.replace(".png", "").slice(0, 100),
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

  if (type === "avatar") {
    await interaction.reply({
      content: "Customize Avatar is coming soon.",
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
      "**Card Background** changes the weather/background image.\n" +
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

  if (type === "transparency") {
    data.cardTransparency = Number(value);
  }

  if (type === "background") {
    if (value === "none") {
      return interaction.reply({
        content: "❌ No card backgrounds found in `/cardbg`.",
        ephemeral: true
      });
    }

    data.cardBackground = value;
  }

  if (type === "color") {
    data.cardRectangleColor = value;
  }

  levels[ownerId] = data;
  saveLevels(levels);

  await interaction.reply({
    content: "✅ Profile card updated. Use `/profile` again to see the new card.",
    ephemeral: true
  });

  return true;
}

module.exports = {
  executeProfile,
  handleButton,
  handleSelect
};