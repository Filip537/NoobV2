const fs = require("node:fs/promises");
const path = require("node:path");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { attachment } = require("./mediaUpload.js");
const levelFeature = require("./level.js");
const { getProfileDetails } = require("./furrytest.js");

const LEVELS_FILE = path.join(__dirname, "..", "levels.json");
const CARD_NAME = "profile.jpg";
const WIDTH = 1100;
const HEIGHT = 560;
const ROLES_PER_PAGE = 10;
const LEGENDARY_LEVEL = 150;
const LEGENDARY_PREVIEW_USER_ID = "1108921222030426172";
const BUTTON_PREFIX = "nv2profile:";
const NO_MENTIONS = { parse: [] };

const joinDateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});

async function loadLevels() {
  try {
    const data = JSON.parse(await fs.readFile(LEVELS_FILE, "utf8"));

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Invalid levels.json");
    }

    return data;
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

function getRankings(guild, levels) {
  return Object.entries(levels)
    .filter(([id, data]) =>
      /^\d{17,20}$/.test(id) &&
      data &&
      Number.isInteger(data.level) &&
      data.level >= 0 &&
      !guild.members.cache.get(id)?.user?.bot &&
      (data.level > 0 || Number(data.xp || 0) > 0)
    )
    .sort((a, b) =>
      b[1].level - a[1].level ||
      Number(b[1].xp || 0) - Number(a[1].xp || 0)
    );
}

function getRoles(member, guild) {
  return [...member.roles.cache.values()]
    .filter(role => role.id !== guild.id)
    .sort((a, b) => b.comparePositionTo(a));
}

async function loadAvatar(member, user) {
  try {
    const options = { extension: "png", forceStatic: true, size: 256 };
    const url = member.displayAvatarURL(options) || user.displayAvatarURL(options);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(1800)
    });

    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }

    return await loadImage(Buffer.from(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

function box(ctx, x, y, width, height, radius, color) {
  if (width <= 0 || height <= 0) return;

  ctx.beginPath();
  ctx.roundRect(x, y, width, height, Math.min(radius, width / 2, height / 2));
  ctx.fillStyle = color;
  ctx.fill();
}

function text(ctx, value, x, y, width, size, color = "#F4F4F5", bold = false) {
  ctx.font = `${bold ? "bold " : ""}${size}px sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;

  let label = String(value);

  if (ctx.measureText(label).width > width) {
    const characters = Array.from(label);

    while (characters.length && ctx.measureText(`${characters.join("")}…`).width > width) {
      characters.pop();
    }

    label = `${characters.join("")}…`;
  }

  ctx.fillText(label, x, y);
}

function crystalGradient(ctx, x1, y1, x2, y2) {
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  gradient.addColorStop(0, "#A765F9");
  gradient.addColorStop(0.5, "#E1CCFF");
  gradient.addColorStop(1, "#4DDCF4");
  return gradient;
}

function drawLegendaryDetails(ctx) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(135, 129, 72, 0, Math.PI * 2);
  ctx.strokeStyle = crystalGradient(ctx, 68, 62, 202, 196);
  ctx.lineWidth = 5;
  ctx.shadowColor = "#9B72FF";
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.restore();

  const crystals = [
    { x: 1043, y: 83, width: 15, height: 37, color: "#AC74F5" },
    { x: 1058, y: 113, width: 8, height: 22, color: "#64DDF4" },
    { x: 1048, y: 479, width: 15, height: 41, color: "#7653CD" },
    { x: 1062, y: 506, width: 8, height: 23, color: "#8AE7FF" }
  ];

  for (const { x, y, width, height, color } of crystals) {
    ctx.beginPath();
    ctx.moveTo(x, y - height);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x - width, y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, y - height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x - width, y);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fill();
  }

  box(ctx, 825, 33, 180, 30, 7, "#E4BA68");
  box(ctx, 827, 35, 176, 26, 6, "#302019");
  text(ctx, "LEGENDARY", 853, 48, 135, 18, "#FFDB88", true);
}

function drawAvatar(ctx, avatar, username) {
  const x = 68;
  const y = 62;
  const size = 134;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = "#3F4148";
  ctx.fillRect(x, y, size, size);

  if (avatar) {
    const scale = Math.max(size / avatar.width, size / avatar.height);
    const width = avatar.width * scale;
    const height = avatar.height * scale;

    ctx.drawImage(
      avatar,
      x + (size - width) / 2,
      y + (size - height) / 2,
      width,
      height
    );
  } else {
    const initial = Array.from(username)[0]?.toUpperCase() || "?";
    ctx.textAlign = "center";
    text(ctx, initial, x + size / 2, y + size / 2, size, 52, "#F4F4F5", true);
  }

  ctx.restore();
}

async function renderPage(member, user, guild, requestedPage, viewerId) {
  const roles = getRoles(member, guild);
  const rolePages = Math.max(1, Math.ceil(roles.length / ROLES_PER_PAGE));
  const totalPages = rolePages + 2;
  const page = Math.max(0, Math.min(requestedPage, totalPages - 1));

  const [avatar, levels] = await Promise.all([
    loadAvatar(member, user),
    loadLevels()
  ]);

  const data = levels[user.id] || {};
  const savedLevel = Number(data.level) || 0;
  const legendary =
    savedLevel >= LEGENDARY_LEVEL ||
    viewerId === LEGENDARY_PREVIEW_USER_ID;

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  const accent = legendary ? "#FFDB88" : "#A5B4FC";
  const tileColor = legendary ? "#2A2239" : "#303239";

  ctx.fillStyle = legendary ? "#080910" : "#111214";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  box(ctx, 20, 20, 1060, 520, 25, legendary ? "#E4BA68" : "#42444B");
  box(ctx, 23, 23, 1054, 514, 23, legendary ? "#151220" : "#202125");

  if (legendary) {
    drawLegendaryDetails(ctx);
  }

  drawAvatar(ctx, avatar, user.username);

  const displayName = member.displayName || user.globalName || user.username;
  text(ctx, displayName, 240, 84, 760, 53, "#F4F4F5", true);
  text(ctx, `@${user.username}`, 242, 139, 760, 29, "#B6BAC4");

  const section = page === 0
    ? "Overview"
    : page === totalPages - 1
      ? "About"
      : "Server Roles";

  text(ctx, section, 242, 185, 760, 24, accent, true);
  box(ctx, 68, 226, 964, 2, 1, legendary ? "#A8824D" : "#373941");

  if (page === 0) {
    const maxLevel = levelFeature.MAX_LEVEL || 150;
    const level = Math.max(0, Math.min(maxLevel, Math.floor(savedLevel)));
    const xp = Math.max(0, Math.floor(Number(data.xp) || 0));
    const needed = level >= maxLevel ? 0 : levelFeature.getXPNeeded(level);
    const progress = level >= maxLevel ? 1 : needed > 0 ? Math.min(1, xp / needed) : 0;
    const rank = getRankings(guild, levels).findIndex(([id]) => id === user.id);
    const topRole = user.id === guild.ownerId ? "Owner" : roles[0]?.name || "Member";
    const joined = member.joinedAt ? joinDateFormat.format(member.joinedAt) : "Unknown";

    text(ctx, topRole, 68, 277, 964, 33, "#F4F4F5", true);
    text(ctx, `Joined ${joined}`, 68, 321, 964, 27, "#B6BAC4");
    text(
      ctx,
      `Level ${level}     Rank ${rank < 0 ? "Unranked" : `#${rank + 1}`}`,
      68, 382, 964, 33, "#F4F4F5", true
    );

    const xpFill = legendary
      ? crystalGradient(ctx, 68, 420, 1032, 420)
      : "#6778F5";

    box(ctx, 68, 420, 964, 15, 8, legendary ? "#39304B" : "#3F4148");
    box(ctx, 68, 420, 964 * progress, 15, 8, xpFill);

    const xpLabel = level >= maxLevel
      ? "Max level"
      : `${xp.toLocaleString("en-US")} / ${needed.toLocaleString("en-US")} XP`;

    text(ctx, xpLabel, 68, 468, 964, 27, "#B6BAC4");
  } else if (page < totalPages - 1) {
    const start = (page - 1) * ROLES_PER_PAGE;
    const shown = roles.slice(start, start + ROLES_PER_PAGE);

    text(ctx, `${roles.length} roles · ${page} / ${rolePages}`, 68, 260, 964, 23, "#B6BAC4");

    if (!shown.length) {
      text(ctx, "No server roles to display.", 68, 316, 964, 27);
    }

    shown.forEach((role, index) => {
      const x = 68 + (index % 2) * 489;
      const y = 286 + Math.floor(index / 2) * 44;

      box(ctx, x, y, 475, 38, 8, tileColor);
      box(ctx, x + 13, y + 13, 12, 12, 6, role.color ? role.hexColor : "#A2A5AE");
      text(ctx, role.name, x + 36, y + 20, 425, 22);
    });
  } else {
    const { hobbies, games } = getProfileDetails(guild.id, user.id);
    const columns = [
      { x: 68, label: "Hobbies", entries: hobbies },
      { x: 557, label: "Favourite games", entries: games }
    ];

    for (const { x, label, entries } of columns) {
      text(ctx, label, x, 275, 475, 28, "#F4F4F5", true);

      if (!entries.length) {
        text(ctx, "None added yet", x, 319, 475, 24, "#B6BAC4");
      }

      entries.slice(0, 4).forEach((entry, index) => {
        const y = 300 + index * 41;
        box(ctx, x, y, 475, 35, 8, tileColor);
        text(ctx, entry, x + 12, y + 18, 451, 23);
      });
    }

    text(ctx, "Achievements · Coming soon", 68, 500, 964, 27, "#B6BAC4", true);
  }

  return { image: await canvas.encode("jpeg", 86), page, totalPages };
}

async function createProfileCard(member, user, guild) {
  const result = await renderPage(member, user, guild, 0);
  return result.image;
}

function pageButtons(ownerId, memberId, page, totalPages) {
  const prefix = `${BUTTON_PREFIX}${ownerId}:${memberId}:`;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}${page - 1}`)
      .setLabel("‹ Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`${prefix}indicator`)
      .setLabel(`${page + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${prefix}${page + 1}`)
      .setLabel("Next ›")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === totalPages - 1)
  );
}

async function executeProfile(interaction) {
  let stage = "acknowledging the command";
  let cardMessage;

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    if (!interaction.guild || typeof interaction.channel?.send !== "function") {
      return await interaction.editReply("Use `/profile` in a server text channel.");
    }

    stage = "loading the server member";

    const user = interaction.options.getUser("user") || interaction.user;
    const member =
      interaction.options.getMember("user") ||
      interaction.guild.members.cache.get(user.id) ||
      await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      return await interaction.editReply("I couldn’t find that member in this server.");
    }

    stage = "rendering the card";
    const result = await renderPage(member, user, interaction.guild, 0, interaction.user.id);

    stage = "uploading the card";
    cardMessage = await interaction.channel.send({
      files: [attachment(result.image, CARD_NAME)],
      components: [pageButtons(interaction.user.id, user.id, result.page, result.totalPages)],
      allowedMentions: NO_MENTIONS
    });

    stage = "updating the command reply";
    await interaction.editReply({
      content: `[View profile card](${cardMessage.url})`,
      allowedMentions: NO_MENTIONS
    });
  } catch (error) {
    console.error(`[PROFILE] Failed while ${stage}:`, error.code ?? error.message);
    if (cardMessage) return;

    const content = `Could not show the profile while ${stage}.`;

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content }).catch(() => {});
    } else {
      await interaction.reply({ content, ephemeral: true }).catch(() => {});
    }
  }
}

async function handleButton(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith(BUTTON_PREFIX)) {
    return false;
  }

  const [ownerId, memberId, destination] = interaction.customId
    .slice(BUTTON_PREFIX.length)
    .split(":");

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: "Only the person who opened this profile can change its pages.",
      ephemeral: true
    });
    return true;
  }

  if (!interaction.guild || !/^\d+$/.test(destination)) {
    await interaction.reply({ content: "This page is unavailable.", ephemeral: true });
    return true;
  }

  try {
    await interaction.deferUpdate();

    const member =
      interaction.guild.members.cache.get(memberId) ||
      await interaction.guild.members.fetch(memberId).catch(() => null);

    if (!member) {
      await interaction.followUp({
        content: "I couldn’t find that member in this server.",
        ephemeral: true
      });
      return true;
    }

    const result = await renderPage(
      member,
      member.user,
      interaction.guild,
      Number(destination),
      interaction.user.id
    );

    await interaction.message.edit({
      attachments: [],
      files: [attachment(result.image, CARD_NAME)],
      components: [pageButtons(ownerId, memberId, result.page, result.totalPages)],
      allowedMentions: NO_MENTIONS
    });
  } catch (error) {
    console.error("[PROFILE] Page update failed:", error.code ?? error.message);

    const payload = { content: "Could not switch profile pages.", ephemeral: true };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }

  return true;
}

async function executeLeaderboard(interaction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    if (!interaction.guild) {
      return await interaction.editReply("Use this command in a server.");
    }

    const levels = await loadLevels();
    const rankings = getRankings(interaction.guild, levels);
    const myRank = rankings.findIndex(([id]) => id === interaction.user.id);
    const myData = levels[interaction.user.id] || { level: 0, xp: 0 };

    const description = rankings
      .slice(0, 10)
      .map(([id, data], index) =>
        `**#${index + 1}** <@${id}>\n` +
        `Level **${data.level}** | XP **${Number(data.xp || 0).toLocaleString("en-US")}**`
      )
      .join("\n\n");

    const embed = new EmbedBuilder()
      .setTitle("Level Leaderboard")
      .setColor(0x3498DB)
      .setDescription(description || "No ranked members yet.")
      .addFields({
        name: "Your Ranking",
        value:
          `Rank: **${myRank >= 0 ? `#${myRank + 1}` : "Unranked"}**\n` +
          `Level: **${myData.level}**\n` +
          `XP: **${Number(myData.xp || 0).toLocaleString("en-US")}**`
      })
      .setFooter({ text: `${rankings.length} ranked members | NoobV2` });

    await interaction.editReply({
      embeds: [embed],
      allowedMentions: NO_MENTIONS
    });
  } catch (error) {
    console.error("[LEADERBOARD]", error.code ?? error.message);

    const content = "Unable to load leaderboard.";

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content }).catch(() => {});
    } else {
      await interaction.reply({ content, ephemeral: true }).catch(() => {});
    }
  }
}

async function handleSelect() {
  return false;
}

module.exports = {
  executeProfile,
  executeLeaderboard,
  createProfileCard,
  handleButton,
  handleSelect
};
