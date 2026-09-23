const fs = require("fs");

const levelFile = "./levels.json";
const LEVEL_CHANNEL_ID = "1552281420368707666";

const LEVEL_ROLES = [
  { level: 10, roleId: "1551190845825220669" },
  { level: 20, roleId: "1451111483269447866" },
  { level: 40, roleId: "1451111522339389493" }
];

const XP_COOLDOWN = 45 * 1000;
const xpCooldowns = new Map();

function loadLevels() {
  if (!fs.existsSync(levelFile)) {
    fs.writeFileSync(levelFile, "{}");
  }

  return JSON.parse(fs.readFileSync(levelFile, "utf8"));
}

function saveLevels(data) {
  fs.writeFileSync(levelFile, JSON.stringify(data, null, 2));
}

function getXPNeeded(level) {
  return Math.floor(150 + Math.pow(level, 2.35) * 15);
}

function getReward(level) {
  return Math.floor(3 + level * 1.5);
}

async function updateLevelRoles(member, level) {
  if (!member) return;

  try {
    for (const levelRole of LEVEL_ROLES) {
      if (level < levelRole.level) continue;

      const role = member.guild.roles.cache.get(levelRole.roleId);

      if (!role) continue;

      if (!member.roles.cache.has(levelRole.roleId)) {
        await member.roles.add(role);
      }
    }
  } catch (error) {
    console.error("Failed to update level roles:", error);
  }
}

async function sendLevelUpMessage(message, level) {
  try {
    let channel =
      message.guild.channels.cache.get(LEVEL_CHANNEL_ID);

    if (!channel) {
      channel = await message.guild.channels.fetch(
        LEVEL_CHANNEL_ID
      ).catch(() => null);
    }

    if (!channel || !channel.isTextBased()) {
      console.error("Level channel not found.");
      return;
    }

    await channel.send({
      content: `${message.author} has reached level **${level}**. GG!`,
      allowedMentions: {
        users: [message.author.id]
      }
    });
  } catch (error) {
    console.error("Failed to send level up message:", error);
  }
}

module.exports = {
  async handleMessage(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const userId = message.author.id;
    const now = Date.now();
    const lastXP = xpCooldowns.get(userId) || 0;

    if (now - lastXP < XP_COOLDOWN) return;

    xpCooldowns.set(userId, now);

    const data = loadLevels();

    if (!data[userId]) {
      data[userId] = {
        xp: 0,
        level: 1,
        wl: 0
      };
    }

    const user = data[userId];

    const gainedXP = Math.random() < 0.7 ? 1 : 2;

    user.xp += gainedXP;

    let neededXP = getXPNeeded(user.level);
    const reachedLevels = [];

    while (
      user.xp >= neededXP &&
      user.level < 125
    ) {
      user.xp -= neededXP;
      user.level++;

      reachedLevels.push(user.level);

      const reward = getReward(user.level);
      user.wl = (user.wl || 0) + reward;

      neededXP = getXPNeeded(user.level);
    }

    if (user.level > 125) {
      user.level = 125;
    }

    await updateLevelRoles(message.member, user.level);

    for (const level of reachedLevels) {
      await sendLevelUpMessage(message, level);
    }

    saveLevels(data);
  },

  getXPNeeded,
  updateLevelRoles
};