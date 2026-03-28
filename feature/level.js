const fs = require("fs");

const levelFile = "./levels.json";

function loadLevels() {
  if (!fs.existsSync(levelFile)) {
    fs.writeFileSync(levelFile, "{}");
  }
  return JSON.parse(fs.readFileSync(levelFile, "utf8"));
}

function saveLevels(data) {
  fs.writeFileSync(levelFile, JSON.stringify(data, null, 2));
}

// XP formula (easy → hard scaling)
function getXPNeeded(level) {
  return Math.floor(50 + (level * level * 2.5)); 
}

// Reward system (World Locks scaling)
function getReward(level) {
  return Math.floor(5 + level * 2); 
}

module.exports = {
  async handleMessage(message) {
    if (message.author.bot) return;

    const data = loadLevels();

    if (!data[message.author.id]) {
      data[message.author.id] = {
        xp: 0,
        level: 1
      };
    }

    const user = data[message.author.id];

    // XP per message (random small amount)
    const gainedXP = Math.floor(Math.random() * 5) + 3; // 3–7 XP
    user.xp += gainedXP;

    const neededXP = getXPNeeded(user.level);

    if (user.xp >= neededXP) {
      user.xp -= neededXP;
      user.level++;

      if (user.level > 125) user.level = 125;

      const reward = getReward(user.level);

      // LEVEL UP MESSAGE
      await message.channel.send(
        `***<:Announcement:1324498827918708746> You reach Level ${user.level} and earned ${neededXP} XP and ${reward} <:World_Lock:1457364439899836501> World Locks nice!***`
      );
    }

    saveLevels(data);
  }
};