require("dotenv").config();

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

const wyr = require("./commands/wyr.js");
const dice = require("./commands/dice.js");
const quote = require("./commands/quote.js");
const level = require("./feature/level.js");
const words = require("./feature/words.js");
const ticket = require("./feature/ticket.js");
const settings = require("./feature/settings.js");
const profileFeature = require("./feature/profile.js");
const blacklistFile = "./blacklist.json";
const socialFeature = require("./feature/social.js");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const fs = require("fs");
const cron = require("node-cron");
const activeInteractions = new Set();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: ["CHANNEL"]
});

const birthdayFile = "./birthdays.json";
const birthdayChannel = "1444902597730504725";
const adminRole = "1411991650573484073";
const BLIST_ROLE = "1483241188868882657";
const PENDING_CHANNEL = "1481767733304623235";
const APPROVED_CHANNEL = "1454171558305202348";
const PAY_CHANNEL = "1439935159926394960";
const STORY_CHANNEL = "1493097672373047347";
const storyFile = "./stories.json";
const NOTE_CHANNEL = "1493571345491955853";
const OWNER_ID = "1108921222030426172";

// messageId → game
const sudokuGames = new Map();

function loadStories() {
  if (!fs.existsSync(storyFile)) {
    fs.writeFileSync(storyFile, "[]");
  }
  return JSON.parse(fs.readFileSync(storyFile, "utf8"));
}

function saveStories(data) {
  fs.writeFileSync(storyFile, JSON.stringify(data, null, 2));
}

function makeStoryId() {
  return `${Date.now()}_${Math.floor(Math.random() * 999999)}`;
}

function loadBlacklist() {
  if (!fs.existsSync(blacklistFile)) {
    fs.writeFileSync(blacklistFile, "[]");
  }
  return JSON.parse(fs.readFileSync(blacklistFile, "utf8"));
}

function saveBlacklist(data) {
  fs.writeFileSync(blacklistFile, JSON.stringify(data, null, 2));
}
async function scanBlacklistChannel() {
  const channel = await client.channels.fetch(APPROVED_CHANNEL).catch(() => null);
  if (!channel) return { scanned: 0 };

  const blacklistMap = new Map();
  let lastId;
  let totalScannedMessages = 0;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const messages = await channel.messages.fetch(options);
    if (!messages.size) break;

    totalScannedMessages += messages.size;

    for (const msg of messages.values()) {
      const content = msg.content || "";

      if (!content.includes("GrowID:")) continue;

      const growidMatch = content.match(/GrowID:\s*(.+)/i);
      const reasonMatch = content.match(/Reason:\s*(.+)/i);
      const proofMatch = content.match(/Blacklisted & Proof By:\s*(.+)/i);

      if (!growidMatch) continue;

      const growid = growidMatch[1].trim();
      const reason = reasonMatch ? reasonMatch[1].trim() : "Unknown";
      const proof = proofMatch ? proofMatch[1].trim() : "Unknown";

      blacklistMap.set(growid.toLowerCase(), {
        growid,
        reason,
        proof,
        addedBy: "Scan System",
        approvedBy: "Scan System",
        createdAt: msg.createdTimestamp
      });
    }

    lastId = messages.last().id;

    if (messages.size < 100) break;
  }

  const blacklist = Array.from(blacklistMap.values()).sort((a, b) => b.createdAt - a.createdAt);
  saveBlacklist(blacklist);

  console.log(`✅ Scanned ${totalScannedMessages} messages and saved ${blacklist.length} blacklist entries`);
  return {
    scanned: totalScannedMessages,
    saved: blacklist.length
  };
}
async function cleanupExpiredStories() {
  const stories = loadStories();
  const now = Date.now();

  const remaining = [];

  for (const story of stories) {
    if (story.expiresAt <= now) {
      try {
        const channel = await client.channels.fetch(story.channelId).catch(() => null);
        if (channel) {
          const msg = await channel.messages.fetch(story.messageId).catch(() => null);
          if (msg) await msg.delete().catch(() => {});
        }
      } catch (err) {
        console.log("Failed to delete expired story:", err);
      }
    } else {
      remaining.push(story);
    }
  }

  saveStories(remaining);
}

function loadBirthdays() {
  if (!fs.existsSync(birthdayFile)) {
    fs.writeFileSync(birthdayFile, "{}");
  }
  return JSON.parse(fs.readFileSync(birthdayFile, "utf8"));
}

function saveBirthdays(data) {
  fs.writeFileSync(birthdayFile, JSON.stringify(data, null, 2));
}

function clone(board) {
  return board.map(r => [...r]);
}

function getPuzzle() {
  return {
    puzzle: [
      [5,3,0,0,7,0,0,0,0],
      [6,0,0,1,9,5,0,0,0],
      [0,9,8,0,0,0,0,6,0],
      [8,0,0,0,6,0,0,0,3],
      [4,0,0,8,0,3,0,0,1],
      [7,0,0,0,2,0,0,0,6],
      [0,6,0,0,0,0,2,8,0],
      [0,0,0,4,1,9,0,0,5],
      [0,0,0,0,8,0,0,7,9]
    ],
    solution: [
      [5,3,4,6,7,8,9,1,2],
      [6,7,2,1,9,5,3,4,8],
      [1,9,8,3,4,2,5,6,7],
      [8,5,9,7,6,1,4,2,3],
      [4,2,6,8,5,3,7,9,1],
      [7,1,3,9,2,4,8,5,6],
      [9,6,1,5,3,7,2,8,4],
      [2,8,7,4,1,9,6,3,5],
      [3,4,5,2,8,6,1,7,9]
    ]
  };
}

function format(board, selected) {
  let out = "";

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {

      let val = board[r][c] === 0 ? "·" : board[r][c];

      // highlight selected cell
      if (selected && selected.r === r && selected.c === c) {
        val = `[${val}]`;
      }

      out += val + " ";

      if (c === 2 || c === 5) out += "| ";
    }

    out += "\n";
    if (r === 2 || r === 5) out += "------+-------+------\n";
  }

  return "```" + out + "```";
}

function createGame() {
  const { puzzle, solution } = getPuzzle();

  return {
    board: clone(puzzle),
    puzzle: clone(puzzle),
    solution: clone(solution),
    selected: null
  };
}

function getEmbed(game) {
  return new EmbedBuilder()
    .setTitle("🧩 Sudoku 9x9")
    .setColor("Blue")
    .setDescription(format(game.board, game.selected))
    .setFooter({ text: "Click a cell → choose number below" });
}

function getGridUI(game) {
  const rows = [];

  for (let r = 0; r < 9; r++) {
    const actionRow = new ActionRowBuilder();

    for (let c = 0; c < 9; c++) {

      const value = game.board[r][c];
      const isFixed = game.puzzle[r][c] !== 0;

      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`cell_${r}_${c}`)
          .setLabel(value === 0 ? " " : String(value))
          .setStyle(
            game.selected?.r === r && game.selected?.c === c
              ? ButtonStyle.Primary
              : isFixed
              ? ButtonStyle.Secondary
              : ButtonStyle.Success
          )
          .setDisabled(isFixed && value !== 0)
      );
    }

    rows.push(actionRow);
  }

  return rows;
}

function getNumberPad() {
  const row = new ActionRowBuilder();

  for (let i = 1; i <= 9; i++) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`num_${i}`)
        .setLabel(String(i))
        .setStyle(ButtonStyle.Primary)
    );
  }

  return row;
}
function getControls() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("clear").setLabel("Clear").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("new").setLabel("New Game").setStyle(ButtonStyle.Danger)
  );
}
function getUI(game) {
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("row")
        .setPlaceholder("Row")
        .addOptions([...Array(9)].map((_, i) => ({
          label: `Row ${i+1}`, value: String(i+1)
        })))
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("col")
        .setPlaceholder("Column")
        .addOptions([...Array(9)].map((_, i) => ({
          label: `Col ${i+1}`, value: String(i+1)
        })))
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("num")
        .setPlaceholder("Number")
        .addOptions([...Array(9)].map((_, i) => ({
          label: `${i+1}`, value: String(i+1)
        })))
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("set").setLabel("Set").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("clear").setLabel("Clear").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("new").setLabel("New Game").setStyle(ButtonStyle.Danger)
    )
  ];
}

client.once("ready", async () => {
  await scanBlacklistChannel();
  console.log(`Logged in as ${client.user.tag}`);

  async function updateStatus() {
    const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
    if (!guild) return;

const memberCount = guild.memberCount;
client.user.setActivity(`with ${memberCount} members`, {
  type: 0 
});
  }

  await updateStatus();
  setInterval(updateStatus, 300000);

  if (!fs.existsSync(storyFile)) {
  fs.writeFileSync(storyFile, "[]");
}

await cleanupExpiredStories();

// every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  await cleanupExpiredStories();
});
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.commandName === "playsudoku") {
  const embed = new EmbedBuilder()
    .setTitle("Sudoku")
    .setDescription(`${interaction.user} is playing Sudoku`)
    .setColor("Blue");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Play now!")
      .setStyle(ButtonStyle.Link)
.setURL(`https://noobv2-production.up.railway.app/?user=${interaction.user.id}`) );
  return interaction.reply({
    embeds: [embed],
    components: [row]
  });
}
if (interaction.isChatInputCommand() && interaction.commandName === "playminigames") {
  const embed = new EmbedBuilder()
    .setTitle("🎮 Mini Games")
    .setDescription("Click below to play mini games.")
    .setColor("Blue");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Play Mini Games")
      .setStyle(ButtonStyle.Link)
      .setURL(`https://noobv2-production.up.railway.app/?user=${interaction.user.id}`)
  );

  await interaction.reply({
    embeds: [embed],
    components: [row]
  });

  return; 
}
if (interaction.commandName === "sayas") {
  const ALLOWED_ROLE_ID = "1495044283294552165";
  const SAYAS_LOG_VIEWER_ID = "1146756192710959155";

  if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
    return interaction.reply({
      content: "❌ You don’t have permission to use this command.",
      ephemeral: true
    });
  }

  const targetUser = interaction.options.getUser("user");
  const messageInput = interaction.options.getString("message");
  const commandInput = interaction.options.getString("command");
  const file = interaction.options.getAttachment("file");
  const targetChannel = interaction.options.getChannel("channel") || interaction.channel;

  if (!messageInput && !commandInput && !file) {
    return interaction.reply({
      content: "❌ Please enter a message, choose a command, or attach a file.",
      ephemeral: true
    });
  }

  if (!targetChannel || !targetChannel.isTextBased()) {
    return interaction.reply({
      content: "❌ Please choose a valid text channel.",
      ephemeral: true
    });
  }

  try {
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const displayName = member?.displayName || targetUser.username;

    let finalMessage = messageInput || "";

    if (commandInput === "howgay") {
      const percent = Math.floor(Math.random() * 200) + 1;
      const messages = [
        `${targetUser} is **${percent}% gay** today 🌈`,
        `Gay meter result for ${targetUser}: **${percent}%** 🌈`,
        `${targetUser}, you are **${percent}% gay** 😳`,
        `The rainbow scanner says ${targetUser} is **${percent}% gay** 🌈`,
        `${targetUser} unlocked **${percent}% gayness** ✨`
      ];

      finalMessage = messages[Math.floor(Math.random() * messages.length)];
    }

    if (commandInput === "howpro") {
      const percent = Math.floor(Math.random() * 200) + 1;
      const messages = [
        `${targetUser} is **${percent}% pro** today 😎`,
        `Pro meter result for ${targetUser}: **${percent}%** 🔥`,
        `${targetUser}, you are **${percent}% pro** 💯`,
        `The skill scanner says ${targetUser} is **${percent}% pro** 🎯`,
        `${targetUser} unlocked **${percent}% pro power** ⚡`
      ];

      finalMessage = messages[Math.floor(Math.random() * messages.length)];
    }

    const webhook = await targetChannel.createWebhook({
      name: displayName,
      avatar: targetUser.displayAvatarURL({ dynamic: true })
    });

    await webhook.send({
      content: finalMessage || null,
      files: file ? [file.url] : [],
      allowedMentions: { parse: [] }
    });

    await webhook.delete().catch(() => {});

    const logEmbed = new EmbedBuilder()
      .setTitle("Sayas Log")
      .setColor("Purple")
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "From", value: `${interaction.user}`, inline: true },
        { name: "To", value: `${targetUser}`, inline: true },
        { name: "Channel", value: `${targetChannel}`, inline: true },
        { name: "Mode", value: commandInput ? `/${commandInput}` : "Message", inline: true },
        { name: "Message", value: finalMessage || "No message", inline: false },
        { name: "Attachment", value: file ? file.url : "None", inline: false }
      )
      .setTimestamp();

    const owner = await client.users.fetch(OWNER_ID).catch(() => null);
    const sayasViewer = await client.users.fetch(SAYAS_LOG_VIEWER_ID).catch(() => null);

    if (owner) {
      await owner.send({ embeds: [logEmbed] }).catch(() => {});
    }

    if (sayasViewer) {
      await sayasViewer.send({ embeds: [logEmbed] }).catch(() => {});
    }

    return interaction.reply({
      content: "✅ Message sent.",
      ephemeral: true
    });

  } catch (err) {
    console.log("Sayas failed:", err);

    return interaction.reply({
      content: "❌ Failed. Make sure the bot has Manage Webhooks permission.",
      ephemeral: true
    });
  }
}
  if (interaction.commandName === "sendroleselector") {
  if (!interaction.member.roles.cache.has(adminRole)) {
    return interaction.reply({
      content: "❌ No permission.",
      ephemeral: true
    });
  }

  const targetChannel = interaction.options.getChannel("channel");

  const embed = new EmbedBuilder()
    .setTitle("Role Selector")
    .setColor("Purple")
    .setDescription("Please use the dropdown menu below to select a role category.");

  const menu = new StringSelectMenuBuilder()
    .setCustomId("role_selector_menu")
    .setPlaceholder("Select a role category")
    .addOptions(
      {
        label: "Devilish Color",
        description: "Choose a Devilish color role",
        value: "devilish_color"
      },
      {
        label: "Color Roles",
        description: "Choose a normal color role",
        value: "color_roles"
      },
      {
        label: "Remove Roles",
        description: "Remove selected color roles",
        value: "remove_color_roles"
      }
    );

  await targetChannel.send({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)]
  });

  return interaction.reply({
    content: `✅ Role selector sent to ${targetChannel}.`,
    ephemeral: true
  });
}
  if (interaction.commandName === "mathquestions") {

  const level = interaction.options.getString("level");

  const easyQuestions = [
    ["What is 1 + 1?", ["2", "1", "3", "4"], 0],
    ["What is 2 + 3?", ["5", "4", "6", "3"], 0],
    ["What is 4 + 1?", ["5", "6", "4", "3"], 0],
    ["What is 5 - 2?", ["3", "2", "4", "5"], 0],
    ["What is 3 + 3?", ["6", "5", "7", "4"], 0],
    ["What is 7 - 1?", ["6", "5", "7", "4"], 0],
    ["What is 2 + 2?", ["4", "3", "5", "2"], 0],
    ["What is 9 - 4?", ["5", "6", "4", "3"], 0],
    ["What is 6 + 1?", ["7", "6", "8", "5"], 0],
    ["What is 8 - 3?", ["5", "4", "6", "7"], 0],
    ["What is 0 + 5?", ["5", "0", "4", "6"], 0],
    ["What is 10 - 5?", ["5", "4", "6", "3"], 0],
    ["What is 3 + 4?", ["7", "6", "8", "5"], 0],
    ["What is 6 - 2?", ["4", "3", "5", "6"], 0],
    ["What is 1 + 7?", ["8", "7", "9", "6"], 0],
    ["What is 5 + 5?", ["10", "9", "11", "8"], 0],
    ["What is 8 - 1?", ["7", "6", "8", "5"], 0],
    ["What is 2 + 5?", ["7", "6", "8", "5"], 0],
    ["What is 9 - 2?", ["7", "8", "6", "5"], 0],
    ["What is 4 + 4?", ["8", "7", "9", "6"], 0],
    ["What is 7 - 3?", ["4", "3", "5", "6"], 0],
    ["What is 1 + 9?", ["10", "9", "8", "11"], 0],
    ["What is 6 + 2?", ["8", "7", "9", "6"], 0],
    ["What is 5 - 1?", ["4", "5", "3", "2"], 0],
    ["What is 3 + 5?", ["8", "7", "9", "6"], 0],
    ["What is 10 - 2?", ["8", "7", "9", "6"], 0],
    ["What is 2 + 6?", ["8", "7", "9", "6"], 0],
    ["What is 7 + 1?", ["8", "7", "9", "6"], 0],
    ["What is 8 - 2?", ["6", "5", "7", "4"], 0],
    ["What is 4 + 5?", ["9", "8", "10", "7"], 0],
    ["What is 9 - 1?", ["8", "7", "9", "6"], 0],
    ["What is 3 + 6?", ["9", "8", "10", "7"], 0],
    ["What is 6 - 1?", ["5", "4", "6", "3"], 0],
    ["What is 2 + 7?", ["9", "8", "10", "7"], 0],
    ["What is 10 - 3?", ["7", "6", "8", "5"], 0],
    ["What is 5 + 2?", ["7", "6", "8", "5"], 0],
    ["What is 7 - 2?", ["5", "4", "6", "3"], 0],
    ["What is 4 + 3?", ["7", "6", "8", "5"], 0],
    ["What is 9 - 3?", ["6", "5", "7", "4"], 0],
    ["What is 1 + 8?", ["9", "8", "10", "7"], 0],
    ["What is 6 + 3?", ["9", "8", "10", "7"], 0],
    ["What is 8 - 4?", ["4", "3", "5", "6"], 0],
    ["What is 2 + 8?", ["10", "9", "11", "8"], 0],
    ["What is 10 - 1?", ["9", "8", "10", "7"], 0],
    ["What is 5 + 3?", ["8", "7", "9", "6"], 0],
    ["What is 7 + 2?", ["9", "8", "10", "7"], 0],
    ["What is 9 - 5?", ["4", "3", "5", "6"], 0],
    ["What is 3 + 7?", ["10", "9", "11", "8"], 0],
    ["What is 6 + 4?", ["10", "9", "11", "8"], 0],
    ["What is 8 - 5?", ["3", "2", "4", "5"], 0]
  ];

  const mediumQuestions = [
    ["Solve for x: x + 3 = 7", ["4", "3", "5", "6"], 0],
    ["Solve for x: 2x = 10", ["5", "4", "6", "3"], 0],
    ["Solve for x: x - 4 = 2", ["6", "5", "7", "4"], 0],
    ["Solve for x: 3x = 12", ["4", "3", "5", "6"], 0],
    ["Solve for x: x + 5 = 11", ["6", "5", "7", "4"], 0],
    ["Solve for x: 4x = 20", ["5", "4", "6", "3"], 0],
    ["Solve for x: x - 2 = 6", ["8", "7", "9", "6"], 0],
    ["Solve for x: 5x = 25", ["5", "4", "6", "3"], 0],
    ["Solve for x: x + 6 = 10", ["4", "3", "5", "6"], 0],
    ["Solve for x: 2x + 1 = 9", ["4", "3", "5", "6"], 0],
    ["Solve for x: 3x + 2 = 11", ["3", "2", "4", "5"], 0],
    ["Solve for x: 2x - 3 = 7", ["5", "4", "6", "3"], 0],
    ["Solve for x: 4x + 1 = 13", ["3", "2", "4", "5"], 0],
    ["Solve for x: 5x - 5 = 20", ["5", "4", "6", "3"], 0],
    ["Solve for x: x/2 = 4", ["8", "6", "4", "10"], 0],
    ["Solve for x: x/3 = 3", ["9", "6", "12", "3"], 0],
    ["Solve for x: x + 8 = 15", ["7", "6", "8", "5"], 0],
    ["Solve for x: 6x = 18", ["3", "2", "4", "5"], 0],
    ["Solve for x: x - 7 = 1", ["8", "7", "9", "6"], 0],
    ["Solve for x: 2x + 4 = 12", ["4", "3", "5", "6"], 0],
    ["Solve for x: 3x - 3 = 6", ["3", "2", "4", "5"], 0],
    ["Solve for x: 4x - 4 = 12", ["4", "3", "5", "6"], 0],
    ["Solve for x: 5x + 5 = 30", ["5", "4", "6", "3"], 0],
    ["Solve for x: x/4 = 2", ["8", "6", "4", "10"], 0],
    ["Solve for x: x + 9 = 14", ["5", "4", "6", "3"], 0],
    ["Solve for x: 7x = 21", ["3", "2", "4", "5"], 0],
    ["Solve for x: x - 5 = 5", ["10", "9", "8", "11"], 0],
    ["Solve for x: 2x - 2 = 8", ["5", "4", "6", "3"], 0],
    ["Solve for x: 3x + 1 = 10", ["3", "2", "4", "5"], 0],
    ["Solve for x: 4x + 4 = 20", ["4", "3", "5", "6"], 0],
    ["Solve for x: 5x - 10 = 15", ["5", "4", "6", "3"], 0],
    ["Solve for x: x/5 = 3", ["15", "10", "20", "5"], 0],
    ["Solve for x: x + 2 = 13", ["11", "10", "12", "9"], 0],
    ["Solve for x: 8x = 32", ["4", "3", "5", "6"], 0],
    ["Solve for x: x - 6 = 4", ["10", "9", "11", "8"], 0],
    ["Solve for x: 2x + 6 = 14", ["4", "3", "5", "6"], 0],
    ["Solve for x: 3x - 6 = 3", ["3", "2", "4", "5"], 0],
    ["Solve for x: 4x - 8 = 8", ["4", "3", "5", "6"], 0],
    ["Solve for x: 6x + 0 = 24", ["4", "3", "5", "6"], 0],
    ["Solve for x: x/2 + 1 = 5", ["8", "6", "10", "4"], 0],
    ["Solve for x: x + 4 = 9", ["5", "4", "6", "3"], 0],
    ["Solve for x: 9x = 27", ["3", "2", "4", "5"], 0],
    ["Solve for x: x - 8 = 2", ["10", "9", "11", "8"], 0],
    ["Solve for x: 2x + 2 = 10", ["4", "3", "5", "6"], 0],
    ["Solve for x: 3x + 3 = 12", ["3", "2", "4", "5"], 0],
    ["Solve for x: 4x + 0 = 16", ["4", "3", "5", "6"], 0],
    ["Solve for x: 5x + 10 = 35", ["5", "4", "6", "3"], 0],
    ["Solve for x: x/3 + 1 = 4", ["9", "6", "12", "3"], 0],
    ["Solve for x: x + 7 = 16", ["9", "8", "10", "7"], 0],
    ["Solve for x: 10x = 50", ["5", "4", "6", "3"], 0]
  ];

  const hardQuestions = [
    ["What is the integral of x^2?", ["x^3/3 + C", "2x + C", "x^2/2 + C", "x^4/4 + C"], 0],
    ["What is the integral of x^3?", ["x^4/4 + C", "3x^2 + C", "x^3/3 + C", "x^5/5 + C"], 0],
    ["What is the derivative of sin(x)?", ["cos(x)", "-cos(x)", "sin(x)", "-sin(x)"], 0],
    ["What is the derivative of cos(x)?", ["-sin(x)", "sin(x)", "cos(x)", "-cos(x)"], 0],
    ["What is the integral of 2x?", ["x^2 + C", "2x^2 + C", "x + C", "x^3 + C"], 0],
    ["What is the integral of 3x^2?", ["x^3 + C", "3x^3 + C", "x^2 + C", "6x + C"], 0],
    ["What is the derivative of x^4?", ["4x^3", "x^3", "4x", "x^5"], 0],
    ["What is the integral of 1/x?", ["ln|x| + C", "1/x^2 + C", "x + C", "e^x + C"], 0],
    ["What is the derivative of e^x?", ["e^x", "xe^(x-1)", "1", "ln(x)"], 0],
    ["What is the integral of e^x?", ["e^x + C", "xe^x + C", "1/e^x + C", "ln(x) + C"], 0],
    ["What is the derivative of ln(x)?", ["1/x", "ln(x)", "x", "e^x"], 0],
    ["What is the integral of cos(x)?", ["sin(x) + C", "-sin(x) + C", "cos(x) + C", "-cos(x) + C"], 0],
    ["What is the integral of sin(x)?", ["-cos(x) + C", "cos(x) + C", "sin(x) + C", "-sin(x) + C"], 0],
    ["What is the derivative of x^5?", ["5x^4", "x^4", "5x", "x^6"], 0],
    ["What is the integral of x?", ["x^2/2 + C", "2x + C", "x + C", "x^3/3 + C"], 0],
    ["What is the derivative of tan(x)?", ["sec^2(x)", "tan(x)", "cot(x)", "csc^2(x)"], 0],
    ["What is the derivative of sec(x)?", ["sec(x)tan(x)", "sec^2(x)", "tan(x)", "csc(x)cot(x)"], 0],
    ["What is the derivative of x^(-1)?", ["-1/x^2", "1/x", "x^-2", "-x"], 0],
    ["What is the integral of x^4?", ["x^5/5 + C", "4x^3 + C", "x^4/4 + C", "x^6/6 + C"], 0],
    ["What is the derivative of x^(1/2)?", ["1/(2sqrt(x))", "sqrt(x)/2", "2sqrt(x)", "1/x"], 0],
    ["What is the integral of 4x^3?", ["x^4 + C", "4x^4 + C", "x^3 + C", "12x^2 + C"], 0],
    ["What is the derivative of 7x?", ["7", "x", "7x^2", "1"], 0],
    ["What is the integral of 7?", ["7x + C", "x^7 + C", "7 + C", "1 + C"], 0],
    ["What is the derivative of x^6?", ["6x^5", "x^5", "6x", "x^7"], 0],
    ["What is the integral of 5x^4?", ["x^5 + C", "5x^5 + C", "x^4 + C", "20x^3 + C"], 0],
    ["What is the derivative of 1/x?", ["-1/x^2", "1/x^2", "ln(x)", "x"], 0],
    ["What is the derivative of sqrt(x)?", ["1/(2sqrt(x))", "2sqrt(x)", "sqrt(x)", "1/x"], 0],
    ["What is the integral of sec^2(x)?", ["tan(x) + C", "sec(x) + C", "cot(x) + C", "sin(x) + C"], 0],
    ["What is the derivative of cot(x)?", ["-csc^2(x)", "sec^2(x)", "csc^2(x)", "-sec^2(x)"], 0],
    ["What is the derivative of csc(x)?", ["-csc(x)cot(x)", "csc(x)cot(x)", "-sec(x)tan(x)", "sec(x)tan(x)"], 0],
    ["What is the integral of 6x^5?", ["x^6 + C", "6x^6 + C", "x^5 + C", "30x^4 + C"], 0],
    ["What is the derivative of x^7?", ["7x^6", "x^6", "7x", "x^8"], 0],
    ["What is the derivative of 9?", ["0", "9", "1", "x"], 0],
    ["What is the integral of 0?", ["C", "0", "x", "1"], 0],
    ["What is the derivative of x^8?", ["8x^7", "x^7", "8x", "x^9"], 0],
    ["What is the integral of 8x^7?", ["x^8 + C", "8x^8 + C", "x^7 + C", "56x^6 + C"], 0],
    ["What is the derivative of x^9?", ["9x^8", "x^8", "9x", "x^10"], 0],
    ["What is the derivative of x^10?", ["10x^9", "x^9", "10x", "x^11"], 0],
    ["What is the integral of x^5?", ["x^6/6 + C", "5x^4 + C", "x^5/5 + C", "x^7/7 + C"], 0],
    ["What is the derivative of 3x^3?", ["9x^2", "3x^2", "x^3", "6x"], 0],
    ["What is the integral of 9x^8?", ["x^9 + C", "9x^9 + C", "x^8 + C", "72x^7 + C"], 0],
    ["What is the derivative of 2x^2?", ["4x", "2x", "x^2", "2"], 0],
    ["What is the derivative of 4x^4?", ["16x^3", "4x^3", "8x", "x^4"], 0],
    ["What is the integral of 10x^9?", ["x^10 + C", "10x^10 + C", "x^9 + C", "90x^8 + C"], 0],
    ["What is the derivative of 5x^5?", ["25x^4", "5x^4", "10x", "x^5"], 0],
    ["What is the derivative of 6x^6?", ["36x^5", "6x^5", "12x", "x^6"], 0],
    ["What is the integral of 12x^11?", ["x^12 + C", "12x^12 + C", "x^11 + C", "144x^10 + C"], 0],
    ["What is the derivative of ln|x|?", ["1/x", "ln(x)", "x", "e^x"], 0],
    ["What is the integral of 1?", ["x + C", "1 + C", "0", "x^2 + C"], 0],
    ["What is the derivative of x^3/3?", ["x^2", "x", "3x^2", "x^3"], 0]
  ];

  let data;

  if (level === "easy") {
    data = easyQuestions[Math.floor(Math.random() * easyQuestions.length)];
  } else if (level === "medium") {
    data = mediumQuestions[Math.floor(Math.random() * mediumQuestions.length)];
  } else {
    data = hardQuestions[Math.floor(Math.random() * hardQuestions.length)];
  }

  const [question, options, answerIndex] = data;
  const letters = ["A", "B", "C", "D"];

  const embed = new EmbedBuilder()
    .setTitle("Math Question")
    .setColor("Purple")
    .setDescription(
      `Level: ${level}\n\n${question}\n\n` +
      options.map((opt, i) => `${letters[i]}. ${opt}`).join("\n")
    );

  const row = new ActionRowBuilder().addComponents(
    options.map((_, i) =>
      new ButtonBuilder()
        .setCustomId(`math_${i}_${answerIndex}`)
        .setLabel(letters[i])
        .setStyle(ButtonStyle.Primary)
    )
  );

  await interaction.reply({
    embeds: [embed],
    components: [row]
  });
}
  if (interaction.commandName === "trivia") {

  const categories = ["life", "math", "science", "grammar", "geography"];

  function generateQuestion() {
    const category = categories[Math.floor(Math.random() * categories.length)];

    let question = "";
    let options = [];
    let answerIndex = 0;

    if (category === "math") {
      const a = Math.floor(Math.random() * 20) + 1;
      const b = Math.floor(Math.random() * 20) + 1;

      question = `What is ${a} + ${b}?`;
      const correct = a + b;

      options = [
        correct,
        correct + Math.floor(Math.random() * 5) + 1,
        correct - (Math.floor(Math.random() * 5) + 1),
        correct + 2
      ].map(x => String(x));

      answerIndex = 0;
    }

    else if (category === "science") {
      const q = [
        ["What planet is known as the Red Planet?", ["Mars", "Earth", "Venus", "Jupiter"], 0],
        ["What gas do plants absorb?", ["Carbon Dioxide", "Oxygen", "Nitrogen", "Hydrogen"], 0],
        ["What is H2O?", ["Water", "Oxygen", "Hydrogen", "Salt"], 0],
        ["What force keeps us on Earth?", ["Gravity", "Magnetism", "Energy", "Light"], 0]
      ];
      const pick = q[Math.floor(Math.random() * q.length)];
      question = pick[0];
      options = pick[1];
      answerIndex = pick[2];
    }

    else if (category === "grammar") {
      const q = [
        ["Which is correct?", ["Their going home", "They're going home", "There going home", "Theyre going home"], 1],
        ["Which is a noun?", ["Run", "Happy", "Dog", "Quickly"], 2],
        ["Which is past tense?", ["Go", "Gone", "Went", "Going"], 2],

        // SAT-style grammar
        ["Choose the grammatically correct sentence.", ["Each of the students have a pencil.", "Each of the students has a pencil.", "Each of the students were given a pencil.", "Each of the students are given a pencil."], 1],
        ["Choose the best revision: 'The book, along with the notes, were placed on the desk.'", ["The book, along with the notes, was placed on the desk.", "The book, along with the notes, were being placed on the desk.", "The book, along with the notes, have been placed on the desk.", "The book, along with the notes, are placed on the desk."], 0],
        ["Which sentence is punctuated correctly?", ["After the show we went home, and slept.", "After the show, we went home and slept.", "After the show we, went home and slept.", "After the show we went, home and slept."], 1],
        ["Choose the correct sentence.", ["Neither the teacher nor the students was ready.", "Neither the teacher nor the students were ready.", "Neither the teacher nor the students is ready.", "Neither the teacher nor the students be ready."], 1],
        ["Which sentence uses the apostrophe correctly?", ["The dogs bone was buried.", "The dog's bone was buried.", "The dogs' bone was buried for one dog.", "The dog's' bone was buried."], 1],
        ["Choose the sentence with the clearest structure.", ["Running through the park, the rain started falling.", "Running through the park, she noticed the rain start falling.", "The rain started falling, running through the park.", "Through the park running, the rain started falling."], 1],
        ["Which option best completes the sentence? 'If I _____ more time, I would study abroad.'", ["have", "had", "has", "having"], 1],
        ["Choose the best transition word: 'The data was incomplete; _____, the report was delayed.'", ["however", "therefore", "meanwhile", "for example"], 1],
        ["Which sentence avoids a comma splice?", ["She was tired, she kept working.", "She was tired, but she kept working.", "She was tired, she however kept working.", "She was tired, kept working."], 1],
        ["Choose the correct version.", ["Its a beautiful day.", "It's a beautiful day.", "Its' a beautiful day.", "It is' a beautiful day."], 1],

        // IELTS-style grammar
        ["Choose the correct sentence for formal writing.", ["There are many people think that online learning is useful.", "There are many people who think that online learning is useful.", "There is many people who think that online learning is useful.", "There are many people which think that online learning is useful."], 1],
        ["Which sentence is best for IELTS writing?", ["In my opinion, governments should invest more in public transport.", "I think governments should invest more in public transport cause it is good.", "Governments should invest more in public transport and stuff.", "In my opinion governments should invest more in public transport because good."], 0],
        ["Choose the correct form.", ["People is becoming more dependent on technology.", "People are becoming more dependent on technology.", "People becoming more dependent on technology.", "People has become more dependent on technology."], 1],
        ["Which sentence has correct article use?", ["The education is important for success.", "Education is important for success.", "An education is important for the success in general.", "The education are important for success."], 1],
        ["Choose the best sentence.", ["One of the main problem is pollution.", "One of the main problems is pollution.", "One of the main problems are pollution.", "One of the main problem are pollution."], 1],
        ["Which sentence is grammatically correct?", ["Nowadays, the number of cars are increasing rapidly.", "Nowadays, the number of cars is increasing rapidly.", "Nowadays, the number of cars increase rapidly.", "Nowadays, the number of cars have increased rapidly."], 1],
        ["Choose the correct linking phrase.", ["On the other hand, studying abroad can be expensive.", "In other hand, studying abroad can be expensive.", "At the other hand, studying abroad can be expensive.", "By the other hand, studying abroad can be expensive."], 0],
        ["Which sentence is best?", ["Many students find difficult to manage their time.", "Many students find it difficult to manage their time.", "Many students find difficult managing their time.", "Many students finds it difficult to manage their time."], 1],
        ["Choose the correct sentence.", ["This essay will discuss about the advantages of exercise.", "This essay will discuss the advantages of exercise.", "This essay will discusses the advantages of exercise.", "This essay discuss the advantages of exercise."], 1],
        ["Which sentence uses plural nouns correctly?", ["The government should provide more facility for young people.", "The government should provide more facilities for young people.", "The government should provides more facilities for young people.", "The government should provide more facilitys for young people."], 1]
      ];
      const pick = q[Math.floor(Math.random() * q.length)];
      question = pick[0];
      options = pick[1];
      answerIndex = pick[2];
    }

    else if (category === "geography") {
      const q = [
        ["Capital of France?", ["Paris", "Rome", "London", "Berlin"], 0],
        ["Which continent is Australia in?", ["Australia", "Asia", "Europe", "Africa"], 0],
        ["Largest ocean?", ["Pacific", "Atlantic", "Indian", "Arctic"], 0]
      ];
      const pick = q[Math.floor(Math.random() * q.length)];
      question = pick[0];
      options = pick[1];
      answerIndex = pick[2];
    }

    else {
      const q = [
        ["What is important in life?", ["Happiness", "Money", "Luck", "Nothing"], 0],
        ["Best habit?", ["Consistency", "Sleep late", "Ignore work", "Procrastinate"], 0],
        ["Key to success?", ["Hard work", "Luck", "Nothing", "Sleep"], 0]
      ];
      const pick = q[Math.floor(Math.random() * q.length)];
      question = pick[0];
      options = pick[1];
      answerIndex = pick[2];
    }

    return { question, options, answerIndex, category };
  }

  const data = generateQuestion();
  const letters = ["A", "B", "C", "D"];

  const embed = new EmbedBuilder()
    .setTitle("Trivia Question")
    .setColor("Purple")
    .setDescription(
      `Category: ${data.category}\n\n${data.question}\n\n` +
      data.options.map((opt, i) => `${letters[i]}. ${opt}`).join("\n")
    );

  const row = new ActionRowBuilder().addComponents(
    data.options.map((_, i) =>
      new ButtonBuilder()
        .setCustomId(`trivia_${i}_${data.answerIndex}`)
        .setLabel(letters[i])
        .setStyle(ButtonStyle.Primary)
    )
  );

  await interaction.reply({
    embeds: [embed],
    components: [row]
  });
}
  if (interaction.commandName === "fortuneteller") {

  const fortunes = [

    "You will have a lucky day soon.",
    "Wealth is coming your way.",
    "Be careful with your decisions today.",
    "Love is closer than you think.",
    "You will achieve something big.",
    "A surprise awaits you tonight.",
    "Your goal will be completed soon.",
    "A new idea will change your path.",
    "Success is near, keep going.",
    "You need more rest, take care.",
    "Someone is watching your progress.",
    "Your future is looking bright.",
    "Trouble might come, stay alert.",
    "Happiness will find you.",
    "You will receive something unexpected.",
    "Someone will message you soon.",
    "You will learn something important.",
    "You are about to glow up.",
    "You will gain something valuable.",
    "You are becoming stronger.",
    "Your effort will pay off soon.",
    "Something exciting is coming.",
    "You will overcome your struggles.",
    "Luck is on your side today.",
    "A big opportunity is near.",
    "You will impress someone.",
    "Trust your instincts.",
    "Your energy is rising.",
    "Someone secretly admires you.",
    "Small wins will lead to big success.",
    "You are destined for greatness.",
    "Expect good news soon.",
    "Things will finally make sense.",
    "Celebration is coming.",
    "A smart decision will benefit you.",
    "New opportunities will appear.",
    "Face your fears, you will win.",
    "Peace will come to you.",
    "Something will make you smile today.",
    "Your progress is being noticed.",

    // auto generate to reach 170+
    ...Array.from({ length: 350 }, (_, i) =>
      `Fortune #${i + 1}: You are ${Math.floor(Math.random() * 101)}% lucky today.`
    )

  ];

  const random = fortunes[Math.floor(Math.random() * fortunes.length)];

  return interaction.reply({
    content: `Fortune Teller:\n${random}`
  });
}
  if (interaction.commandName === "announcement") {
  if (!interaction.member.permissions.has("Administrator")) {
    return interaction.reply({
      content: "❌ Administrator only.",
      ephemeral: true
    });
  }

  const title = interaction.options.getString("title");
  const message = interaction.options.getString("message");
  const useEmbed = interaction.options.getBoolean("embed");
  const targetChannel = interaction.options.getChannel("channel");
  const thumbnail = interaction.options.getString("thumbnail");
  const footer = interaction.options.getString("footer");

  if (!targetChannel || !targetChannel.isTextBased()) {
    return interaction.reply({
      content: "❌ Please choose a valid text channel.",
      ephemeral: true
    });
  }

  try {
    if (useEmbed) {
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(message)
        .setColor("Purple")
        .setTimestamp();

      if (thumbnail) embed.setThumbnail(thumbnail);
      if (footer) embed.setFooter({ text: footer });

      await targetChannel.send({ embeds: [embed] });
    } else {
      let content = `## ${title}\n${message}`;

      if (footer) {
        content += `\n\n${footer}`;
      }

      await targetChannel.send({ content });
    }

    return interaction.reply({
      content: `✅ Announcement sent to ${targetChannel}.`,
      ephemeral: true
    });
  } catch (err) {
    console.log("Announcement send failed:", err);

    return interaction.reply({
      content: "❌ Failed to send announcement.",
      ephemeral: true
    });
  }
}
if (interaction.commandName === "dms") {
  const targetUser = interaction.options.getUser("user");
  const message = interaction.options.getString("message");
  const file = interaction.options.getAttachment("file");

  if (!targetUser) {
    return interaction.reply({
      content: "❌ Please choose a user.",
      ephemeral: true
    });
  }

  if (!message && !file) {
    return interaction.reply({
      content: "❌ Please provide a message or a file.",
      ephemeral: true
    });
  }

  try {
    await targetUser.send({
      content: message || null,
      files: file ? [file.url] : []
    });

    const owner = await client.users.fetch(OWNER_ID).catch(() => null);

    if (owner) {
      await owner.send(
        `**Bot /dms Log**\n\n` +
        `**Used By:** ${interaction.user.tag}\n` +
        `**Sent To:** ${targetUser.tag}\n` +
        `**Message:** ${message || "None"}\n` +
        `**Attachment:** ${file ? file.url : "None"}`
      ).catch(() => {});
    }

    return interaction.reply({
      content: `✅ Message sent to ${targetUser.tag}.`,
      ephemeral: true
    });

  } catch (err) {
    return interaction.reply({
      content: "❌ Could not send DM.",
      ephemeral: true
    });
  }
}
if (interaction.commandName === "sendupdates") {
  if (!interaction.member.roles.cache.has(adminRole)) {
    return interaction.reply({
      content: "❌ No permission.",
      ephemeral: true
    });
  }

  const targetChannel = interaction.options.getChannel("channel");

  const embed = new EmbedBuilder()
    .setTitle("NoobV2 Bot Update Log")
    .setColor("Green")
    .setDescription(
      "Please use the dropdown menu below to view today's bot updates in a simple and easy-to-understand way."
    )
    .setFooter({
      text: "NoobV2 • Latest Updates"
    });

  const menu = new StringSelectMenuBuilder()
    .setCustomId("updates_menu")
    .setPlaceholder("Select an update category")
    .addOptions(
      {
        label: "Profile & Social Features",
        description: "Profiles, posts, reels, followers",
        value: "updates_profile"
      },
      {
        label: "Stories & Highlights",
        description: "Stories, notes, highlights, views",
        value: "updates_stories"
      },
      {
        label: "Interaction System",
        description: "Likes, comments, views",
        value: "updates_interaction"
      },
      {
        label: "Help & Navigation",
        description: "Help menu and command organization",
        value: "updates_help"
      },
      {
        label: "Moderation Improvements",
        description: "Blacklist and moderation upgrades",
        value: "updates_moderation"
      },
      {
        label: "System Improvements",
        description: "Stability, fixes, and status updates",
        value: "updates_system"
      }
    );

  const row = new ActionRowBuilder().addComponents(menu);

  await targetChannel.send({
    embeds: [embed],
    components: [row]
  });

  return interaction.reply({
    content: `✅ Clickable update log sent to ${targetChannel}.`,
    ephemeral: true
  });
}
if (interaction.commandName === "howgay") {
  const target = interaction.options.getUser("user") || interaction.user;
const percent = Math.floor(Math.random() * 200) + 1;
  const messages = [
    `${target} is **${percent}% gay** today 🌈`,
    `Gay meter result for ${target}: **${percent}%** 🌈`,
    `${target}, you are **${percent}% gay** 😳`,
    `The rainbow scanner says ${target} is **${percent}% gay** 🌈`,
    `${target} unlocked **${percent}% gayness** ✨`,
    `Certified result: ${target} is **${percent}% gay** 🏳️‍🌈`,
    `${target} has reached **${percent}% gay** power 🌈`,
    `Breaking news: ${target} is **${percent}% gay** 😎`
  ];

  const message = messages[Math.floor(Math.random() * messages.length)];

  return interaction.reply({
    content: message
  });
}

if (interaction.commandName === "howpro") {
  const target = interaction.options.getUser("user") || interaction.user;
const percent = Math.floor(Math.random() * 200) + 1;
  const messages = [
    `${target} is **${percent}% pro** today 😎`,
    `Pro meter result for ${target}: **${percent}%** 🔥`,
    `${target}, you are **${percent}% pro** 💯`,
    `The skill scanner says ${target} is **${percent}% pro** 🎯`,
    `${target} unlocked **${percent}% pro power** ⚡`,
    `Certified result: ${target} is **${percent}% pro** 🏆`,
    `${target} has reached **${percent}% pro level** 🚀`,
    `Breaking news: ${target} is **${percent}% pro** 😎`
  ];

  const message = messages[Math.floor(Math.random() * messages.length)];

  return interaction.reply({
    content: message
  });
}
  if (interaction.commandName === "help") {
  const helpEmbed = new EmbedBuilder()
    .setTitle("NoobV2 Help Menu")
    .setColor("Blue")
    .setDescription(
      "Please use the dropdown menu below to view all available bot commands by category."
    )
    .setFooter({
      text: "NoobV2 Command Help Panel"
    });

  const menu = new StringSelectMenuBuilder()
    .setCustomId("help_menu")
    .setPlaceholder("Select a command category")
    .addOptions(
      {
        label: "Profile Commands",
        description: "Profile, stories, posts, highlights",
        value: "help_profile"
      },
      {
        label: "Moderation Commands",
        description: "Blacklist and word moderation",
        value: "help_moderation"
      },
      {
        label: "Fun Commands",
        description: "Games, quotes, dice, WYR",
        value: "help_fun"
      },
      {
        label: "Utility Commands",
        description: "General utility and info commands",
        value: "help_utility"
      },
      {
        label: "Admin Commands",
        description: "Admin-only setup and management",
        value: "help_admin"
      }
    );

  const row = new ActionRowBuilder().addComponents(menu);

  return interaction.reply({
    embeds: [helpEmbed],
    components: [row],
  });
}
  if (interaction.isChatInputCommand() && (
  interaction.commandName === "postfeed" ||
  interaction.commandName === "highlights"
)) {
  return socialFeature.handleCommand(interaction);
}
  if (interaction.commandName === "sendinfo") {
  if (!interaction.member.roles.cache.has(adminRole)) {
    return interaction.reply({
      content: "❌ No permission.",
      ephemeral: true
    });
  }

  const targetChannel = interaction.options.getChannel("channel");

  const mainEmbed = new EmbedBuilder()
    .setTitle("Server Info")
    .setColor("Blue")
    .setDescription(
      "Please use the dropdown menu below to view important server information, including the server rules, admin guide, and VIP guide."
    )
    .setFooter({
      text: "NoobV2 Information Panel"
    });

  const menu = new StringSelectMenuBuilder()
    .setCustomId("server_info_menu")
    .setPlaceholder("Select an information category")
    .addOptions(
      {
        label: "Server Rules",
        description: "View the official server rules",
        value: "server_rules"
      },
      {
  label: "Server Role Information",
  description: "View all important server roles",
  value: "server_roles"
},
      {
        label: "Admin Guide",
        description: "View how to become an admin",
        value: "admin_guide"
      },
      {
        label: "VIP Guide",
        description: "View VIP sponsorship information",
        value: "vip_guide"
      }
    );

  const row = new ActionRowBuilder().addComponents(menu);

  await targetChannel.send({
    embeds: [mainEmbed],
    components: [row]
  });

  return interaction.reply({
    content: `✅ Server info panel sent to ${targetChannel}.`,
    ephemeral: true
  });
}

 if (interaction.isChatInputCommand() && interaction.commandName === "createprofile") {
  return profileFeature.executeCreateProfile(interaction);
}

if (interaction.isChatInputCommand() && interaction.commandName === "profile") {
  return profileFeature.executeProfile(interaction);
}

if (interaction.isChatInputCommand() && interaction.commandName === "viewprofile") {
  return profileFeature.executeViewProfile(interaction);
}

if (interaction.commandName === "scanblist") {
  if (!interaction.member.roles.cache.has(adminRole)) {
    return interaction.reply({
      content: "❌ No permission.",
      ephemeral: true
    });
  }

  await interaction.reply({
    content: "Scanning blacklist channel... this may take a while.",
    ephemeral: true
  });

  const result = await scanBlacklistChannel();

  return interaction.editReply({
    content: `✅ Scan complete.\nMessages scanned: ${result.scanned}\nBlacklist entries saved: ${result.saved}`
  });
}
if (interaction.commandName === "blist") {
  const blacklist = loadBlacklist();

  if (blacklist.length === 0) {
    return interaction.reply({
      content: "❌ There are no approved blacklist entries yet.",
      ephemeral: true
    });
  }

  const sorted = [...blacklist].sort((a, b) =>
    a.growid.localeCompare(b.growid)
  );

  const pageItems = sorted.slice(0, 10);

  const embed = new EmbedBuilder()
    .setTitle("📛 Blacklist List")
    .setColor("Red")
    .setDescription(
      pageItems.map((entry, i) =>
        `**${i + 1}. ${entry.growid}**\n` +
        `Reason: ${entry.reason}\n` +
        `Proof: ${entry.proof}\n` +
        `Added: <t:${Math.floor(entry.createdAt / 1000)}:R>`
      ).join("\n\n")
    )
    .setFooter({
      text: `Showing ${pageItems.length} of ${blacklist.length} blacklisted GrowIDs`
    });

  const sortMenu = new StringSelectMenuBuilder()
    .setCustomId("blist_sort")
    .setPlaceholder("Sort blacklist")
    .addOptions([
      {
        label: "A-Z",
        description: "Sort GrowIDs alphabetically",
        value: "az"
      },
      {
        label: "Date",
        description: "Sort by saved date",
        value: "date"
      },
      {
        label: "Newly Added",
        description: "Show newest first",
        value: "new"
      },
      {
        label: "Old Added",
        description: "Show oldest first",
        value: "old"
      }
    ]);

  const row1 = new ActionRowBuilder().addComponents(sortMenu);

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("blist_search")
      .setLabel("Search User")
      .setStyle(ButtonStyle.Primary)
  );

  return interaction.reply({
    embeds: [embed],
    components: [row1, row2],
    ephemeral: true
  });
}
if (interaction.isChatInputCommand() && interaction.commandName === "postnote") {
  const text = interaction.options.getString("text");

  if (!text || !text.trim()) {
    return interaction.reply({
      content: "❌ Please enter a note.",
      ephemeral: true
    });
  }

  const noteChannel = await client.channels.fetch(NOTE_CHANNEL).catch(() => null);

  if (!noteChannel) {
    return interaction.reply({
      content: "❌ Note channel not found.",
      ephemeral: true
    });
  }

  const storyId = makeStoryId();
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

  const embed = new EmbedBuilder()
    .setColor("Purple")
    .setAuthor({
      name: `${interaction.user.username}'s Note`,
      iconURL: interaction.user.displayAvatarURL({ dynamic: true })
    })
    .setDescription(`This note will disappear <t:${Math.floor(expiresAt / 1000)}:R>.`)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`view_note_${storyId}`)
      .setLabel(`View ${interaction.user.username}'s Note`)
      .setStyle(ButtonStyle.Primary)
  );

  const sentMessage = await noteChannel.send({
    embeds: [embed],
    components: [row]
  });

  const stories = loadStories();
  stories.push({
    storyId,
    ownerId: interaction.user.id,
    ownerTag: interaction.user.tag,
    channelId: NOTE_CHANNEL,
    messageId: sentMessage.id,
    mediaType: "note",
    noteText: text,
    expiresAt,
    viewers: []
  });
  saveStories(stories);

  if (interaction.channel.id === NOTE_CHANNEL) {
    return interaction.reply({
      content: "✅ Your note has been posted.",
      ephemeral: true
    });
  }

  return interaction.reply({
    content: `✅ ${interaction.user} posted a note. Please view it in <#${NOTE_CHANNEL}>.`,
    allowedMentions: { users: [interaction.user.id] }
  });
}
if (interaction.isChatInputCommand() && interaction.commandName === "poststory") {
  const media = interaction.options.getAttachment("media");

  if (!media) {
    return interaction.reply({
      content: "❌ Please upload an image or video.",
      ephemeral: true
    });
  }

  const contentType = media.contentType || "";

  if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
    return interaction.reply({
      content: "❌ Only image or video files are allowed.",
      ephemeral: true
    });
  }

  const storyChannel = await client.channels.fetch(STORY_CHANNEL).catch(() => null);

  if (!storyChannel) {
    return interaction.reply({
      content: "❌ Story channel not found.",
      ephemeral: true
    });
  }

  const storyId = makeStoryId();
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

  const embed = new EmbedBuilder()
    .setColor("Purple")
    .setAuthor({
      name: `${interaction.user.username}'s Story`,
      iconURL: interaction.user.displayAvatarURL({ dynamic: true })
    })
    .setDescription(`This story will disappear <t:${Math.floor(expiresAt / 1000)}:R>.`)
    .setTimestamp()
    .addFields({
      name: "Story Type",
      value: contentType.startsWith("image/") ? "Image story" : "Video story"
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`view_story_${storyId}`)
      .setLabel(`View ${interaction.user.username}'s Story`)
      .setStyle(ButtonStyle.Primary)
  );

  const sentMessage = await storyChannel.send({
    embeds: [embed],
    components: [row]
  });

  const stories = loadStories();
 stories.push({
  storyId,
  ownerId: interaction.user.id,
  ownerTag: interaction.user.tag,
  channelId: STORY_CHANNEL,
  messageId: sentMessage.id,
  mediaUrl: media.url,
  mediaType: contentType,
  mediaName: media.name || "story",
  expiresAt,
  viewers: [],
  highlights: false 
});
  saveStories(stories);

  if (interaction.channel.id === STORY_CHANNEL) {
    return interaction.reply({
      content: "✅ Your story has been posted.",
      ephemeral: true
    });
  }

  return interaction.reply({
    content: `✅ ${interaction.user} posted a story. Please view it in <#${STORY_CHANNEL}>.`,
    allowedMentions: { users: [interaction.user.id] }
  });
}
if (interaction.commandName === "editwordban") {

  if (!interaction.member.permissions.has("Administrator")) {
    return interaction.reply({
      content: "❌ Admin only.",
      ephemeral: true
    });
  }

  const word = interaction.options.getString("word");

  const list = words.getWords();

  if (!list.includes(word.toLowerCase())) {
    return interaction.reply({
      content: "❌ That word is not in the blacklist.",
      ephemeral: true
    });
  }

  words.removeWord(word);

  return interaction.reply({
    content: `✅ Removed **${word}** from blacklist.`,
    ephemeral: true
  });
}
if (interaction.commandName === "editbday") {

  const birthdays = loadBirthdays();

  // ❌ if user has no birthday yet
  if (!birthdays[interaction.user.id]) {
    return interaction.reply({
      content: "❌ You don't have a birthday set. Use /addbirthday first.",
      ephemeral: true
    });
  }

  // ✅ update ONLY their own
  birthdays[interaction.user.id] = {
    day: interaction.options.getInteger("day"),
    month: interaction.options.getInteger("month"),
    year: interaction.options.getInteger("year")
  };

  saveBirthdays(birthdays);

  return interaction.reply({
    content: "✅ Your birthday has been updated.",
    ephemeral: true
  });
}
  // ================= SETTINGS COMMAND =================
  if (interaction.isChatInputCommand()) {
if (interaction.channel.id === PAY_CHANNEL) {

    const levels = JSON.parse(fs.readFileSync("./levels.json", "utf8"));
    const user = levels[interaction.user.id] || { wl: 0 };

    if ((user.wl || 0) < 3) {
      return interaction.reply({
        content: "❌ You need 3 World Locks to use this channel.",
        ephemeral: true
      });
    }

    user.wl -= 3;
    levels[interaction.user.id] = user;

    fs.writeFileSync("./levels.json", JSON.stringify(levels, null, 2));
  }
  
if (interaction.commandName === "leaderboard") {

  const category = interaction.options.getString("category");

  if (category === "level") {
    const data = JSON.parse(fs.readFileSync("./levels.json", "utf8"));

    const sorted = Object.entries(data)
      .sort((a, b) => b[1].level - a[1].level)
      .slice(0, 10);

    if (sorted.length === 0) {
      return interaction.reply("No data yet.");
    }

    let description = "";

    for (let i = 0; i < sorted.length; i++) {
      const [userId, info] = sorted[i];

      description += `**${i + 1}.** <@${userId}> — Level ${info.level} (${info.xp} XP)\n`;
    }

    const embed = new EmbedBuilder()
.setTitle("<:bulletin:1447778065512923217> Level Leaderboard")
      .setDescription(description)
      .setColor("Gold");

    return interaction.reply({
      embeds: [embed],
      allowedMentions: { parse: [] } // 🚫 prevents ping
    });
  }
}
if (interaction.commandName === "wordbanlist") {

  if (!interaction.member.roles.cache.has(adminRole)) {
    return interaction.reply({ content: "❌ No permission.", ephemeral: true });
  }

  const list = words.getWords();

  if (list.length === 0) {
    return interaction.reply("No blacklisted words.");
  }

  return interaction.reply({
    content: `📛 Blacklisted Words:\n\n${list.map(w => `• ${w}`).join("\n")}`,
    ephemeral: true
  });
}

      if (interaction.commandName === "bdaylist") {

  const birthdays = loadBirthdays();

  if (Object.keys(birthdays).length === 0) {
    return interaction.reply("No birthdays saved.");
  }

  let list = "";

  for (const userId in birthdays) {
    const b = birthdays[userId];
    list += `<@${userId}> → ${b.day}/${b.month}/${b.year}\n`;
  }

  return interaction.reply({
    content: `**Birthday List**\n\n${list}`,
    allowedMentions: { parse: [] } // no ping spam
  });
}

if (interaction.commandName === "testbday") {

  if (!interaction.member.roles.cache.has(adminRole)) {
    return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
  }

  const channel = await client.channels.fetch(birthdayChannel);

  const birthdays = loadBirthdays();
  const today = new Date();

  let found = false;

  for (const userId in birthdays) {
    const b = birthdays[userId];

    if (b.day === today.getDate() && b.month === (today.getMonth() + 1)) {
      found = true;

      channel.send(`🎉 Happy Birthday <@${userId}>! 🎂`);
    }
  }

  if (!found) {
    return interaction.reply("No birthdays today.");
  }

  return interaction.reply({ content: "✅ Test birthday message sent.", ephemeral: true });
}
 if (interaction.commandName === "ticketpanel") {
  return ticket.execute(interaction);
}
if (interaction.commandName === "wordban") {

  if (!interaction.member.roles.cache.has(adminRole)) {
    return interaction.reply({ content: "❌ No permission.", ephemeral: true });
  }

  const word = interaction.options.getString("word");

  words.addWord(word);

  return interaction.reply({
    content: `Word **${word}** has been blacklisted.`,
    ephemeral: true
  });
}
    if (interaction.commandName === "settings") {
      return settings.execute(interaction, adminRole);
    }
    
  
  if (interaction.commandName === "wouldyourather") {
    return wyr.execute(interaction);
  }

  if (interaction.commandName === "testdice") {
    return dice.execute(interaction);
  }

  if (interaction.commandName === "quote") {
  return quote.execute(interaction);
}
// ================= ADD BLACKLIST =================
if (interaction.commandName === "addblist") {

  if (activeInteractions.has(interaction.id)) return;
  activeInteractions.add(interaction.id);
  setTimeout(() => activeInteractions.delete(interaction.id), 5000);

  const image = interaction.options.getAttachment("image");

  if (!interaction.member.roles.cache.has(BLIST_ROLE)) {
    return interaction.reply({ content: "You don't have permission.", ephemeral: true });
  }

  const growid = interaction.options.getString("growid");
  const reason = interaction.options.getString("reason");
  const proofUser = interaction.options.getUser("proof");

  const channel = await client.channels.fetch(PENDING_CHANNEL);

  const embed = new EmbedBuilder()
    .setTitle("Blacklist Request")
    .setDescription(`Hello ${interaction.user}`)
    .addFields(
      { name: "GrowID", value: growid, inline: true },
      { name: "Reason", value: reason, inline: true },
      { name: "Proof By", value: `<@${proofUser.id}>`, inline: true }
    )
    .setColor("Yellow");

  if (image) embed.setImage(image.url);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`approve_${interaction.user.id}`)
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`deny_${interaction.user.id}`)
      .setLabel("Not Approve")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ embeds: [embed], components: [row] });

  return interaction.reply({
    content: "✅ Your blacklist is currently pending.",
    ephemeral: true
  });
}

// ================= REPORT PLAYER (BETA) =================
if (interaction.commandName === "report") {

  const growid = interaction.options.getString("growid");
  const reason = interaction.options.getString("reason");
  const proof = interaction.options.getAttachment("proof");

  const channel = await client.channels.fetch(PENDING_CHANNEL);

  const embed = new EmbedBuilder()
    .setTitle("Player Reported (BETA)")
    .setDescription(`Report submitted by ${interaction.user}`)
    .addFields(
      { name: "GrowID", value: growid, inline: true },
      { name: "Reason", value: reason, inline: true },
      { name: "Status", value: "Pending Review", inline: true }
    )
    .setColor("Purple");

  if (proof) embed.setImage(proof.url);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`report_blacklist_${interaction.user.id}`)
      .setLabel("Blacklist")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`report_deny_${interaction.user.id}`)
      .setLabel("Not Approve")
      .setStyle(ButtonStyle.Secondary)
  );

  await channel.send({
    embeds: [embed],
    components: [row]
  });

  return interaction.reply({
    content: "✅ Your report has been submitted (BETA).",
    ephemeral: true
  });
}
// ================= ADD BIRTHDAY =================
if (interaction.commandName === "addbirthday") {

  const birthdays = loadBirthdays();

  birthdays[interaction.user.id] = {
    day: interaction.options.getInteger("day"),
    month: interaction.options.getInteger("month"),
    year: interaction.options.getInteger("year")
  };

  saveBirthdays(birthdays);
  return interaction.reply("Saved!");
}

// ================= GAMES =================
if (interaction.commandName === "games") {

  const menu = new StringSelectMenuBuilder()
    .setCustomId("game")
    .setPlaceholder("Choose game")
    .addOptions([{ label: "Sudoku", value: "sudoku" }]);

  return interaction.reply({
    content: "🎮 Choose a game:",
    components: [new ActionRowBuilder().addComponents(menu)]
  });
}
  }

  // ================= DROPDOWN =================
 if (interaction.isStringSelectMenu()) {
  if (interaction.customId === "role_selector_menu") {
  const value = interaction.values[0];

  if (value === "devilish_color") {
    const embed = new EmbedBuilder()
      .setTitle("Devilish Color Roles")
      .setColor("DarkButNotBlack")
      .setDescription(
        `<:arrow:1442712798969729087> Click a button below to get or remove a Devilish color role.`
      );

const row1 = new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId("role_1496850177246363759").setLabel("Black").setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId("role_1496845745947410593").setLabel("Blue").setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId("role_1498474880105054218").setLabel("Pink").setStyle(ButtonStyle.Secondary)
);

const row2 = new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId("role_1496847529013285115").setLabel("Purple").setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId("role_1498477615789510728").setLabel("Red").setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId("role_1496898950714757180").setLabel("White").setStyle(ButtonStyle.Secondary)
);
    return interaction.reply({
      embeds: [embed],
      components: [row1, row2],
      ephemeral: true
    });
  }

  if (value === "color_roles") {
    const embed = new EmbedBuilder()
      .setTitle("Color Roles")
      .setColor("Blue")
      .setDescription("Click a button below to get or remove a color role.");

const row1 = new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId("role_1491016531176456272").setLabel("Red").setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId("role_1491016623375781959").setLabel("Blue").setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId("role_1491016679776456714").setLabel("Yellow").setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId("role_1491016736244367391").setLabel("Green").setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId("role_1491016798802546718").setLabel("Purple").setStyle(ButtonStyle.Secondary)
);

const row2 = new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId("role_1498483649367248947").setLabel("Pink").setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId("role_1498483827029573792").setLabel("Gold").setStyle(ButtonStyle.Secondary)
);

    return interaction.reply({
      embeds: [embed],
      components: [row1, row2],
      ephemeral: true
    });
  }

  if (value === "remove_color_roles") {
    return interaction.reply({
      content: "Click the same role again to remove it.",
      ephemeral: true
    });
  }
}
  if (interaction.customId === "updates_menu") {
  const value = interaction.values[0];

  if (value === "updates_profile") {
    const embed = new EmbedBuilder()
      .setTitle("Profile & Social Features")
      .setColor("Green")
      .setDescription(
        `<:arrow:1442712798969729087> Users can now create their own profiles\n` +
        `<:arrow:1442712798969729087> Profiles now support followers and following\n` +
        `<:arrow:1442712798969729087> Users can post photos and videos like social media posts\n` +
        `<:arrow:1442712798969729087> The bot now feels more like an Instagram-style system`
      );

    return interaction.update({
      embeds: [embed],
      components: [interaction.message.components[0]]
    });
  }

  if (value === "updates_stories") {
    const embed = new EmbedBuilder()
      .setTitle("Stories & Highlights")
      .setColor("Green")
      .setDescription(
        `<:arrow:1442712798969729087> Users can post stories that disappear after 24 hours\n` +
        `<:arrow:1442712798969729087> Users can also post text notes as temporary stories\n` +
        `<:arrow:1442712798969729087> Favorite stories can now be saved as highlights\n` +
        `<:arrow:1442712798969729087> Story views, likes, and comments are now tracked better`
      );

    return interaction.update({
      embeds: [embed],
      components: [interaction.message.components[0]]
    });
  }

  if (value === "updates_interaction") {
    const embed = new EmbedBuilder()
      .setTitle("Interaction System")
      .setColor("Green")
      .setDescription(
        `<:arrow:1442712798969729087> Users can like posts and stories\n` +
        `<:arrow:1442712798969729087> Users can comment on posts and stories\n` +
        `<:arrow:1442712798969729087> View tracking has been added for posts and stories\n` +
        `<:arrow:1442712798969729087> Overall interaction is now more engaging and easier to use`
      );

    return interaction.update({
      embeds: [embed],
      components: [interaction.message.components[0]]
    });
  }

  if (value === "updates_help") {
    const embed = new EmbedBuilder()
      .setTitle("Help & Navigation")
      .setColor("Green")
      .setDescription(
        `<:arrow:1442712798969729087> Added a new /help command\n` +
        `<:arrow:1442712798969729087> Commands are now grouped into categories\n` +
        `<:arrow:1442712798969729087> Help information is easier to understand for all users\n` +
        `<:arrow:1442712798969729087> Dropdown menus now make navigation cleaner and faster`
      );

    return interaction.update({
      embeds: [embed],
      components: [interaction.message.components[0]]
    });
  }

  if (value === "updates_moderation") {
    const embed = new EmbedBuilder()
      .setTitle("Moderation Improvements")
      .setColor("Green")
      .setDescription(
        `<:arrow:1442712798969729087> Improved the blacklist system\n` +
        `<:arrow:1442712798969729087> Added the ability to scan old messages and rebuild blacklist data\n` +
        `<:arrow:1442712798969729087> Added sorting options for blacklist entries\n` +
        `<:arrow:1442712798969729087> Added a search feature to find blacklisted users faster`
      );

    return interaction.update({
      embeds: [embed],
      components: [interaction.message.components[0]]
    });
  }

  if (value === "updates_system") {
    const embed = new EmbedBuilder()
      .setTitle("System Improvements")
      .setColor("Green")
      .setDescription(
        `<:arrow:1442712798969729087> Improved bot stability and reduced interaction errors\n` +
        `<:arrow:1442712798969729087> Updated the bot status display\n` +
        `<:arrow:1442712798969729087> Fixed several issues that caused commands to fail\n` +
        `<:arrow:1442712798969729087> Overall bot performance is now smoother and more reliable`
      );

    return interaction.update({
      embeds: [embed],
      components: [interaction.message.components[0]]
    });
  }
}

if (interaction.customId === "help_menu") {
  const value = interaction.values[0];

  if (value === "help_profile") {
    const embed = new EmbedBuilder()
      .setTitle("Profile Commands")
      .setColor("Blue")
      .setDescription(
        `<:arrow:1442712798969729087> **/createprofile** — Create your profile\n` +
        `<:arrow:1442712798969729087> **/profile** — View your own profile\n` +
        `<:arrow:1442712798969729087> **/viewprofile** — View another user's profile\n` +
        `<:arrow:1442712798969729087> **/poststory** — Post a story for 24 hours\n` +
        `<:arrow:1442712798969729087> **/postnote** — Post a note for 24 hours\n` +
        `<:arrow:1442712798969729087> **/postfeed** — Post a permanent photo or reel\n` +
        `<:arrow:1442712798969729087> **/highlights** — View story highlights`
      );

return interaction.update({
  embeds: [embed],
  components: [interaction.message.components[0]]
});
  }

  if (value === "help_moderation") {
    const embed = new EmbedBuilder()
      .setTitle("Moderation Commands")
      .setColor("Blue")
      .setDescription(
        `<:arrow:1442712798969729087> **/addblist** — Submit a blacklist request\n` +
        `<:arrow:1442712798969729087> **/blist** — View approved blacklist entries\n` +
        `<:arrow:1442712798969729087> **/scanblist** — Rebuild blacklist data from channel\n` +
        `<:arrow:1442712798969729087> **/wordban** — Add a banned word\n` +
        `<:arrow:1442712798969729087> **/editwordban** — Remove a banned word\n` +
        `<:arrow:1442712798969729087> **/wordbanlist** — View banned words`
      );

return interaction.update({
  embeds: [embed],
  components: [interaction.message.components[0]]
});
  }

  if (value === "help_fun") {
    const embed = new EmbedBuilder()
      .setTitle("Fun Commands")
      .setColor("Blue")
      .setDescription(
        `<:arrow:1442712798969729087> **/wouldyourather** — Play Would You Rather\n` +
        `<:arrow:1442712798969729087> **/testdice** — Roll a dice\n` +
        `<:arrow:1442712798969729087> **/quote** — Get a random quote\n` +
        `<:arrow:1442712798969729087> **/howgay** — Check how gay someone is\n` +
`<:arrow:1442712798969729087> **/howpro** — Check how pro someone is\n` +
        `<:arrow:1442712798969729087> **/games** — Open the mini games menu`
      );

return interaction.update({
  embeds: [embed],
  components: [interaction.message.components[0]]
});
  }

  if (value === "help_utility") {
    const embed = new EmbedBuilder()
      .setTitle("Utility Commands")
      .setColor("Blue")
      .setDescription(
        `<:arrow:1442712798969729087> **/leaderboard** — View leaderboard rankings\n` +
        `<:arrow:1442712798969729087> **/help** — View all commands`
      );

return interaction.update({
  embeds: [embed],
  components: [interaction.message.components[0]]
});
  }

  if (value === "help_admin") {
    const embed = new EmbedBuilder()
      .setTitle("Admin Commands")
      .setColor("Blue")
      .setDescription(
        `<:arrow:1442712798969729087> **/settings** — Open the settings panel\n` +
        `<:arrow:1442712798969729087> **/ticketpanel** — Send the ticket panel\n` +
        `<:arrow:1442712798969729087> **/sendinfo** — Send the server info panel\n` +
        `<:arrow:1442712798969729087> **/testbday** — Test birthday message\n` +
        `<:arrow:1442712798969729087> **/addbirthday** — Save your birthday\n` +
        `<:arrow:1442712798969729087> **/editbday** — Edit your birthday\n` +
        `<:arrow:1442712798969729087> **/bdaylist** — View saved birthdays`
      );

return interaction.update({
  embeds: [embed],
  components: [interaction.message.components[0]]
});
  }
}
  if (interaction.customId === "blist_sort") {
  const blacklist = loadBlacklist();

  if (blacklist.length === 0) {
    return interaction.reply({
      content: "❌ No blacklist entries found.",
      ephemeral: true
    });
  }

  const sortType = interaction.values[0];
  let sorted = [...blacklist];

  if (sortType === "az") {
    sorted.sort((a, b) => a.growid.localeCompare(b.growid));
  } else if (sortType === "date") {
    sorted.sort((a, b) => b.createdAt - a.createdAt);
  } else if (sortType === "new") {
    sorted.sort((a, b) => b.createdAt - a.createdAt);
  } else if (sortType === "old") {
    sorted.sort((a, b) => a.createdAt - b.createdAt);
  }

  const pageItems = sorted.slice(0, 10);

  const embed = new EmbedBuilder()
    .setTitle("📛 Blacklist List")
    .setColor("Red")
    .setDescription(
      pageItems.map((entry, i) =>
        `**${i + 1}. ${entry.growid}**\n` +
        `Reason: ${entry.reason}\n` +
        `Proof: ${entry.proof}\n` +
        `Added: <t:${Math.floor(entry.createdAt / 1000)}:R>`
      ).join("\n\n")
    )
    .setFooter({
      text: `Showing ${pageItems.length} of ${blacklist.length} blacklisted GrowIDs`
    });

  const sortMenu = new StringSelectMenuBuilder()
    .setCustomId("blist_sort")
    .setPlaceholder("Sort blacklist")
    .addOptions([
      {
        label: "A-Z",
        description: "Sort GrowIDs alphabetically",
        value: "az",
        default: sortType === "az"
      },
      {
        label: "Date",
        description: "Sort by saved date",
        value: "date",
        default: sortType === "date"
      },
      {
        label: "Newly Added",
        description: "Show newest first",
        value: "new",
        default: sortType === "new"
      },
      {
        label: "Old Added",
        description: "Show oldest first",
        value: "old",
        default: sortType === "old"
      }
    ]);

  const row1 = new ActionRowBuilder().addComponents(sortMenu);

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("blist_search")
      .setLabel("Search User")
      .setStyle(ButtonStyle.Primary)
  );

  return interaction.update({
    embeds: [embed],
    components: [row1, row2]
  });
}

  if (interaction.customId === "server_info_menu") {
  const value = interaction.values[0];

  if (value === "server_rules") {
    const embed = new EmbedBuilder()
      .setTitle("Server Rules")
      .setColor("Blue")
      .setDescription(
        `<:arrow:1442712798969729087> **No toxicity or bullying.**\n` +
        `<:arrow:1442712798969729087> **No bots, spamming, or hacks.**\n` +
        `<:arrow:1442712798969729087> **Advertising other worlds is not allowed.**\n` +
        `<:arrow:1442712798969729087> **No doubling World Locks or Diamond Locks.**\n` +
        `<:arrow:1442712798969729087> **If an admin tells you to stop doing something, you must stop immediately. Ignoring staff instructions may lead to a punishment or ban.**\n` +
        `<:arrow:1442712798969729087> **Do not bully, insult, or disrespect other admins.**\n` +
        `<:arrow:1442712798969729087> **Using glitches to survive fire is not allowed and may result in a ban.**\n\n` +
        `If you need to report a player or an admin, please contact an admin on Discord.\n\n` +
        `To make a valid report, you must provide clear proof such as screenshots or recordings. Without proof, staff may not be able to take action.\n\n` +
        `✨ **Respect others and enjoy your time in NoobV2.**`
      );

    return interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  if (value === "admin_guide") {
    const embed = new EmbedBuilder()
      .setTitle("Admin Guide")
      .setColor("Blue")
      .setDescription(
        `To become an admin in **NoobV2**, please review the requirements below:\n\n` +
        `<:arrow:1442712798969729087> You must be **recognized and trusted** by at least **3 admins** and **1 owner or co-owner**.\n` +
        `<:arrow:1442712798969729087> You must be an **active player** in the world for at least **10 days**.\n` +
        `<:arrow:1442712798969729087> You should actively **support the server**, such as helping with giveaways, sponsoring events, assisting admins, or contributing to activities like dice games or parkour drops.\n` +
        `<:arrow:1442712798969729087> After that, the owners will discuss whether you are suitable for the position.\n\n` +
        `Please note that meeting these requirements does **not guarantee** that you will become an admin, as there may be competition from other players.\n\n` +
        `However, all genuine effort will always be noticed and appreciated. ❤️`
      );

    return interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  if (value === "server_roles") {
  const embed = new EmbedBuilder()
.setTitle("<:Announcement:1324498827918708746> Server Roles Information")
.setColor("Blue")
.setDescription(
  `<:arrow:1442712798969729087> <@&1455416432752988305> - Special Bot Role\n` +
  `<:arrow:1442712798969729087> <@&1446474214755270667> - NoobV2 Owner\n` +
  `<:arrow:1442712798969729087> <@&1449413701756256308> - NoobV2 Co-Owner\n` +
  `<:arrow:1442712798969729087> <@&1470190619212386329> - NoobV2 Original Admins\n` +
  `<:arrow:1442712798969729087> <@&1411991650573484073> - NoobV2 Admins\n` +
  `<:arrow:1442712798969729087> <@&1483338429675868203> - Ticket Supports\n` +
  `<:arrow:1442712798969729087> <@&1483241188868882657> - Server Guardians → Helps with blacklisting and managing the server\n` +
  `<:arrow:1442712798969729087> <@&1476701600406835241> - NoobV2 New/Training Admins\n` +
  `<:arrow:1442712798969729087> <@&1412474556077051965> - NoobV2 Members\n\n` +

  `## <:emoji_19:1422900861541289984> Role Tiers\n` +
  `<:arrow:1442712798969729087> <@&1449569489338499182> - Players who have sponsored more than 20 Diamond Locks\n` +
  `<:arrow:1442712798969729087> <@&1449569268315459724> - Players who have sponsored more than 75 Diamond Locks\n` +
  `<:arrow:1442712798969729087> <@&1449569557445345301> - Players who have sponsored more than 1.5 Blue Gem Locks\n` +
  `<:arrow:1442712798969729087> <@&1449569731680931941> - Players who have sponsored more than 25 Blue Gem Locks\n` +
  `<:arrow:1442712798969729087> <@&1449569838778548224> - Players who have sponsored more than 50 Blue Gem Locks\n` +
  `<:arrow:1442712798969729087> <@&1460469091201449994> - Players who have sponsored more than 100 Blue Gem Locks\n` +
  `<:arrow:1442712798969729087> <@&1480855881741631621> - Players who have sponsored more than 180 Blue Gem Locks\n` +
  `<:arrow:1442712798969729087> <@&1496425822645649498> - Players who have sponsored more than 500+ Blue Gem Locks\n\n` +

  `## <:bhammer:1493606035326500874> Punishment Roles\n` +
  `<:arrow:1442712798969729087> <@&1447558455299674112>, <@&1447587914165784749>, <@&1461732151728013397>, <@&1477293102946455622>, <@&1452551233935114354>\n\n` +

  `## <:bulletin:1447778065512923217> Extra Note\n` +
  `Please note that some roles are hidden for now and will be added to <#1413404813512671285> soon.`
);
  return interaction.reply({
    embeds: [embed],
    ephemeral: true,
    allowedMentions: { parse: [] }
  });
}

  if (value === "vip_guide") {
    const embed = new EmbedBuilder()
      .setTitle("VIP Guide")
      .setColor("Blue")
.setDescription(
  `## <:bulletin:1447778065512923217> VIP Sponsorship Information\n\n` +
  `<:arrow:1442712798969729087> The **<@&1479616262223953972>** role that can be granted is the one listed **below the dice**.\n\n` +
  `<:arrow:1442712798969729087> This role is given to players who sponsor **3 BGLs or more**. This can be done through **one single donation** or **multiple smaller donations** that add up to **3 BGLs**.\n\n` +
  `<:arrow:1442712798969729087> Once a player receives the **VIP role**, they may keep it by continuing to sponsor from time to time, even in smaller amounts.\n\n` +
  `<:arrow:1442712798969729087> If there is **no sponsorship activity for 10 days**, the **VIP role will be removed**.\n\n` +
  `To claim your **VIP spot**, tag me or **padrohell**, or create a ticket in <#1413404892416053289>.\n\n` +
  `Thank you for your cooperation.`
)

    return interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
}
    if (interaction.customId === "settings_menu") {
      return settings.handleMenu(interaction);
    }

    if (interaction.customId === "panel_menu") {
      return settings.handlePanelMenu(interaction);
    }
  
    if (
  interaction.customId === "rr_message_type" ||
  interaction.customId === "rr_selection_type" 
) {
  return settings.handleSelect(interaction);
}

  if (interaction.customId === "game") {

    if (interaction.values[0] === "sudoku") {

      const msg = await interaction.reply({
        content: "🧩 Starting Sudoku...",
        fetchReply: true
      });

      const game = createGame();
      sudokuGames.set(msg.id, game);

      return interaction.editReply({
        embeds: [getEmbed(game)],
        components: getUI(game)
      });
    }
  }

  const game = sudokuGames.get(interaction.message.id);
  if (!game) return;

  if (interaction.customId === "row") game.row = parseInt(interaction.values[0]);
  if (interaction.customId === "col") game.col = parseInt(interaction.values[0]);
  if (interaction.customId === "num") game.num = parseInt(interaction.values[0]);

  return interaction.update({
    embeds: [getEmbed(game)],
    components: getUI(game)
  });
}


  // ================= MODAL =================
if (interaction.isModalSubmit()) {
if (interaction.customId.startsWith("comment_modal_")) {
  const storyId = interaction.customId.replace("comment_modal_", "");
  const comment = interaction.fields.getTextInputValue("comment_input");

  const stories = loadStories();
  const story = stories.find(s => s.storyId === storyId);

  if (!story) return;

  story.comments = story.comments || [];
story.comments.push({
  userId: interaction.user.id,
  user: interaction.user.tag,
  text: comment,
  createdAt: Date.now()
});

  saveStories(stories);

  return interaction.reply({
    content: "Comment added!",
    ephemeral: true
  });
}
  if (interaction.customId === "blist_search_modal") {
  const query = interaction.fields
    .getTextInputValue("blist_search_input")
    .trim()
    .toLowerCase();

  const blacklist = loadBlacklist();
  const results = blacklist.filter(entry =>
    entry.growid.toLowerCase().includes(query)
  );

  if (results.length === 0) {
    return interaction.reply({
      content: `❌ No blacklisted GrowID found for **${query}**.`,
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("📛 Blacklist Search Result")
    .setColor("Red")
    .setDescription(
      results.slice(0, 10).map((entry, i) =>
        `**${i + 1}. ${entry.growid}**\n` +
        `Reason: ${entry.reason}\n` +
        `Proof: ${entry.proof}\n` +
        `Added By: ${entry.addedBy}\n` +
        `Approved By: ${entry.approvedBy}\n` +
        `Added: <t:${Math.floor(entry.createdAt / 1000)}:R>`
      ).join("\n\n")
    )
    .setFooter({
      text: `Found ${results.length} result(s)`
    });

  return interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}
  const handled = await profileFeature.handleModal(interaction);
  if (handled) return;
const handledSocialModal = await socialFeature.handleModal(interaction);
if (handledSocialModal !== false) return;
  return settings.handleModal(interaction);
}

if (interaction.customId.startsWith("role_")) {
  const roleId = interaction.customId.replace("role_", "");

  const colorRoleIds = [
    "1491016531176456272", // Red
    "1491016623375781959", // Blue
    "1491016679776456714", // Yellow
    "1491016736244367391", // Green
    "1491016798802546718", // Purple
    "1498483649367248947", // Pink
    "1498483827029573792"  // Gold
  ];

  const devilishRoleIds = [
    "1496850177246363759",
    "1496845745947410593",
    "1498474880105054218",
    "1496847529013285115",
    "1498477615789510728",
    "1496898950714757180"
  ];

  const role = interaction.guild.roles.cache.get(roleId);

  if (!role) {
    return interaction.reply({
      content: "❌ Role not found.",
      ephemeral: true
    });
  }

  const isColorRole = colorRoleIds.includes(roleId);
  const isDevilishRole = devilishRoleIds.includes(roleId);

  if (interaction.member.roles.cache.has(roleId)) {
    await interaction.member.roles.remove(roleId);

    return interaction.reply({
      content: `✅ Removed ${role.name}.`,
      ephemeral: true
    });
  }

  if (isColorRole) {
    const rolesToRemove = colorRoleIds.filter(id => id !== roleId);
    await interaction.member.roles.remove(rolesToRemove).catch(() => {});
  }

  if (isDevilishRole) {
    const rolesToRemove = devilishRoleIds.filter(id => id !== roleId);
    await interaction.member.roles.remove(rolesToRemove).catch(() => {});
  }

  await interaction.member.roles.add(roleId);

  return interaction.reply({
    content: `✅ Added ${role.name}. Only one color role can be active at a time.`,
    ephemeral: true
  });
}
  // ================= BUTTON =================
if (interaction.isButton()) {

  if (interaction.customId.startsWith("math_")) {

  const [, chosen, correct] = interaction.customId.split("_");

  const isCorrect = chosen === correct;

  return interaction.reply({
    content: isCorrect
      ? "Correct answer."
      : `Wrong answer. Correct answer is ${["A","B","C","D"][correct]}.`,
    ephemeral: true
  });
}
  if (interaction.customId.startsWith("trivia_")) {

  const [, chosen, correct] = interaction.customId.split("_");

  const isCorrect = chosen === correct;

  return interaction.reply({
    content: isCorrect
      ? `Correct answer.`
      : `Wrong answer. The correct answer was option ${["A","B","C","D"][correct]}.`,
    ephemeral: true
  });
}
  if (interaction.customId.startsWith("comment_")) {
  const storyId = interaction.customId.replace("comment_", "");

  const modal = new ModalBuilder()
    .setCustomId(`comment_modal_${storyId}`)
    .setTitle("Add Comment");

  const input = new TextInputBuilder()
    .setCustomId("comment_input")
    .setLabel("Your comment")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  return interaction.showModal(modal);
}

  if (interaction.customId.startsWith("like_")) {
  const storyId = interaction.customId.replace("like_", "");
  const stories = loadStories();
  const story = stories.find(s => s.storyId === storyId);

  if (!story) return;

  story.likes = story.likes || [];

  if (story.likes.includes(interaction.user.id)) {
    return interaction.reply({
      content: "❌ You already liked this.",
      ephemeral: true
    });
  }

  story.likes.push(interaction.user.id);
  saveStories(stories);

  return interaction.reply({
    content: "❤️ You liked this story!",
    ephemeral: true
  });
}
if (interaction.customId.startsWith("highlight_")) {
  const storyId = interaction.customId.replace("highlight_", "");
  const stories = loadStories();
  const story = stories.find(s => s.storyId === storyId);

  if (!story) return;

  if (story.ownerId !== interaction.user.id) {
    return interaction.reply({
      content: "❌ Only the owner can highlight this story.",
      ephemeral: true
    });
  }

  story.highlights = true;
  saveStories(stories);

  return interaction.reply({
    content: "Story added to highlights!",
    ephemeral: true
  });
}
  if (interaction.customId === "blist_search") {
    const modal = new ModalBuilder()
      .setCustomId("blist_search_modal")
      .setTitle("Search Blacklist");

    const input = new TextInputBuilder()
      .setCustomId("blist_search_input")
      .setLabel("Enter GrowID")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Type the GrowID to search")
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(input);
    modal.addComponents(row);

    return interaction.showModal(modal);
  }

  const handledSocialButton = await socialFeature.handleButton(interaction);
if (handledSocialButton !== false) return;
const handledProfileButton = await profileFeature.handleButton(interaction, client);

if (handledProfileButton) return;

if (interaction.customId.startsWith("view_note_")) {
  const storyId = interaction.customId.replace("view_note_", "");
  const stories = loadStories();
  const story = stories.find(s => s.storyId === storyId);

  if (!story) {
    return interaction.reply({
      content: "❌ This note no longer exists.",
      ephemeral: true
    });
  }

  if (Date.now() >= story.expiresAt) {
    return interaction.reply({
      content: "❌ This note has expired.",
      ephemeral: true
    });
  }

  const alreadyViewed = story.viewers.some(v => v.userId === interaction.user.id);

  if (!alreadyViewed) {
    story.viewers.push({
      userId: interaction.user.id,
      tag: interaction.user.tag,
      viewedAt: Date.now()
    });
    saveStories(stories);

    try {
      const owner = await client.users.fetch(story.ownerId).catch(() => null);
      if (owner) {
        await owner.send(`👀 **${interaction.user.tag}** viewed your note.`).catch(() => {});
      }
    } catch (err) {
      console.log("Failed to DM note owner:", err);
    }
  }

  const viewEmbed = new EmbedBuilder()
    .setColor("Purple")
    .setAuthor({
      name: `${story.ownerTag}'s Note`
    })
    .setDescription(story.noteText)

  return interaction.reply({
    embeds: [viewEmbed],
    ephemeral: true
  });
}
 if (interaction.customId.startsWith("view_story_")) {
  const storyId = interaction.customId.replace("view_story_", "");
  const stories = loadStories();
  const story = stories.find(s => s.storyId === storyId);

  if (!story) {
    return interaction.reply({
      content: "❌ This story no longer exists.",
      ephemeral: true
    });
  }

  if (Date.now() >= story.expiresAt) {
    return interaction.reply({
      content: "❌ This story has expired.",
      ephemeral: true
    });
  }

  const alreadyViewed = story.viewers.some(v => v.userId === interaction.user.id);

  if (!alreadyViewed) {
    story.viewers.push({
      userId: interaction.user.id,
      tag: interaction.user.tag,
      viewedAt: Date.now()
    });

    story.views = (story.views || 0) + 1;
    saveStories(stories);

    try {
      const owner = await client.users.fetch(story.ownerId).catch(() => null);
      if (owner) {
        await owner.send(`👀 **${interaction.user.tag}** viewed your story.`).catch(() => {});
      }
    } catch (err) {
      console.log("Failed to DM story owner:", err);
    }
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`like_${storyId}`)
      .setLabel("Like")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`comment_${storyId}`)
      .setLabel("Comment")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`highlight_${storyId}`)
      .setLabel("Highlight")
      .setStyle(ButtonStyle.Secondary)
  );

  if (story.mediaType.startsWith("image/")) {
    const viewEmbed = new EmbedBuilder()
      .setColor("Purple")
      .setAuthor({
        name: `${story.ownerTag}'s Story`
      })
      .setImage(story.mediaUrl)
      .setFooter({
        text: `Views: ${story.views || 0} | Likes: ${(story.likes || []).length} | Comments: ${(story.comments || []).length}`
      });

    return interaction.reply({
      embeds: [viewEmbed],
      components: [row],
      ephemeral: true
    });
  }

  return interaction.reply({
    content: `Here is the story video:\n${story.mediaUrl}`,
    components: [row],
    ephemeral: true
  });
}
if (
  interaction.customId === "confirm_bot" ||
  interaction.customId === "cancel_bot" ||
  interaction.customId === "edit_ticket" ||
  interaction.customId === "roles_reaction" ||
  interaction.customId === "rr_set_name" ||
  interaction.customId === "rr_set_channel" ||
  interaction.customId === "rr_add_reaction" ||
  interaction.customId === "rr_save" ||
  interaction.customId === "rr_cancel"
) {
  return settings.handleButton(interaction, client);
}

  if (
    interaction.customId === "create_ticket" ||
    interaction.customId === "close_ticket" ||
    interaction.customId === "admin_form" ||
    interaction.customId === "support_form"
  ) {
    return ticket.handleButton(interaction);
  }

  if (interaction.customId.startsWith("wyr_")) {
    return wyr.handleButton(interaction);
  }

  // ===== BLACKLIST APPROVE / DENY =====
  // ===== REPORT SYSTEM =====
if (interaction.customId.startsWith("report_blacklist_") || interaction.customId.startsWith("report_deny_")) {

  const embed = EmbedBuilder.from(interaction.message.embeds[0]);
  const fields = embed.data.fields;

  const growid = fields.find(f => f.name === "GrowID").value;
  const reason = fields.find(f => f.name === "Reason").value;

  if (interaction.customId.startsWith("report_blacklist_")) {

    const finalChannel = await client.channels.fetch(APPROVED_CHANNEL);

    let message = `**GrowID**: ${growid}
**Reason**: ${reason}
**Blacklisted & Proof By**: Report System`;

    const imageUrl = interaction.message.embeds[0].image?.url;
    if (imageUrl) message += `\n${imageUrl}`;

    await finalChannel.send({ content: message });

    // SAVE TO JSON
    const blacklist = loadBlacklist();

    const exists = blacklist.some(e => e.growid.toLowerCase() === growid.toLowerCase());

    if (!exists) {
      blacklist.push({
        growid,
        reason,
        proof: "Report System",
        addedBy: "Report",
        approvedBy: `<@${interaction.user.id}>`,
        createdAt: Date.now()
      });

      saveBlacklist(blacklist);
    }

    embed.setColor("Green").setFooter({ text: "Blacklisted via Report" });

  } else {
    embed.setColor("Red").setFooter({ text: "Report Denied" });
  }

  return interaction.update({
    embeds: [embed],
    components: []
  });
}
  if (interaction.customId.startsWith("approve_") || interaction.customId.startsWith("deny_")) {

    const ownerId = interaction.customId.split("_")[1];
    const SELF_APPROVE_ROLE = "1448858787296317553";

    if (interaction.user.id === ownerId) {
      if (!interaction.member.roles.cache.has(SELF_APPROVE_ROLE)) {
        return interaction.reply({
          content: "❌ You cannot approve your own blacklist.",
          ephemeral: true
        });
      }
    }

    const embed = EmbedBuilder.from(interaction.message.embeds[0]);
    const fields = embed.data.fields;

    const growid = fields.find(f => f.name === "GrowID").value;
    const reason = fields.find(f => f.name === "Reason").value;
    const proof = fields.find(f => f.name === "Proof By").value;

if (interaction.customId.startsWith("approve_")) {

  const finalChannel = await client.channels.fetch(APPROVED_CHANNEL);

  let message = `**GrowID**: ${growid}
**Reason**: ${reason}
**Blacklisted & Proof By**: ${proof}`;

  const imageUrl = interaction.message.embeds[0].image?.url;
  if (imageUrl) message += `\n${imageUrl}`;

  await finalChannel.send({ content: message });

  // save approved blacklist permanently
  const blacklist = loadBlacklist();

  const alreadyExists = blacklist.some(
    entry => entry.growid.toLowerCase() === growid.toLowerCase()
  );

  if (!alreadyExists) {
    blacklist.push({
      growid,
      reason,
      proof,
      addedBy: `<@${ownerId}>`,
      approvedBy: `<@${interaction.user.id}>`,
      imageUrl: imageUrl || null,
      createdAt: Date.now()
    });

    saveBlacklist(blacklist);
  }

  embed.setColor("Green").setFooter({ text: "Approved" });

} else {
  embed.setColor("Red").setFooter({ text: "Not Approved" });
}
return interaction.update({
  embeds: [embed],
  components: []
});
  }

  // ===== SUDOKU BUTTONS =====
  const game = sudokuGames.get(interaction.message.id);
  if (!game) return;

  if (interaction.customId === "new") {
    const newGame = createGame();
    sudokuGames.set(interaction.message.id, newGame);

    return interaction.update({
      embeds: [getEmbed(newGame)],
      components: getUI(newGame)
    });
  }

  if (interaction.customId === "set") {
    if (!game.row || !game.col || !game.num) {
      return interaction.reply({ content: "Select row/col/num first", ephemeral: true });
    }

    const r = game.row - 1;
    const c = game.col - 1;

    if (game.puzzle[r][c] !== 0) {
      return interaction.reply({ content: "Cannot change fixed cell", ephemeral: true });
    }

    game.board[r][c] = game.num;

    return interaction.update({
      embeds: [getEmbed(game)],
      components: getUI(game)
    });
  }

  if (interaction.customId === "clear") {
    if (!game.row || !game.col) {
      return interaction.reply({ content: "Select row/col first", ephemeral: true });
    }

    const r = game.row - 1;
    const c = game.col - 1;

    if (game.puzzle[r][c] !== 0) {
      return interaction.reply({ content: "Cannot clear fixed cell", ephemeral: true });
    }

    game.board[r][c] = 0;

    return interaction.update({
      embeds: [getEmbed(game)],
      components: getUI(game)
    });
  }
}

if (interaction.isChannelSelectMenu()) {
  if (interaction.customId === "rr_channel_select") {
    return settings.handleSelect(interaction);
  }
}
});
client.on("messageCreate", async (message) => {
    if (message.author.bot) return; 
    if (!message.guild) {
  const owner = await client.users.fetch(OWNER_ID).catch(() => null);

const logEmbed = new EmbedBuilder()
  .setTitle("DM Log")
  .setColor("Blue")
  .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
  .addFields(
    { name: "From", value: `${interaction.user}`, inline: true },
    { name: "To", value: `${targetUser}`, inline: true },
    { name: "Message", value: message || "None" },
    { name: "Attachment", value: file ? file.url : "None" }
  )
  .setTimestamp();

if (owner) {
  await owner.send({ embeds: [logEmbed] }).catch(() => {});
}

  return;
}

if (message.channel.id === PAY_CHANNEL) {

  const levels = JSON.parse(fs.readFileSync("./levels.json", "utf8"));
  const user = levels[message.author.id] || { wl: 0 };

  if ((user.wl || 0) < 3) {
    await message.delete().catch(() => {});
    await message.author.send("❌ You need 3 World Locks to use that channel.").catch(() => {});
    return;
  }

  user.wl -= 3;
  levels[message.author.id] = user;

  fs.writeFileSync("./levels.json", JSON.stringify(levels, null, 2));
}

const badWord = words.containsBadWord(message.content);

if (badWord) {
  await message.delete().catch(() => {});

  // ⚠️ Send warning
  const warnMsg = await message.channel.send({
    content: `⚠️ ${message.author}, watch your language. You have been muted for 1 minute.`
  });

  // ⏱️ Timeout
  try {
    await message.member.timeout(60 * 1000);
  } catch (err) {
    console.log("Timeout failed:", err);
  }

  // 📜 LOG (RESTORED)
  try {
    const logChannel = await client.channels.fetch("1487613700516085760");

    const embed = new EmbedBuilder()
      .setColor("Red")
      .setTitle("Blacklisted Word Detected")
      .setThumbnail(message.author.displayAvatarURL())
      .addFields(
        { name: "User", value: `${message.author}`, inline: true },
        { name: "Channel", value: `${message.channel}`, inline: true },
        { name: "Action", value: "Muted 1 minute", inline: true },
        { name: "Message", value: message.content.slice(0, 1000) || "No content" }
      )
      .setTimestamp();

    logChannel.send({ embeds: [embed] });

  } catch (err) {
    console.log("Log failed:", err);
  }

  // 🧹 Clean warning
  setTimeout(() => {
    warnMsg.delete().catch(() => {});
  }, 5000);

  return;
}
  // level system
  level.handleMessage(message);
});
client.login(process.env.TOKEN);

module.exports = client;