const fs = require("fs");
const path = require("path");

const {
const { attachment } = require("./mediaUpload.js");
} = require("discord.js");

const {
  createCanvas,
  loadImage
} = require("@napi-rs/canvas");

const levelFeature = require("./level.js");

// ==========================================
// CONFIGURATION
// ==========================================

const TEMPLATE_PATH = path.join(
  __dirname,
  "..",
  "cardbg",
  "CEFD83DE-6E45-406A-B54C-454DEE6BC782.png"
);

const LEVELS_FILE = path.join(
  __dirname,
  "..",
  "levels.json"
);

const WIDTH = 1648;
const HEIGHT = 928;

let cachedTemplate = null;
let templatePromise = null;

// ==========================================
// LOAD PROFILE TEMPLATE
// ==========================================

async function getTemplate() {
  if (cachedTemplate) {
    return cachedTemplate;
  }

  if (!templatePromise) {
    templatePromise = (async () => {
      if (!fs.existsSync(TEMPLATE_PATH)) {
        throw new Error(
          `Profile template not found: ${TEMPLATE_PATH}`
        );
      }

      cachedTemplate = await loadImage(TEMPLATE_PATH);

      console.log("[PROFILE] Template loaded successfully");

      return cachedTemplate;
    })();
  }

  try {
    return await templatePromise;
  } finally {
    templatePromise = null;
  }
}

// ==========================================
// LOAD LEVEL DATA
// ==========================================

function loadLevels() {
  if (!fs.existsSync(LEVELS_FILE)) {
    return {};
  }

  const data = JSON.parse(
    fs.readFileSync(LEVELS_FILE, "utf8")
  );

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid levels.json");
  }

  return data;
}

// ==========================================
// RANKING SYSTEM
// ==========================================

function getRankings(guild, levels) {
  return Object.entries(levels)
    .filter(([id, data]) => {
      return (
        /^\d{17,20}$/.test(id) &&
        data &&
        Number.isInteger(data.level) &&
        data.level >= 0 &&
        !guild.members.cache.get(id)?.user?.bot &&
        (
          data.level > 0 ||
          Number(data.xp || 0) > 0
        )
      );
    })
    .sort((a, b) =>
      b[1].level - a[1].level ||
      Number(b[1].xp || 0) -
      Number(a[1].xp || 0)
    );
}

// ==========================================
// TIMEOUT HELPER
// ==========================================

async function withTimeout(promise, ms) {
  let timer;

  try {
    return await Promise.race([
      promise,
      new Promise(resolve => {
        timer = setTimeout(() => resolve(null), ms);
      })
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ==========================================
// DOWNLOAD DISCORD AVATAR
// ==========================================

async function getAvatar(user, member) {
  try {
    const url =
      member?.displayAvatarURL?.({
        extension: "png",
        size: 256,
        forceStatic: true
      }) ||
      user.displayAvatarURL({
        extension: "png",
        size: 256,
        forceStatic: true
      });

    const response = await fetch(url, {
      signal: AbortSignal.timeout(2500)
    });

    if (!response.ok) {
      return null;
    }

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    return await loadImage(buffer);

  } catch (error) {
    console.error(
      "[PROFILE] Avatar download failed:",
      error.message
    );

    return null;
  }
}

// ==========================================
// GET SERVER ROLE
// ==========================================

function getServerRole(member, guild, user) {
  if (user.id === guild.ownerId) {
    return "Owner";
  }

  if (!member?.roles?.cache) {
    return "Unknown";
  }

  const role = member.roles.cache
    .filter(role =>
      role.id !== guild.id &&
      !role.managed
    )
    .sort((a, b) =>
      b.position - a.position
    )
    .first();

  return role?.name || "Member";
}

// ==========================================
// DRAW ROUNDED RECTANGLE
// ==========================================

function roundedRect(ctx, x, y, w, h, radius) {
  const r = Math.min(
    radius,
    w / 2,
    h / 2
  );

  ctx.beginPath();

  ctx.moveTo(x + r, y);

  ctx.lineTo(x + w - r, y);

  ctx.quadraticCurveTo(
    x + w, y,
    x + w, y + r
  );

  ctx.lineTo(x + w, y + h - r);

  ctx.quadraticCurveTo(
    x + w, y + h,
    x + w - r, y + h
  );

  ctx.lineTo(x + r, y + h);

  ctx.quadraticCurveTo(
    x, y + h,
    x, y + h - r
  );

  ctx.lineTo(x, y + r);

  ctx.quadraticCurveTo(
    x, y,
    x + r, y
  );

  ctx.closePath();
}

// ==========================================
// AUTOMATIC TEXT SIZE
// ==========================================

function drawText(
  ctx,
  text,
  x,
  y,
  maxWidth,
  fontSize = 40,
  color = "#FFFFFF",
  align = "left"
) {
  text = String(text ?? "");

  ctx.save();

  ctx.textAlign = align;
  ctx.textBaseline = "middle";

  let size = fontSize;

  ctx.font = `bold ${size}px sans-serif`;

  while (
    ctx.measureText(text).width > maxWidth &&
    size > 14
  ) {
    size--;

    ctx.font = `bold ${size}px sans-serif`;
  }

  ctx.fillStyle = color;

  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 2;

  ctx.fillText(text, x, y, maxWidth);

  ctx.restore();
}

// ==========================================
// DRAW CIRCULAR AVATAR
// ==========================================

function drawAvatar(ctx, avatar, user) {
  const x = 244;
  const y = 340;
  const radius = 132;

  ctx.save();

  ctx.beginPath();

  ctx.arc(
    x,
    y,
    radius,
    0,
    Math.PI * 2
  );

  ctx.clip();

  ctx.fillStyle = "#23466C";

  ctx.fillRect(
    x - radius,
    y - radius,
    radius * 2,
    radius * 2
  );

  if (avatar) {
    const size = radius * 2;

    const scale = Math.max(
      size / avatar.width,
      size / avatar.height
    );

    const imageWidth = avatar.width * scale;
    const imageHeight = avatar.height * scale;

    ctx.drawImage(
      avatar,
      x - imageWidth / 2,
      y - imageHeight / 2,
      imageWidth,
      imageHeight
    );

  } else {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "bold 110px sans-serif";
    ctx.fillStyle = "#FFFFFF";

    ctx.fillText(
      user.username.charAt(0).toUpperCase(),
      x,
      y
    );
  }

  ctx.restore();
}

// ==========================================
// DRAW REAL XP PROGRESS BAR
// ==========================================

function drawXPBar(ctx, xp, requiredXP, level) {
  const x = 66;
  const y = 744;
  const w = 1520;
  const h = 40;

  const maxLevel = levelFeature.MAX_LEVEL || 150;

  const progress =
    level >= maxLevel
      ? 1
      : requiredXP > 0
        ? Math.max(
            0,
            Math.min(1, xp / requiredXP)
          )
        : 0;

  // Remove the original yellow bar
  // and replace it with an empty track.

  ctx.save();

  roundedRect(ctx, x, y, w, h, 20);
  ctx.clip();

  const track = ctx.createLinearGradient(
    0,
    y,
    0,
    y + h
  );

  track.addColorStop(0, "#102D4D");
  track.addColorStop(1, "#173B65");

  ctx.fillStyle = track;
  ctx.fillRect(x, y, w, h);

  // Actual yellow progress.

  const fillWidth = Math.round(w * progress);

  if (fillWidth > 0) {
    const gradient = ctx.createLinearGradient(
      0,
      y,
      0,
      y + h
    );

    gradient.addColorStop(0, "#FFF78A");
    gradient.addColorStop(0.3, "#FFE94A");
    gradient.addColorStop(0.7, "#FFD92C");
    gradient.addColorStop(1, "#F3AD0C");

    ctx.fillStyle = gradient;

    roundedRect(
      ctx,
      x,
      y,
      fillWidth,
      h,
      15
    );

    ctx.fill();
  }

  ctx.restore();

  // Remove the template's static XP / XP text.

  ctx.fillStyle = "#153B65";

  ctx.fillRect(
    1130,
    679,
    468,
    52
  );

  const xpText =
    level >= maxLevel
      ? "MAX LEVEL"
      : `${xp.toLocaleString("en-US")} / ${requiredXP.toLocaleString("en-US")} XP`;

  drawText(
    ctx,
    xpText,
    1580,
    704,
    440,
    30,
    "#FFFFFF",
    "right"
  );
}

// ==========================================
// GENERATE PROFILE IMAGE
// ==========================================

async function createProfileCard(
  member,
  user,
  guild
) {
  const levels = loadLevels();

  const data = levels[user.id] || {
    level: 0,
    xp: 0
  };

  const level = Math.max(
    0,
    Math.min(
      levelFeature.MAX_LEVEL || 150,
      Math.floor(Number(data.level) || 0)
    )
  );

  const xp = Math.max(
    0,
    Math.floor(Number(data.xp) || 0)
  );

  const requiredXP =
    levelFeature.getXPNeeded(level);

  const rankings = getRankings(
    guild,
    levels
  );

  const rankIndex = rankings.findIndex(
    ([id]) => id === user.id
  );

  const rank =
    rankIndex >= 0
      ? `#${rankIndex + 1}`
      : "Unranked";

  const role = getServerRole(
    member,
    guild,
    user
  );

  // Load background and avatar together.

  const [template, avatar] = await Promise.all([
    getTemplate(),
    getAvatar(user, member)
  ]);

  const canvas = createCanvas(
    WIDTH,
    HEIGHT
  );

  const ctx = canvas.getContext("2d");

  // ========================================
  // TEMPLATE BACKGROUND
  // ========================================

  ctx.drawImage(
    template,
    0,
    0,
    WIDTH,
    HEIGHT
  );

  // ========================================
  // AVATAR
  // ========================================

  drawAvatar(
    ctx,
    avatar,
    user
  );

  // ========================================
  // DISPLAY NAME
  // ========================================

  const displayName =
    member?.displayName ||
    user.globalName ||
    user.username;

  drawText(
    ctx,
    displayName,
    455,
    301,
    515,
    40,
    "#FFFFFF"
  );

  // ========================================
  // USERNAME
  // ========================================

  drawText(
    ctx,
    `@${user.username}`,
    455,
    384,
    355,
    29,
    "#D9F1FF"
  );

  // ========================================
  // CURRENT LEVEL
  // ========================================

  drawText(
    ctx,
    level,
    296,
    612,
    420,
    54,
    "#FFFFFF",
    "center"
  );

  // ========================================
  // SERVER RANK
  // ========================================

  drawText(
    ctx,
    rank,
    824,
    612,
    420,
    50,
    "#FFE34B",
    "center"
  );

  // ========================================
  // SERVER ROLE
  // ========================================

  drawText(
    ctx,
    role,
    1354,
    612,
    440,
    39,
    "#FFFFFF",
    "center"
  );

  // ========================================
  // XP PROGRESS
  // ========================================

  drawXPBar(
    ctx,
    xp,
    requiredXP,
    level
  );

  // ========================================
  // COMPRESS IMAGE FOR DISCORD
  // ========================================

  return await canvas.encode(
    "jpeg",
    90
  );
}

// ==========================================
// /PROFILE COMMAND
// ==========================================

async function executeProfile(interaction) {
  const started = Date.now();

  let stage = "acknowledgement";

  try {
    // Respond immediately to avoid
    // application did not respond errors.

    if (
      !interaction.deferred &&
      !interaction.replied
    ) {
      await interaction.deferReply();
    }

    if (!interaction.guild) {
      return interaction.editReply({
        content:
          "This command can only be used in a server."
      });
    }

    stage = "member information";

    const user =
      interaction.options.getUser("user") ||
      interaction.user;

    let member =
      interaction.options.getMember("user") ||
      interaction.guild.members.cache.get(user.id) ||
      (
        user.id === interaction.user.id
          ? interaction.member
          : null
      );

    if (!member) {
      member = await withTimeout(
        interaction.guild.members.fetch(user.id),
        1500
      );
    }

    stage = "card generation";

    const image = await createProfileCard(
      member,
      user,
      interaction.guild
    );

    console.log(
      `[PROFILE] Card generated in ${Date.now() - started}ms`
    );

    stage = "Discord image upload";

        const upload = attachment(image, "profile.jpg");

    await interaction.editReply({
      files: [upload],
      allowedMentions: {
        parse: []
      }
    });

    console.log(
      `[PROFILE] Completed in ${Date.now() - started}ms`
    );

  } catch (error) {
    console.error(
      `[PROFILE] Failed during ${stage}:`,
      error
    );

    const payload = {
      content:
        `Unable to generate profile.\n` +
        `Failed during: ${stage}`
    };

    try {
      if (
        interaction.deferred ||
        interaction.replied
      ) {
        await interaction.editReply(payload);
      } else {
        await interaction.reply(payload);
      }

    } catch (replyError) {
      console.error(
        "[PROFILE] Reply failed:",
        replyError
      );
    }
  }
}

// ==========================================
// /LEADERBOARD COMMAND
// ==========================================

async function executeLeaderboard(interaction) {
  try {
    if (
      !interaction.deferred &&
      !interaction.replied
    ) {
      await interaction.deferReply();
    }

    if (!interaction.guild) {
      return interaction.editReply({
        content: "Use this command in a server."
      });
    }

    const levels = loadLevels();

    const rankings = getRankings(
      interaction.guild,
      levels
    );

    const description = rankings
      .slice(0, 10)
      .map(([id, data], index) =>
        `**#${index + 1}** <@${id}>\n` +
        `Level **${data.level}** | ` +
        `XP **${Number(data.xp || 0).toLocaleString("en-US")}**`
      )
      .join("\n\n");

    const myRank = rankings.findIndex(
      ([id]) => id === interaction.user.id
    );

    const myData =
      levels[interaction.user.id] || {
        level: 0,
        xp: 0
      };

    const embed = new EmbedBuilder()
      .setTitle("Level Leaderboard")
      .setColor(0x3498DB)
      .setDescription(
        description ||
        "No ranked members yet."
      )
      .addFields({
        name: "Your Ranking",
        value:
          `Rank: **${myRank >= 0 ? `#${myRank + 1}` : "Unranked"}**\n` +
          `Level: **${myData.level}**\n` +
          `XP: **${Number(myData.xp || 0).toLocaleString("en-US")}**`
      })
      .setFooter({
        text:
          `${rankings.length} ranked members | NoobV2`
      });

    await interaction.editReply({
      embeds: [embed],
      allowedMentions: {
        parse: []
      }
    });

  } catch (error) {
    console.error("[LEADERBOARD]", error);

    const payload = {
      content: "Unable to load leaderboard."
    };

    if (
      interaction.deferred ||
      interaction.replied
    ) {
      await interaction.editReply(payload)
        .catch(console.error);
    } else {
      await interaction.reply(payload)
        .catch(console.error);
    }
  }
}

// ==========================================
// INDEX.JS COMPATIBILITY
// NO BUTTONS OR DROPDOWNS
// ==========================================

async function handleButton() {
  return false;
}

async function handleSelect() {
  return false;
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
