const fs = require("fs");
const { AttachmentBuilder } = require("discord.js");
const { createLevelCard } = require("./levelcard");
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

function getXPNeeded(level) {
  return Math.floor(100 + Math.pow(level, 2.2) * 10);
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
const gainedXP = Math.floor(Math.random() * 3) + 1;
user.xp += gainedXP;
    const neededXP = getXPNeeded(user.level);

    if (user.xp >= neededXP) {
      user.xp -= neededXP;
      user.level++;

      if (user.level > 125) user.level = 125;

      const reward = getReward(user.level);
user.wl = (user.wl || 0) + reward;
const image = await createLevelCard(
    message.author,
    user.level,
    reward
);

const attachment = new AttachmentBuilder(image, {
    name: "levelup.png"
});

await message.channel.send({
    content: `🎉 Congratulations ${message.author}!`,
    files: [attachment]
});
    }

    saveLevels(data);
  }
};