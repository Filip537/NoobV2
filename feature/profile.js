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

const {
  importArcaneLevels,
  getUserLevel
} = require("./level.js");

const levelsFile = path.join(
  __dirname, "..", "levels.json"
);

const fontPath = path.join(
  __dirname, "..", "fonts", "Nourd.ttf"
);

let FONT = "Arial";

try {
  if (GlobalFonts.registerFromPath(fontPath, "Nourd")) {
    FONT = "Nourd";
  }
} catch {}

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
  let currentSize = size;

  ctx.font = `${weight} ${currentSize}px "${FONT}"`.trim();

  while (
    ctx.measureText(text).width > maxWidth &&
    currentSize > 20
  ) {
    currentSize -= 2;

    ctx.font =
      `${weight} ${currentSize}px "${FONT}"`.trim();
  }

  let shortened = text;

while (
  ctx.measureText(shortened + "…").width > maxWidth &&
  shortened.length > 0
) {
  shortened = shortened.slice(0, -1);
}

if (shortened !== text) {
  text = shortened + "…";
}
  return text;
}

// ==========================================
// FAST IMAGE LOADING
// ==========================================

async function loadFastImage(url) {
  if (!url) return null;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(2500)
    });

    if (!response.ok) return null;

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    return await loadImage(buffer);

  } catch {
    return null;
  }
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
    .filter(r =>
      r.id !== member.guild.id &&
      !r.managed
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

    const radius = i % 2 === 0
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
// DRAW INFORMATION PILL
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
  const W = 1000;
  const H = 780;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Use cached Discord user information.

  const user = member.user;
  const role = getProfileRole(member);

  // Smaller avatar for faster downloading.

  const avatarURL = member.displayAvatarURL({
    extension: "png",
    size: 256,
    forceStatic: true
  });

  const bannerURL =
    (typeof member.bannerURL === "function"
      ? member.bannerURL({
          extension: "png",
          size: 1024,
          forceStatic: true
        })
      : null) ||
    user.bannerURL({
      extension: "png",
      size: 1024,
      forceStatic: true
    });

  // Download both images simultaneously.

  const [avatar, banner] = await Promise.all([
    loadFastImage(avatarURL),
    loadFastImage(bannerURL)
  ]);

  ctx.clearRect(0, 0, W, H);

  // ========================================
  // MAIN CARD BACKGROUND
  // ========================================

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

    // Default diagonal banner pattern.

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

  ctx.save();

  ctx.shadowColor = "rgba(0,0,0,0.65)";
  ctx.shadowBlur = 25;
  ctx.shadowOffsetY = 10;

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

  ctx.restore();

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
    // Fallback if avatar download fails.

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
  // CURRENT LEVEL ROW
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

  return canvas.encode("png");
}

// ==========================================
// /PROFILE USER:
// ==========================================

async function executeProfile(interaction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: "This command must be used in a server.",
      ephemeral: true
    });
  }

  // Acknowledge the command immediately.

  await interaction.deferReply();

  try {
    const user =
      interaction.options.getUser("user") ||
      interaction.user;
const member =
  interaction.options.getMember("user") ||
  interaction.guild.members.cache.get(user.id) ||
  (user.id === interaction.user.id
    ? interaction.member
    : null);
    if (!member || user.bot) {
      return interaction.editReply({
        content: "Please select a valid server member."
      });
    }

    // Validate saved level data.

    JSON.parse(
      fs.readFileSync(levelsFile, "utf8")
    );

    // Read the current level without importing
    // Arcane data every time /profile is used.

    const data = getUserLevel(user.id);

    // Generate the canvas.

    const image = await createProfileCard(
      member,
      data
    );

    const attachment = new AttachmentBuilder(
      image,
      {
        name: "profile-card.png"
      }
    );

    // Send the completed canvas image.

    return await interaction.editReply({
      files: [attachment],
      allowedMentions: {
        parse: []
      }
    });

  } catch (error) {
    console.error("[PROFILE]", error);

    return interaction.editReply({
      content: "Unable to generate this profile card."
    });
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

  await interaction.deferReply();

  try {
    const ready = await importArcaneLevels(
      interaction.client
    );

    if (!ready) {
      return interaction.editReply({
        content: "The level system is not ready yet."
      });
    }

    const levels = JSON.parse(
      fs.readFileSync(levelsFile, "utf8")
    );

    const members = interaction.guild.members.cache;

    // ======================================
    // FILTER VALID MEMBERS
    // ======================================

    const ranked = Object.entries(levels)

      .filter(([userId, data]) => {
        const member = members.get(userId);

        return (
          member &&
          !member.user.bot &&
          data &&
          Number.isInteger(data.level) &&
          data.level >= 0 &&
          Number.isFinite(data.xp) &&
          data.xp >= 0 &&
          (data.level > 0 || data.xp > 0)
        );
      })

      // Sort by level, then XP.

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

    // ======================================
    // LEADERBOARD DESCRIPTION
    // ======================================

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

    // ======================================
    // PERSONAL RANKING
    // ======================================

    const userRank = ranked.findIndex(
      ([id]) => id === interaction.user.id
    );

    const userData = getUserLevel(
      interaction.user.id
    );

    // ======================================
    // LEADERBOARD EMBED
    // ======================================

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
        size: 256
      });

    if (guildIcon) {
      embed.setThumbnail(guildIcon);
    }

    return await interaction.editReply({
      embeds: [embed],
      allowedMentions: {
        parse: []
      }
    });

  } catch (error) {
    console.error("[LEADERBOARD]", error);

    return interaction.editReply({
      content: "Unable to load the level leaderboard."
    });
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
