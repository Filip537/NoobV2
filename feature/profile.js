
const fs = require("fs");
const path = require("path");

const {
  AttachmentBuilder,
  EmbedBuilder
} = require("discord.js");

const {
  createCanvas,
  loadImage,
  GlobalFonts
} = require("@napi-rs/canvas");

// ==========================================
// CONFIGURATION
// ==========================================

const levelsFile = path.join(
  __dirname, "..", "levels.json"
);

const fontPath = path.join(
  __dirname, "..", "fonts", "Nourd.ttf"
);

const IMAGE_TIMEOUT = 1200;
const IMAGE_CACHE_DURATION = 10 * 60 * 1000;
const MAX_CACHED_IMAGES = 200;

const imageCache = new Map();

let FONT = "Arial";

try {
  if (GlobalFonts.registerFromPath(fontPath, "Nourd")) {
    FONT = "Nourd";
  }
} catch {}

// ==========================================
// READ LEVEL DATA
// ==========================================

function loadLevels() {
  if (!fs.existsSync(levelsFile)) {
    return {};
  }

  return JSON.parse(
    fs.readFileSync(levelsFile, "utf8")
  );
}

function getUserLevel(userId) {
  const levels = loadLevels();

  return levels[userId] || {
    level: 0,
    xp: 0,
    wl: 0
  };
}

// ==========================================
// FAST IMAGE LOADING
// ==========================================

async function loadFastImage(url) {
  if (!url) return null;

  const cached = imageCache.get(url);

  if (
    cached &&
    Date.now() - cached.timestamp < IMAGE_CACHE_DURATION
  ) {
    return cached.image;
  }

  let timer;

  try {
    const image = await Promise.race([
      (async () => {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(IMAGE_TIMEOUT)
        });

        if (!response.ok) return null;

        const buffer = Buffer.from(
          await response.arrayBuffer()
        );

        return await loadImage(buffer);
      })(),

      new Promise(resolve => {
        timer = setTimeout(
          () => resolve(null),
          IMAGE_TIMEOUT
        );
      })
    ]);

    if (!image) return null;

    if (imageCache.size >= MAX_CACHED_IMAGES) {
      const oldest = imageCache.keys().next().value;
      imageCache.delete(oldest);
    }

    imageCache.set(url, {
      image,
      timestamp: Date.now()
    });

    return image;

  } catch {
    return null;

  } finally {
    clearTimeout(timer);
  }
}

// ==========================================
// CANVAS HELPERS
// ==========================================

function roundedRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(ctx, image, x, y, w, h) {
  const scale = Math.max(
    w / image.width,
    h / image.height
  );

  const width = image.width * scale;
  const height = image.height * scale;

  ctx.drawImage(
    image,
    x + (w - width) / 2,
    y + (h - height) / 2,
    width,
    height
  );
}

function fitText(ctx, text, maxWidth, size, weight = "") {
  text = String(text);

  let currentSize = size;

  ctx.font =
    `${weight} ${currentSize}px "${FONT}"`.trim();

  while (
    ctx.measureText(text).width > maxWidth &&
    currentSize > 20
  ) {
    currentSize -= 2;

    ctx.font =
      `${weight} ${currentSize}px "${FONT}"`.trim();
  }

  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  let shortened = text;

  while (
    shortened.length > 0 &&
    ctx.measureText(shortened + "…").width > maxWidth
  ) {
    shortened = shortened.slice(0, -1);
  }

  return shortened + "…";
}

// ==========================================
// PROFILE ROLE
// ==========================================

function getProfileRole(member) {
  if (member.id === member.guild.ownerId) {
    return {
      name: "Owner",
      color: "#d4d4d8"
    };
  }

  const role = member.roles.cache
    .filter(role =>
      role.id !== member.guild.id &&
      !role.managed
    )
    .sort((a, b) => b.position - a.position)
    .first();

  return {
    name: role?.name || "Member",

    color: role?.color
      ? role.hexColor
      : "#d4d4d8"
  };
}

// ==========================================
// CROWN ICON
// ==========================================

function drawCrown(ctx, x, y, size, color) {
  ctx.save();

  ctx.translate(x, y);
  ctx.scale(size / 40, size / 40);

  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.moveTo(2, 8);
  ctx.lineTo(12, 17);
  ctx.lineTo(20, 3);
  ctx.lineTo(28, 17);
  ctx.lineTo(38, 8);
  ctx.lineTo(33, 34);
  ctx.lineTo(7, 34);
  ctx.closePath();
  ctx.fill();

  for (const [cx, cy] of [
    [2, 7],
    [20, 3],
    [38, 7]
  ]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ==========================================
// STAR ICON
// ==========================================

function drawStar(ctx, x, y, size, color) {
  ctx.save();

  ctx.translate(
    x + size / 2,
    y + size / 2
  );

  ctx.beginPath();

  for (let i = 0; i < 10; i++) {
    const angle =
      -Math.PI / 2 + i * Math.PI / 5;

    const radius =
      i % 2 === 0
        ? size / 2
        : size / 4;

    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;

    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }

  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  ctx.restore();
}

// ==========================================
// INFORMATION PILL
// ==========================================

function drawPill(ctx, text, x, y, w, h, color) {
  roundedRect(ctx, x, y, w, h, h / 2);

  ctx.fillStyle = "#29292e";
  ctx.fill();

  ctx.strokeStyle = "#44444c";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const fitted = fitText(
    ctx,
    String(text),
    w - 32,
    32,
    "bold"
  );

  ctx.fillText(
    fitted,
    x + w / 2,
    y + h / 2
  );

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

// ==========================================
// CREATE PROFILE CANVAS
// ==========================================

async function createProfileCard(member, data) {
  const started = Date.now();

  const W = 1000;
  const H = 780;

  const canvas = createCanvas(800, 624);
  const ctx = canvas.getContext("2d");

  // Preserve original design at a smaller resolution.
  ctx.scale(0.8, 0.8);

  const user = member.user;
  const role = getProfileRole(member);

  // ========================================
  // AVATAR AND BANNER
  // ========================================

  const avatarURL = member.displayAvatarURL({
    extension: "png",
    size: 256,
    forceStatic: true
  });

  const bannerURL =
    member.bannerURL?.({
      extension: "jpg",
      size: 512,
      forceStatic: true
    }) ||
    user.bannerURL?.({
      extension: "jpg",
      size: 512,
      forceStatic: true
    }) ||
    null;

  const [avatar, banner] = await Promise.all([
    loadFastImage(avatarURL),
    loadFastImage(bannerURL)
  ]);

  console.log(
    `[PROFILE] Images loaded in ${Date.now() - started}ms`
  );

  // ========================================
  // MAIN BACKGROUND
  // ========================================

  ctx.fillStyle = "#101012";
  ctx.fillRect(0, 0, W, H);

  ctx.save();

  roundedRect(
    ctx,
    4,
    4,
    W - 8,
    H - 8,
    44
  );

  ctx.clip();

  const background = ctx.createLinearGradient(
    0, 0, W, H
  );

  background.addColorStop(0, "#202024");
  background.addColorStop(1, "#101012");

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, W, H);

  // ========================================
  // PROFILE BANNER
  // ========================================

  ctx.save();

  ctx.beginPath();
  ctx.rect(0, 0, W, 310);
  ctx.clip();

  if (banner) {
    drawCover(
      ctx,
      banner,
      0,
      0,
      W,
      310
    );

  } else {
    const gradient = ctx.createLinearGradient(
      0, 0, W, 310
    );

    gradient.addColorStop(0, "#393940");
    gradient.addColorStop(1, "#151518");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, 310);

    ctx.strokeStyle =
      "rgba(255,255,255,0.035)";

    ctx.lineWidth = 50;

    for (let x = -400; x < W; x += 150) {
      ctx.beginPath();
      ctx.moveTo(x, 310);
      ctx.lineTo(x + 350, 0);
      ctx.stroke();
    }
  }

  ctx.restore();

  // ========================================
  // CURVED BANNER DIVIDER
  // ========================================

  ctx.beginPath();
  ctx.moveTo(0, 265);

  ctx.bezierCurveTo(
    200, 335,
    360, 245,
    550, 270
  );

  ctx.bezierCurveTo(
    730, 300,
    850, 330,
    1000, 255
  );

  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();

  ctx.fillStyle = background;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, 265);

  ctx.bezierCurveTo(
    200, 335,
    360, 245,
    550, 270
  );

  ctx.bezierCurveTo(
    730, 300,
    850, 330,
    1000, 255
  );

  ctx.strokeStyle = "#65656d";
  ctx.lineWidth = 3;
  ctx.stroke();

  // ========================================
  // DISCORD AVATAR
  // ========================================

  const avatarX = 185;
  const avatarY = 285;
  const avatarRadius = 125;

  // Lightweight avatar border.
  ctx.beginPath();

  ctx.arc(
    avatarX,
    avatarY,
    avatarRadius + 7,
    0,
    Math.PI * 2
  );

  ctx.fillStyle = "#d4d4d8";
  ctx.fill();

  ctx.save();

  ctx.beginPath();

  ctx.arc(
    avatarX,
    avatarY,
    avatarRadius,
    0,
    Math.PI * 2
  );

  ctx.clip();

  ctx.fillStyle = "#333338";

  ctx.fillRect(
    avatarX - avatarRadius,
    avatarY - avatarRadius,
    avatarRadius * 2,
    avatarRadius * 2
  );

  if (avatar) {
    drawCover(
      ctx,
      avatar,
      avatarX - avatarRadius,
      avatarY - avatarRadius,
      avatarRadius * 2,
      avatarRadius * 2
    );

  } else {
    // Never fail the card because of an avatar.
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 100px "${FONT}"`;
    ctx.textAlign = "center";

    ctx.fillText(
      user.username.charAt(0).toUpperCase(),
      avatarX,
      avatarY + 35
    );
  }

  ctx.restore();

  // ========================================
  // DISPLAY NAME
  // ========================================

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";

  const displayName = fitText(
    ctx,
    member.displayName || user.username,
    600,
    66,
    "bold"
  );

  ctx.fillText(
    displayName,
    355,
    350
  );

  // ========================================
  // DISCORD USERNAME
  // ========================================

  ctx.fillStyle = "#a1a1aa";

  const username = fitText(
    ctx,
    user.username,
    600,
    36
  );

  ctx.fillText(
    username,
    358,
    405
  );

  // ========================================
  // ROLE ROW
  // ========================================

  drawCrown(
    ctx,
    65,
    485,
    52,
    "#d4d4d8"
  );

  ctx.font = `bold 40px "${FONT}"`;
  ctx.fillStyle = "#ffffff";

  ctx.fillText(
    "Role",
    145,
    525
  );

  drawPill(
    ctx,
    role.name,
    490,
    470,
    440,
    75,
    role.color
  );

  // ========================================
  // ROW DIVIDER
  // ========================================

  ctx.beginPath();
  ctx.moveTo(65, 585);
  ctx.lineTo(935, 585);

  ctx.strokeStyle = "#35353b";
  ctx.lineWidth = 2;
  ctx.stroke();

  // ========================================
  // CURRENT LEVEL
  // ========================================

  drawStar(
    ctx,
    65,
    630,
    52,
    "#d4d4d8"
  );

  ctx.font = `bold 40px "${FONT}"`;
  ctx.fillStyle = "#ffffff";

  ctx.fillText(
    "Current Level",
    145,
    670
  );

  drawPill(
    ctx,
    String(data.level ?? 0),
    690,
    615,
    240,
    75,
    "#ffffff"
  );

  ctx.restore();

  // ========================================
  // OUTER BORDER
  // ========================================

  roundedRect(
    ctx,
    4,
    4,
    W - 8,
    H - 8,
    44
  );

  ctx.strokeStyle = "#52525b";
  ctx.lineWidth = 3;
  ctx.stroke();

  // ========================================
  // FAST JPEG ENCODING
  // ========================================

  const image = canvas.toBuffer(
    "image/jpeg",
    75
  );

  console.log(
    `[PROFILE] Rendered in ${Date.now() - started}ms (${image.length} bytes)`
  );

  return image;
}

// ==========================================
// /PROFILE USER:
// ==========================================

async function executeProfile(interaction) {
  const started = Date.now();

  let stage = "acknowledging command";

  if (!interaction.guild) {
    return interaction.reply({
      content: "This command must be used in a server.",
      ephemeral: true
    });
  }

  try {
    // Immediately acknowledge Discord.
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    console.log(
      `[PROFILE] Acknowledged in ${Date.now() - started}ms`
    );

    // ======================================
    // GET SELECTED MEMBER
    // NO DISCORD API FETCH
    // ======================================

    stage = "reading member";

    const user =
      interaction.options.getUser("user") ||
      interaction.user;

    const member =
      interaction.options.getMember("user") ||
      interaction.guild.members.cache.get(user.id) ||
      (
        user.id === interaction.user.id
          ? interaction.member
          : null
      );

    if (!member || !member.user || user.bot) {
      return interaction.editReply({
        content: "Please select a valid server member."
      });
    }

    // ======================================
    // READ LOCAL LEVEL DATA
    // ======================================

    stage = "reading levels.json";

    const data = getUserLevel(user.id);

    // ======================================
    // GENERATE IMAGE
    // ======================================

    stage = "rendering canvas";

    const image = await createProfileCard(
      member,
      data
    );

    const attachment = new AttachmentBuilder(
      image,
      {
        name: "profile-card.jpg"
      }
    );

    // ======================================
    // UPLOAD TO DISCORD
    // ======================================

    stage = "uploading image to Discord";

    const uploadStarted = Date.now();

    console.log(
      `[PROFILE] Uploading ${image.length} bytes...`
    );

    await interaction.editReply({
      content: null,
      files: [attachment],
      allowedMentions: {
        parse: []
      }
    });

    console.log(
      `[PROFILE] Upload completed in ${Date.now() - uploadStarted}ms`
    );

    console.log(
      `[PROFILE] Total time: ${Date.now() - started}ms`
    );

  } catch (error) {
    console.error(
      `[PROFILE] Failed while ${stage}:`,
      error
    );

    const response = {
      content:
        `Unable to generate this profile card.\n` +
        `Failed while ${stage}.`,

      allowedMentions: {
        parse: []
      }
    };

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(response);
      } else {
        await interaction.reply(response);
      }
    } catch (replyError) {
      console.error(
        "[PROFILE] Unable to send error response:",
        replyError
      );
    }
  }
}

// ==========================================
// /LEADERBOARD LEVEL
// ==========================================

async function executeLeaderboard(interaction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: "This command must be used in a server.",
      ephemeral: true
    });
  }

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    // Read saved levels directly.
    // Never wait for Arcane migration.
    const levels = loadLevels();

    const members = interaction.guild.members.cache;

    const ranked = Object.entries(levels)

      .filter(([userId, data]) => {
        const member = members.get(userId);

        return (
          /^\d{17,20}$/.test(userId) &&
          !member?.user.bot &&
          data &&
          Number.isInteger(data.level) &&
          data.level >= 0 &&
          Number.isFinite(data.xp) &&
          data.xp >= 0 &&
          (data.level > 0 || data.xp > 0)
        );
      })

      .sort((a, b) =>
        b[1].level - a[1].level ||
        b[1].xp - a[1].xp ||
        a[0].localeCompare(b[0])
      );

    const top = ranked.slice(0, 10);

    const medals = [
      "🥇",
      "🥈",
      "🥉"
    ];

    const description = top.map(
      ([userId, data], index) => {
        const rank =
          medals[index] ||
          `**#${index + 1}**`;

        return (
          `${rank} <@${userId}>\n` +
          `└ Level **${data.level}**`
        );
      }
    ).join("\n\n");

    const userRank = ranked.findIndex(
      ([id]) => id === interaction.user.id
    );

    const userData = levels[interaction.user.id] || {
      level: 0,
      xp: 0
    };

    const embed = new EmbedBuilder()

      .setTitle("🏆 Level Leaderboard")

      .setColor(0x171719)

      .setDescription(
        description ||
        "No ranked members yet."
      )

      .addFields({
        name: "Your Ranking",

        value:
          `Rank: **${userRank >= 0
            ? `#${userRank + 1}`
            : "Unranked"}**\n` +

          `Level: **${userData.level}**`
      })

      .setFooter({
        text:
          `${ranked.length} ranked members • NoobV2`
      })

      .setTimestamp();

    const guildIcon =
      interaction.guild.iconURL({
        size: 128
      });

    if (guildIcon) {
      embed.setThumbnail(guildIcon);
    }

    await interaction.editReply({
      embeds: [embed],

      allowedMentions: {
        parse: []
      }
    });

  } catch (error) {
    console.error("[LEADERBOARD]", error);

    const response = {
      content: "Unable to load the level leaderboard."
    };

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(response);
      } else {
        await interaction.reply(response);
      }
    } catch (replyError) {
      console.error("[LEADERBOARD]", replyError);
    }
  }
}

// ==========================================
// DISABLE OLD CUSTOMIZATION BUTTONS
// ==========================================

async function handleButton(interaction) {
  if (!interaction.isButton()) {
    return false;
  }

  if (!interaction.customId.startsWith("profile_")) {
    return false;
  }

  await interaction.reply({
    content: "This feature is temporarily disabled.",
    ephemeral: true
  });

  return true;
}

// ==========================================
// DISABLE OLD CUSTOMIZATION MENUS
// ==========================================

async function handleSelect(interaction) {
  if (!interaction.isStringSelectMenu()) {
    return false;
  }

  if (!interaction.customId.startsWith("profile_")) {
    return false;
  }

  await interaction.reply({
    content: "This feature is temporarily disabled.",
    ephemeral: true
  });

  return true;
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  executeProfile,
  executeLeaderboard,
  createProfileCard,
  handleButton,
  handleSelect
};
