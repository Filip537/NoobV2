
const fs = require("fs");
const path = require("path");

const levelFile = path.join(__dirname, "..", "levels.json");

// ==========================================
// LEVEL CONFIGURATION
// ==========================================

const LEVEL_CHANNEL_ID = "1442714367568248916";

const MAX_LEVEL = 150;

const LEVEL_ROLES = [
  { level: 10, roleId: "1551190845825220669" },
  { level: 20, roleId: "1451111483269447866" },
  { level: 40, roleId: "1451111522339389493" }
];

// ==========================================
// XP CONFIGURATION
// ==========================================

const XP_COOLDOWN = 60 * 1000;
const MIN_XP = 5;
const MAX_XP = 10;

const xpCooldowns = new Map();

// ==========================================
// LOAD LEVEL DATA
// ==========================================

function loadLevels() {
  try {
    if (!fs.existsSync(levelFile)) {
      fs.writeFileSync(levelFile, "{}");
      return {};
    }

    const raw = fs.readFileSync(levelFile, "utf8").trim();

    if (!raw) return null;

    const data = JSON.parse(raw);

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Invalid level data");
    }

    return data;

  } catch (error) {
    console.error("Failed to load levels.json:", error);
    return null;
  }
}

// ==========================================
// SAVE LEVEL DATA
// ==========================================

function saveLevels(data) {
  try {
    const tempFile = `${levelFile}.tmp`;

    fs.writeFileSync(
      tempFile,
      JSON.stringify(data, null, 2)
    );

    fs.renameSync(tempFile, levelFile);

    return true;

  } catch (error) {
    console.error("Failed to save levels.json:", error);
    return false;
  }
}

// ==========================================
// XP CALCULATION
// ==========================================

function getXPNeeded(level) {
  const earlyLevels = {
    0: 15,
    1: 25,
    2: 40,
    3: 60,
    4: 100
  };

  if (level < 5) {
    return earlyLevels[level];
  }

  return Math.floor(
    200 + Math.pow(level, 1.7) * 15
  );
}

function getRandomXP() {
  return Math.floor(
    Math.random() * (MAX_XP - MIN_XP + 1)
  ) + MIN_XP;
}

// ==========================================
// LEVEL REWARD ROLES
// ==========================================

async function updateLevelRoles(member, level) {
  if (!member) return;

  for (const levelRole of LEVEL_ROLES) {
    if (level < levelRole.level) continue;

    try {
      const role = member.guild.roles.cache.get(
        levelRole.roleId
      );

      if (!role) continue;

      if (!member.roles.cache.has(levelRole.roleId)) {
        await member.roles.add(role);
      }

    } catch (error) {
      console.error("Failed to update level role:", error);
    }
  }
}

// ==========================================
// LEVEL-UP ANNOUNCEMENT
// NO PINGS OR NOTIFICATIONS FROM MENTIONS
// ==========================================

async function sendLevelUpMessage(message, level) {
  try {
    const channel = await message.guild.channels
      .fetch(LEVEL_CHANNEL_ID)
      .catch(() => null);

    if (!channel || !channel.isTextBased()) {
      console.error("Level announcement channel not found.");
      return;
    }

    await channel.send({
      content:
        `<@${message.author.id}> has reached level **${level}**. GG!`,

      allowedMentions: {
        parse: [],
        users: [],
        roles: [],
        repliedUser: false
      }
    });

  } catch (error) {
    console.error("Failed to send level-up message:", error);
  }
}

// ==========================================
// MESSAGE XP HANDLER
// ==========================================

async function handleLevelXP(message) {
  if (!message.guild) return;
  if (message.author.bot) return;
  if (message.webhookId) return;

  // Only award XP in the intended server.
  if (!message.guild.channels.cache.has(LEVEL_CHANNEL_ID)) {
    const levelChannel = await message.guild.channels
      .fetch(LEVEL_CHANNEL_ID)
      .catch(() => null);

    if (!levelChannel) return;
  }

  // Prevent XP farming in the announcement channel.
  if (message.channel.id === LEVEL_CHANNEL_ID) return;

  const userId = message.author.id;
  const now = Date.now();

  // Check XP cooldown.
  const lastXP = xpCooldowns.get(userId);

  if (lastXP && now - lastXP < XP_COOLDOWN) {
    return;
  }

  // Reload data to preserve changes from other commands.
  const levels = loadLevels();

  if (levels === null) return;

  // Create new member data.
  if (!levels[userId]) {
    levels[userId] = {
      level: 0,
      xp: 0,
      wl: 0
    };
  }

  const userData = levels[userId];

  // Validate existing data.
  if (
    !Number.isInteger(userData.level) ||
    userData.level < 0 ||
    !Number.isFinite(userData.xp) ||
    userData.xp < 0
  ) {
    console.error(`Invalid level data for ${userId}`);
    return;
  }

  // Maximum level reached.
  if (userData.level >= MAX_LEVEL) return;

  xpCooldowns.set(userId, now);

  // Remove expired cooldown entries.
  const cooldownTimer = setTimeout(() => {
    if (xpCooldowns.get(userId) === now) {
      xpCooldowns.delete(userId);
    }
  }, XP_COOLDOWN);

  cooldownTimer.unref();

  const previousLevel = userData.level;

  // Award XP.
  userData.xp += getRandomXP();

  // Check for level-up.
  while (
    userData.level < MAX_LEVEL &&
    userData.xp >= getXPNeeded(userData.level)
  ) {
    userData.xp -= getXPNeeded(userData.level);
    userData.level++;
  }

  // Stop accumulating XP at maximum level.
  if (userData.level >= MAX_LEVEL) {
    userData.xp = 0;
  }

  // Save progress.
  if (!saveLevels(levels)) {
    xpCooldowns.delete(userId);
    return;
  }

  // Handle level-up.
  if (userData.level > previousLevel) {
    await updateLevelRoles(
      message.member,
      userData.level
    );

    await sendLevelUpMessage(
      message,
      userData.level
    );
  }
}

// ==========================================
// GET USER LEVEL
// ==========================================

function getUserLevel(userId) {
  const levels = loadLevels();

  const userData = levels?.[userId] || {
    level: 0,
    xp: 0,
    wl: 0
  };

  return {
    ...userData,
    requiredXP:
      userData.level >= MAX_LEVEL
        ? 0
        : getXPNeeded(userData.level)
  };
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  handleLevelXP,
  handleMessage: handleLevelXP,
  getUserLevel,
  getXPNeeded,
  MAX_LEVEL
};
