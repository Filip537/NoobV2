const fs = require("fs");
const { EmbedBuilder } = require("discord.js");

const LEVELS_FILE = "./levels.json";

const cooldowns = {
  daily: 24 * 60 * 60 * 1000,
  work: 60 * 60 * 1000,
  beg: 5 * 60 * 1000,
  crime: 10 * 60 * 1000,
  rob: 30 * 60 * 1000
};

function loadLevelsData() {
  if (!fs.existsSync(LEVELS_FILE)) {
    fs.writeFileSync(LEVELS_FILE, "{}");
  }

  try {
    return JSON.parse(fs.readFileSync(LEVELS_FILE, "utf8"));
  } catch {
    fs.writeFileSync(LEVELS_FILE, "{}");
    return {};
  }
}

function saveLevelsData(data) {
  fs.writeFileSync(LEVELS_FILE, JSON.stringify(data, null, 2));
}

function ensureUser(levels, userId) {
  if (!levels[userId]) {
    levels[userId] = {
      xp: 0,
      level: 1,
      wl: 0,
      cooldowns: {}
    };
  }

  if (!levels[userId].cooldowns) levels[userId].cooldowns = {};
  if (typeof levels[userId].wl !== "number") levels[userId].wl = 0;

  return levels[userId];
}

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function checkCooldown(userData, key) {
  const now = Date.now();
  const lastUsed = userData.cooldowns[key] || 0;
  const remaining = cooldowns[key] - (now - lastUsed);

  if (remaining > 0) return remaining;

  userData.cooldowns[key] = now;
  return 0;
}

async function handleCommand(interaction) {
  if (!interaction.isChatInputCommand()) return false;

  const command = interaction.commandName;

  if (!["daily", "work", "beg", "crime", "rob", "pay"].includes(command)) {
    return false;
  }

  const levels = loadLevelsData();
  const userData = ensureUser(levels, interaction.user.id);

  if (command === "daily") {
    const remaining = checkCooldown(userData, "daily");

    if (remaining > 0) {
      return interaction.reply({
        content: `⏳ You already claimed daily. Try again in **${formatTime(remaining)}**.`,
        ephemeral: true
      });
    }

    const amount = random(10, 50);
    userData.wl += amount;
    saveLevelsData(levels);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("Green")
          .setTitle("Daily Reward")
          .setDescription(`You claimed **${amount} WL**.\nBalance: **${userData.wl} WL**`)
      ]
    });
  }

  if (command === "work") {
    const remaining = checkCooldown(userData, "work");

    if (remaining > 0) {
      return interaction.reply({
        content: `⏳ You are tired. Work again in **${formatTime(remaining)}**.`,
        ephemeral: true
      });
    }

    const jobs = [
      "farmed dirt blocks",
      "cleaned the casino floor",
      "delivered Growtopia items",
      "worked at the WL bank",
      "sold suspicious soup",
      "helped an admin with tickets"
    ];

    const amount = random(5, 20);
    userData.wl += amount;
    saveLevelsData(levels);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("Blue")
          .setTitle("Work Complete")
          .setDescription(`You ${jobs[random(0, jobs.length - 1)]} and earned **${amount} WL**.\nBalance: **${userData.wl} WL**`)
      ]
    });
  }

  if (command === "beg") {
    const remaining = checkCooldown(userData, "beg");

    if (remaining > 0) {
      return interaction.reply({
        content: `⏳ You begged recently. Try again in **${formatTime(remaining)}**.`,
        ephemeral: true
      });
    }

    const success = Math.random() < 0.35;

    if (!success) {
      saveLevelsData(levels);
      return interaction.reply("😭 Nobody gave you anything.");
    }

    const amount = random(1, 10);
    userData.wl += amount;
    saveLevelsData(levels);

    return interaction.reply(`🙏 Someone felt bad and gave you **${amount} WL**.\nBalance: **${userData.wl} WL**`);
  }

  if (command === "crime") {
    const remaining = checkCooldown(userData, "crime");

    if (remaining > 0) {
      return interaction.reply({
        content: `⏳ Lay low for **${formatTime(remaining)}** before doing another crime.`,
        ephemeral: true
      });
    }

    const success = Math.random() < 0.45;

    if (success) {
      const amount = random(15, 60);
      userData.wl += amount;
      saveLevelsData(levels);

      return interaction.reply(`🕶️ Crime successful. You gained **${amount} WL**.\nBalance: **${userData.wl} WL**`);
    }

    const loss = Math.min(userData.wl, random(5, 30));
    userData.wl -= loss;
    saveLevelsData(levels);

    return interaction.reply(`🚓 You got caught and lost **${loss} WL**.\nBalance: **${userData.wl} WL**`);
  }

  if (command === "rob") {
    const target = interaction.options.getUser("user");

    if (!target || target.bot || target.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ You cannot rob this user.",
        ephemeral: true
      });
    }

    const remaining = checkCooldown(userData, "rob");

    if (remaining > 0) {
      return interaction.reply({
        content: `⏳ You can rob again in **${formatTime(remaining)}**.`,
        ephemeral: true
      });
    }

    const targetData = ensureUser(levels, target.id);

    if (targetData.wl < 10) {
      saveLevelsData(levels);
      return interaction.reply({
        content: "❌ This user does not have enough WL to rob.",
        ephemeral: true
      });
    }

    const success = Math.random() < 0.35;

    if (success) {
      const stolen = random(1, Math.min(30, targetData.wl));
      targetData.wl -= stolen;
      userData.wl += stolen;
      saveLevelsData(levels);

      return interaction.reply(`🥷 You robbed ${target} and stole **${stolen} WL**.\nYour Balance: **${userData.wl} WL**`);
    }

    const fine = Math.min(userData.wl, random(5, 20));
    userData.wl -= fine;
    saveLevelsData(levels);

    return interaction.reply(`🚨 Robbery failed. You paid **${fine} WL** as a fine.\nBalance: **${userData.wl} WL**`);
  }

  if (command === "pay") {
    const target = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");

    if (!target || target.bot || target.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ You cannot pay this user.",
        ephemeral: true
      });
    }

    if (!amount || amount <= 0) {
      return interaction.reply({
        content: "❌ Amount must be higher than 0.",
        ephemeral: true
      });
    }

    if (userData.wl < amount) {
      return interaction.reply({
        content: `❌ You do not have enough WL.\nBalance: **${userData.wl} WL**`,
        ephemeral: true
      });
    }

    const targetData = ensureUser(levels, target.id);

    userData.wl -= amount;
    targetData.wl += amount;

    saveLevelsData(levels);

    return interaction.reply(`💸 ${interaction.user} paid ${target} **${amount} WL**.\nYour Balance: **${userData.wl} WL**`);
  }

  return false;
}

module.exports = {
  handleCommand
};