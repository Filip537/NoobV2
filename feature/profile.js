const fs = require("fs");
const path = require("path");

const {
  AttachmentBuilder,
  EmbedBuilder
} = require("discord.js");

const {
  createCanvas,
  loadImage
} = require("@napi-rs/canvas");

const levelFeature = require("./level.js");

const levelsFile = path.join(__dirname, "..", "levels.json");

// ==========================================
// HELPERS
// ==========================================

async function withTimeout(promise, ms, fallback = null) {
  let timer;

  try {
    return await Promise.race([
      promise,
      new Promise(resolve => {
        timer = setTimeout(() => resolve(fallback), ms);
      })
    ]);
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

function loadLevels() {
  try {
    if (!fs.existsSync(levelsFile)) {
      fs.writeFileSync(levelsFile, "{}");
      return {};
    }

    const raw = fs.readFileSync(levelsFile, "utf8").trim();
    if (!raw) return {};

    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : {};
  } catch (error) {
    console.error("[PROFILE] Failed to load levels.json:", error);
    return {};
  }
}

function getXPNeeded(level) {
  if (typeof levelFeature?.getXPNeeded === "function") {
    return levelFeature.getXPNeeded(level);
  }

  const earlyLevels = {
    0: 15,
    1: 25,
    2: 40,
    3: 60,
    4: 100
  };

  if (level < 5) return earlyLevels[level] ?? 200;
  return Math.floor(200 + Math.pow(level, 1.7) * 15);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function truncateText(ctx, text, maxWidth) {
  const safe = String(text ?? "");
  if (ctx.measureText(safe).width <= maxWidth) return safe;

  let result = safe;
  while (result.length > 0 && ctx.measureText(result + "...").width > maxWidth) {
    result = result.slice(0, -1);
  }

  return result + "...";
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawCover(ctx, image, x, y, w, h) {
  const scale = Math.max(w / image.width, h / image.height);
  const width = image.width * scale;
  const height = image.height * scale;

  ctx.save();
  roundRect(ctx, x, y, w, h, 18);
  ctx.clip();

  ctx.drawImage(
    image,
    x + (w - width) / 2,
    y + (h - height) / 2,
    width,
    height
  );

  ctx.restore();
}

async function getImage(url) {
  if (!url) return null;

  return withTimeout(
    (async () => {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(1500)
      });

      if (!response.ok) return null;

      const buffer = Buffer.from(await response.arrayBuffer());
      return await loadImage(buffer);
    })(),
    1800,
    null
  );
}

function getRole(member, guild, user) {
  if (user.id === guild.ownerId) return "Owner";
  if (!member?.roles?.cache) return "Member";

  const role = member.roles.cache
    .filter(r => r.id !== guild.id && !r.managed)
    .sort((a, b) => b.position - a.position)
    .first();

  return role?.name || "Member";
}

function getJoinDate(member) {
  const timestamp = member?.joinedTimestamp || member?.joined_at;
  if (!timestamp) return "Unknown";

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

function getUserLevelData(userId) {
  const levels = loadLevels();
  const data = levels[userId] || { level: 0, xp: 0, wl: 0 };

  const level = Number.isInteger(data.level) ? data.level : 0;
  const xp = Number.isFinite(data.xp) ? data.xp : 0;
  const requiredXP = getXPNeeded(level);

  return {
    level,
    xp,
    requiredXP
  };
}

function getUserRank(guild, userId) {
  const levels = loadLevels();

  const ranked = Object.entries(levels)
    .filter(([id, data]) =>
      /^\d{17,20}$/.test(id) &&
      data &&
      Number.isInteger(data.level) &&
      !guild.members.cache.get(id)?.user?.bot &&
      (data.level > 0 || Number(data.xp || 0) > 0)
    )
    .sort((a, b) =>
      b[1].level - a[1].level ||
      (b[1].xp || 0) - (a[1].xp || 0)
    );

  const index = ranked.findIndex(([id]) => id === userId);

  return {
    rank: index >= 0 ? index + 1 : null,
    total: ranked.length
  };
}

function drawStatBox(ctx, x, y, w, h, label, value, align = "left") {
  ctx.fillStyle = "#1b1b21";
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();

  ctx.strokeStyle = "#2a2a31";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 16);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = "#9a9aa5";
  ctx.font = "16px sans-serif";
  ctx.fillText(label, x + 18, y + 26);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = align;

  if (align === "center") {
    ctx.fillText(String(value), x + w / 2, y + 58, w - 20);
  } else if (align === "right") {
    ctx.fillText(String(value), x + w - 18, y + 58, w - 36);
  } else {
    ctx.fillText(String(value), x + 18, y + 58, w - 36);
  }
}

function drawProgressBar(ctx, x, y, w, h, progress) {
  const safeProgress = Math.max(0, Math.min(1, progress));

  ctx.fillStyle = "#23232a";
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();

  const fillWidth = Math.max(h, Math.floor(w * safeProgress));

  const gradient = ctx.createLinearGradient(x, y, x + w, y);
  gradient.addColorStop(0, "#7c4dff");
  gradient.addColorStop(1, "#b388ff");

  ctx.fillStyle = gradient;
  roundRect(ctx, x, y, fillWidth, h, h / 2);
  ctx.fill();
}

// ==========================================
// CARD
// ==========================================

async function createProfileCard(member, user, guild) {
  const W = 900;
  const H = 500;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const avatarURL =
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

  let bannerURL =
    member?.bannerURL?.({
      extension: "png",
      size: 1024,
      forceStatic: true
    }) ||
    user.bannerURL?.({
      extension: "png",
      size: 1024,
      forceStatic: true
    });

  if (!bannerURL && user.banner === undefined) {
    const fetchedUser = await withTimeout(user.fetch(true), 1000, null);
    bannerURL = fetchedUser?.bannerURL?.({
      extension: "png",
      size: 1024,
      forceStatic: true
    }) || null;
  }

  const [avatar, banner] = await Promise.all([
    getImage(avatarURL),
    getImage(bannerURL)
  ]);

  const {
    level,
    xp,
    requiredXP
  } = getUserLevelData(user.id);

  const {
    rank,
    total
  } = getUserRank(guild, user.id);

  const roleName = getRole(member, guild, user);
  const joinDate = getJoinDate(member);

  // Background
  ctx.fillStyle = "#0f1014";
  ctx.fillRect(0, 0, W, H);

  // Main card
  ctx.fillStyle = "#14151a";
  roundRect(ctx, 20, 20, W - 40, H - 40, 24);
  ctx.fill();

  // Banner area
  ctx.fillStyle = "#262730";
  roundRect(ctx, 20, 20, W - 40, 140, 24);
  ctx.fill();

  if (banner) {
    drawCover(ctx, banner, 20, 20, W - 40, 140);
  }

  // Dark overlay on banner
  const overlay = ctx.createLinearGradient(0, 20, 0, 160);
  overlay.addColorStop(0, "rgba(0,0,0,0.15)");
  overlay.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = overlay;
  roundRect(ctx, 20, 20, W - 40, 140, 24);
  ctx.fill();

  // Avatar outer ring
  ctx.beginPath();
  ctx.arc(110, 160, 62, 0, Math.PI * 2);
  ctx.fillStyle = "#14151a";
  ctx.fill();

  // Avatar circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(110, 160, 54, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = "#323440";
  ctx.fillRect(56, 106, 108, 108);

  if (avatar) {
    ctx.drawImage(avatar, 56, 106, 108, 108);
  } else {
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px sans-serif";
    ctx.fillText(
      user.username.charAt(0).toUpperCase(),
      110,
      174
    );
  }

  ctx.restore();

  // Name
  const displayName =
    member?.displayName ||
    user.globalName ||
    user.username;

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 34px sans-serif";
  ctx.fillText(
    truncateText(ctx, displayName, 420),
    190,
    165
  );

  // Username
  ctx.fillStyle = "#a9a9b4";
  ctx.font = "18px sans-serif";
  ctx.fillText(
    truncateText(ctx, `@${user.username}`, 420),
    190,
    194
  );

  // Title
  ctx.fillStyle = "#bbbbc5";
  ctx.font = "15px sans-serif";
  ctx.fillText("NOOBV2 MEMBER PROFILE", 34, 56);

  // Right level box
  ctx.fillStyle = "#1b1b21";
  roundRect(ctx, 675, 48, 175, 90, 18);
  ctx.fill();

  ctx.strokeStyle = "#2a2a31";
  ctx.lineWidth = 1;
  roundRect(ctx, 675, 48, 175, 90, 18);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#9a9aa5";
  ctx.font = "16px sans-serif";
  ctx.fillText("CURRENT LEVEL", 762.5, 78);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 34px sans-serif";
  ctx.fillText(String(level), 762.5, 118);

  // Progress area
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText("Level Progress", 40, 270);

  ctx.fillStyle = "#a9a9b4";
  ctx.font = "16px sans-serif";
  ctx.fillText(
    `${formatNumber(xp)} / ${formatNumber(requiredXP)} XP`,
    40,
    297
  );

  drawProgressBar(
    ctx,
    40,
    312,
    530,
    18,
    requiredXP > 0 ? xp / requiredXP : 1
  );

  ctx.textAlign = "right";
  ctx.fillStyle = "#a9a9b4";
  ctx.font = "15px sans-serif";
  ctx.fillText(
    requiredXP > 0
      ? `${formatNumber(Math.max(requiredXP - xp, 0))} XP to next level`
      : "Maximum level reached",
    570,
    297
  );

  // Stat boxes
  drawStatBox(ctx, 40, 345, 255, 85, "Server Role", truncateText(ctx, roleName, 200));
  drawStatBox(ctx, 315, 345, 255, 85, "Joined Server", joinDate);

  drawStatBox(ctx, 590, 165, 260, 85, "Rank", rank ? `#${rank} / ${total}` : "Unranked");
  drawStatBox(ctx, 590, 265, 260, 85, "Current XP", formatNumber(xp));
  drawStatBox(ctx, 590, 365, 260, 85, "Next Level XP", formatNumber(requiredXP));

  // Footer
  ctx.textAlign = "left";
  ctx.fillStyle = "#7d7d89";
  ctx.font = "14px sans-serif";
  ctx.fillText("Generated by NoobV2", 40, 462);

  return await canvas.encode("jpeg", 90);
}

// ==========================================
// /PROFILE
// ==========================================

async function executeProfile(interaction) {
  const started = Date.now();
  let stage = "start";

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    if (!interaction.guild) {
      return interaction.editReply({
        content: "Use this command in a server."
      });
    }

    stage = "get user";

    const user =
      interaction.options.getUser("user") ||
      interaction.user;

    let member =
      interaction.options.getMember("user") ||
      interaction.guild.members.cache.get(user.id) ||
      null;

    if (!member) {
      member = await withTimeout(
        interaction.guild.members.fetch(user.id),
        1200,
        null
      );
    }

    stage = "generate card";

    const image = await createProfileCard(
      member,
      user,
      interaction.guild
    );

    stage = "send reply";

    await interaction.editReply({
      files: [
        new AttachmentBuilder(image, {
          name: "profile.jpg"
        })
      ],
      allowedMentions: {
        parse: []
      }
    });

    console.log(
      `[PROFILE] Completed in ${Date.now() - started}ms for ${user.id}`
    );
  } catch (error) {
    console.error(`[PROFILE] Failed at ${stage}:`, error);

    const payload = {
      content: `Profile failed at: ${stage}.`
    };

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (replyError) {
      console.error("[PROFILE] Reply failed:", replyError);
    }
  }
}

// ==========================================
// /LEADERBOARD
// ==========================================

async function executeLeaderboard(interaction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const levels = loadLevels();

    const ranked = Object.entries(levels)
      .filter(([id, data]) =>
        /^\d{17,20}$/.test(id) &&
        data &&
        Number.isInteger(data.level) &&
        !interaction.guild?.members.cache.get(id)?.user?.bot &&
        (data.level > 0 || Number(data.xp || 0) > 0)
      )
      .sort((a, b) =>
        b[1].level - a[1].level ||
        (b[1].xp || 0) - (a[1].xp || 0)
      );

    const medals = ["🥇", "🥈", "🥉"];

    const description = ranked
      .slice(0, 10)
      .map(([id, data], index) =>
        `${medals[index] || `**#${index + 1}**`} <@${id}>\n` +
        `└ Level **${data.level}** • XP **${formatNumber(data.xp || 0)}**`
      )
      .join("\n\n");

    const myRank = ranked.findIndex(([id]) => id === interaction.user.id);
    const myLevel = levels[interaction.user.id]?.level || 0;
    const myXP = levels[interaction.user.id]?.xp || 0;

    const embed = new EmbedBuilder()
      .setTitle("🏆 Level Leaderboard")
      .setColor(0x111113)
      .setDescription(description || "No ranked members yet.")
      .addFields({
        name: "Your Ranking",
        value:
          `Rank: **${myRank >= 0 ? `#${myRank + 1}` : "Unranked"}**\n` +
          `Level: **${myLevel}**\n` +
          `XP: **${formatNumber(myXP)}**`
      })
      .setFooter({
        text: `${ranked.length} ranked members • NoobV2`
      });

    await interaction.editReply({
      embeds: [embed],
      allowedMentions: {
        parse: []
      }
    });
  } catch (error) {
    console.error("[LEADERBOARD]", error);

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: "Unable to load leaderboard."
      }).catch(console.error);
    }
  }
}

// ==========================================
// KEEP THESE FOR INDEX COMPATIBILITY
// NO BUTTONS / NO SELECTS
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
