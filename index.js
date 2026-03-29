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
  TextInputStyle
} = require("discord.js");

const fs = require("fs");
const cron = require("node-cron");
const activeInteractions = new Set();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const birthdayFile = "./birthdays.json";
const birthdayChannel = "1444902597730504725";
const adminRole = "1411991650573484073";
const BLIST_ROLE = "1483241188868882657";
const PENDING_CHANNEL = "1481767733304623235";
const APPROVED_CHANNEL = "1454171558305202348";
const PAY_CHANNEL = "1439935159926394960";

// messageId → game
const sudokuGames = new Map();

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
  console.log(`Logged in as ${client.user.tag}`);

  async function updateStatus() {
    const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
    if (!guild) return;

const memberCount = (await guild.members.fetch()).size;
    client.user.setActivity(`with ${memberCount} members`, {
      type: 0
    });
  }

  await updateStatus();
  setInterval(updateStatus, 300000);
});

client.on("interactionCreate", async (interaction) => {
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
if (interaction.isChatInputCommand()) {

  // 💰 WL CHECK
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

  // 👇 ALL COMMANDS BELOW HERE

  if (interaction.commandName === "profile") {

  const target = interaction.options.getUser("user") || interaction.user;
  const member = await interaction.guild.members.fetch(target.id);

  const levels = JSON.parse(fs.readFileSync("./levels.json", "utf8"));

  const userData = levels[target.id] || { level: 1, xp: 0 };

  // WL BANK (you can change later if you make economy system)
const wlBank = userData.wl || 0;
  const embed = new EmbedBuilder()
    .setColor("Blurple")
    .setAuthor({
      name: `@${target.username}`,
      iconURL: target.displayAvatarURL()
    })
    .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))

    .addFields(
      {
        name: "User Info",
        value:
`**ID:** ${target.id}
**Name:** @${target.username}
**Created:** <t:${Math.floor(target.createdTimestamp / 1000)}:F>`
      },
      {
        name: "Member Info",
        value:
`**Joined:** <t:${Math.floor(member.joinedTimestamp / 1000)}:F>`
      },
      {
        name: "Progress",
        value:
`**Level:** ${userData.level}
**XP:** ${userData.xp}
**WL Bank:** <:World_Lock:1455752235966533662> ${wlBank}`
      }
    );

  return interaction.reply({ embeds: [embed] });
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
  
  if (interaction.commandName === "wouldyourather") {
    return wyr.execute(interaction);
  }

  if (interaction.commandName === "testdice") {
    return dice.execute(interaction);
  }

  if (interaction.commandName === "quote") {
  return quote.execute(interaction);
}


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

if (image) {
  embed.setImage(image.url);
}

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

  await channel.send({
    embeds: [embed],
    components: [row]
  });

  return interaction.reply({
    content: "✅ Your blacklist is currently pending, Check <#1481767733304623235>.",
    ephemeral: true
  });
}

    const birthdays = loadBirthdays();

    if (interaction.commandName === "addbirthday") {
      birthdays[interaction.user.id] = {
        day: interaction.options.getInteger("day"),
        month: interaction.options.getInteger("month"),
        year: interaction.options.getInteger("year")
      };
      saveBirthdays(birthdays);
      return interaction.reply("Saved!");
    }

    if (interaction.commandName === "games") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("game")
        .setPlaceholder("Choose game")
        .addOptions([
          { label: "Sudoku", value: "sudoku" }
        ]);

      return interaction.reply({
        content: "🎮 Choose a game:",
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    }
  }

  if (interaction.isButton()) {
if (
  interaction.customId === "create_ticket" ||
  interaction.customId === "close_ticket" ||
  interaction.customId === "admin_form" ||
  interaction.customId === "support_form"
) {
  return ticket.handleButton(interaction);
}
// WYR buttons
if (interaction.customId.startsWith("wyr_")) {
  return wyr.handleButton(interaction);
}


  // ===== BLACKLIST =====
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

if (imageUrl) {
  message += `\n${imageUrl}`;
}

await finalChannel.send({
  content: message
});

      embed.setColor("Green").setFooter({ text: "Approved" });

    } else {
      embed.setColor("Red").setFooter({ text: "Not Approved" });
    }

    return interaction.update({
      embeds: [embed],
      components: []
    });
  }

  // ===== SUDOKU =====
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
  // ================= SELECT =================
  if (interaction.isStringSelectMenu()) {

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

  
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return; 

if (message.channel.id === PAY_CHANNEL) {

  const levels = JSON.parse(fs.readFileSync("./levels.json", "utf8"));
  const user = levels[message.author.id] || { wl: 0 };

if ((user.wl || 0) < 3) {
  await message.delete().catch(() => {});
  await message.author.send("❌ You need 3 World Locks to use that channel.").catch(() => {});
  return; // 🔥 VERY IMPORTANT
}
  // deduct WL
  user.wl -= 3;
  levels[message.author.id] = user;

  fs.writeFileSync("./levels.json", JSON.stringify(levels, null, 2));
}

  // 🚫 check banned words
  const badWord = words.containsBadWord(message.content);

  if (badWord) {
    await message.delete().catch(() => {});

    const logChannel = await client.channels.fetch("1487613700516085760");

const embed = new EmbedBuilder()
  .setColor("Red")
  .setTitle("Blacklisted Word Detected")
  .setThumbnail(message.author.displayAvatarURL())
  .addFields(
    { name: "User", value: `${message.author}`, inline: true },
    { name: "Channel", value: `${message.channel}`, inline: true },
    { name: "Message", value: message.content.slice(0, 1000) || "No content" }
  )
  .setTimestamp();

logChannel.send({ embeds: [embed] });

    return;
  }

  // level system
  level.handleMessage(message);
});
client.login(process.env.TOKEN);