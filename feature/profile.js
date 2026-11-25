
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
// LEVEL DATA
// ==========================================

function loadLevels() {
  if (!fs.existsSync(levelsFile)) return {};

  return JSON.parse(
    fs.readFileSync(levelsFile, "utf8")
  );
}

function getUserLevel(userId) {
  return loadLevels()[userId] || {
    level: 0,
    xp: 0,
    wl: 0
  };
}

// ==========================================
// LOAD AVATAR
// ==========================================

async function loadAvatar(user) {
  try {
    const url = user.displayAvatarURL({
      extension: "png",
      size: 128,
      forceStatic: true
    });

    const response = await fetch(url, {
      signal: AbortSignal.timeout(800)
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
// BASIC PROFILE CANVAS
// ==========================================

async function createProfileCard(member, data, selectedUser) {
  const user = selectedUser || member.user;

  const canvas = createCanvas(600, 220);
  const ctx = canvas.getContext("2d");

  // Black background
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, 600, 220);

  // Border
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 598, 218);

  // Avatar
  const avatar = await loadAvatar(user);

  ctx.save();

  ctx.beginPath();
  ctx.arc(100, 110, 65, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = "#333333";
  ctx.fillRect(35, 45, 130, 130);

  if (avatar) {
    ctx.drawImage(avatar, 35, 45, 130, 130);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 50px sans-serif";
    ctx.textAlign = "center";

    ctx.fillText(
      user.username.charAt(0).toUpperCase(),
      100,
      128
    );
  }

  ctx.restore();

  // Role
  let roleName = "Member";

  if (member?.id === member?.guild?.ownerId && member?.id) {
    roleName = "Owner";
  } else if (member?.roles?.highest) {
    roleName = member.roles.highest.name;

    if (roleName === "@everyone") {
      roleName = "Member";
    }
  }

  // Username
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px sans-serif";

  ctx.fillText(
    member?.displayName || user.username,
    195,
    65,
    375
  );

  // Role label
  ctx.font = "18px sans-serif";
  ctx.fillStyle = "#999999";
  ctx.fillText("Role", 195, 105);

  // Role value
  ctx.font = "bold 22px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(roleName, 195, 132, 375);

  // Current level
  ctx.font = "18px sans-serif";
  ctx.fillStyle = "#999999";
  ctx.fillText("Current Level", 195, 165);

  ctx.font = "bold 28px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(String(data.level ?? 0), 195, 198);

  return canvas.toBuffer("image/png");
}

// ==========================================
// /PROFILE
// ==========================================

async function executeProfile(interaction) {
  const started = Date.now();

  try {
    if (!interaction.guild) {
      return interaction.reply({
        content: "Use this command in a server.",
        ephemeral: true
      });
    }

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

    const data = getUserLevel(user.id);

    const image = await createProfileCard(
      member,
      data,
      user
    );

    console.log(
      `[PROFILE] Canvas generated in ${Date.now() - started}ms`
    );

    const attachment = new AttachmentBuilder(image, {
      name: "profile.png"
    });

    const payload = {
      files: [attachment],
      allowedMentions: {
        parse: []
      }
    };

    // Send the canvas directly.
    // No temporary webhooks.
    // No unnecessary deferReply.

    if (interaction.deferred) {
      await interaction.editReply(payload);
    } else if (interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }

    console.log(
      `[PROFILE] Completed in ${Date.now() - started}ms`
    );

  } catch (error) {
    console.error("[PROFILE]", error);

    const payload = {
      content: "Unable to generate profile card."
    };

    try {
      if (interaction.deferred) {
        await interaction.editReply(payload);
      } else if (interaction.replied) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (err) {
      console.error("[PROFILE REPLY]", err);
    }
  }
}

// ==========================================
// /LEADERBOARD LEVEL
// ==========================================

async function executeLeaderboard(interaction) {
  try {
    if (!interaction.guild) {
      return interaction.reply({
        content: "Use this command in a server.",
        ephemeral: true
      });
    }

    const levels = loadLevels();

    const ranked = Object.entries(levels)
      .filter(([id, data]) => {
        const member =
          interaction.guild.members.cache.get(id);

        return (
          /^\d{17,20}$/.test(id) &&
          !member?.user?.bot &&
          data &&
          Number.isInteger(data.level) &&
          (
            data.level > 0 ||
            Number(data.xp || 0) > 0
          )
        );
      })
      .sort((a, b) =>
        b[1].level - a[1].level ||
        (b[1].xp || 0) - (a[1].xp || 0)
      );

    const medals = ["🥇", "🥈", "🥉"];

    const description = ranked
      .slice(0, 10)
      .map(([id, data], index) => {
        const rank =
          medals[index] || `**#${index + 1}**`;

        return `${rank} <@${id}>\n└ Level **${data.level}**`;
      })
      .join("\n\n");

    const userRank = ranked.findIndex(
      ([id]) => id === interaction.user.id
    );

    const userData = levels[interaction.user.id] || {
      level: 0
    };

    const embed = new EmbedBuilder()
      .setTitle("🏆 Level Leaderboard")
      .setColor(0x111111)
      .setDescription(
        description || "No ranked members yet."
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
        text: `${ranked.length} ranked members`
      });

    const payload = {
      embeds: [embed],
      allowedMentions: {
        parse: []
      }
    };

    if (interaction.deferred) {
      await interaction.editReply(payload);
    } else if (interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }

  } catch (error) {
    console.error("[LEADERBOARD]", error);

    const payload = {
      content: "Unable to load leaderboard."
    };

    try {
      if (interaction.deferred) {
        await interaction.editReply(payload);
      } else if (interaction.replied) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (err) {
      console.error("[LEADERBOARD REPLY]", err);
    }
  }
}

// ==========================================
// OLD CUSTOMIZATION HANDLERS
// ==========================================

async function handleButton(interaction) {
  if (!interaction.isButton()) return false;

  if (!interaction.customId.startsWith("profile_")) {
    return false;
  }

  await interaction.reply({
    content: "This feature is disabled.",
    ephemeral: true
  });

  return true;
}

async function handleSelect(interaction) {
  if (!interaction.isStringSelectMenu()) return false;

  if (!interaction.customId.startsWith("profile_")) {
    return false;
  }

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
