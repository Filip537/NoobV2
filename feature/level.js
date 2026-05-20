const fs = require("fs");
const { EmbedBuilder } = require("discord.js");

const levelFile = "./levels.json";
const cooldown = new Set();

function ensureFile() {
  if (!fs.existsSync(levelFile)) fs.writeFileSync(levelFile, "{}");
}

function loadLevels() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(levelFile, "utf8"));
  } catch {
    fs.writeFileSync(levelFile, "{}");
    return {};
  }
}

function saveLevels(data) {
  fs.writeFileSync(levelFile, JSON.stringify(data, null, 2));
}

function xpNeeded(level) {
  return 100 + level * 50;
}

async function handleMessage(message) {
  if (!message.guild || message.author.bot) return;

  const key = `${message.guild.id}_${message.author.id}`;
  if (cooldown.has(key)) return;

  cooldown.add(key);
  setTimeout(() => cooldown.delete(key), 60000);

  const data = loadLevels();

  if (!data[message.author.id]) {
    data[message.author.id] = {
      xp: 0,
      level: 1,
      wl: 0,
      messages: 0
    };
  }

  const user = data[message.author.id];

  user.messages = (user.messages || 0) + 1;
  user.xp = (user.xp || 0) + Math.floor(Math.random() * 11) + 15;

  let leveledUp = false;

  while (user.xp >= xpNeeded(user.level || 1)) {
    user.xp -= xpNeeded(user.level || 1);
    user.level = (user.level || 1) + 1;
    user.wl = (user.wl || 0) + 1;
    leveledUp = true;
  }

  data[message.author.id] = user;
  saveLevels(data);

  if (leveledUp) {
    const embed = new EmbedBuilder()
      .setTitle("Level Up!")
      .setColor("Gold")
      .setDescription(
        `${message.author} reached **Level ${user.level}**!\n` +
        `Reward: **+1 World Lock**`
      );

    message.channel.send({
      embeds: [embed],
      allowedMentions: { users: [message.author.id] }
    }).catch(() => {});
  }
}

module.exports = {
  handleMessage,
  loadLevels
};
