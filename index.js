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
  ]
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
client.user.setActivity(`Stories Live | ${memberCount} members`, {
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


  // ================= BUTTON =================
if (interaction.isButton()) {
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