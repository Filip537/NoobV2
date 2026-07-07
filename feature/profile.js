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
const decorFolder = path.join(__dirname, "..", "decor");

const defaultBgPath = path.join(__dirname, "..", "images", "profilebg.png");
const originalHeadPath = path.join(__dirname, "..", "images", "gthead.png");
const avatarFolder = path.join(__dirname, "..", "avatarz");

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
  pink: "rgba(255, 105, 180, ALPHA)",
  purple: "rgba(138, 43, 226, ALPHA)"
};

const DECOR_COSTS = {
  "wlz.png": 50,
  "dirt.png": 2
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

function getImageFiles(folder) {
  ensureFolder(folder);

  return fs.readdirSync(folder)
    .filter(file => [".png", ".jpg", ".jpeg", ".webp"].includes(path.extname(file).toLowerCase()))
    .slice(0, 24);
}

function cleanLabel(file) {
  return file
    .replace(/\.(png|jpg|jpeg|webp)$/i, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .slice(0, 80);
}

function getDecorCost(file) {
  return DECOR_COSTS[file] ?? 10;
}

function getUserProfileSettings(data) {
  return {
    background: data.cardBackground || null,
    rectangleColor: data.cardRectangleColor || "blue",
    transparency: Number(data.cardTransparency || 72),
    avatarHead: data.avatarHead || "original",
    decoration: data.cardDecoration || "none"
  };
}

async function drawAvatar(ctx, data) {
  const settings = getUserProfileSettings(data);

  const avatarX = 75;
  const avatarY = 75;
  const avatarW = 260;
  const avatarH = 190;

  let headPath = originalHeadPath;

  if (settings.avatarHead && settings.avatarHead !== "original") {
    const customAvatarPath = path.join(avatarFolder, settings.avatarHead);
    if (fs.existsSync(customAvatarPath)) headPath = customAvatarPath;
  }

  const head = await loadImage(headPath).catch(() => null);
  if (head) ctx.drawImage(head, avatarX, avatarY, avatarW, avatarH);
}

async function drawDecoration(ctx, data) {
  const settings = getUserProfileSettings(data);
  if (!settings.decoration || settings.decoration === "none") return;

  const decorPath = path.join(decorFolder, settings.decoration);
  if (!fs.existsSync(decorPath)) return;

  const decor = await loadImage(decorPath).catch(() => null);
  if (!decor) return;

  ctx.save();

  ctx.translate(55, 292);
  ctx.rotate(-0.35);
  ctx.drawImage(decor, -55, -55, 125, 125);

  ctx.restore();
  ctx.save();

  ctx.translate(1120, 38);
  ctx.rotate(0.35);
  ctx.drawImage(decor, -55, -55, 125, 125);

  ctx.restore();
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

  await drawDecoration(ctx, data);

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
      .setLabel("Choose Avatar")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`profile_customize_decor_${userId}`)
      .setLabel("Add Decoration")
      .setStyle(ButtonStyle.Success)
  );
}

function buildCustomizeMenus(userId) {
  const bgFiles = getImageFiles(bgFolder);

  const transparencyMenu = new StringSelectMenuBuilder()
    .setCustomId(`profile_transparency_${userId}`)
    .setPlaceholder("Choose panel transparency")
    .addOptions(
      [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(num => ({
        label: `${num}% Transparency`,
        value: String(num)
      }))
    );

  const bgMenu = new StringSelectMenuBuilder()
    .setCustomId(`profile_background_${userId}`)
    .setPlaceholder("Choose card background")
    .addOptions(
      bgFiles.length
        ? bgFiles.map(file => ({ label: cleanLabel(file), value: file }))
        : [{ label: "No backgrounds found", value: "none" }]
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

  return [
    new ActionRowBuilder().addComponents(transparencyMenu),
    new ActionRowBuilder().addComponents(bgMenu),
    new ActionRowBuilder().addComponents(colorMenu)
  ];
}

function buildAvatarMenu(userId) {
  const avatars = getImageFiles(avatarFolder);

  const avatarMenu = new StringSelectMenuBuilder()
    .setCustomId(`profile_avatar_${userId}`)
    .setPlaceholder("Choose avatar head")
    .addOptions(
      [
        { label: "Original", value: "original" },
        ...(avatars.length
          ? avatars.map(file => ({ label: cleanLabel(file), value: file }))
          : [{ label: "No avatar heads found", value: "no_avatar" }])
      ].slice(0, 25)
    );

  return [new ActionRowBuilder().addComponents(avatarMenu)];
}

function buildDecorMenu(userId) {
  const decors = getImageFiles(decorFolder);

  const decorMenu = new StringSelectMenuBuilder()
    .setCustomId(`profile_decor_${userId}`)
    .setPlaceholder("Choose profile decoration")
    .addOptions(
      [
        { label: "Remove Decoration", value: "none", description: "Free" },
        ...(decors.length
          ? decors.map(file => ({
              label: cleanLabel(file),
              value: file,
              description: `${getDecorCost(file)} World Locks`
            }))
          : [{ label: "No decorations found", value: "no_decor", description: "Add images to /decor" }])
      ].slice(0, 25)
    );

  return [new ActionRowBuilder().addComponents(decorMenu)];
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
    const embed = new EmbedBuilder()
      .setTitle("Choose Avatar Head")
      .setColor("Purple")
      .setDescription("Choose which character head you want to display on your profile card.");

    await interaction.reply({
      embeds: [embed],
      components: buildAvatarMenu(ownerId),
      ephemeral: true
    });

    return true;
  }

  if (type === "decor") {
    const embed = new EmbedBuilder()
      .setTitle("Add Profile Decoration")
      .setColor("Gold")
      .setDescription(
        "Decorations are bought using your World Locks.\n\n" +
        "`wlz.png` costs **50 WL**\n" +
        "`dirt.png` costs **2 WL**\n\n" +
        "After buying, the decoration will appear on your profile card."
      );

    await interaction.reply({
      embeds: [embed],
      components: buildDecorMenu(ownerId),
      ephemeral: true
    });

    return true;
  }

  const embed = new EmbedBuilder()
    .setTitle("Customize Your Profile Card")
    .setColor("Blue")
    .setDescription(
      "**Transparency** changes the see-through rectangle.\n" +
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

  if (value === "no_avatar") {
    await interaction.reply({
      content: "❌ No avatar heads found in `/avatarz`.",
      ephemeral: true
    });
    return true;
  }

  if (value === "no_decor") {
    await interaction.reply({
      content: "❌ No decorations found in `/decor`.",
      ephemeral: true
    });
    return true;
  }

  if (type === "transparency") data.cardTransparency = Number(value);

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

  if (type === "color") data.cardRectangleColor = value;

  if (type === "avatar") data.avatarHead = value;

  if (type === "decor") {
    if (value === "none") {
      data.cardDecoration = "none";
    } else {
      const decorPath = path.join(decorFolder, value);

      if (!fs.existsSync(decorPath)) {
        await interaction.reply({
          content: "❌ This decoration file no longer exists.",
          ephemeral: true
        });
        return true;
      }

      const cost = getDecorCost(value);

      if ((data.wl || 0) < cost) {
        await interaction.reply({
          content: `❌ You need **${cost} World Locks** to buy this decoration.\nYou currently have **${data.wl || 0} WL**.`,
          ephemeral: true
        });
        return true;
      }

      data.wl = (data.wl || 0) - cost;
      data.cardDecoration = value;
    }
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