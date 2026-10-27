
const fs = require("fs");

const levelFile = "./levels.json";

const LEVEL_CHANNEL_ID = "1559764175126007838";
const WL_EMOJI = "<:ItemSprites67:1455752235966533662>";

const MAX_LEVEL = 125;

// Level reward roles
const LEVEL_ROLES = [
  { level: 10, roleId: "1551190845825220669" },
  { level: 20, roleId: "1451111483269447866" },
  { level: 40, roleId: "1451111522339389493" }
];

// XP settings
const XP_COOLDOWN = 30 * 1000;
const MIN_XP = 8;
const MAX_XP = 15;

const xpCooldowns = new Map();

// Load saved levels
function loadLevels() {
  try {
    if (!fs.existsSync(levelFile)) {
      fs.writeFileSync(levelFile, "{}");
      return {};
    }

    const raw = fs.readFileSync(levelFile, "utf8").trim();

    if (!raw) {
      return {};
    }

    return JSON.parse(raw);

  } catch (error) {
    console.error("Failed to load levels.json:", error);
    // Avoid overwriting potentially recoverable data.
    return null;
  }
}

// Save levels
function saveLevels(data) {
  try {
    fs.writeFileSync(
      levelFile,
      JSON.stringify(data, null, 2)
    );

  } catch (error) {
    console.error("Failed to save levels.json:", error);
  }
}

// XP needed for next level
function getXPNeeded(level) {
  return Math.floor(
    100 + Math.pow(level, 1.65) * 12
  );
}

// Random XP per message
function getRandomXP() {
  return Math.floor(
    Math.random() * (MAX_XP - MIN_XP + 1)
  ) + MIN_XP;
}

// Random WL reward based on level
function getReward(level) {
  const min = Math.max(1, level * 2);
  const max = Math.max(min, level * 4);

  return Math.floor(
    Math.random() * (max - min + 1)
  ) + min;
}

// Update level roles
async function updateLevelRoles(member, level) {
  if (!member) return;

  try {
    for (const levelRole of LEVEL_ROLES) {
      if (level < levelRole.level) continue;

      const role = member.guild.roles.cache.get(
        levelRole.roleId
      );

      if (!role) continue;

      if (!member.roles.cache.has(levelRole.roleId)) {
        await member.roles.add(role);
      }
    }

  } catch (error) {
    console.error("Failed to update level roles:", error);
  }
}

// Send permanent level-up announcement
async function sendLevelUpMessage(message, level, reward) {
  try {
    let channel = message.guild.channels.cache.get(
      LEVEL_CHANNEL_ID
    );

    if (!channel) {
      channel = await message.guild.channels
        .fetch(LEVEL_CHANNEL_ID)
        .catch(() => null);
    }

    if (!channel || !channel.isTextBased()) {
      console.error("Level channel not found.");
      return;
    }

    await channel.send({
      content:
        `${message.author} has reached level **${level}** ` +
        `and earned **${reward}** ${WL_EMOJI}! GG!`,

      allowedMentions: {
        users: [message.author.id]
      }
    });

    // No automatic message deletion

  } catch (error) {
    console.error("Failed to send level up message:", error);
  }
}

// Main leveling system
module.exports = {

  async handleMessage(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const userId = message.author.id;
    const now = Date.now();

    // Use guild + user to prevent cooldown conflicts
    const cooldownKey = `${message.guild.id}:${userId}`;

    const lastXP = xpCooldowns.get(cooldownKey) || 0;

    if (now - lastXP < XP_COOLDOWN) return;

    const data = loadLevels();

    if (!data) return;

    if (!data[userId]) {
      data[userId] = {
        xp: 0,
        level: 1,
        wl: 0
      };
    }

    const user = data[userId];

    // Keep existing saved progress
    user.xp = Number(user.xp) || 0;
    user.level = Number(user.level) || 1;
    user.wl = Number(user.wl) || 0;

    // Prevent exceeding maximum level
    user.level = Math.min(user.level, MAX_LEVEL);

    xpCooldowns.set(cooldownKey, now);

    // Stop XP gain at max level
    if (user.level >= MAX_LEVEL) {
      await updateLevelRoles(message.member, user.level);
      return;
    }

    // Buffed XP gain
    const gainedXP = getRandomXP();

    user.xp += gainedXP;

    let neededXP = getXPNeeded(user.level);

    const reachedLevels = [];

    // Support multiple level-ups
    while (
      user.xp >= neededXP &&
      user.level < MAX_LEVEL
    ) {
      user.xp -= neededXP;
      user.level++;

      // Random WL reward
      const reward = getReward(user.level);

      // Add WL to saved balance
      user.wl += reward;

      reachedLevels.push({
        level: user.level,
        reward
      });

      neededXP = getXPNeeded(user.level);
    }

    // Save progress before announcements
    saveLevels(data);

    // Update level roles
    await updateLevelRoles(message.member, user.level);

    // Announce each level-up
    for (const { level, reward } of reachedLevels) {
      await sendLevelUpMessage(
        message,
        level,
        reward
      );
    }
  },

  getXPNeeded,
  getReward,
  updateLevelRoles
};
