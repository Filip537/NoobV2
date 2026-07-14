const fs = require("fs");
const path = require("path");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const levelsFile = path.join(__dirname, "..", "levels.json");
const taskFile = path.join(__dirname, "..", "taskData.json");

const TASK_CHANNEL = "1522730887081623684";
const TASK_DURATION_MS = 13 * 24 * 60 * 60 * 1000;
const TASK_REQUIREMENTS = {
  wigglyWorm: 25,
  whale: 50,
  gar: 5,
  alpha_shark: 10
};

const TASK_REWARD_WL = 2000; // 10 DL

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function ensureUser(levels, userId) {
  if (!levels[userId]) levels[userId] = { level: 1, xp: 0, wl: 0 };
  if (!levels[userId].items) levels[userId].items = {};
  if (!Array.isArray(levels[userId].fishBackpack)) levels[userId].fishBackpack = [];
  return levels[userId];
}

function normalize(value = "") {
  return String(value).toLowerCase().replace(/\.(webp|png|jpg|jpeg)$/i, "").replace(/[^a-z0-9]/g, "");
}

function getFishAmount(data, key) {
  const names = {
    whale: ["whale"],
    gar: ["gar"],
    alpha_shark: ["alphashark", "alpha_shark", "alpha-shark"]
  };

  const targets = names[key] || [key];
  let total = 0;

  for (const fish of data.fishBackpack || []) {
    const fishKey = normalize(fish.key);
    const fishName = normalize(fish.name);
    const fishFile = normalize(fish.file);

    if (targets.some(t => [fishKey, fishName, fishFile].includes(normalize(t)))) {
      total += Number(fish.amount || 1);
    }
  }

  return total;
}

function removeFish(data, key, amount) {
  const targets = {
    whale: ["whale"],
    gar: ["gar"],
    alpha_shark: ["alphashark", "alpha_shark", "alpha-shark"]
  }[key] || [key];

  let remaining = amount;

  for (const fish of data.fishBackpack || []) {
    const fishKey = normalize(fish.key);
    const fishName = normalize(fish.name);
    const fishFile = normalize(fish.file);

    const match = targets.some(t => [fishKey, fishName, fishFile].includes(normalize(t)));
    if (!match) continue;

    const current = Number(fish.amount || 1);
    const take = Math.min(current, remaining);

    fish.amount = current - take;
    remaining -= take;

    if (remaining <= 0) break;
  }

  if (remaining > 0) return false;

  data.fishBackpack = data.fishBackpack.filter(fish => Number(fish.amount || 0) > 0);
  return true;
}

function hasRequirements(data) {
  return (
    (data.items?.wigglyWorm || 0) >= TASK_REQUIREMENTS.wigglyWorm &&
    getFishAmount(data, "whale") >= TASK_REQUIREMENTS.whale &&
    getFishAmount(data, "gar") >= TASK_REQUIREMENTS.gar &&
    getFishAmount(data, "alpha_shark") >= TASK_REQUIREMENTS.alpha_shark
  );
}

function taskEmbed(taskData) {
  const endsAt = Math.floor(taskData.endsAt / 1000);

  return new EmbedBuilder()
    .setColor(0xFFD54A)
    .setTitle("📋 Today's Delivery Task")
    .setDescription(
      "The Salesman has a special delivery order today!\n\n" +
      "**Required Items**\n\n" +
      "<:wigglyworm:1524016362727542784> **25× Wiggly Worms**\n" +
      "<:Whale:1524016299695542292> **50× Whale**\n" +
      "<:Gar:1524016311590588597> **5× Gar**\n" +
      "<:AlphaShark:1524016301989691392> **10× Alpha Shark**\n\n" +
      "**Reward:** **20 Diamond Locks**\n\n" +
      `**Ends:** <t:${endsAt}:R>\n` +
      "**Each player can complete this task only once.**"
    )
    .setFooter({
      text: "Complete all requirements before turning them in."
    })
    .setTimestamp();
}

function taskRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("daily_task_turnin")
      .setLabel("Turn-in Items")
      .setStyle(ButtonStyle.Success)
  );
}

async function handleCommand(interaction, client) {
  if (!interaction.isChatInputCommand()) return false;
  if (interaction.commandName !== "sendtask") return false;

  await interaction.deferReply({ ephemeral: true });

  const taskData = {
    taskId: Date.now().toString(),
    createdAt: Date.now(),
    endsAt: Date.now() + TASK_DURATION_MS,
    completed: []
  };

  const channel = await client.channels.fetch(TASK_CHANNEL).catch(err => {
    console.error("Task channel fetch error:", err);
    return null;
  });

  if (!channel || !channel.isTextBased()) {
    return interaction.editReply({
      content: "❌ Task channel not found or bot cannot access it."
    });
  }

  try {
    await channel.send({
      embeds: [taskEmbed(taskData)],
      components: [taskRow()]
    });

    saveJson(taskFile, taskData);

    return interaction.editReply({
      content: `✅ Task sent to <#${TASK_CHANNEL}>.`
    });
  } catch (err) {
    console.error("Task send error:", err);

    return interaction.editReply({
      content: "❌ Failed to send task. Check bot permission in the task channel."
    });
  }
}
async function handleButton(interaction) {
  if (!interaction.isButton()) return false;
  if (interaction.customId !== "daily_task_turnin") return false;

  const taskData = loadJson(taskFile, null);

  if (!taskData || !taskData.endsAt) {
    await interaction.reply({
      content: "❌ No active task found.",
      ephemeral: true
    });
    return true;
  }

  if (Date.now() > taskData.endsAt) {
    await interaction.reply({
      content: "❌ This task has expired.",
      ephemeral: true
    });
    return true;
  }

  if (taskData.completed.includes(interaction.user.id)) {
    await interaction.reply({
      content: "❌ You already completed this task.",
      ephemeral: true
    });
    return true;
  }

  const levels = loadJson(levelsFile, {});
  const userData = ensureUser(levels, interaction.user.id);

  if (!hasRequirements(userData)) {
await interaction.reply({
  ephemeral: true,
  content:
    "❌ You don't have all the required items.\n\n" +
    `<:wigglyworm:1524016362727542784> **25 Wiggly Worms** • You have: **${userData.items?.wigglyWorm || 0}**\n` +
    `<:Whale:1524016299695542292> **50 Whale** • You have: **${getFishAmount(userData, "whale")}**\n` +
    `<:Gar:1524016311590588597> **5 Gar** • You have: **${getFishAmount(userData, "gar")}**\n` +
    `<:AlphaShark:1524016301989691392> **10 Alpha Shark** • You have: **${getFishAmount(userData, "alpha_shark")}**`
});
    return true;
  }

  userData.items.wigglyWorm -= TASK_REQUIREMENTS.wigglyWorm;
  removeFish(userData, "whale", TASK_REQUIREMENTS.whale);
  removeFish(userData, "gar", TASK_REQUIREMENTS.gar);
  removeFish(userData, "alpha_shark", TASK_REQUIREMENTS.alpha_shark);

  userData.wl = (userData.wl || 0) + TASK_REWARD_WL;

  taskData.completed.push(interaction.user.id);

  levels[interaction.user.id] = userData;
  saveJson(levelsFile, levels);
  saveJson(taskFile, taskData);

await interaction.reply({
  ephemeral: true,
  content:
    "✅ **Delivery Complete!**\n\n" +
    "You handed over:\n" +
    "<:wigglyworm:1524016362727542784> **25 Wiggly Worms**\n" +
    "<:Whale:1524016299695542292> **50 Whale**\n" +
    "<:Gar:1524016311590588597> **5 Gar**\n" +
    "<:AlphaShark:1524016301989691392> **10 Alpha Shark**\n\n" +
    "**Reward:** **20 Diamond Locks**"
});

  return true;
}

module.exports = {
  handleCommand,
  handleButton
};