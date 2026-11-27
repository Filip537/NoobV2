const fs = require("node:fs/promises");
const path = require("node:path");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
StringSelectMenuBuilder
} = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { attachment } = require("./mediaUpload.js");
const levelFeature = require("./level.js");
const { getProfileDetails } = require("./furrytest.js");
const gameStats = require("./gameStats.js");
const LEVELS_FILE = path.join(__dirname, "..", "levels.json");
const CARD_NAME = "profile.jpg";
const WIDTH = 1100;
const HEIGHT = 560;
const ROLES_PER_PAGE = 10;
const CRIMSON_USER_ID = "1108921222030426172";
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

function crimsonBox(ctx, x, y, w, h, fill = "#251016", edge = "#8E293F") {
  const cut = Math.min(9, h / 3);
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h - cut);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawCrimsonFrame(ctx) {
  crimsonBox(ctx, 20, 20, 1060, 520, "#140C11", "#F63858");

  ctx.fillStyle = "rgba(246, 56, 88, 0.055)";
  for (let y = 35; y < 221; y += 5) {
    ctx.fillRect(31, y, 1038, 1);
  }

  for (const [x, y, w, color] of [
    [32, 19, 118, "#FF3454"], [949, 19, 90, "#FF3454"],
    [1020, 24, 35, "#53EBDC"], [21, 108, 32, "#FF3454"],
    [48, 115, 18, "#53EBDC"], [1030, 155, 50, "#FF3454"],
    [1050, 162, 21, "#53EBDC"], [31, 536, 103, "#FF3454"],
    [930, 539, 125, "#FF3454"]
  ]) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 3);
  }

  ctx.save();
  ctx.shadowColor = "#FF234C";
  ctx.shadowBlur = 13;
  ctx.strokeStyle = "#FF3D59";
  ctx.lineWidth = 5;
  for (const [start, end] of [[0.08, 1.58], [1.72, 3.08], [3.23, 4.58], [4.73, 6.13]]) {
    ctx.beginPath();
    ctx.arc(135, 129, 73, start, end);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = "#53EBDC";
  ctx.lineWidth = 2;
  for (const [start, end] of [[0.15, 0.65], [2.75, 3.32], [4.25, 4.68]]) {
    ctx.beginPath();
    ctx.arc(136, 129, 79, start, end);
    ctx.stroke();
  }
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

async function renderPage(member, user, guild, requestedPage) {
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
  const crimson = user.id === CRIMSON_USER_ID;

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  const accent = crimson ? "#FF7186" : "#A5B4FC";

  ctx.fillStyle = crimson ? "#0D080B" : "#111214";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (crimson) {
    drawCrimsonFrame(ctx);
  } else {
    box(ctx, 20, 20, 1060, 520, 25, "#42444B");
    box(ctx, 22, 22, 1056, 516, 23, "#202125");
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
  box(ctx, 68, 226, 964, 2, 1, crimson ? "#AA3249" : "#373941");

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
    const rankLabel = rank < 0 ? "Unranked" : `#${rank + 1}`;

    if (crimson) {
      crimsonBox(ctx, 68, 352, 475, 50);
      crimsonBox(ctx, 557, 352, 475, 50);
      text(ctx, `Level ${level}`, 86, 377, 430, 30, "#F4F4F5", true);
      text(ctx, `Rank ${rankLabel}`, 575, 377, 430, 30, "#F4F4F5", true);

      const segmentCount = 24;
      const gap = 4;
      const step = 964 / segmentCount;
      for (let index = 0; index < segmentCount; index++) {
        const x = 68 + index * step;
        const width = step - gap;
        const fill = width * Math.max(0, Math.min(1, progress * segmentCount - index));
        box(ctx, x, 420, width, 15, 2, "#3A1721");
        box(ctx, x, 420, fill, 15, 2, "#FF3757");
      }
    } else {
      text(ctx, `Level ${level}     Rank ${rankLabel}`, 68, 382, 964, 33, "#F4F4F5", true);
      box(ctx, 68, 420, 964, 15, 8, "#3F4148");
      box(ctx, 68, 420, 964 * progress, 15, 8, "#6778F5");
    }

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

      const roleColor = role.color ? role.hexColor : "#A2A5AE";
      if (crimson) {
        crimsonBox(ctx, x, y, 475, 38);
        box(ctx, x + 13, y + 8, 5, 22, 2, roleColor);
      } else {
        box(ctx, x, y, 475, 38, 8, "#303239");
        box(ctx, x + 13, y + 13, 12, 12, 6, roleColor);
      }
      text(ctx, role.name, x + 36, y + 20, 425, 22);
    });
  } else {
    const { hobbies, games } = getProfileDetails(guild.id, user.id);
    const columns = [
      { x: 68, label: "Hobbies", entries: hobbies },
      { x: 557, label: "Favourite games", entries: games }
    ];

    for (const { x, label, entries } of columns) {
      if (crimson) {
        crimsonBox(ctx, x - 8, 249, 483, 218, "#1C0E14");
      }
      text(ctx, label, x, 275, 475, 28, "#F4F4F5", true);

      if (!entries.length) {
        text(ctx, "None added yet", x, 319, 475, 24, "#B6BAC4");
      }

      entries.slice(0, 4).forEach((entry, index) => {
        const y = 300 + index * 41;
        if (crimson) {
          crimsonBox(ctx, x, y, 467, 35);
        } else {
          box(ctx, x, y, 475, 35, 8, "#303239");
        }
        text(ctx, entry, x + 12, y + 18, 451, 23);
      });
    }

    if (crimson) {
      crimsonBox(ctx, 60, 480, 980, 40, "#1C161B", "#50424A");
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
    const result = await renderPage(member, user, interaction.guild, 0);

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
    console.error(`[PROFILE] Failed while ${stage}:`, error);
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
      Number(destination)
    );

    await interaction.message.edit({
      attachments: [],
      files: [attachment(result.image, CARD_NAME)],
      components: [pageButtons(ownerId, memberId, result.page, result.totalPages)],
      allowedMentions: NO_MENTIONS
    });
  } catch (error) {
    console.error("[PROFILE] Page update failed:", error);

    const payload = { content: "Could not switch profile pages.", ephemeral: true };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }

  return true;
}
const LEADERBOARD_PREFIX = "nv2leaderboard:";

const LB_CATEGORIES = {
  level: {
    label: "Level",
    short: "LEVEL",
    color: "#4FC3FF",
    accent: "#FFD54A"
  },
  surgery: {
    label: "Surgery",
    short: "SURGERY",
    color: "#71F0A8",
    accent: "#FFD54A"
  },
  startopia: {
    label: "Startopia",
    short: "STARTOPIA",
    color: "#B28CFF",
    accent: "#FFD54A"
  },
  crime: {
    label: "Crime",
    short: "CRIME",
    color: "#FF7A7A",
    accent: "#FFD54A"
  }
};

function leaderboardMenu(ownerId, selected = "level") {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${LEADERBOARD_PREFIX}${ownerId}`)
      .setPlaceholder("Select leaderboard")
      .addOptions(
        Object.entries(LB_CATEGORIES).map(([key, value]) => ({
          label: value.label,
          value: key,
          default: key === selected
        }))
      )
  );
}

async function resolveLeaderboardEntries(guild, category) {
  if (category === "level") {
    const levels = await loadLevels();
    const rankings = getRankings(guild, levels);

    const top = await Promise.all(
      rankings.slice(0, 10).map(async ([id, data], index) => {
        const member =
          guild.members.cache.get(id) ||
          await guild.members.fetch(id).catch(() => null);

        return {
          rank: index + 1,
          id,
          name: member?.displayName || `User ${id.slice(-4)}`,
          score: data.level,
          extra: `XP ${Number(data.xp || 0).toLocaleString("en-US")}`
        };
      })
    );

    return { levels, rankings, top };
  }

  const raw = gameStats
    .getRankings(category)
    .filter(player => !guild.members.cache.get(player.id)?.user?.bot);

  const top = await Promise.all(
    raw.slice(0, 10).map(async (player, index) => {
      const member =
        guild.members.cache.get(player.id) ||
        await guild.members.fetch(player.id).catch(() => null);

      return {
        rank: index + 1,
        id: player.id,
        name: member?.displayName || `User ${player.id.slice(-4)}`,
        score: player.score,
        extra:
          category === "startopia"
            ? "successful voyages"
            : category === "surgery"
              ? "successful surgeries"
              : "wins"
      };
    })
  );

  return { rankings: raw, top };
}

function drawLeaderboardCard(category, entries, rankText, personalText, totalRanked) {
  const canvas = createCanvas(1100, 760);
  const ctx = canvas.getContext("2d");
  const categoryInfo = LB_CATEGORIES[category];

  // background
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#53B8FF");
  gradient.addColorStop(0.45, "#2C78D3");
  gradient.addColorStop(1, "#184A92");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // outer border
  box(ctx, 20, 20, 1060, 720, 24, "#174079");
  box(ctx, 32, 32, 1036, 696, 22, "#2F87E0");

  // top panel
  box(ctx, 55, 50, 990, 95, 20, "#1E4F93");
  box(ctx, 65, 60, 970, 75, 18, "#2E6FC3");

  ctx.fillStyle = "#FFD54A";
  ctx.font = "bold 46px sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("NOOBV2 LEADERBOARD", 90, 98);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(`CATEGORY: ${categoryInfo.short}`, 720, 98);

  // category pills
  const pillKeys = Object.keys(LB_CATEGORIES);
  pillKeys.forEach((key, i) => {
    const selected = key === category;
    const x = 65 + i * 240;
    const y = 165;
    box(ctx, x, y, 215, 48, 16, selected ? "#FFD54A" : "#225DAA");
    text(
      ctx,
      LB_CATEGORIES[key].label,
      x + 20,
      y + 24,
      175,
      24,
      selected ? "#203760" : "#FFFFFF",
      true
    );
  });

  // table header
  box(ctx, 65, 235, 970, 44, 12, "#1D4A88");
  text(ctx, "RANK", 95, 257, 90, 22, "#FFD54A", true);
  text(ctx, "PLAYER", 235, 257, 430, 22, "#FFD54A", true);
  text(ctx, "STAT", 760, 257, 220, 22, "#FFD54A", true);

  const medals = ["🥇", "🥈", "🥉"];

  let y = 295;

  if (!entries.length) {
    box(ctx, 65, y, 970, 60, 14, "#2C67B1");
    text(ctx, "No ranked players yet.", 95, y + 30, 900, 24, "#FFFFFF", true);
  } else {
    for (const entry of entries) {
      box(ctx, 65, y, 970, 48, 12, entry.rank % 2 ? "#2C67B1" : "#245A9D");

      const rankLabel = medals[entry.rank - 1] || `#${entry.rank}`;
      text(ctx, rankLabel, 95, y + 24, 90, 24, "#FFFFFF", true);
      text(ctx, entry.name, 235, y + 24, 430, 24, "#FFFFFF", true);

      const statText =
        category === "level"
          ? `LV ${entry.score} • ${entry.extra}`
          : `${entry.score} • ${entry.extra}`;

      text(ctx, statText, 760, y + 24, 245, 22, categoryInfo.color, true);

      y += 54;
    }
  }

  // footer panels
  box(ctx, 65, 650, 450, 55, 16, "#1D4A88");
  box(ctx, 585, 650, 450, 55, 16, "#1D4A88");

  text(ctx, `YOUR RANK: ${rankText}`, 90, 678, 400, 24, "#FFD54A", true);
  text(ctx, personalText, 610, 678, 400, 24, "#FFFFFF", true);

  ctx.font = "bold 18px sans-serif";
  ctx.fillStyle = "#D9EEFF";
  ctx.fillText(`Ranked Players: ${totalRanked}`, 70, 726);
  ctx.fillText("Growtopia-themed NoobV2 leaderboard", 760, 726);

  return canvas.encode("png");
}

async function buildLeaderboardPayload(interaction, category = "level") {
  const guild = interaction.guild;
  const categoryInfo = LB_CATEGORIES[category];

  const data = await resolveLeaderboardEntries(guild, category);
  const entries = data.top || [];
  const rankings = data.rankings || [];

  let rankText = "Unranked";
  let personalText = "No stats yet";

  if (category === "level") {
    const levels = data.levels || {};
    const myRank = rankings.findIndex(([id]) => id === interaction.user.id);
    const myData = levels[interaction.user.id] || { level: 0, xp: 0 };

    rankText = myRank >= 0 ? `#${myRank + 1}` : "Unranked";
    personalText = `Level ${myData.level} • XP ${Number(myData.xp || 0).toLocaleString("en-US")}`;
  } else {
    const myRank = rankings.findIndex(player => player.id === interaction.user.id);
    const myStats = gameStats.getUserStats(interaction.user.id);
    const myScore = Number(myStats[category] || 0);

    rankText = myRank >= 0 ? `#${myRank + 1}` : "Unranked";
    personalText =
      category === "startopia"
        ? `${myScore} successful voyages`
        : category === "surgery"
          ? `${myScore} successful surgeries`
          : `${myScore} wins`;
  }

const image = await drawLeaderboardCard(
    category,
    entries,
    rankText,
    personalText,
    rankings.length
  );

  return {
    content: null,
    embeds: [],
    files: [attachment(image, "leaderboard.png")],
    components: [leaderboardMenu(interaction.user.id, category)],
    allowedMentions: NO_MENTIONS
  };
}

async function executeLeaderboard(interaction) {
  try {
    if (!interaction.guild) {
      return await interaction.reply({
        content: "Use this command in a server.",
        ephemeral: true
      });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    await interaction.editReply(
      await buildLeaderboardPayload(interaction, "level")
    );
  } catch (error) {
    console.error("[LEADERBOARD]", error);

    const payload = { content: "Unable to load leaderboard." };

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => {});
    } else {
      await interaction.reply({ ...payload, ephemeral: true }).catch(() => {});
    }
  }
}

async function handleSelect(interaction) {
  if (
    !interaction.isStringSelectMenu() ||
    !interaction.customId.startsWith(LEADERBOARD_PREFIX)
  ) {
    return false;
  }

  const ownerId = interaction.customId.slice(LEADERBOARD_PREFIX.length);

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: "Open your own leaderboard with /leaderboard.",
      ephemeral: true
    }).catch(() => {});
    return true;
  }

  const category = interaction.values[0];

  if (!LB_CATEGORIES[category]) {
    await interaction.reply({
      content: "Invalid leaderboard category.",
      ephemeral: true
    }).catch(() => {});
    return true;
  }

  try {
    await interaction.deferUpdate();

    await interaction.editReply(
      await buildLeaderboardPayload(interaction, category)
    );
  } catch (error) {
    console.error("[LEADERBOARD SELECT]", error);

    await interaction.followUp({
      content: "Unable to switch leaderboard.",
      ephemeral: true
    }).catch(() => {});
  }

  return true;
}


module.exports = {
  executeProfile,
  executeLeaderboard,
  createProfileCard,
  handleButton,
  handleSelect
};
