
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

const levelsFile = path.join(
  __dirname, "..", "levels.json"
);

// ==========================================
// TIMEOUT HELPER
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

// ==========================================
// LOAD DISCORD IMAGE
// ==========================================

async function getImage(url) {
  if (!url) return null;

  return withTimeout(
    (async () => {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(1000)
      });

      if (!response.ok) return null;

      const buffer = Buffer.from(
        await response.arrayBuffer()
      );

      return await loadImage(buffer);
    })(),
    1200
  );
}

// ==========================================
// DRAW IMAGE
// ==========================================

function drawCover(ctx, image, x, y, w, h) {
  const scale = Math.max(
    w / image.width,
    h / image.height
  );

  const width = image.width * scale;
  const height = image.height * scale;

  ctx.save();

  ctx.beginPath();
  ctx.rect(x, y, w, h);
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

// ==========================================
// SERVER ROLE
// ==========================================

function getRole(member, guild, user) {
  if (user.id === guild.ownerId) {
    return "Owner";
  }

  if (!member?.roles?.cache) {
    return "Unknown";
  }

  const role = member.roles.cache
    .filter(r => r.id !== guild.id && !r.managed)
    .sort((a, b) => b.position - a.position)
    .first();

  return role?.name || "Member";
}

// ==========================================
// SERVER JOIN DATE
// ==========================================

function getJoinDate(member) {
  const timestamp =
    member?.joinedTimestamp ||
    member?.joined_at;

  if (!timestamp) return "Unknown";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

// ==========================================
// CREATE PROFILE CARD
// ==========================================

async function createProfileCard(member, user, guild) {
  const W = 640;
  const H = 420;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Avatar and banner URLs

  const avatarURL =
    member?.displayAvatarURL?.({
      extension: "png",
      size: 128,
      forceStatic: true
    }) ||
    user.displayAvatarURL({
      extension: "png",
      size: 128,
      forceStatic: true
    });

  let bannerURL =
    member?.bannerURL?.({
      extension: "png",
      size: 512,
      forceStatic: true
    }) ||
    user.bannerURL?.({
      extension: "png",
      size: 512,
      forceStatic: true
    });

  // Fetch the user only if banner information
  // is not already available.

  if (!bannerURL && user.banner === undefined) {
    const fetchedUser = await withTimeout(
      user.fetch(true),
      800
    );

    bannerURL = fetchedUser?.bannerURL({
      extension: "png",
      size: 512,
      forceStatic: true
    });
  }

  const [avatar, banner] = await Promise.all([
    getImage(avatarURL),
    getImage(bannerURL)
  ]);

  // Main black background

  ctx.fillStyle = "#111113";
  ctx.fillRect(0, 0, W, H);

  // Banner

  ctx.fillStyle = "#303035";
  ctx.fillRect(0, 0, W, 150);

  if (banner) {
    drawCover(ctx, banner, 0, 0, W, 150);
  }

  // Avatar border

  ctx.beginPath();
  ctx.arc(88, 150, 58, 0, Math.PI * 2);
  ctx.fillStyle = "#111113";
  ctx.fill();

  // Circular avatar

  ctx.save();

  ctx.beginPath();
  ctx.arc(88, 150, 51, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = "#343438";
  ctx.fillRect(37, 99, 102, 102);

  if (avatar) {
    ctx.drawImage(avatar, 37, 99, 102, 102);
  } else {
    ctx.font = "bold 42px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";

    ctx.fillText(
      user.username.charAt(0).toUpperCase(),
      88,
      165
    );
  }

  ctx.restore();

  // Display name

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px sans-serif";

  ctx.fillText(
    member?.displayName ||
    user.globalName ||
    user.username,
    160,
    184,
    450
  );

  // Username

  ctx.font = "16px sans-serif";
  ctx.fillStyle = "#99999f";

  ctx.fillText(
    `@${user.username}`,
    160,
    208,
    450
  );

  // Divider

  ctx.fillStyle = "#303034";
  ctx.fillRect(28, 232, 584, 1);

  // Server role

  ctx.font = "18px sans-serif";
  ctx.fillStyle = "#aaaaaf";
  ctx.fillText("Server Role", 30, 275);

  ctx.fillStyle = "#29292d";
  ctx.fillRect(345, 250, 265, 40);

  ctx.font = "bold 18px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";

  ctx.fillText(
    getRole(member, guild, user),
    477,
    276,
    245
  );

  // Divider

  ctx.fillStyle = "#303034";
  ctx.fillRect(28, 305, 584, 1);

  // Join date

  ctx.textAlign = "left";
  ctx.font = "18px sans-serif";
  ctx.fillStyle = "#aaaaaf";
  ctx.fillText("Joined Server", 30, 345);

  ctx.textAlign = "right";
  ctx.font = "bold 18px sans-serif";
  ctx.fillStyle = "#ffffff";

  ctx.fillText(
    getJoinDate(member),
    610,
    345,
    300
  );

  // Footer

  ctx.fillStyle = "#303034";
  ctx.fillRect(28, 370, 584, 1);

  ctx.textAlign = "center";
  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#77777e";

  ctx.fillText(
    "NOOBV2  •  MEMBER PROFILE",
    W / 2,
    398
  );

  // Small compressed image

  return await canvas.encode("jpeg", 80);
}

// ==========================================
// /PROFILE COMMAND
// ==========================================

async function executeProfile(interaction) {
  const started = Date.now();
  let stage = "acknowledgement";

  console.log("[PROFILE] Command received");

  try {
    // Acknowledge immediately.

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    console.log(
      `[PROFILE] Acknowledged in ${Date.now() - started}ms`
    );

    if (!interaction.guild) {
      return interaction.editReply({
        content: "Use this command in a server."
      });
    }

    stage = "member data";

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

    stage = "canvas generation";

    const image = await createProfileCard(
      member,
      user,
      interaction.guild
    );

    console.log(
      `[PROFILE] Canvas ready in ${Date.now() - started}ms`
    );

    stage = "image upload";

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
      `[PROFILE] Completed in ${Date.now() - started}ms`
    );

  } catch (error) {
    console.error(
      `[PROFILE] Failed at ${stage}:`,
      error
    );

    try {
      const payload = {
        content: `Profile failed at: ${stage}.`
      };

      if (interaction.deferred || interaction.replied) {
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
// LEVEL LEADERBOARD
// Independent from the profile command.
// ==========================================

async function executeLeaderboard(interaction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const levels = fs.existsSync(levelsFile)
      ? JSON.parse(fs.readFileSync(levelsFile, "utf8"))
      : {};

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
        `└ Level **${data.level}**`
      )
      .join("\n\n");

    const rank = ranked.findIndex(
      ([id]) => id === interaction.user.id
    );

    const userLevel =
      levels[interaction.user.id]?.level || 0;

    const embed = new EmbedBuilder()
      .setTitle("🏆 Level Leaderboard")
      .setColor(0x111113)
      .setDescription(
        description || "No ranked members yet."
      )
      .addFields({
        name: "Your Ranking",
        value:
          `Rank: **${rank >= 0 ? `#${rank + 1}` : "Unranked"}**\n` +
          `Level: **${userLevel}**`
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
// OLD CUSTOMIZATION HANDLERS
// ==========================================

async function handleButton(interaction) {
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith("profile_")) return false;

  await interaction.reply({
    content: "This feature is disabled.",
    ephemeral: true
  });

  return true;
}

async function handleSelect(interaction) {
  if (!interaction.isStringSelectMenu()) return false;
  if (!interaction.customId.startsWith("profile_")) return false;

  await interaction.reply({
    content: "This feature is disabled.",
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
