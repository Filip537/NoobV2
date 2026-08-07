const fs = require("fs");
const path = require("path");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const levelsFile = path.join(
  __dirname,
  "..",
  "levels.json"
);

const taskFile = path.join(
  __dirname,
  "..",
  "taskData.json"
);

const TASK_CHANNEL = "1411995708403486780";

const TASK_DURATION_MS =
  17 * 24 * 60 * 60 * 1000;

const TASK_REQUIREMENTS = {
  messages: 500,
  attachments: 2,
  megalodon: 15,
  bass: 200,
  goldenRod: 2
};

// 150 Diamond Locks = 15,000 World Locks
const TASK_REWARD_WL = 15000;

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(
      file,
      JSON.stringify(fallback, null, 2)
    );
  }

  try {
    return JSON.parse(
      fs.readFileSync(file, "utf8")
    );
  } catch {
    fs.writeFileSync(
      file,
      JSON.stringify(fallback, null, 2)
    );

    return fallback;
  }
}

function saveJson(file, data) {
  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2)
  );
}

function ensureUser(levels, userId) {
  if (!levels[userId]) {
    levels[userId] = {
      level: 1,
      xp: 0,
      wl: 0
    };
  }

  if (!levels[userId].items) {
    levels[userId].items = {};
  }

  if (
    !Array.isArray(
      levels[userId].fishBackpack
    )
  ) {
    levels[userId].fishBackpack = [];
  }

  return levels[userId];
}

function ensureProgress(taskData, userId) {
  if (!taskData.progress) {
    taskData.progress = {};
  }

  if (!taskData.progress[userId]) {
    taskData.progress[userId] = {
      messages: 0,
      attachments: 0
    };
  }

  return taskData.progress[userId];
}

function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .replace(
      /\.(webp|png|jpg|jpeg)$/i,
      ""
    )
    .replace(/[^a-z0-9]/g, "");
}

function getFishTargets(key) {
  const targets = {
    megalodon: [
      "megalodon",
      "megal",
      "megal.webp"
    ],

    bass: [
      "bass",
      "bass.webp"
    ]
  };

  return targets[key] || [key];
}

function getFishAmount(data, key) {
  const targets = getFishTargets(key)
    .map(normalize);

  let total = 0;

  for (
    const fish of
    data.fishBackpack || []
  ) {
    const values = [
      fish.key,
      fish.name,
      fish.file
    ].map(normalize);

    const matches = targets.some(
      target => values.includes(target)
    );

    if (matches) {
      total += Number(fish.amount || 1);
    }
  }

  return total;
}

function removeFish(data, key, amount) {
  const targets = getFishTargets(key)
    .map(normalize);

  let remaining = amount;

  for (
    const fish of
    data.fishBackpack || []
  ) {
    const values = [
      fish.key,
      fish.name,
      fish.file
    ].map(normalize);

    const matches = targets.some(
      target => values.includes(target)
    );

    if (!matches) continue;

    const currentAmount =
      Number(fish.amount || 1);

    const removedAmount = Math.min(
      currentAmount,
      remaining
    );

    fish.amount =
      currentAmount - removedAmount;

    remaining -= removedAmount;

    if (remaining <= 0) {
      break;
    }
  }

  if (remaining > 0) {
    return false;
  }

  data.fishBackpack =
    data.fishBackpack.filter(
      fish =>
        Number(fish.amount || 0) > 0
    );

  return true;
}

function getProgress(taskData, userId) {
  return ensureProgress(
    taskData,
    userId
  );
}

function hasRequirements(
  userData,
  progress
) {
  return (
    Number(progress.messages || 0) >=
      TASK_REQUIREMENTS.messages &&

    Number(progress.attachments || 0) >=
      TASK_REQUIREMENTS.attachments &&

    getFishAmount(
      userData,
      "megalodon"
    ) >= TASK_REQUIREMENTS.megalodon &&

    getFishAmount(
      userData,
      "bass"
    ) >= TASK_REQUIREMENTS.bass &&

    Number(
      userData.items?.goldenRod || 0
    ) >= TASK_REQUIREMENTS.goldenRod
  );
}

function taskEmbed(taskData) {
  const endsAt = Math.floor(
    taskData.endsAt / 1000
  );

  return new EmbedBuilder()
    .setColor(0xFFD54A)
    .setTitle("Community Delivery Task")
    .setDescription(
      "Complete every requirement before the task expires.\n\n" +

      "**Chat Requirements**\n" +
      `Send **${TASK_REQUIREMENTS.messages} messages** in <#${TASK_CHANNEL}> only.\n` +
      `Send **${TASK_REQUIREMENTS.attachments} attachments or images** in <#${TASK_CHANNEL}> only.\n\n` +

      "**Delivery Requirements**\n" +
      `Deliver **${TASK_REQUIREMENTS.megalodon} Megalodon**.\n` +
      `Deliver **${TASK_REQUIREMENTS.bass} Bass**.\n` +
      `Deliver **${TASK_REQUIREMENTS.goldenRod} Golden Rods**.\n\n` +

      "**Reward**\n" +
      "**150 Diamond Locks**\n\n" +

      `**Ends:** <t:${endsAt}:R>\n` +
      "**Each player can complete this task only once.**"
    )
    .setFooter({
      text:
        "Messages and attachments only count in the Chat channel."
    })
    .setTimestamp();
}

function taskRow() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          "daily_task_progress"
        )
        .setLabel("Check Progress")
        .setStyle(
          ButtonStyle.Primary
        ),

      new ButtonBuilder()
        .setCustomId(
          "daily_task_turnin"
        )
        .setLabel("Turn-in Requirements")
        .setStyle(
          ButtonStyle.Success
        )
    );
}

async function handleCommand(
  interaction,
  client
) {
  if (
    !interaction.isChatInputCommand()
  ) {
    return false;
  }

  if (
    interaction.commandName !==
    "sendtask"
  ) {
    return false;
  }

  await interaction.deferReply({
    ephemeral: true
  });

  const taskData = {
    taskId: Date.now().toString(),
    createdAt: Date.now(),
    endsAt:
      Date.now() +
      TASK_DURATION_MS,
    completed: [],
    progress: {}
  };

  const channel = await client.channels
    .fetch(TASK_CHANNEL)
    .catch(error => {
      console.error(
        "Task channel fetch error:",
        error
      );

      return null;
    });

  if (
    !channel ||
    !channel.isTextBased()
  ) {
    return interaction.editReply({
      content:
        "Task channel was not found or the bot cannot access it."
    });
  }

  try {
    await channel.send({
      embeds: [
        taskEmbed(taskData)
      ],
      components: [
        taskRow()
      ]
    });

    saveJson(
      taskFile,
      taskData
    );

    return interaction.editReply({
      content:
        `Task sent to <#${TASK_CHANNEL}>.`
    });
  } catch (error) {
    console.error(
      "Task send error:",
      error
    );

    return interaction.editReply({
      content:
        "Failed to send the task. Check the bot permissions in the task channel."
    });
  }
}

async function handleMessage(message) {
  if (!message.guild) return false;
  if (message.author.bot) return false;

  if (
    message.channel.id !==
    TASK_CHANNEL
  ) {
    return false;
  }

  const taskData = loadJson(
    taskFile,
    null
  );

  if (
    !taskData ||
    !taskData.endsAt
  ) {
    return false;
  }

  if (
    Date.now() >
    taskData.endsAt
  ) {
    return false;
  }

  if (
    taskData.completed?.includes(
      message.author.id
    )
  ) {
    return false;
  }

  const progress = ensureProgress(
    taskData,
    message.author.id
  );

  progress.messages =
    Number(progress.messages || 0) + 1;

  const attachmentAmount =
    message.attachments.size;

  if (attachmentAmount > 0) {
    progress.attachments =
      Number(
        progress.attachments || 0
      ) + attachmentAmount;
  }

  saveJson(
    taskFile,
    taskData
  );

  return true;
}

async function handleButton(
  interaction
) {
  if (!interaction.isButton()) {
    return false;
  }

  if (
    interaction.customId !==
      "daily_task_progress" &&
    interaction.customId !==
      "daily_task_turnin"
  ) {
    return false;
  }

  const taskData = loadJson(
    taskFile,
    null
  );

  if (
    !taskData ||
    !taskData.endsAt
  ) {
    await interaction.reply({
      content:
        "No active task was found.",
      ephemeral: true
    });

    return true;
  }

  if (
    Date.now() >
    taskData.endsAt
  ) {
    await interaction.reply({
      content:
        "This task has expired.",
      ephemeral: true
    });

    return true;
  }

  if (
    taskData.completed.includes(
      interaction.user.id
    )
  ) {
    await interaction.reply({
      content:
        "You already completed this task.",
      ephemeral: true
    });

    return true;
  }

  const levels = loadJson(
    levelsFile,
    {}
  );

  const userData = ensureUser(
    levels,
    interaction.user.id
  );

  const progress = getProgress(
    taskData,
    interaction.user.id
  );

  const messageAmount =
    Number(progress.messages || 0);

  const attachmentAmount =
    Number(progress.attachments || 0);

  const megalodonAmount =
    getFishAmount(
      userData,
      "megalodon"
    );

  const bassAmount =
    getFishAmount(
      userData,
      "bass"
    );

  const goldenRodAmount =
    Number(
      userData.items?.goldenRod || 0
    );

  const progressText =
    "**Task Progress**\n\n" +

    `Messages in Chat: **${Math.min(
      messageAmount,
      TASK_REQUIREMENTS.messages
    )}/${TASK_REQUIREMENTS.messages}**\n` +

    `Attachments in Chat: **${Math.min(
      attachmentAmount,
      TASK_REQUIREMENTS.attachments
    )}/${TASK_REQUIREMENTS.attachments}**\n` +

    `Megalodon: **${Math.min(
      megalodonAmount,
      TASK_REQUIREMENTS.megalodon
    )}/${TASK_REQUIREMENTS.megalodon}**\n` +

    `Bass: **${Math.min(
      bassAmount,
      TASK_REQUIREMENTS.bass
    )}/${TASK_REQUIREMENTS.bass}**\n` +

    `Golden Rods: **${Math.min(
      goldenRodAmount,
      TASK_REQUIREMENTS.goldenRod
    )}/${TASK_REQUIREMENTS.goldenRod}**`;

  if (
    interaction.customId ===
    "daily_task_progress"
  ) {
    await interaction.reply({
      content: progressText,
      ephemeral: true
    });

    return true;
  }

  if (
    !hasRequirements(
      userData,
      progress
    )
  ) {
    await interaction.reply({
      content:
        "You have not completed every requirement.\n\n" +
        progressText,
      ephemeral: true
    });

    return true;
  }

  const megalodonRemoved =
    removeFish(
      userData,
      "megalodon",
      TASK_REQUIREMENTS.megalodon
    );

  const bassRemoved =
    removeFish(
      userData,
      "bass",
      TASK_REQUIREMENTS.bass
    );

  if (
    !megalodonRemoved ||
    !bassRemoved
  ) {
    await interaction.reply({
      content:
        "The fish could not be removed from your inventory. Please try again.",
      ephemeral: true
    });

    return true;
  }

  userData.items.goldenRod =
    Math.max(
      0,
      Number(
        userData.items.goldenRod || 0
      ) -
      TASK_REQUIREMENTS.goldenRod
    );

  if (
    userData.items.goldenRod <= 0
  ) {
    delete userData.items.goldenRod;
  }

  userData.wl =
    Number(userData.wl || 0) +
    TASK_REWARD_WL;

  taskData.completed.push(
    interaction.user.id
  );

  levels[interaction.user.id] =
    userData;

  saveJson(
    levelsFile,
    levels
  );

  saveJson(
    taskFile,
    taskData
  );

  await interaction.reply({
    content:
      "**Task Complete**\n\n" +
      "You completed:\n" +
      "500 messages in the Chat channel\n" +
      "2 attachments in the Chat channel\n" +
      "15 Megalodon\n" +
      "200 Bass\n" +
      "2 Golden Rods\n\n" +
      "**Reward: 150 Diamond Locks**",
    ephemeral: true
  });

  return true;
}

module.exports = {
  handleCommand,
  handleButton,
  handleMessage
};