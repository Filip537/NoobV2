require("dotenv").config();
const cheerio = require("cheerio");
const wikiItemCache = new Map();

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
const testLevelCommand = require("./commands/testlevelup.js");const wyr = require("./commands/wyr.js");
const dice = require("./commands/dice.js");
const quote = require("./commands/quote.js");
const renderWorld = require("./commands/renderworld.js");
const call = require("./feature/call.js");
const inventoryFeature = require("./feature/inventory.js");
const slot = require("./feature/slot.js");
const business = require("./feature/business.js");
const casino = require("./feature/casino.js");
const pvp = require("./feature/pvp.js");
const gamble = require("./feature/gamble.js");
const level = require("./feature/level.js");
const stickerGif = require("./feature/stickerGif.js");
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

const aiMemoryFile = "./aiMemory.json";

const AUCTION_CHANNEL = "1503646000936517752";
const auctionFile = "./auctions.json";
const auctionThumbnail = "https://media.discordapp.net/attachments/1446501509708910704/1503647471077691473/New_Piskel_35.png?ex=6a041c55&is=6a02cad5&hm=e841f76e539eed1d9069010d78224e9c87beb1ddf6db934fc1a05055b8721fb0&=&format=webp&quality=lossless";

const wikiFile = "./wikiData.json";
const pendingWikiEdits = new Map();

function loadWikiData() {
  if (!fs.existsSync(wikiFile)) fs.writeFileSync(wikiFile, "[]");

  try {
    return JSON.parse(fs.readFileSync(wikiFile, "utf8"));
  } catch {
    fs.writeFileSync(wikiFile, "[]");
    return [];
  }
}

function saveWikiData(data) {
  fs.writeFileSync(wikiFile, JSON.stringify(data, null, 2));
}

function makeWikiId() {
  return `${Date.now()}_${Math.floor(Math.random() * 999999)}`;
}

function buildWikiMenu() {
  const wiki = loadWikiData();

  if (wiki.length === 0) return null;

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("wiki_select")
      .setPlaceholder("Choose a wiki guide")
      .addOptions(
        wiki.slice(0, 25).map(item => ({
          label: item.title.slice(0, 100),
          description: "Click to read this guide",
          value: item.id
        }))
      )
  );
}

function buildRemoveWikiMenu() {
  const wiki = loadWikiData();

  if (wiki.length === 0) return null;

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("wiki_remove_select")
      .setPlaceholder("Choose a wiki selector to remove")
      .addOptions(
        wiki.slice(0, 25).map(item => ({
          label: item.title.slice(0, 100),
          description: "Remove this wiki selector",
          value: item.id
        }))
      )
  );
}
function loadAuctions() {
  if (!fs.existsSync(auctionFile)) fs.writeFileSync(auctionFile, "[]");
  try {
    return JSON.parse(fs.readFileSync(auctionFile, "utf8"));
  } catch {
    fs.writeFileSync(auctionFile, "[]");
    return [];
  }
}

function saveAuctions(data) {
  fs.writeFileSync(auctionFile, JSON.stringify(data, null, 2));
}

function makeAuctionId() {
  return `${Date.now()}_${Math.floor(Math.random() * 999999)}`;
}

function parseAuctionDuration(input) {
  if (!input) return Date.now() + 24 * 60 * 60 * 1000;

  const match = input.match(/^(\d+)(m|h|d)$/i);
  if (!match) return Date.now() + 24 * 60 * 60 * 1000;

  const amount = Number(match[1]);
  const type = match[2].toLowerCase();

  if (type === "m") return Date.now() + amount * 60 * 1000;
  if (type === "h") return Date.now() + amount * 60 * 60 * 1000;
  if (type === "d") return Date.now() + amount * 24 * 60 * 60 * 1000;

  return Date.now() + 24 * 60 * 60 * 1000;
}

function buildAuctionEmbed(auction) {
  return new EmbedBuilder()
    .setTitle("Auction House")
    .setColor("Yellow")
    .setThumbnail(auctionThumbnail)
    .setDescription(
      `**Item:** ${auction.item}\n` +
      `**Seller:** <@${auction.ownerId}>\n\n` +
      `**Starting Bid:** ${auction.startBid} ${auction.currency}\n` +
      `**Current Bid:** ${auction.currentBid ? `${auction.currentBid} ${auction.currency}` : "No bids yet"}\n` +
      `**Highest Bidder:** ${auction.highestBidder ? `<@${auction.highestBidder}>` : "None"}\n\n` +
      `**Status:** ${auction.status}\n` +
      `**Ends:** <t:${Math.floor(auction.endsAt / 1000)}:R>`
    )
    .setFooter({ text: `Auction ID: ${auction.auctionId}` })
    .setTimestamp();
}

const STORY_COST = 5;

function loadLevelsData() {
  if (!fs.existsSync("./levels.json")) {
    fs.writeFileSync("./levels.json", "{}");
  }

  try {
    return JSON.parse(fs.readFileSync("./levels.json", "utf8"));
  } catch {
    fs.writeFileSync("./levels.json", "{}");
    return {};
  }
}

function saveLevelsData(data) {
  fs.writeFileSync("./levels.json", JSON.stringify(data, null, 2));
}

const tellStories = {
  redratsu: [
    "Once upon a time, Redratsu walked into a dark forest.",
    "He was looking for Red Riding Hood, who disappeared near NoobV2 village.",
    "A strange wolf appeared and asked for World Locks.",
    "Redratsu said, 'I only pay with courage.'",
    "The wolf got scared because Redratsu was too powerful.",
    "Red Riding Hood came out from behind a tree and laughed.",
    "Together, they went back home and became legends of the forest."
  ],
  noob_bgl: [
    "Once upon a time, a noob found a shiny Blue Gem Lock on the ground.",
    "He screamed so loud that the whole world joined.",
    "Everyone asked if it was real or fake.",
    "The noob tried to wrench it but accidentally dropped it.",
    "A chicken picked it up and ran away.",
    "The noob chased the chicken for three worlds.",
    "In the end, the chicken gave it back and became his pet."
  ],
  lost_wl: [
    "Once upon a time, an admin lost one World Lock.",
    "He searched every block in the world.",
    "Players started making theories about where it went.",
    "One player said the WL became invisible.",
    "Another said it got eaten by a dirt block.",
    "Finally, the admin found it in his own inventory.",
    "Everyone laughed, and the admin pretended nothing happened."
  ],
  ghost_noobv2: [
    "Once upon a time, NoobV2 had a ghost problem.",
    "Every night, someone heard a door opening by itself.",
    "The admins gathered with flashlights and suspicious faces.",
    "They followed the sound to the storage room.",
    "Inside, they found a player secretly farming dirt.",
    "The ghost was not a ghost at all.",
    "It was just a noob trying to become rich."
  ],
  parkour_king: [
    "Once upon a time, a player claimed he was the Parkour King.",
    "He said he could finish any parkour without dying.",
    "The whole server gathered to watch him.",
    "He jumped once and immediately fell.",
    "Everyone stayed silent for three seconds.",
    "Then he said it was just a warm-up.",
    "After 99 tries, he finally won and became a legend."
  ],
  fake_pro: [
    "Once upon a time, a player called himself the strongest pro.",
    "He wore expensive items and walked like a boss.",
    "Everyone believed him until someone asked him to break a dirt block.",
    "He missed the dirt block three times.",
    "The server became quiet.",
    "Then someone whispered, 'He is a noob.'",
    "The fake pro accepted his destiny and changed his name."
  ],
  wl_wizard: [
    "Once upon a time, there was a World Lock Wizard.",
    "He could turn dirt into dreams and gems into chaos.",
    "Players came from every world to ask for luck.",
    "One noob asked to become rich overnight.",
    "The wizard gave him one seed and said, 'Farm.'",
    "The noob was confused but started working.",
    "Years later, he became richer than the wizard."
  ],
  dice_cave: [
    "Once upon a time, there was a hidden dice cave.",
    "Only brave players could enter it.",
    "Inside the cave, dice rolled by themselves.",
    "One player rolled a six and the cave started shaking.",
    "A secret door opened behind a lava wall.",
    "Inside was one sign that said, 'Touch grass.'",
    "Everyone left the cave and pretended they never saw it."
  ],
  rich_noob: [
    "Once upon a time, a noob became rich by accident.",
    "He sold a random item for way too many World Locks.",
    "Nobody knew why the buyer wanted it.",
    "The noob bought wings, a cape, and sunglasses.",
    "Then he forgot how to trade.",
    "He asked the server how to drop items safely.",
    "Everyone protected him because he was rich but still noob."
  ],
  dragon_gt: [
    "Once upon a time, a dragon landed in a Growtopia world.",
    "It wanted gems, World Locks, and a comfortable bed.",
    "The players tried to fight it with pickaxes.",
    "The dragon laughed and opened a shop instead.",
    "It sold lava, wings, and suspicious soup.",
    "Soon, the dragon became the richest shop owner.",
    "Nobody fought it again because the prices were actually good."
  ],
  lost_growid: [
    "Once upon a time, a player forgot his GrowID.",
    "He asked everyone if they remembered who he was.",
    "Some said he was a legend.",
    "Some said he owed them World Locks.",
    "He became more confused every second.",
    "Finally, he checked his own profile.",
    "His GrowID was there the whole time."
  ],
  admin_test: [
    "Once upon a time, a player wanted to become an admin.",
    "The owners gave him the final admin test.",
    "He had to stay calm during chaos.",
    "Suddenly, everyone started asking questions at once.",
    "Someone yelled scam, someone yelled parkour, and someone asked for free WL.",
    "The player took a deep breath and answered everyone politely.",
    "He passed the test and became a trusted admin."
  ]
};
const dareFile = "./dareUsed.json";

function loadDareUsed() {
  if (!fs.existsSync(dareFile)) {
    fs.writeFileSync(dareFile, "{}");
  }

  try {
    return JSON.parse(fs.readFileSync(dareFile, "utf8"));
  } catch {
    fs.writeFileSync(dareFile, "{}");
    return {};
  }
}

function saveDareUsed(data) {
  fs.writeFileSync(dareFile, JSON.stringify(data, null, 2));
}

function getDareMessages() {
  return [
    "Send a random emoji that describes your day.",
    "Type your next message with no vowels.",
    "Change your nickname to something funny for 10 minutes.",
    "Say one nice thing about the last person who sent a message.",
    "Send your most used emoji.",
    "Talk like a robot for 5 minutes.",
    "Use only emojis for your next 3 messages.",
    "Send a random fun fact about yourself.",
    "Let someone choose your Discord status for 10 minutes.",
    "Say the alphabet backwards as far as you can.",
    "Send a message using only capital letters.",
    "Send a message using only lowercase letters.",
    "Pretend to be an NPC for 5 minutes.",
    "Tell the server your weirdest habit.",
    "Send a compliment to someone online.",
    "Let the next person choose your next message.",
    "Type a sentence backwards.",
    "Say something dramatic for no reason.",
    "Act like you are in a movie trailer.",
    "Send the last emoji in your emoji list.",
    "Say your username like it is a royal title.",
    "Use a random word in your next 3 messages.",
    "Pretend you are a teacher for 5 minutes.",
    "Pretend you are a villain for 5 minutes.",
    "Send a fake breaking news message.",
    "Tell everyone your current mood in one word.",
    "Send a message without using the letter A.",
    "Send a message without using the letter E.",
    "Talk like a pirate for 5 minutes.",
    "Talk like a baby for 3 messages.",
    "Make a fake advertisement for yourself.",
    "Say something that sounds wise but is useless.",
    "Send a random food opinion.",
    "Tell the server your favorite snack.",
    "Say who you think is the funniest person online.",
    "Let someone rate your profile picture.",
    "Send a bad joke.",
    "Send a dad joke.",
    "Tell everyone your dream job as a joke.",
    "Pretend you are rich for 5 minutes.",
    "Pretend you are broke for 5 minutes.",
    "Make a fake apology for something random.",
    "Send a message like you are crying in a movie.",
    "Send a message like you are giving a speech.",
    "Say your favorite word.",
    "Send a random keyboard smash.",
    "Try to make someone laugh with one sentence.",
    "Say something suspicious.",
    "Say something wholesome.",
    "Say something cursed but server-safe.",
    "Send a message like a news reporter.",
    "Send a message like a game announcer.",
    "Send a message like a cooking show host.",
    "Tell the server what animal you would be.",
    "Tell the server what fruit you would be.",
    "Tell the server what NPC name you would have.",
    "Make a fake quest for someone.",
    "Make a fake server rule.",
    "Make a fake item name.",
    "Make a fake movie title about your life.",
    "Make a fake song title about your mood.",
    "Say something in the most formal way possible.",
    "Say something in the most dramatic way possible.",
    "Say something in the most lazy way possible.",
    "Send a message with exactly 5 words.",
    "Send a message with exactly 10 words.",
    "Send a message ending with lol.",
    "Send a message ending with 💀.",
    "Ask a random silly question.",
    "Answer the next question with only yes.",
    "Answer the next question with only no.",
    "Pretend you are confused for 3 messages.",
    "Pretend you are very smart for 3 messages.",
    "Pretend you are a detective for 5 minutes.",
    "Accuse someone of stealing your imaginary sandwich.",
    "Say your biggest fake secret.",
    "Tell everyone your fake villain name.",
    "Tell everyone your fake superhero name.",
    "Create a fake quote from yourself.",
    "Send a random number and act like it means something.",
    "Say something motivational.",
    "Say something anti-motivational.",
    "Send a message like you just won an award.",
    "Send a message like you lost a boss fight.",
    "Send a message like you found treasure.",
    "Send a message like you are lost.",
    "Send a message like you are giving a warning.",
    "Send a message like you are a final boss.",
    "Send a message like you are a side character.",
    "Send a message like you are in court.",
    "Make a fake confession.",
    "Make a fake weather report.",
    "Make a fake school announcement.",
    "Make a fake server update.",
    "Make a fake product review.",
    "Make a fake restaurant review.",
    "Say one thing you would never eat.",
    "Say one thing you would eat every day.",
    "Tell the server your funniest fear.",
    "Tell the server your fake fear.",
    "Tell someone they have main character energy.",
    "Tell someone they have NPC energy.",
    "Send your best fake evil laugh.",
    "Send your best fake crying text.",
    "Send your best fake angry text.",
    "Send your best fake happy text.",
    "Use three emojis to describe yourself.",
    "Use three words to describe yourself.",
    "Send a message with no spaces.",
    "Send a message with too many spaces.",
    "Send a random compliment to the server.",
    "Send a random roast but keep it friendly.",
    "Say something like an anime character.",
    "Say something like a game tutorial.",
    "Say something like a loading screen tip.",
    "Make a fake achievement you unlocked today.",
    "Make a fake title for yourself.",
    "Tell everyone your fake level.",
    "Tell everyone your fake skill.",
    "Tell everyone your fake weakness.",
    "Tell everyone your fake power.",
    "Send a message like you are lagging.",
    "Send a message like your brain is buffering.",
    "Send a message like you are speedrunning life.",
    "Send a message like you are about to rage quit.",
    "Say something that sounds like a spell.",
    "Make a fake magic spell.",
    "Make a fake potion name.",
    "Make a fake boss name.",
    "Make a fake world name.",
    "Make a fake Discord command.",
    "Make a fake warning message.",
    "Make a fake ban reason.",
    "Make a fake item description.",
    "Make a fake shop message.",
    "Make a fake giveaway prize.",
    "Say your current battery percentage as your mood.",
    "Say what your brain is doing right now.",
    "Say what your stomach is thinking right now.",
    "Tell the server your fake life goal.",
    "Tell the server your real favorite color.",
    "Tell the server your fake favorite color.",
    "Send a random sentence with the word banana.",
    "Send a random sentence with the word potato.",
    "Send a random sentence with the word cheese.",
    "Send a random sentence with the word noodles.",
    "Send a random sentence with the word dragon.",
    "Send a random sentence with the word noob.",
    "Send a random sentence with the word pro.",
    "Say something like you are selling an item.",
    "Say something like you are buying an item.",
    "Say something like you are trading your soul.",
    "Say something like a tired worker.",
    "Say something like a confused student.",
    "Say something like a strict teacher.",
    "Say something like a chill admin.",
    "Say something like a suspicious admin.",
    "Say something like a rich player.",
    "Say something like a poor player.",
    "Say something like a lucky player.",
    "Say something like an unlucky player.",
    "Make up a fake excuse for being late.",
    "Make up a fake reason why you disappeared.",
    "Make up a fake reason why you are online.",
    "Make up a fake reason why you are tired.",
    "Make up a fake reason why you are hungry.",
    "Send a message like you are whispering.",
    "Send a message like you are shouting.",
    "Send a message like you are panicking.",
    "Send a message like you are celebrating.",
    "Send a message like you are suspiciously calm.",
    "Send a message like you are pretending to be normal.",
    "Tell the server your fake crime.",
    "Tell the server your fake punishment.",
    "Tell the server your fake reward.",
    "Tell the server your fake talent.",
    "Tell the server your fake curse.",
    "Tell the server your fake blessing.",
    "Send a message using only 2 words.",
    "Send a message using only 3 words.",
    "Send a message using only 4 words.",
    "Send a message with one emoji at the end.",
    "Send a message with three emojis at the end.",
    "Say something that sounds like a quote from a game.",
    "Say something that sounds like a quote from a movie.",
    "Say something that sounds like a quote from a villain.",
    "Say something that sounds like a quote from a hero.",
    "Make a fake dramatic goodbye message.",
    "Make a fake dramatic comeback message.",
    "Make a fake dramatic betrayal message.",
    "Make a fake dramatic friendship message.",
    "Ask someone a random harmless question.",
    "Ask the server to rate your vibe.",
    "Ask the server to choose your next emoji.",
    "Ask the server to give you a fake title.",
    "Ask the server to give you a fake job.",
    "Ask the server to give you a fake superpower.",
    "Say one thing you are grateful for.",
    "Say one thing that made you laugh recently.",
    "Say one thing you are pretending to understand.",
    "Say one thing you would delete from existence.",
    "Say one thing you would add to the world.",
    "Pretend you are giving patch notes for yourself.",
    "Pretend you are a broken AI for 3 messages.",
    "Pretend your keyboard is possessed for 1 message.",
    "Pretend you are a shopkeeper for 5 minutes.",
    "Pretend you are a quest giver for 5 minutes.",
    "Pretend you are the server mascot for 5 minutes.",
    "Pretend you are the final boss of the chat.",
    "Send a message like you just woke up.",
    "Send a message like you need coffee.",
    "Send a message like you are out of energy.",
    "Send a message like you found unlimited money.",
    "Send a message like you lost your last brain cell.",
    "Send a message like your WiFi betrayed you.",
    "Send a message like your phone is judging you.",
    "Send a message like you are hiding something.",
    "Send a message like you discovered a secret.",
    "Send a message like you are giving life advice."
  ];
}
function loadAiMemory() {
  if (!fs.existsSync(aiMemoryFile)) {
    fs.writeFileSync(aiMemoryFile, "{}");
  }
  return JSON.parse(fs.readFileSync(aiMemoryFile, "utf8"));
}

function saveAiMemory(data) {
  fs.writeFileSync(aiMemoryFile, JSON.stringify(data, null, 2));
}
const fs = require("fs");
const cron = require("node-cron");
const activeInteractions = new Set();
const client = new Client({
intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildModeration,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.MessageContent,
],
partials: ["CHANNEL", "MESSAGE", "GUILD_MEMBER"]
});
const sharkfinReplyFile = "./sharkfinReplies.json";

function loadSharkfinReplies() {
  if (!fs.existsSync(sharkfinReplyFile)) {
    fs.writeFileSync(sharkfinReplyFile, "{}");
  }

  try {
    return JSON.parse(fs.readFileSync(sharkfinReplyFile, "utf8"));
  } catch {
    fs.writeFileSync(sharkfinReplyFile, "{}");
    return {};
  }
}

function saveSharkfinReplies(data) {
  fs.writeFileSync(sharkfinReplyFile, JSON.stringify(data, null, 2));
}
const randomMessageFile = "./randomMessagesUsed.json";

function loadRandomMessageUsed() {
  if (!fs.existsSync(randomMessageFile)) {
    fs.writeFileSync(randomMessageFile, "{}");
  }

  try {
    return JSON.parse(fs.readFileSync(randomMessageFile, "utf8"));
  } catch {
    fs.writeFileSync(randomMessageFile, "{}");
    return {};
  }
}

function saveRandomMessageUsed(data) {
  fs.writeFileSync(randomMessageFile, JSON.stringify(data, null, 2));
}
function getRandomMessages() {
  return [

    "Sometimes I act mysterious, but honestly I forgot what I was about to say.",
    "I tried to look cool today... then I tripped.",
    "I act confident until someone asks me a simple question.",
    "I stare at my crush like I’m in a music video.",
    "I practice fake arguments in the shower.",
    "I laugh at my own jokes before finishing them.",
    "I act like I’m busy when I actually have no idea what I’m doing.",
    "I make eye contact then immediately regret it.",
    "Sometimes I walk fast just to look important.",
    "I create fake scenarios before sleeping.",

    "I said I’d sleep early... that was a lie.",
    "I open the fridge like something new will spawn.",
    "I check my phone every 2 minutes like I’m famous.",
    "I pretend to understand, then panic later.",
    "I act mature until free food appears.",
    "I try to be mysterious but end up looking confused.",
    "I overthink conversations from 3 years ago.",
    "I smile at texts like an idiot.",
    "I practice conversations that will never happen.",
    "I act cool until someone attractive walks by.",

    "I tell myself one more game, then the sun comes up.",
    "I act like I’m okay but my sleep schedule disagrees.",
    "Sometimes I’m the red flag and the victim.",
    "I say I’m productive while lying on my bed.",
    "I’m emotionally attached to people who barely text back.",
    "I get jealous over imaginary situations.",
    "I create problems in my head for free.",
    "I re-read messages like I’m analyzing crime evidence.",
    "I type fast when I’m angry but never send it.",
    "I act tough but mosquito bites still scare me.",

    ...Array.from({ length: 300 }, () =>
      [
        "I had a main character moment, then reality humbled me.",
        "I entered the room confidently and forgot why I went there.",
        "I act unbothered, but I notice everything.",
        "I replay awkward moments like it's Netflix.",
        "I fell in love with someone who replies with one word.",
        "I act like I know what I’m doing... I don’t.",
        "I looked in the mirror and negotiated with myself.",
        "I said I’d be productive today. That didn’t happen.",
        "I romanticize my life then remember I’m broke.",
        "I create fake arguments and somehow still lose."
      ][Math.floor(Math.random() * 10)]
    )

  ];
}

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
const birthdayRole = "1500307450824232970";
const BOT_ID = "1444622846729912435";
const ROLE_LOG_CHANNEL = "1503741904636874756";
const MESSAGE_LOG_CHANNEL = "1503741879282307072";
const NICK_LOG_CHANNEL = "1503742032034795720";
const SUGGESTION_CHANNEL = "1439670516490436710";
const aiCooldown = new Map();
// messageId → gamehop
const sudokuGames = new Map();

const teamsFile = "./teams.json";
const TEAM_LOG_CHANNEL = "1502320280691806258";
const UPDATE_BROADCAST_CHANNEL = "1501004255014686780";
const updateBroadcastCooldown = new Set();
const guildFile = "./guildMembers.json";
const guildThumbnail = "https://media.discordapp.net/attachments/1441484400385720320/1504343505072427120/New_Piskel_36.png?ex=6a06a490&is=6a055310&hm=6788bd09d7274293d3243bc7bfb6b5253c020ddecdbbb79be6ec0bbe937ec924&=&format=webp&quality=lossless";

function loadGuildMembers() {
  if (!fs.existsSync(guildFile)) fs.writeFileSync(guildFile, "[]");

  try {
    return JSON.parse(fs.readFileSync(guildFile, "utf8"));
  } catch {
    fs.writeFileSync(guildFile, "[]");
    return [];
  }
}

function saveGuildMembers(data) {
  fs.writeFileSync(guildFile, JSON.stringify(data, null, 2));
}

function guildRoleName(role) {
  if (role === "GL") return "Guild Leader";
  if (role === "GC") return "Guild Co-Leader";
  if (role === "GE") return "Guild Elder";
  return "Member";
}

function buildGuildEmbed(members, filter = "ALL") {
  const filtered = filter === "ALL"
    ? members
    : members.filter(m => m.role === filter);

  const description = filtered.length
    ? filtered.map((m, i) =>
        `**${i + 1}. ${m.growid}**\n` +
        `Role: **${guildRoleName(m.role)}**\n` +
        `Discord: ${m.discordId ? `<@${m.discordId}>` : "Not linked"}`
      ).join("\n\n")
    : "No guild members found for this category.";

  return new EmbedBuilder()
    .setTitle(filter === "ALL" ? "Guild Member List" : `${guildRoleName(filter)} List`)
    .setColor("Yellow")
    .setThumbnail(guildThumbnail)
    .setDescription(description)
    .setFooter({ text: `Total shown: ${filtered.length}` })
    .setTimestamp();
}

function guildListDropdown(selected = "ALL") {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("guildlist_filter")
      .setPlaceholder("Filter guild members")
      .addOptions(
        { label: "All Members", value: "ALL", default: selected === "ALL" },
        { label: "GL - Guild Leader", value: "GL", default: selected === "GL" },
        { label: "GC - Guild Co-Leader", value: "GC", default: selected === "GC" },
        { label: "GE - Guild Elder", value: "GE", default: selected === "GE" },
        { label: "Normal Member", value: "MEMBER", default: selected === "MEMBER" }
      )
  );
}
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function loadTeams() {
  if (!fs.existsSync(teamsFile)) {
    fs.writeFileSync(teamsFile, "[]");
  }

  try {
    return JSON.parse(fs.readFileSync(teamsFile, "utf8"));
  } catch {
    fs.writeFileSync(teamsFile, "[]");
    return [];
  }
}

function saveTeams(data) {
  fs.writeFileSync(teamsFile, JSON.stringify(data, null, 2));
}
function loadStories() {
  if (!fs.existsSync(storyFile)) {
    fs.writeFileSync(storyFile, "[]");
  }
  return JSON.parse(fs.readFileSync(storyFile, "utf8"));
}

const WORD_BYPASS_ID = "1108921222030426172";
const wordTimeouts = new Map();
const protectedTimeouts = new Map();

function getNextWordTimeout(userId) {
  const current = wordTimeouts.get(userId) || 25;
  const next = current + 5;
  wordTimeouts.set(userId, next);
  return next;
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
async function fetchWithTimeout(url, options = {}, timeout = 2500) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    return response;
  } finally {
    clearTimeout(timer);
  }
}
async function getWikiItem(itemName) {
  try {
    const title = itemName
      .trim()
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    const parseUrl =
      "https://growtopiawiki.com/api.php?action=parse&page=" +
      encodeURIComponent(title) +
      "&prop=text&format=json";

    const parseRes = await fetchWithTimeout(
      parseUrl,
      {
        headers: {
          "User-Agent": "NoobV2 Wiki Sync Bot"
        }
      },
      2500
    );

    if (!parseRes.ok) return null;

    const parseData = await parseRes.json();

    if (parseData?.error) return null;

    const html = parseData?.parse?.text?.["*"];
    if (!html) return null;

    const $ = cheerio.load(html);

    const content = $(".mw-parser-output");

    const realTitle = parseData?.parse?.title || title;

    // Description
    const description =
      content
        .children("p")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim() || "No description found.";

    // Image
    let image = content
      .find(".infobox img, .itembox img, img")
      .first()
      .attr("src");

    if (image) {
      if (image.startsWith("//")) {
        image = "https:" + image;
      } else if (image.startsWith("/")) {
        image = "https://growtopiawiki.com" + image;
      }
    }

    // Better splice detection
    function getSpliceRecipe() {
      let foundRecipe = null;

      $("*").each((i, el) => {
        const text = $(el)
          .text()
          .replace(/\s+/g, " ")
          .trim();

        if (
          text.includes("The tree of this item can be made by") ||
          text.includes("made by mixing the following seeds")
        ) {
          foundRecipe = text;
          return false;
        }
      });

      if (!foundRecipe) {
        return "This item is **unsplicable**.";
      }

      foundRecipe = foundRecipe
        .replace("Splicing", "")
        .replace(/\s+/g, " ")
        .trim();

      return foundRecipe;
    }

    const splice = getSpliceRecipe();

    return {
      title: realTitle,
      description,
      image,
      splice,
      url:
        "https://growtopiawiki.com/wiki/" +
        encodeURIComponent(
          realTitle.replace(/\s+/g, "_")
        )
    };

  } catch (err) {
    console.error("Wiki Error:", err);
    return null;
  }
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

  try {
    return JSON.parse(fs.readFileSync(birthdayFile, "utf8"));
  } catch (err) {
    console.log("Birthday file corrupted, resetting:", err);
    fs.writeFileSync(birthdayFile, "{}");
    return {};
  }
}

function saveBirthdays(data) {
  const tempFile = birthdayFile + ".tmp";

  fs.writeFileSync(
    tempFile,
    JSON.stringify(data, null, 2),
    "utf8"
  );

  fs.renameSync(tempFile, birthdayFile);
}

function isValidBirthday(day, month, year) {
  if (!day || !month || !year) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > new Date().getFullYear()) return false;

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

async function cleanUnknownBirthdays(guild, birthdays) {
  let removed = 0;

  for (const userId of Object.keys(birthdays)) {
    const member = await guild.members.fetch(userId).catch(() => null);

    if (!member || member.user.bot) {
      delete birthdays[userId];
      removed++;
    }
  }

  if (removed > 0) saveBirthdays(birthdays);

  return removed;
}

async function checkBirthdays() {
  const now = getGMT8DateParts();

  if (now.hour !== 9) return;

  const birthdays = loadBirthdays();
  const channel = await client.channels.fetch(birthdayChannel).catch(() => null);

  if (!channel || !channel.guild) return;

  await cleanUnknownBirthdays(channel.guild, birthdays);

  for (const userId of Object.keys(birthdays)) {
    const birthday = birthdays[userId];

    if (!birthday || !birthday.day || !birthday.month) continue;

    const member = await channel.guild.members.fetch(userId).catch(() => null);

    if (!member || member.user.bot) {
      delete birthdays[userId];
      continue;
    }

    if (
      birthday.day === now.day &&
      birthday.month === now.month &&
      birthday.lastBirthdaySent !== now.dateKey
    ) {
      await channel.send({
        content: `🎉 Happy Birthday ${member}! Hope you have an amazing day!`
      });

      await member.send({
        content:
`🎉 Happy Birthday!

Hello ${member}, today is your birthday!

We hope you have an amazing day. Enjoy your special day 🎂`
      }).catch(() => {});

      await member.roles.add(birthdayRole).catch(() => {});

      setTimeout(async () => {
        const freshMember = await channel.guild.members.fetch(userId).catch(() => null);
        if (freshMember) {
          await freshMember.roles.remove(birthdayRole).catch(() => {});
        }
      }, 24 * 60 * 60 * 1000);

      birthday.lastBirthdaySent = now.dateKey;
    }
  }

  saveBirthdays(birthdays);
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
  await ticket.refreshAllTicketPanels(client);
await ticket.cleanupCustomTickets(client);

cron.schedule("*/5 * * * *", async () => {
  await ticket.refreshAllTicketPanels(client);
  await ticket.cleanupCustomTickets(client);
});
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
await checkBirthdays();

// every 5 minutes → story cleanup
cron.schedule("*/5 * * * *", async () => {
  await cleanupExpiredStories();
});

// every hour → birthday checker
cron.schedule("0 * * * *", async () => {
  await checkBirthdays();
});
});

setInterval(async () => {

  const blacklistData = loadBlacklist();

  const remaining = [];

  for (const entry of blacklistData) {

    if (
      entry.expiresAt &&
      Date.now() >= entry.expiresAt
    ) {

      const logChannel =
        client.channels.cache.get("1505252429967396904");

      if (logChannel) {

        logChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor("Green")
              .setTitle("Unblacklisted")
              .setDescription(
`Growid: **${entry.growid}**
Reason: **Blacklist Expired**`
              )
              .setTimestamp()
          ]
        });
      }

    } else {

      remaining.push(entry);
    }
  }

  saveBlacklist(remaining);

}, 60000);
const LEGEND_QUESTS = {
  honor: {
    title: "Quest For Honor",
    reward: "Legendary Title",
    steps: [
      "Deliver 2,000 Sand.",
      "Kill 100 players in PvP via a Game Generator.",
      "Break 5,000 blocks.",
      "Deliver 600 Display Boxes.",
      "Plant seeds that add up to 50,000 rarities.",
      "Earn 50 Growtokens.",
      "Deliver 3 Golden Diapers.",
      "Earn 10,000 XP.",
      "Deliver 1,000 Tombstones.",
      "Deliver 100,000 Gems.",
      "Break 100,000 rarity worth of blocks.",
      "Complete 100 successful surgeries.",
      "Collect from 1,000 providers.",
      "Deliver 3 Golden Heart Crystals.",
      "Collect 100,000 rarity worth of fruit from trees.",
      "Deliver a Growie Award or a Neptune's Crown.",
      "Deliver 3 Super Fireworks.",
      "Deliver 10 pairs of Rainbow Wings.",
      "Deliver 3 Birth Certificates.",
      "Deliver the Legendary Orb."
    ]
  },
  fire: {
    title: "Quest For Fire",
    reward: "Dragon of Legend",
    steps: [
      "Deliver 2,000 Lava.",
      "Kill 100 players in PvP via a Game Generator.",
      "Break 5,000 blocks.",
      "Deliver 600 Dragon Gates.",
      "Plant seeds that add up to 50,000 rarities.",
      "Earn 50 Growtokens.",
      "Deliver 10 Dragon Hands.",
      "Earn 10,000 XP.",
      "Deliver 1,000 Dragon Tails.",
      "Deliver 100,000 Gems.",
      "Break 100,000 rarity worth of blocks.",
      "Complete 100 successful surgeries.",
      "Collect from 1,000 providers.",
      "Deliver 3 Fiesta Dragons.",
      "Collect 100,000 rarity worth of fruit from trees.",
      "Deliver an Ultra Trophy 3000 or any of the WOTD Trophies.",
      "Deliver 1 Neptune's Pendant.",
      "Deliver 1,000 Rocket Thrusters.",
      "Deliver 3 Devil Wings.",
      "Deliver the Legendary Orb."
    ]
  },
  steel: {
    title: "Quest Of Steel",
    reward: "Legendbot-009",
    steps: [
      "Deliver 2,000 Chemical Gs.",
      "Kill 100 players in PvP via a Game Generator.",
      "Break 5,000 blocks.",
      "Deliver 600 Robot Wants Dubsteps.",
      "Plant seeds that add up to 50,000 rarities.",
      "Earn 50 Growtokens.",
      "Deliver 3 Edison Zoomsters.",
      "Earn 10,000 XP.",
      "Deliver 1,000 High Tech Blocks.",
      "Deliver 100,000 Gems.",
      "Break 100,000 rarity worth of blocks.",
      "Complete 100 successful surgeries.",
      "Collect from 1,000 providers.",
      "Deliver 3 Bride Of Reanimator Remotes.",
      "Collect 100,000 rarity worth of fruit from trees.",
      "Deliver 1 Mint Julep or 1 Neptune's Chariot.",
      "Deliver 5 Kerjiggers.",
      "Deliver 5 Doohickeys.",
      "Deliver 2 Thingamabobs.",
      "Deliver the Legendary Orb."
    ]
  },
  heavens: {
    title: "Quest Of The Heavens",
    reward: "Legendary Wings",
    steps: [
      "Deliver 1,000 Clouds.",
      "Kill 100 players in PvP via a Game Generator.",
      "Break 5,000 blocks.",
      "Deliver 600 Fairy Wings.",
      "Plant seeds that add up to 50,000 rarities.",
      "Earn 50 Growtokens.",
      "Deliver 3 Bubble Wings.",
      "Earn 10,000 XP.",
      "Deliver 800 Crimson Eagle Wings.",
      "Deliver 100,000 Gems.",
      "Break 100,000 rarity worth of blocks.",
      "Complete 100 successful surgeries.",
      "Collect from 1,000 providers.",
      "Deliver 20 Rainbow Wings.",
      "Collect 100,000 rarity worth of fruit from trees.",
      "Deliver 3 Golden Angel Wings.",
      "Deliver 100 Ripper Wings.",
      "Deliver 1 Phoenix Wings or 1 Neptune's Trident.",
      "Deliver 50 Parrot Wings.",
      "Deliver the Legendary Orb."
    ]
  },
  blade: {
    title: "Quest For The Blade",
    reward: "Legendary Katana",
    steps: [
      "Deliver 1,000 Iron Bars.",
      "Kill 100 players in PvP via a Game Generator.",
      "Break 5,000 blocks.",
      "Deliver 600 Golden Swords.",
      "Plant seeds that add up to 50,000 rarities.",
      "Earn 50 Growtokens.",
      "Deliver 3 Heavenly Scythes.",
      "Earn 10,000 XP.",
      "Deliver 800 Headsman's Axes.",
      "Deliver 100,000 Gems.",
      "Break 100,000 rarity worth of blocks.",
      "Defeat 100 villains.",
      "Find 100 radioactive items with a Geiger Counter.",
      "Deliver 20 Flamesabers.",
      "Collect 100,000 rarity worth of fruit from trees.",
      "Deliver 1 Golden Apple.",
      "Deliver 10 Much-Too-Small Yellow Shirts.",
      "Deliver 20 Flame Scythes.",
      "Deliver 20 Crystal Glaives.",
      "Deliver the Legendary Orb."
    ]
  },
  candour: {
    title: "Quest For Candour",
    reward: "Whip of Truth",
    steps: [
      "Deliver 2,000 Secret Of Growtopias.",
      "Kill 100 players in PvP via a Game Generator.",
      "Break 10,000 blocks.",
      "Deliver 1,000 Mind-Ghost-In-A-Jars.",
      "Plant seeds that add up to 100,000 rarities.",
      "Earn 50 Growtokens.",
      "Deliver 10 Super Squirt Gun Jetpacks.",
      "Earn 20,000 XP.",
      "Deliver 5 Soul Stones.",
      "Deliver 140,000 Gems.",
      "Break 200,000 rarity worth of blocks.",
      "Defeat 100 villains.",
      "Train 20 fishes.",
      "Deliver 3 Celestial Lances.",
      "Collect 200,000 rarity worth of fruit from trees.",
      "Deliver 5 Ring Of Shrinkings.",
      "Deliver 3 Golden Talarias.",
      "Deliver 1 Summer Event Player Medal: Gold, Winter Event Player Medal: Gold, or Spring Event Player Medal: Gold.",
      "Deliver 3 Ancestral Totems of Wisdom.",
      "Deliver the Legendary Orb."
    ]
  },
  sky: {
    title: "Quest For The Sky",
    reward: "Legendary Dragon Knight's Wings",
    steps: [
      "Deliver 2,000 Obsidians.",
      "Kill 100 players in PvP via a Game Generator.",
      "Break 10,000 blocks.",
      "Deliver 1,000 Knight Helmets.",
      "Plant seeds that add up to 100,000 rarities.",
      "Earn 50 Growtokens.",
      "Deliver 10 Blanket Capes.",
      "Earn 20,000 XP.",
      "Deliver 800 Blazing Electro Wings.",
      "Deliver 140,000 Gems.",
      "Break 200,000 rarity worth of blocks.",
      "Complete 100 successful surgeries.",
      "Train 10 fishes.",
      "Deliver 10 Autumn Wings.",
      "Collect 200,000 rarity worth of fruit from trees.",
      "Deliver 1 Golden Dragon Statue or 1 Neptune's Armor.",
      "Deliver 5 Chaos Dragons.",
      "Deliver 1 Draconic Wings.",
      "Deliver 10 Dragon Knight's Chestplate.",
      "Deliver the Legendary Orb."
    ]
  },
  owl: {
    title: "Quest Of The Owl",
    reward: "Legendary Owl",
    steps: [
      "Deliver 2,000 Clouds Wallpaper.",
      "Kill 100 players in PvP via a Game Generator.",
      "Break 10,000 blocks.",
      "Deliver 50 Owl Masks.",
      "Plant seeds that add up to 100,000 rarities.",
      "Earn 50 Growtokens.",
      "Deliver 50 Alaskan King Crab Crowns.",
      "Earn 20,000 XP.",
      "Deliver 10 Sun Shooter Bows.",
      "Deliver 100,000 Gems.",
      "Break 200,000 rarity worth of blocks.",
      "Defeat 100 villains.",
      "Train 10 fishes.",
      "Deliver 1 Golden Silk Scarf or 1 Neptune's Weather Machine - Atlantis.",
      "Collect 200,000 rarity worth of fruit from trees.",
      "Deliver 2 Snow Leopard Tail.",
      "Deliver 3 Ultraviolet Aura.",
      "Deliver 1 Lil Growpeep's Baaaa Blaster.",
      "Deliver 1 Draconic Soul Aura.",
      "Deliver the Legendary Orb."
    ]
  },
  mech: {
    title: "Quest Of The Mech",
    reward: "Legendary Destroyer",
    steps: [
      "Deliver 2,000 Dwarven Backgrounds.",
      "Kill 100 players in PvP via a Game Generator.",
      "Break 10,000 blocks.",
      "Deliver 150 Lost Startopian Helmets.",
      "Plant seeds that add up to 100,000 rarities.",
      "Earn 50 Growtokens.",
      "Deliver 15 Monster Trucks.",
      "Earn 20,000 XP.",
      "Deliver 10 Matrix Auras.",
      "Deliver 100,000 Gems.",
      "Break 200,000 rarity worth of blocks.",
      "Complete 100 Star Voyages.",
      "Collect from 1,000 providers.",
      "Deliver 3 Digger's Spades.",
      "Collect 200,000 rarity worth of fruit from trees.",
      "Deliver 10 Ambu-Lances.",
      "Deliver 5 Mining Mechs.",
      "Deliver 1 Phoenix Armor.",
      "Deliver 1 Volcanic Cape.",
      "Deliver the Legendary Orb."
    ]
  }
};
client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
  const handled = await call.handleCommand(interaction);
  if (handled) return;
}
if (interaction.isChatInputCommand() && interaction.commandName === "renderworld") {
  return renderWorld.execute(interaction);
}

if (interaction.isButton()) {
  const handled = await renderWorld.handleButton(interaction);
  if (handled) return;
}

if (interaction.isModalSubmit()) {
  const handled = await renderWorld.handleModal(interaction);
  if (handled) return;
}
if (interaction.isStringSelectMenu()) {
  const handled = await call.handleSelect(interaction);
  if (handled) return;
}
  if (interaction.isChatInputCommand() && interaction.commandName === "testlevelup") {
  return testLevelCommand.execute(interaction);
}
  if (interaction.isChatInputCommand()) {
  const handled = await business.handleCommand(interaction);
  if (handled) return;
}

if (interaction.isButton()) {
  const handled = await business.handleButton(interaction);
  if (handled) return;
}
  if (interaction.isChatInputCommand()) {
  const handled = await casino.handleCommand(interaction);
  if (handled) return;
}
if (interaction.isButton()) {
  const handled = await profileFeature.handleButton(interaction);
  if (handled) return;
}

if (interaction.isStringSelectMenu()) {
  const handled = await profileFeature.handleSelect(interaction);
  if (handled) return;
}
if (interaction.isButton()) {
  const handled = await casino.handleButton(interaction);
  if (handled) return;
}
  if (interaction.isChatInputCommand()) {
  const handled = await pvp.handleCommand(interaction);
  if (handled) return;
}

if (interaction.isButton()) {
  const handled = await pvp.handleButton(interaction);
  if (handled) return;
}
  if (interaction.isChatInputCommand()) {
  const handled = await casino.handleCommand(interaction);
  if (handled) return;
}
  if (interaction.isChatInputCommand()) {
  const handled = await gamble.handleCommand(interaction);
  if (handled) return;
}
  if (interaction.isChatInputCommand()) {
  const handled = await slot.handleCommand(interaction);
  if (handled) return;
}
  if (interaction.isAutocomplete()) {
  const handled = await stickerGif.handleAutocomplete(interaction);
  if (handled) return;
}

if (interaction.isChatInputCommand()) {
  const handled = await stickerGif.handleCommand(interaction, client);
  if (handled) return;
}

if (interaction.isButton()) {
const handled = await stickerGif.handleButton(interaction, client);
  if (handled) return;
}
  if (interaction.commandName === "wiki") {
  const menu = buildWikiMenu();

  if (!menu) {
    return interaction.reply({
      content: "❌ No wiki guides have been added yet.",
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("NoobV2 Wiki")
    .setColor("Blue")
    .setDescription("Please choose a guide from the selector below.");

  return interaction.reply({
    embeds: [embed],
    components: [menu],
    ephemeral: true
  });
}

if (interaction.commandName === "editwiki") {
  if (!interaction.member.permissions.has("Administrator")) {
    return interaction.reply({
      content: "❌ Administrator only.",
      ephemeral: true
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("wiki_add_button")
      .setLabel("Add Wiki Selector")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("wiki_remove_button")
      .setLabel("Remove Wiki Selector")
      .setStyle(ButtonStyle.Danger)
  );

  return interaction.reply({
    content: "What do you want to do?",
    components: [row],
    ephemeral: true
  });
}
 if (interaction.isChatInputCommand() && interaction.commandName === "inventory") {
  return inventoryFeature.executeInventory(interaction);
}

if (interaction.commandName === "tellstory") {
  const storyId = interaction.options.getString("story");
  const story = tellStories[storyId];

  if (!story) {
    return interaction.reply({
      content: "❌ Story not found.",
      ephemeral: true
    });
  }

  const levels = loadLevelsData();
  const userData = levels[interaction.user.id] || { wl: 0, level: 1, xp: 0 };

  if ((userData.wl || 0) < STORY_COST) {
    return interaction.reply({
      content: `❌ You need **5 World Locks** to use /tellstory.\nYou currently have **${userData.wl || 0} WL**.`,
      ephemeral: true
    });
  }

  userData.wl -= STORY_COST;
  levels[interaction.user.id] = userData;
  saveLevelsData(levels);

  await interaction.reply({
    content: `Story started. **5 WL** has been removed from your inventory.`
  });

  for (const line of story) {
    await wait(3000);
    await interaction.followUp({
      content: line,
      allowedMentions: { parse: [] }
    });
  }

  return;
}
  if (interaction.commandName === "hownoob") {
  const target = interaction.options.getUser("user") || interaction.user;
  const percent = Math.floor(Math.random() * 500) + 1;

  const messages = [
    `${target} is **${percent}% noob** today 😂`,
    `Noob meter result for ${target}: **${percent}%** 🤓`,
    `${target}, you are **${percent}% noob** 💀`,
    `The noob scanner says ${target} is **${percent}% noob** 🧠`,
    `${target} unlocked **${percent}% noob power** ⚡`,
    `Certified result: ${target} is **${percent}% noob** 🏆`,
    `${target} has reached **${percent}% noob level** 🚀`,
    `Breaking news: ${target} is **${percent}% noob** 😭`
  ];

  return interaction.reply({
    content: messages[Math.floor(Math.random() * messages.length)]
  });
}

if (interaction.commandName === "whatsmydare") {
  const usedData = loadDareUsed();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  usedData.used = (usedData.used || []).filter(item => now - item.usedAt < dayMs);

  const allDares = getDareMessages();
  const usedDares = new Set(usedData.used.map(item => item.dare));

  let available = allDares.filter(dare => !usedDares.has(dare));

  if (available.length === 0) {
    usedData.used = [];
    available = allDares;
  }

  const picked = available[Math.floor(Math.random() * available.length)];

  usedData.used.push({
    dare: picked,
    usedAt: now
  });

  saveDareUsed(usedData);

  return interaction.reply({
    content: picked
  });
}
if (interaction.isChatInputCommand() && interaction.commandName === "legendquest") {
  const questId = interaction.options.getString("quest");
  const quest = LEGEND_QUESTS[questId];

  if (!quest) {
    return interaction.reply({
      content: "❌ Legendary quest not found.",
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(quest.title)
    .setColor("Yellow")
    .setDescription(
      quest.steps.map((step, i) => `**${i + 1}.** ${step}`).join("\n")
    )
    .addFields({
      name: "Reward",
      value: quest.reward
    });

  return interaction.reply({
    embeds: [embed]
  });
}
if (interaction.isChatInputCommand() && interaction.commandName === "wikiitem") {
  const item = interaction.options.getString("item");

  await interaction.deferReply();

  const data = await getWikiItem(item);

  if (!data) {
    return interaction.editReply({
      content: `❌ I could not find **${item}** on Growtopia Wiki.`
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(data.title)
    .setURL(data.url)
    .setColor("Yellow")
    .setDescription((data.description || "No description found.").slice(0, 1000));

  if (data.image) embed.setThumbnail(data.image);

  return interaction.editReply({
    embeds: [embed]
  });
}
  if (interaction.commandName === "addguild") {
  if (!interaction.member.permissions.has("Administrator")) {
    return interaction.reply({
      content: "❌ Administrator only.",
      ephemeral: true
    });
  }

  const growid = interaction.options.getString("growid");
  const discordUser = interaction.options.getUser("discord");
  const role = interaction.options.getString("role");

  const members = loadGuildMembers();

  const existing = members.find(m =>
    m.growid.toLowerCase() === growid.toLowerCase()
  );

  if (existing) {
    existing.growid = growid;
    existing.discordId = discordUser ? discordUser.id : existing.discordId || null;
    existing.discordTag = discordUser ? discordUser.tag : existing.discordTag || null;
    existing.role = role;
    existing.updatedAt = Date.now();
    existing.updatedBy = interaction.user.id;
  } else {
    members.push({
      growid,
      discordId: discordUser ? discordUser.id : null,
      discordTag: discordUser ? discordUser.tag : null,
      role,
      addedBy: interaction.user.id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  saveGuildMembers(members);

  return interaction.reply({
    content:
      `✅ Guild member saved.\n` +
      `**GrowID:** ${growid}\n` +
      `**Role:** ${guildRoleName(role)}\n` +
      `**Discord:** ${discordUser ? `${discordUser}` : "Not linked"}`,
    ephemeral: true
  });
}

if (interaction.commandName === "guildlist") {
  const members = loadGuildMembers();

  return interaction.reply({
    embeds: [buildGuildEmbed(members, "ALL")],
    components: [guildListDropdown("ALL")],
    allowedMentions: { parse: [] }
  });
}
  if (interaction.commandName === "suggestion") {
  const title = interaction.options.getString("title");
  const feature = interaction.options.getString("feature");

  const channel = await client.channels.fetch(SUGGESTION_CHANNEL).catch(() => null);

  if (!channel) {
    return interaction.reply({
      content: "❌ Suggestion channel not found.",
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(`Suggestion: ${title}`)
    .setColor("Yellow")
    .setDescription(feature)
    .addFields({
      name: "Suggested By",
      value: `${interaction.user}`,
      inline: true
    })
    .setTimestamp();

  await channel.send({
    embeds: [embed],
    allowedMentions: { parse: [] }
  });

  return interaction.reply({
    content: "✅ Your suggestion has been sent.",
    ephemeral: true
  });
}
  if (interaction.commandName === "addauction") {
  const item = interaction.options.getString("item");
  const startBid = interaction.options.getInteger("startbid");
  const currency = interaction.options.getString("currency");
  const duration = interaction.options.getString("duration") || "1d";

  if (startBid <= 0) {
    return interaction.reply({
      content: "❌ Starting bid must be higher than 0.",
      ephemeral: true
    });
  }

  const auctionId = makeAuctionId();
  const endsAt = parseAuctionDuration(duration);

  const auction = {
    auctionId,
    item,
    ownerId: interaction.user.id,
    ownerTag: interaction.user.tag,
    startBid,
    currency,
    currentBid: null,
    highestBidder: null,
    messageId: null,
    channelId: AUCTION_CHANNEL,
    status: "Preview",
    createdAt: Date.now(),
    endsAt
  };

  const previewEmbed = buildAuctionEmbed(auction)
    .setTitle("Auction Preview")
    .setDescription(
      `Please confirm if you want to post this auction.\n\n` +
      `**Item:** ${item}\n` +
      `**Starting Bid:** ${startBid} ${currency}\n` +
      `**Duration:** ${duration}\n` +
      `**Auction Channel:** <#${AUCTION_CHANNEL}>`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`auction_preview_yes_${auctionId}`)
      .setLabel("Yes, Post Auction")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`auction_preview_no_${auctionId}`)
      .setLabel("No, Cancel")
      .setStyle(ButtonStyle.Danger)
  );

  const auctions = loadAuctions();
  auctions.push(auction);
  saveAuctions(auctions);

  return interaction.reply({
    embeds: [previewEmbed],
    components: [row],
    ephemeral: true
  });
}

if (interaction.commandName === "auctionlist") {
  const auctions = loadAuctions().filter(a => a.status === "Active");

  if (auctions.length === 0) {
    return interaction.reply({
      content: "❌ There are no active auctions right now.",
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("Active Auctions")
    .setColor("Yellow")
    .setThumbnail(auctionThumbnail)
    .setDescription(
      auctions.slice(0, 10).map((a, i) =>
        `**${i + 1}. ${a.item}**\n` +
        `Seller: <@${a.ownerId}>\n` +
        `Current Bid: ${a.currentBid ? `${a.currentBid} ${a.currency}` : `${a.startBid} ${a.currency}`}\n` +
        `Highest Bidder: ${a.highestBidder ? `<@${a.highestBidder}>` : "None"}\n` +
        `Ends: <t:${Math.floor(a.endsAt / 1000)}:R>`
      ).join("\n\n")
    )
    .setFooter({ text: `Showing ${Math.min(auctions.length, 10)} of ${auctions.length} auctions` });

  return interaction.reply({
    embeds: [embed],
    allowedMentions: { parse: [] }
  });
}

  if (interaction.commandName === "editblist") {
  const GUARDIAN_ROLE_ID = "1483241188868882657";

  const hasPermission =
    interaction.member.permissions.has("Administrator") ||
    interaction.member.roles.cache.has(GUARDIAN_ROLE_ID);

  if (!hasPermission) {
    return interaction.reply({
      content: "❌ You do not have permission to use this command.",
      ephemeral: true
    });
  }

  const messageId = interaction.options.getString("messageid");
  const growid = interaction.options.getString("growid");
  const reason = interaction.options.getString("reason");

  try {
    const message = await interaction.channel.messages.fetch(messageId);

    const oldLines = message.content.split("\n");

    const proofLine =
      oldLines.find(line =>
        line.toLowerCase().includes("blacklisted & proof by")
      ) || `**Blacklisted & Proof By:** ${interaction.user}`;

    const newContent =
`**GrowID:** ${growid}
**Reason:** ${reason}
${proofLine}`;

    await message.edit(newContent);

    return interaction.reply({
      content: `✅ Blacklist message updated successfully.\n**GrowID:** ${growid}\n**Reason:** ${reason}`,
      ephemeral: true
    });

  } catch (err) {
    console.error("editblist error:", err);

    return interaction.reply({
      content: "❌ I could not edit that message. Make sure the message ID is correct and the message is in this channel.",
      ephemeral: true
    });
  }
}
  if (interaction.commandName === "selectteam") {
  const targetUser = interaction.options.getUser("user");

  if (!targetUser) {
    return interaction.reply({
      content: "❌ Please choose a user.",
      ephemeral: true
    });
  }

  if (targetUser.bot) {
    return interaction.reply({
      content: "❌ You cannot team with a bot.",
      ephemeral: true
    });
  }

  if (targetUser.id === interaction.user.id) {
    return interaction.reply({
      content: "❌ You cannot team with yourself.",
      ephemeral: true
    });
  }

  const teams = loadTeams();

  const alreadyInTeam = teams.some(team =>
    team.members.includes(interaction.user.id) ||
    team.members.includes(targetUser.id)
  );

  if (alreadyInTeam) {
    return interaction.reply({
      content: "❌ One of you is already in a confirmed team.",
      ephemeral: true
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`team_agree_${interaction.user.id}_${targetUser.id}`)
      .setLabel("Agree")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`team_decline_${interaction.user.id}_${targetUser.id}`)
      .setLabel("Not Agree")
      .setStyle(ButtonStyle.Danger)
  );

  return interaction.reply({
    content: `Hello ${targetUser}, would you like to join a team with ${interaction.user}?`,
    components: [row],
    allowedMentions: { users: [targetUser.id, interaction.user.id] }
  });
}
if (interaction.commandName === "teamlist") {
  const teams = loadTeams();

  if (teams.length === 0) {
    return interaction.reply({
      content: "❌ No teams have been confirmed yet.",
      ephemeral: true
    });
  }

  const description = teams.map((team, index) =>
    `**Team ${index + 1}**\n<@${team.members[0]}> and <@${team.members[1]}>`
  ).join("\n\n");

  const embed = new EmbedBuilder()
    .setTitle("Confirmed Team List")
    .setColor("Green")
    .setDescription(description)
    .setFooter({ text: `Total Teams: ${teams.length}` });

  return interaction.reply({
    embeds: [embed],
    allowedMentions: { parse: [] }
  });
}
  if (interaction.commandName === "eventjoin") {
  if (!interaction.member.roles.cache.has(adminRole)) {
    return interaction.reply({
      content: "❌ No permission.",
      ephemeral: true
    });
  }

  const targetChannel = interaction.options.getChannel("channel");

  if (!targetChannel || !targetChannel.isTextBased()) {
    return interaction.reply({
      content: "❌ Please choose a valid text channel.",
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("Are you willing to join this event?")
    .setColor("Green")
    .setDescription(
      "Join this event for the experience, fun, and a chance to enjoy new activities with other members.\n\n" +
      "This event is made for players who want to participate, meet others, and be part of something exciting in the server.\n\n" +
      "Click the **Join Event** button below if you would like to join."
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("event_join_button")
      .setLabel("Join Event")
      .setStyle(ButtonStyle.Success)
  );

  await targetChannel.send({
    embeds: [embed],
    components: [row]
  });

  return interaction.reply({
    content: `Event join panel sent to ${targetChannel}.`,
    ephemeral: true
  });
}
  if (interaction.commandName === "randommessage") {
  const usedData = loadRandomMessageUsed();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  usedData.used = (usedData.used || []).filter(item => now - item.usedAt < dayMs);

  const allMessages = getRandomMessages();
  const usedMessages = new Set(usedData.used.map(item => item.message));

  let available = allMessages.filter(msg => !usedMessages.has(msg));

  if (available.length === 0) {
    usedData.used = [];
    available = allMessages;
  }

  const picked = available[Math.floor(Math.random() * available.length)];

  usedData.used.push({
    message: picked,
    usedAt: now
  });

  saveRandomMessageUsed(usedData);

  return interaction.reply({
    content: picked
  });
}
  if (interaction.isChatInputCommand() && interaction.commandName === "removecustomticket") {
  return ticket.removeCustomTicket(interaction);
}

if (interaction.isChatInputCommand() && interaction.commandName === "refreshticketpanel") {
  return ticket.refreshTicketPanelCommand(interaction);
}
if (interaction.isChatInputCommand() && interaction.commandName === "whosmypartner") {
  await interaction.deferReply();

  const boostIds = [
    "1009567472577429515",
    "987285444754550805",
    "1146756192710959155",
    "946556932636950528",
    "1307800986534019207",
    "887369211322720297"
  ];

  const members = interaction.guild.members.cache.filter(member =>
    !member.user.bot &&
    member.id !== interaction.user.id
  );

  const memberPool = [];

  members.forEach(member => {
    memberPool.push(member);

    if (boostIds.includes(member.id)) {
      for (let i = 0; i < 5; i++) {
        memberPool.push(member);
      }
    }
  });

  if (memberPool.length === 0) {
    return interaction.editReply("❌ I could not find a partner for you.");
  }

  const randomMember = memberPool[Math.floor(Math.random() * memberPool.length)];

  const messages = [
    `Hello ${interaction.user}, your future partner is ${randomMember}. Please enjoy 💖`,
    `${interaction.user}, destiny has chosen ${randomMember} as your future partner 💘`,
    `Love alert! ${interaction.user}, your future partner is ${randomMember} 💕`,
    `${interaction.user}, the bot has matched you with ${randomMember}. Please enjoy 😳`,
    `Congratulations ${interaction.user}! Your future partner is ${randomMember} 🎉`,
    `${interaction.user}, your perfect match is ${randomMember} 💞`,
    `The love machine says ${interaction.user} belongs with ${randomMember} 💗`,
    `${interaction.user}, your future romance starts with ${randomMember} 🌹`,
    `Breaking news: ${interaction.user}'s future partner is ${randomMember} 💌`,
    `${interaction.user}, the stars say your partner is ${randomMember} ✨`,
    `Cupid has spoken! ${interaction.user}, your partner is ${randomMember} 🏹`,
    `${interaction.user}, your soulmate might be ${randomMember} 😍`,
    `After deep calculation, ${interaction.user}'s future partner is ${randomMember} 🧮💖`,
    `${interaction.user}, your love story begins with ${randomMember} 📖💕`,
    `The server has decided: ${interaction.user} + ${randomMember} = perfect match 💑`,
    `${interaction.user}, your future partner has been revealed: ${randomMember} 👀`,
    `No escape now ${interaction.user}, your partner is ${randomMember} 😭💕`,
    `${interaction.user}, your heart has selected ${randomMember} ❤️`,
    `Match found! ${interaction.user}, please enjoy your future with ${randomMember} 💍`,
    `${interaction.user}, your partner result is ${randomMember}. Treat them well 😌`
  ];

  return interaction.editReply({
    content: messages[Math.floor(Math.random() * messages.length)]
  });
}
if (interaction.isChatInputCommand() && interaction.commandName === "customticket") {
  return ticket.customTicket(interaction);
}
  if (interaction.isChatInputCommand() && interaction.commandName === "ticketmod") {
  return ticket.ticketMod(interaction);
}

if (
  interaction.isStringSelectMenu() &&
  (
    interaction.customId === "ticket_create_menu" ||
    interaction.customId === "ticket_mod_menu"
  )
) {
  return ticket.handleSelect(interaction);
}

if (interaction.isModalSubmit() && interaction.customId === "ticket_add_user_modal") {
  return ticket.handleModal(interaction);
}

if (interaction.isButton() && interaction.customId === "close_ticket") {
  return ticket.handleButton(interaction);
}
if (interaction.isChatInputCommand() && ["warn1", "warn2", "warn3"].includes(interaction.commandName)) {
  if (!interaction.member.permissions.has("Administrator")) {
    return interaction.reply({
      content: "❌ Administrator only.",
      ephemeral: true
    });
  }

  const target = interaction.options.getUser("user");
  const reason = interaction.options.getString("reason");
  const member = await interaction.guild.members.fetch(target.id).catch(() => null);

  if (!member) {
    return interaction.reply({
      content: "❌ User not found in this server.",
      ephemeral: true
    });
  }

  if (interaction.commandName === "warn1") {
    await member.roles.add("1447558455299674112").catch(() => {});
    await member.timeout(60 * 60 * 1000, reason).catch(() => {});

    return interaction.reply({
      content: `✅ ${target} received **Warn 1**.\nReason: ${reason}\nPunishment: Muted for 1 hour.`
    });
  }

  if (interaction.commandName === "warn2") {
    await member.roles.remove("1412474556077051965").catch(() => {});
    await member.roles.add("1447587914165784749").catch(() => {});
    await member.timeout(24 * 60 * 60 * 1000, reason).catch(() => {});

    return interaction.reply({
      content: `✅ ${target} received **Warn 2**.\nReason: ${reason}\nPunishment: Timeout for 24 hours.`
    });
  }

  if (interaction.commandName === "warn3") {
    await member.roles.add("1447811460863496265").catch(() => {});
    await member.ban({ reason }).catch(() => {});

    return interaction.reply({
      content: `✅ ${target} received **Warn 3**.\nReason: ${reason}\nPunishment: Banned from the server.`
    });
  }
}

if (interaction.commandName === "sayas") {
  const SAYAS_ROLE = "1491399898237501530";

  if (!interaction.member.roles.cache.has(SAYAS_ROLE) && interaction.user.id !== OWNER_ID) {
    return interaction.reply({
      content: "❌ You do not have permission to use this command.",
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const targetUser = interaction.options.getUser("user");
  const message = interaction.options.getString("message");
  const command = interaction.options.getString("command");
  const file = interaction.options.getAttachment("file");
  const targetChannel = interaction.options.getChannel("channel") || interaction.channel;

  if (!message && !command && !file) {
    return interaction.editReply("❌ Please provide a message, command, or file.");
  }

  let finalMessage = message || "";

  if (command === "howgay") {
    const percent = Math.floor(Math.random() * 101);
    finalMessage = `${targetUser} is **${percent}% gay** 🌈`;
  }

  if (command === "howpro") {
    const percent = Math.floor(Math.random() * 501);
    finalMessage = `${targetUser} is **${percent}% pro** 🔥`;
  }

  if (command === "fortuneteller") {
    const fortunes = [
      "You will have a lucky day soon 🍀",
      "Someone will surprise you this week ✨",
      "Your hard work will pay off soon 🔥",
      "A funny moment is coming your way 😂",
      "You will receive good news soon 📩",
      "Be careful, someone is secretly watching you 👀",
      "Your next decision will be important 🌟",
      "Money luck is coming your way 💰",
      "A new friendship may start soon 🤝",
      "Your future looks bright today 🌈"
    ];

    finalMessage = `${targetUser}, ${fortunes[Math.floor(Math.random() * fortunes.length)]}`;
  }

  if (command === "whosmypartner") {
    const boostIds = [
      "1009567472577429515",
      "987285444754550805",
      "1146756192710959155",
      "946556932636950528",
      "1307800986534019207",
      "887369211322720297"
    ];

    const members = interaction.guild.members.cache.filter(member =>
      !member.user.bot &&
      member.id !== targetUser.id
    );

    const memberPool = [];

    members.forEach(member => {
      memberPool.push(member);

      if (boostIds.includes(member.id)) {
        for (let i = 0; i < 5; i++) {
          memberPool.push(member);
        }
      }
    });

    if (memberPool.length === 0) {
      return interaction.editReply("❌ I could not find a partner.");
    }

    const randomMember = memberPool[Math.floor(Math.random() * memberPool.length)];

    const messages = [
      `Hello ${targetUser}, your future partner is ${randomMember}. Please enjoy 💖`,
      `${targetUser}, destiny has chosen ${randomMember} as your future partner 💘`,
      `Love alert! ${targetUser}, your future partner is ${randomMember} 💕`,
      `${targetUser}, the bot has matched you with ${randomMember}. Please enjoy 😳`,
      `Congratulations ${targetUser}! Your future partner is ${randomMember} 🎉`,
      `${targetUser}, your perfect match is ${randomMember} 💞`,
      `The love machine says ${targetUser} belongs with ${randomMember} 💗`,
      `${targetUser}, your future romance starts with ${randomMember} 🌹`,
      `Breaking news: ${targetUser}'s future partner is ${randomMember} 💌`,
      `${targetUser}, the stars say your partner is ${randomMember} ✨`
    ];

    finalMessage = messages[Math.floor(Math.random() * messages.length)];
  }

  try {
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    const webhook = await targetChannel.createWebhook({
      name: member?.displayName || targetUser.username,
      avatar: member?.displayAvatarURL({ dynamic: true }) || targetUser.displayAvatarURL({ dynamic: true })
    });

    await webhook.send({
      content: finalMessage || null,
      files: file ? [file.url] : [],
      allowedMentions: { parse: [] }
    });

    await webhook.delete().catch(() => {});

    return interaction.editReply("✅ Message sent successfully.");
  } catch (err) {
    console.error("Sayas Error:", err);
    return interaction.editReply("❌ Failed. Make sure the bot has **Manage Webhooks** permission.");
  }
}  if (interaction.commandName === "sendroleselector") {
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
  const SAYAS_ROLE = "1491399898237501530";

  if (!interaction.member.roles.cache.has(SAYAS_ROLE) && interaction.user.id !== OWNER_ID) {
    return interaction.reply({
      content: "❌ You do not have permission to use this command.",
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const user = interaction.options.getUser("user");
  const message = interaction.options.getString("message");
  const file = interaction.options.getAttachment("file");

  if (!message && !file) {
    return interaction.editReply("❌ Please provide a message or attachment.");
  }

  try {
    await user.send({
      content: message || null,
      files: file ? [file.url] : []
    });

    return interaction.editReply(`✅ Successfully sent a DM to ${user.tag}`);
  } catch (err) {
    console.error("DM Error:", err);
    return interaction.editReply("❌ Failed to send DM. The user may have DMs closed.");
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
const percent = Math.floor(Math.random() * 500) + 1;
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
const percent = Math.floor(Math.random() * 500) + 1;
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

if (interaction.isChatInputCommand() && interaction.commandName === "profile") {
  return profileFeature.executeProfile(interaction);
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
  const day = interaction.options.getInteger("day");
  const month = interaction.options.getInteger("month");
  const year = interaction.options.getInteger("year");

  if (!isValidBirthday(day, month, year)) {
    return interaction.reply({
      content: "❌ Invalid birthday date.",
      ephemeral: true
    });
  }

  const birthdays = loadBirthdays();

  if (!birthdays[interaction.user.id]) {
    return interaction.reply({
      content: "❌ You don't have a birthday set. Use /addbirthday first.",
      ephemeral: true
    });
  }

  birthdays[interaction.user.id] = {
    ...birthdays[interaction.user.id],
    day,
    month,
    year,
    updatedAt: Date.now()
  };

  saveBirthdays(birthdays);

  return interaction.reply({
    content: `✅ Your birthday has been updated to **${day}/${month}/${year}**.`,
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
  const levels = loadLevelsData();

  const users = Object.entries(levels)
    .map(([userId, data]) => ({
      userId,
      level: data.level || 1,
      xp: data.xp || 0,
      wl: data.wl || 0
    }))
    .filter(user => category === "wl" ? user.wl > 0 : user.level > 0)
    .sort((a, b) => {
      if (category === "wl") return b.wl - a.wl;
      return b.level - a.level || b.xp - a.xp;
    })
    .slice(0, 10);

  if (users.length === 0) {
    return interaction.reply({
      content: "❌ No leaderboard data found.",
      ephemeral: true
    });
  }

  const title = category === "wl"
    ? "🏆 World Locks Leaderboard"
    : "🏆 Level Leaderboard";

  const description = users.map((user, index) => {
    const medal =
      index === 0 ? "🥇" :
      index === 1 ? "🥈" :
      index === 2 ? "🥉" :
      `**${index + 1}.**`;

    if (category === "wl") {
      return `${medal} <@${user.userId}> — **${user.wl} WL**`;
    }

    return `${medal} <@${user.userId}> — Level **${user.level}** | XP **${user.xp}**`;
  }).join("\n");

  const embed = new EmbedBuilder()
    .setColor("Gold")
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  return interaction.reply({
    embeds: [embed],
    allowedMentions: { parse: [] }
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

if (interaction.commandName === "bdaylist") {
  await interaction.deferReply(); // visible to everyone

  const birthdays = loadBirthdays();
  const entries = [];
  let removed = 0;

  for (const userId of Object.keys(birthdays)) {
    const member =
      interaction.guild.members.cache.get(userId) ||
      await interaction.guild.members.fetch(userId).catch(() => null);

    if (!member || member.user.bot) {
      delete birthdays[userId];
      removed++;
      continue;
    }

    const b = birthdays[userId];
    entries.push(`<@${member.id}> → ${b.day}/${b.month}/${b.year}`);
  }

  if (removed > 0) {
    saveBirthdays(birthdays);
  }

  if (entries.length === 0) {
    return interaction.editReply({
      content: "No birthdays saved."
    });
  }

  const chunks = [];
  let current = "";

  for (const line of entries) {
    if ((current + line + "\n").length > 1800) {
      chunks.push(current);
      current = "";
    }

    current += line + "\n";
  }

  if (current) chunks.push(current);

  await interaction.editReply({
    content: `## Birthday List\n\n${chunks[0]}`,
    allowedMentions: { parse: [] }
  });

  for (let i = 1; i < chunks.length; i++) {
    await interaction.followUp({
      content: chunks[i],
      allowedMentions: { parse: [] }
    });
  }

  return;
}
if (interaction.commandName === "testbday") {
  if (!interaction.member.roles.cache.has(adminRole)) {
    return interaction.reply({
      content: "❌ Admin only.",
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  await checkBirthdays();

  return interaction.editReply({
    content: "✅ Birthday check completed."
  });
}
 if (interaction.commandName === "ticketpanel") {
  return ticket.execute(interaction);
}
if (interaction.commandName === "howstraight") {
  const target = interaction.options.getUser("user") || interaction.user;

  const percent = Math.floor(Math.random() * 500) + 1;

  const messages = [
    `${target} is **${percent}% straight** today 😎`,
    `Straight meter result for ${target}: **${percent}%** 🔥`,
    `${target}, you are **${percent}% straight** 💯`,
    `The scanner says ${target} is **${percent}% straight** 🎯`,
    `${target} unlocked **${percent}% straight power** ⚡`,
    `Certified result: ${target} is **${percent}% straight** 🏆`,
    `${target} has reached **${percent}% straight level** 🚀`,
    `Breaking news: ${target} is **${percent}% straight** 👀`
  ];

  const message = messages[Math.floor(Math.random() * messages.length)];

  return interaction.reply({
    content: message
  });
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

  const growid = interaction.options.getString("growid");
  const reason = interaction.options.getString("reason");
  const proofUser = interaction.options.getUser("proof");
  const image = interaction.options.getAttachment("image");
  const durationInput = interaction.options.getString("duration");

  let expiresAt = null;
  let durationText = null;

  if (durationInput) {

    if (durationInput.toLowerCase() === "perma") {

      durationText = "Permanent";

    } else {

      const match = durationInput.match(/^(\d+)([hd])$/i);

      if (!match) {
        return interaction.reply({
          content: "❌ Invalid duration format. Use example: 1h, 1d or perma",
          ephemeral: true
        });
      }

      const amount = parseInt(match[1]);
      const type = match[2].toLowerCase();

      let ms = 0;

      if (type === "h") ms = amount * 60 * 60 * 1000;
      if (type === "d") ms = amount * 24 * 60 * 60 * 1000;

      expiresAt = Date.now() + ms;
      durationText = durationInput;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle("Blacklist Request")
    .setColor("Red")
    .addFields(
      {
        name: "GrowID",
        value: growid,
        inline: true
      },
      {
        name: "Reason",
        value: reason,
        inline: true
      },
      {
        name: "Proof By",
        value: `${proofUser}`,
        inline: true
      }
    )
    .setFooter({
      text: `Requested by ${interaction.user.tag}`
    })
    .setTimestamp();

  if (durationText) {
    embed.addFields({
      name: "Duration",
      value: durationText,
      inline: true
    });
  }

  if (image) {
    embed.setImage(image.url);
  }

  const approve = new ButtonBuilder()
    .setCustomId(`approve_blist_${interaction.user.id}`)
    .setLabel("Approve")
    .setStyle(ButtonStyle.Success);

  const deny = new ButtonBuilder()
    .setCustomId(`deny_blist_${interaction.user.id}`)
    .setLabel("Deny")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(approve, deny);

  const channel = client.channels.cache.get("1481767733304623235");

  await channel.send({
    embeds: [embed],
    components: [row]
  });

  return interaction.reply({
    content: "✅ Blacklist request submitted.",
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
  const day = interaction.options.getInteger("day");
  const month = interaction.options.getInteger("month");
  const year = interaction.options.getInteger("year");

  if (!isValidBirthday(day, month, year)) {
    return interaction.reply({
      content: "❌ Invalid birthday date.",
      ephemeral: true
    });
  }

  const birthdays = loadBirthdays();

  birthdays[interaction.user.id] = {
    day,
    month,
    year,
    lastBirthdaySent: birthdays[interaction.user.id]?.lastBirthdaySent || null,
    updatedAt: Date.now()
  };

  saveBirthdays(birthdays);

  return interaction.reply({
    content: `✅ Your birthday has been saved: **${day}/${month}/${year}**`,
    ephemeral: true
  });
}
  }

  // ================= DROPDOWN =================
 if (interaction.isStringSelectMenu()) {
  if (interaction.customId === "wiki_select") {
  const wiki = loadWikiData();
  const selectedId = interaction.values[0];

  const selected = wiki.find(item => item.id === selectedId);

  if (!selected) {
    return interaction.reply({
      content: "❌ This wiki guide no longer exists.",
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(selected.title)
    .setColor("Blue")
    .setDescription(selected.body)
    .setTimestamp();

  return interaction.update({
    embeds: [embed],
    components: []
  });
}

if (interaction.customId === "wiki_remove_select") {
  if (!interaction.member.permissions.has("Administrator")) {
    return interaction.reply({
      content: "❌ Administrator only.",
      ephemeral: true
    });
  }

  const selectedId = interaction.values[0];
  const wiki = loadWikiData();

  const selected = wiki.find(item => item.id === selectedId);

  if (!selected) {
    return interaction.reply({
      content: "❌ This wiki selector no longer exists.",
      ephemeral: true
    });
  }

  const updated = wiki.filter(item => item.id !== selectedId);
  saveWikiData(updated);

  return interaction.update({
    content: `✅ Removed wiki selector: **${selected.title}**`,
    components: []
  });
}

  if (interaction.customId === "guildlist_filter") {
  const selected = interaction.values[0];
  const members = loadGuildMembers();

  return interaction.update({
    embeds: [buildGuildEmbed(members, selected)],
    components: [guildListDropdown(selected)],
    allowedMentions: { parse: [] }
  });
}
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
 }
  // ================= MODAL =================
if (interaction.isModalSubmit()) {
  if (interaction.customId === "wiki_add_modal") {
  if (!interaction.member.permissions.has("Administrator")) {
    return interaction.reply({
      content: "❌ Administrator only.",
      ephemeral: true
    });
  }

  const title = interaction.fields.getTextInputValue("wiki_title").trim();
  const body = interaction.fields.getTextInputValue("wiki_body").trim();

  const tempId = makeWikiId();

  pendingWikiEdits.set(tempId, {
    title,
    body
  });

  const embed = new EmbedBuilder()
    .setTitle("Confirm Wiki Selector")
    .setColor("Yellow")
    .addFields(
      { name: "Title", value: title },
      { name: "Description / Body", value: body.slice(0, 1000) }
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`wiki_confirm_add_${tempId}`)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`wiki_cancel_add_${tempId}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger)
  );

  return interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true
  });
}
  if (interaction.customId.startsWith("auction_bid_modal_")) {
  const auctionId = interaction.customId.replace("auction_bid_modal_", "");
  const bidText = interaction.fields.getTextInputValue("auction_bid_amount").trim();
  const bidAmount = Number(bidText);

  if (!Number.isInteger(bidAmount) || bidAmount <= 0) {
    return interaction.reply({
      content: "❌ Please enter a valid number.",
      ephemeral: true
    });
  }

  const auctions = loadAuctions();
  const auction = auctions.find(a => a.auctionId === auctionId);

  if (!auction || auction.status !== "Active") {
    return interaction.reply({
      content: "❌ This auction is no longer active.",
      ephemeral: true
    });
  }

  const minimumBid = auction.currentBid || auction.startBid;

  if (bidAmount <= minimumBid) {
    return interaction.reply({
      content: `❌ Your bid must be higher than **${minimumBid} ${auction.currency}**.`,
      ephemeral: true
    });
  }

  auction.currentBid = bidAmount;
  auction.highestBidder = interaction.user.id;
  saveAuctions(auctions);

  const auctionChannel = await client.channels.fetch(auction.channelId).catch(() => null);
  const auctionMessage = auctionChannel
    ? await auctionChannel.messages.fetch(auction.messageId).catch(() => null)
    : null;

  if (auctionMessage) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`auction_bid_${auctionId}`)
        .setLabel("Start Bidding")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`auction_confirm_${auctionId}`)
        .setLabel("Confirm Winner")
        .setStyle(ButtonStyle.Success)
    );

    await auctionMessage.edit({
      embeds: [buildAuctionEmbed(auction)],
      components: [row],
      allowedMentions: { parse: [] }
    });
  }

  return interaction.reply({
    content: `✅ Your bid of **${bidAmount} ${auction.currency}** has been placed.`,
    ephemeral: true
  });
}
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
  
  if (interaction.customId === "wiki_add_button") {
  if (!interaction.member.permissions.has("Administrator")) {
    return interaction.reply({
      content: "❌ Administrator only.",
      ephemeral: true
    });
  }

  const modal = new ModalBuilder()
    .setCustomId("wiki_add_modal")
    .setTitle("Add Wiki Selector");

  const titleInput = new TextInputBuilder()
    .setCustomId("wiki_title")
    .setLabel("Selector Title")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Example: NoobV2 Guide")
    .setRequired(true);

  const bodyInput = new TextInputBuilder()
    .setCustomId("wiki_body")
    .setLabel("Description / Body")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Write the guide information here")
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(bodyInput)
  );

  return interaction.showModal(modal);
}

if (interaction.isButton()) {
  const handled = await inventoryFeature.handleButton(interaction);
  if (handled) return;
}

if (interaction.customId.startsWith("wiki_confirm_add_")) {
  if (!interaction.member.permissions.has("Administrator")) {
    return interaction.reply({
      content: "❌ Administrator only.",
      ephemeral: true
    });
  }

  const tempId = interaction.customId.replace("wiki_confirm_add_", "");
  const data = pendingWikiEdits.get(tempId);

  if (!data) {
    return interaction.reply({
      content: "❌ This wiki edit expired. Please try again.",
      ephemeral: true
    });
  }

  const wiki = loadWikiData();

  wiki.push({
    id: makeWikiId(),
    title: data.title,
    body: data.body,
    createdBy: interaction.user.id,
    createdAt: Date.now()
  });

  saveWikiData(wiki);
  pendingWikiEdits.delete(tempId);

  return interaction.update({
    content: `✅ Added wiki selector: **${data.title}**`,
    embeds: [],
    components: []
  });
}

if (interaction.customId.startsWith("wiki_cancel_add_")) {
  const tempId = interaction.customId.replace("wiki_cancel_add_", "");
  pendingWikiEdits.delete(tempId);

  return interaction.update({
    content: "❌ Wiki selector creation cancelled.",
    embeds: [],
    components: []
  });
}

if (interaction.customId === "wiki_remove_button") {
  if (!interaction.member.permissions.has("Administrator")) {
    return interaction.reply({
      content: "❌ Administrator only.",
      ephemeral: true
    });
  }

  const menu = buildRemoveWikiMenu();

  if (!menu) {
    return interaction.reply({
      content: "❌ No wiki selectors to remove.",
      ephemeral: true
    });
  }

  return interaction.reply({
    content: "Choose the wiki selector you want to remove:",
    components: [menu],
    ephemeral: true
  });
}
  if (interaction.customId.startsWith("auction_preview_yes_")) {
  const auctionId = interaction.customId.replace("auction_preview_yes_", "");
  const auctions = loadAuctions();
  const auction = auctions.find(a => a.auctionId === auctionId);

  if (!auction) {
    return interaction.reply({ content: "❌ Auction not found.", ephemeral: true });
  }

  if (auction.ownerId !== interaction.user.id) {
    return interaction.reply({ content: "❌ Only the auction creator can confirm this.", ephemeral: true });
  }

  const auctionChannel = await client.channels.fetch(AUCTION_CHANNEL).catch(() => null);

  if (!auctionChannel) {
    return interaction.reply({ content: "❌ Auction channel not found.", ephemeral: true });
  }

  auction.status = "Active";

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`auction_bid_${auctionId}`)
      .setLabel("Start Bidding")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`auction_confirm_${auctionId}`)
      .setLabel("Confirm Winner")
      .setStyle(ButtonStyle.Success)
  );

  const sent = await auctionChannel.send({
    embeds: [buildAuctionEmbed(auction)],
    components: [row],
    allowedMentions: { parse: [] }
  });

  auction.messageId = sent.id;
  saveAuctions(auctions);

  return interaction.update({
    content: `✅ Auction posted in <#${AUCTION_CHANNEL}>.`,
    embeds: [],
    components: []
  });
}

if (interaction.customId.startsWith("auction_preview_no_")) {
  const auctionId = interaction.customId.replace("auction_preview_no_", "");
  let auctions = loadAuctions();

  const auction = auctions.find(a => a.auctionId === auctionId);

  if (auction && auction.ownerId !== interaction.user.id) {
    return interaction.reply({ content: "❌ Only the auction creator can cancel this.", ephemeral: true });
  }

  auctions = auctions.filter(a => a.auctionId !== auctionId);
  saveAuctions(auctions);

  return interaction.update({
    content: "❌ Auction cancelled.",
    embeds: [],
    components: []
  });
}

if (interaction.customId.startsWith("auction_bid_")) {
  const auctionId = interaction.customId.replace("auction_bid_", "");
  const auctions = loadAuctions();
  const auction = auctions.find(a => a.auctionId === auctionId);

  if (!auction || auction.status !== "Active") {
    return interaction.reply({ content: "❌ This auction is no longer active.", ephemeral: true });
  }

  if (auction.ownerId === interaction.user.id) {
    return interaction.reply({ content: "❌ You cannot bid on your own auction.", ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId(`auction_bid_modal_${auctionId}`)
    .setTitle("Place Your Bid");

  const bidInput = new TextInputBuilder()
    .setCustomId("auction_bid_amount")
    .setLabel(`Enter your bid in ${auction.currency}`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(`Must be higher than ${auction.currentBid || auction.startBid}`)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(bidInput));

  return interaction.showModal(modal);
}

if (interaction.customId.startsWith("auction_confirm_")) {
  const auctionId = interaction.customId.replace("auction_confirm_", "");
  const auctions = loadAuctions();
  const auction = auctions.find(a => a.auctionId === auctionId);

  if (!auction) {
    return interaction.reply({ content: "❌ Auction not found.", ephemeral: true });
  }

  if (auction.ownerId !== interaction.user.id) {
    return interaction.reply({ content: "❌ Only the auction owner can confirm the winner.", ephemeral: true });
  }

  auction.status = "Ended";
  saveAuctions(auctions);

  const embed = buildAuctionEmbed(auction)
    .setColor("Green")
    .setTitle("Auction Ended")
    .setDescription(
      `**Item:** ${auction.item}\n` +
      `**Seller:** <@${auction.ownerId}>\n\n` +
      `**Final Bid:** ${auction.currentBid ? `${auction.currentBid} ${auction.currency}` : "No bids"}\n` +
      `**Winner:** ${auction.highestBidder ? `<@${auction.highestBidder}>` : "No winner"}\n\n` +
      `**Status:** Ended`
    );

  return interaction.update({
    embeds: [embed],
    components: []
  });
}
  if (
  interaction.customId.startsWith("team_agree_") ||
  interaction.customId.startsWith("team_decline_")
) {
  const parts = interaction.customId.split("_");
  const action = parts[1];
  const requesterId = parts[2];
  const targetId = parts[3];

  if (interaction.user.id !== targetId) {
    return interaction.reply({
      content: "❌ Only the selected user can respond to this team request.",
      ephemeral: true
    });
  }

  if (action === "decline") {
    await interaction.update({
      content: `<@${targetId}> declined the team request from <@${requesterId}>.`,
      components: [],
      allowedMentions: { parse: [] }
    });

    return;
  }

  const teams = loadTeams();

  const alreadyInTeam = teams.some(team =>
    team.members.includes(requesterId) ||
    team.members.includes(targetId)
  );

  if (alreadyInTeam) {
    return interaction.reply({
      content: "❌ One of you is already in a confirmed team.",
      ephemeral: true
    });
  }

  const teamNumber = teams.length + 1;

  teams.push({
    teamNumber,
    members: [requesterId, targetId],
    createdAt: Date.now()
  });

  saveTeams(teams);

  await interaction.update({
    content: `✅ Team ${teamNumber} confirmed!\n<@${requesterId}> and <@${targetId}>`,
    components: [],
    allowedMentions: { parse: [] }
  });

  const logChannel = await interaction.guild.channels.fetch(TEAM_LOG_CHANNEL).catch(() => null);

  if (logChannel) {
    await logChannel.send({
      content:
`**Team ${teamNumber} Confirmed**
<@${requesterId}> and <@${targetId}>`,
      allowedMentions: { parse: [] }
    });
  }

  return;
}
if (interaction.customId === "event_join_button") {
  const EVENT_ROLE_ID = "1502318129664229578";

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

  if (!member) {
    return interaction.reply({
      content: "❌ Could not find your server profile.",
      ephemeral: true
    });
  }

  if (member.roles.cache.has(EVENT_ROLE_ID)) {
    return interaction.reply({
      content: "You have already joined this event.",
      ephemeral: true
    });
  }

  await member.roles.add(EVENT_ROLE_ID).catch(() => null);

  return interaction.reply({
    content: "You have joined the event!",
    ephemeral: true
  });
}
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

const ownerId = interaction.customId.split("_").pop();
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
    return;
  }
  // ================= AUTO REPLY: TUMMA / TUMMARATSU / NIRIEL =================

// ================= SHARKFIN AUTO REPLY =================
const SHARKFIN_USER_ID = "946556932636950528";

if (message.author.id === SHARKFIN_USER_ID && !message.author.bot) {

  const sharkfinData = loadSharkfinReplies();

  const today = new Date().toISOString().split("T")[0];

  if (!sharkfinData[today]) {
    sharkfinData[today] = 0;
  }

  if (sharkfinData[today] < 3) {

    sharkfinData[today]++;

    saveSharkfinReplies(sharkfinData);

    await message.reply({
      content: "i love sharkfin soup",
      allowedMentions: { repliedUser: false }
    }).catch(() => {});
  }
}
  // ================= UPDATE BROADCAST DM SYSTEM =================
if (message.channel.id === UPDATE_BROADCAST_CHANNEL) {
  if (updateBroadcastCooldown.has(message.id)) return;

  updateBroadcastCooldown.add(message.id);

  await message.channel.send({
    content: "✅ Update notification is being sent to server members."
  }).catch(() => {});

  const members = await message.guild.members.fetch().catch(() => null);
  if (!members) return;

  let sent = 0;
  let failed = 0;

  const updateMessage =
`**A new NoobV2 update has been released!**

Please check the update channel for the latest changes:
<#${UPDATE_BROADCAST_CHANNEL}>`;

  for (const member of members.values()) {
    if (member.user.bot) continue;

    await member.send({
      content: updateMessage
    }).then(() => {
      sent++;
    }).catch(() => {
      failed++;
    });

    await wait(1200); // prevents DM rate-limit spam
  }

  await message.channel.send({
    content: `✅ Update DM broadcast completed.\nSent: **${sent}**\nFailed: **${failed}**`
  }).catch(() => {});

  setTimeout(() => {
    updateBroadcastCooldown.delete(message.id);
  }, 10 * 60 * 1000);

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
  if (message.author.id === WORD_BYPASS_ID) return;

  const member = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member) return;

  const seconds = getNextWordTimeout(message.author.id);
  const duration = seconds * 1000;
  const until = Date.now() + duration;

  protectedTimeouts.set(message.author.id, {
    until,
    duration
  });

  await message.delete().catch(() => {});

  await member.timeout(duration, `Blacklisted word used: ${badWord}`).catch(() => {});

  await message.channel.send({
    content: `${message.author}, you used a blacklisted word and have been timed out for **${seconds} seconds**.`
  }).catch(() => {});

  return;
}
  // level system
  level.handleMessage(message);
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  if (newMember.id === WORD_BYPASS_ID) return;

  const protectedData = protectedTimeouts.get(newMember.id);
  if (!protectedData) return;

  const oldTimeout = oldMember.communicationDisabledUntilTimestamp || 0;
  const newTimeout = newMember.communicationDisabledUntilTimestamp || 0;

  const stillProtected = Date.now() < protectedData.until;
  const timeoutRemoved = oldTimeout > Date.now() && (!newTimeout || newTimeout < oldTimeout);

  if (!stillProtected) {
    protectedTimeouts.delete(newMember.id);
    return;
  }

  if (timeoutRemoved) {
    const doubledDuration = protectedData.duration * 2;
    const doubledUntil = Date.now() + doubledDuration;

    protectedTimeouts.set(newMember.id, {
      until: doubledUntil,
      duration: doubledDuration
    });

    await newMember.timeout(
      doubledDuration,
      "Protected blacklist timeout was removed by an unauthorized user"
    ).catch(() => {});
  }
});
async function sendLog(channelId, embed) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;
  await channel.send({ embeds: [embed] }).catch(() => {});
}

client.on("messageDelete", async (message) => {
  if (!message.guild || message.author?.bot) return;

  const embed = new EmbedBuilder()
    .setTitle("Message Deleted")
    .setColor("Red")
    .addFields(
      { name: "User", value: `${message.author || "Unknown"}`, inline: true },
      { name: "Channel", value: `${message.channel}`, inline: true },
      { name: "Message", value: message.content || "No text / attachment only" }
    )
    .setTimestamp();

  await sendLog(MESSAGE_LOG_CHANNEL, embed);
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
  if (!newMessage.guild || newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  const embed = new EmbedBuilder()
    .setTitle("Message Edited")
    .setColor("Orange")
    .addFields(
      { name: "User", value: `${newMessage.author}`, inline: true },
      { name: "Channel", value: `${newMessage.channel}`, inline: true },
      { name: "Before", value: oldMessage.content || "Unknown" },
      { name: "After", value: newMessage.content || "Unknown" }
    )
    .setTimestamp();

  await sendLog(MESSAGE_LOG_CHANNEL, embed);
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  if (oldMember.nickname !== newMember.nickname) {
    const embed = new EmbedBuilder()
      .setTitle("Nickname Changed")
      .setColor("Blue")
      .addFields(
        { name: "User", value: `${newMember.user}`, inline: true },
        { name: "Before", value: oldMember.nickname || oldMember.user.username, inline: true },
        { name: "After", value: newMember.nickname || newMember.user.username, inline: true }
      )
      .setTimestamp();

    await sendLog(NICK_LOG_CHANNEL, embed);
  }

  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;

  const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
  const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));

  if (addedRoles.size > 0 || removedRoles.size > 0) {
    const embed = new EmbedBuilder()
      .setTitle("Member Role Updated")
      .setColor("Purple")
      .addFields(
        { name: "User", value: `${newMember.user}`, inline: true },
        { name: "Roles Added", value: addedRoles.map(r => r.name).join(", ") || "None" },
        { name: "Roles Removed", value: removedRoles.map(r => r.name).join(", ") || "None" }
      )
      .setTimestamp();

    await sendLog(ROLE_LOG_CHANNEL, embed);
  }
});

client.on("roleCreate", async (role) => {
  const embed = new EmbedBuilder()
    .setTitle("Role Created")
    .setColor("Green")
    .addFields(
      { name: "Role Name", value: role.name, inline: true },
      { name: "Role ID", value: role.id, inline: true }
    )
    .setTimestamp();

  await sendLog(ROLE_LOG_CHANNEL, embed);
});

client.on("roleDelete", async (role) => {
  const embed = new EmbedBuilder()
    .setTitle("Role Deleted")
    .setColor("Red")
    .addFields(
      { name: "Role Name", value: role.name, inline: true },
      { name: "Role ID", value: role.id, inline: true }
    )
    .setTimestamp();

  await sendLog(ROLE_LOG_CHANNEL, embed);
});

client.on("roleUpdate", async (oldRole, newRole) => {
  if (oldRole.name === newRole.name) return;

  const embed = new EmbedBuilder()
    .setTitle("Role Name Changed")
    .setColor("Orange")
    .addFields(
      { name: "Before", value: oldRole.name, inline: true },
      { name: "After", value: newRole.name, inline: true },
      { name: "Role ID", value: newRole.id, inline: true }
    )
    .setTimestamp();

  await sendLog(ROLE_LOG_CHANNEL, embed);
});
client.login(process.env.TOKEN);

module.exports = client;