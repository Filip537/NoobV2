require("dotenv").config();
const testLevelCommand = require("./commands/testlevelup.js");const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [

  new SlashCommandBuilder()
    .setName("addbirthday")
    .setDescription("Add your birthday")
    .addIntegerOption(o =>
      o.setName("day").setDescription("Day").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("month").setDescription("Month").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("year").setDescription("Year").setRequired(true)
    ),
new SlashCommandBuilder()
  .setName("addblist")
  .setDescription("Add user to blacklist")
  .addStringOption(o =>
    o.setName("growid")
      .setDescription("GrowID")
      .setRequired(true)
  )
  .addStringOption(o =>
    o.setName("reason")
      .setDescription("Reason")
      .setRequired(true)
  )
  .addUserOption(o =>
    o.setName("proof")
      .setDescription("Proof by")
      .setRequired(true)
  )
  .addStringOption(o =>
    o.setName("duration")
      .setDescription("Example: 1h, 1d, 7d or perma")
      .setRequired(false)
  )
  .addAttachmentOption(o =>
    o.setName("image")
      .setDescription("Upload proof (optional)")
      .setRequired(false)
  ),
  new SlashCommandBuilder()
  .setName("hownoob")
  .setDescription("See how noob someone is")
  .addUserOption(option =>
    option.setName("user")
      .setDescription("User to check")
      .setRequired(false)
  ),
new SlashCommandBuilder()
  .setName("inventory")
  .setDescription("Check your or another member's World Locks")
  .addUserOption(option =>
    option.setName("user")
      .setDescription("Member to check")
      .setRequired(false)
  ),

new SlashCommandBuilder()
  .setName("tellstory")
  .setDescription("Tell a story for 5 World Locks")
  .addStringOption(option =>
    option.setName("story")
      .setDescription("Choose a story")
      .setRequired(true)
      .addChoices(
        { name: "Story of Redratsu and Red Riding Hood", value: "redratsu" },
        { name: "The Noob Who Found a BGL", value: "noob_bgl" },
        { name: "The Admin and the Lost WL", value: "lost_wl" },
        { name: "The Ghost in NoobV2", value: "ghost_noobv2" },
        { name: "The Parkour King", value: "parkour_king" },
        { name: "The Fake Pro Player", value: "fake_pro" },
        { name: "The World Lock Wizard", value: "wl_wizard" },
        { name: "The Dice Cave Mystery", value: "dice_cave" },
        { name: "The Rich Noob", value: "rich_noob" },
        { name: "The Dragon of Growtopia", value: "dragon_gt" },
        { name: "The Lost GrowID", value: "lost_growid" },
        { name: "The Final Admin Test", value: "admin_test" }
      )
  ),
  new SlashCommandBuilder()
  .setName("addsticker")
  .setDescription("Submit a sticker/image for admin approval")
  .addStringOption(o =>
    o.setName("name")
      .setDescription("Sticker name")
      .setRequired(true)
  )
  .addAttachmentOption(o =>
    o.setName("file")
      .setDescription("Upload sticker/image")
      .setRequired(true)
  ),

new SlashCommandBuilder()
  .setName("addgif")
  .setDescription("Submit a GIF for admin approval")
  .addStringOption(o =>
    o.setName("name")
      .setDescription("GIF name")
      .setRequired(true)
  )
  .addAttachmentOption(o =>
    o.setName("file")
      .setDescription("Upload GIF")
      .setRequired(true)
  ),

new SlashCommandBuilder()
  .setName("sendsticker")
  .setDescription("Send a saved sticker")
  .addStringOption(o =>
    o.setName("name")
      .setDescription("Sticker name")
      .setRequired(true)
      .setAutocomplete(true)
  ),

new SlashCommandBuilder()
  .setName("sendgif")
  .setDescription("Send a saved GIF")
  .addStringOption(o =>
    o.setName("name")
      .setDescription("GIF name")
      .setRequired(true)
      .setAutocomplete(true)
  ),
  new SlashCommandBuilder()
.setName("coinflip")
.setDescription("Bet your WL on a coin flip.")
.addIntegerOption(o =>
    o.setName("bet")
    .setDescription("Amount of WL to bet")
    .setRequired(true)
)
.addStringOption(o =>
    o.setName("side")
    .setDescription("Heads or Tails")
    .setRequired(true)
    .addChoices(
        { name: "Heads", value: "heads" },
        { name: "Tails", value: "tails" }
    )
),
new SlashCommandBuilder()
  .setName("daily")
  .setDescription("Claim 10-50 WL once every 24 hours"),

new SlashCommandBuilder()
  .setName("work")
  .setDescription("Work and earn 5-20 WL every hour"),

new SlashCommandBuilder()
  .setName("beg")
  .setDescription("Beg for a small chance to get WL"),

new SlashCommandBuilder()
  .setName("crime")
  .setDescription("Commit a risky crime for WL"),

new SlashCommandBuilder()
  .setName("rob")
  .setDescription("Try to rob another user")
  .addUserOption(o =>
    o.setName("user")
      .setDescription("User to rob")
      .setRequired(true)
  ),

new SlashCommandBuilder()
  .setName("pay")
  .setDescription("Pay WL to another user")
  .addUserOption(o =>
    o.setName("user")
      .setDescription("User to pay")
      .setRequired(true)
  )
  .addIntegerOption(o =>
    o.setName("amount")
      .setDescription("Amount of WL")
      .setRequired(true)
  ),
  new SlashCommandBuilder()
  .setName("rps")
  .setDescription("Challenge someone to Rock Paper Scissors")
  .addUserOption(o =>
    o.setName("user")
      .setDescription("User to challenge")
      .setRequired(true)
  )
  .addIntegerOption(o =>
    o.setName("bet")
      .setDescription("WL bet amount")
      .setRequired(true)
  ),

new SlashCommandBuilder()
  .setName("bombpass")
  .setDescription("Challenge someone to Bomb Pass")
  .addUserOption(o =>
    o.setName("user")
      .setDescription("User to challenge")
      .setRequired(true)
  )
  .addIntegerOption(o =>
    o.setName("bet")
      .setDescription("WL bet amount")
      .setRequired(true)
  ),

new SlashCommandBuilder()
  .setName("battle")
  .setDescription("Challenge someone to an Arena Battle")
  .addUserOption(o =>
    o.setName("user")
      .setDescription("User to challenge")
      .setRequired(true)
  )
  .addIntegerOption(o =>
    o.setName("bet")
      .setDescription("WL bet amount")
      .setRequired(true)
  ),
  new SlashCommandBuilder()
  .setName("slot")
  .setDescription("Test your luck with the slot machine"),
  new SlashCommandBuilder()
  .setName("wiki")
  .setDescription("Open the NoobV2 wiki menu"),

new SlashCommandBuilder()
  .setName("editwiki")
  .setDescription("Add or remove wiki selectors"),
new SlashCommandBuilder()
  .setName("whatsmydare")
  .setDescription("Get a random dare that will not repeat in 1 day"),
new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("View leaderboard")
  .addStringOption(option =>
    option.setName("category")
      .setDescription("Choose leaderboard category")
      .setRequired(true)
.addChoices(
  { name: "Level", value: "level" },
  { name: "World Locks", value: "wl" }
)
  ),
  new SlashCommandBuilder()
  .setName("business")
  .setDescription("Invest WL into an interactive business")
  .addStringOption(o =>
    o.setName("type")
      .setDescription("Choose business type")
      .setRequired(true)
      .addChoices(
        { name: "Restaurant", value: "restaurant" },
        { name: "Mining Company", value: "mining" },
        { name: "Delivery Company", value: "delivery" },
        { name: "Fishing Boat", value: "fishing" }
      )
  )
  .addIntegerOption(o =>
    o.setName("investment")
      .setDescription("Amount of WL to invest")
      .setRequired(true)
  ),
  new SlashCommandBuilder()
  .setName("sendupdates")
  .setDescription("Send the latest bot update log")
  .addChannelOption(option =>
    option.setName("channel")
      .setDescription("Where to send the update log")
      .setRequired(true)
  ),
new SlashCommandBuilder()
  .setName("dms")
  .setDescription("Send a direct message to a user")
  .addUserOption(option =>
    option.setName("user")
      .setDescription("User to DM")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("message")
      .setDescription("Message to send")
      .setRequired(false)
  )
  .addAttachmentOption(option =>
    option.setName("file")
      .setDescription("Attach file/image (optional)")
      .setRequired(false)
  ),
  new SlashCommandBuilder()
  .setName("report")
  .setDescription("Report a player (Beta)")
  .addStringOption(o =>
    o.setName("growid")
      .setDescription("GrowID")
      .setRequired(true)
  )
  .addStringOption(o =>
    o.setName("reason")
      .setDescription("Reason")
      .setRequired(true)
  )
  .addAttachmentOption(o =>
    o.setName("proof")
      .setDescription("Upload proof (optional)")
      .setRequired(false)
  ),
  new SlashCommandBuilder()
  .setName("announcement")
  .setDescription("Send an announcement")
  .addStringOption(option =>
    option.setName("title")
      .setDescription("Announcement title")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("message")
      .setDescription("Announcement message")
      .setRequired(true)
  )
  .addBooleanOption(option =>
    option.setName("embed")
      .setDescription("Send as embed?")
      .setRequired(true)
  )
  .addChannelOption(option =>
    option.setName("channel")
      .setDescription("Channel to send the announcement to")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("thumbnail")
      .setDescription("Thumbnail image URL (optional)")
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName("footer")
      .setDescription("Footer text (optional)")
      .setRequired(false)
  ),
  new SlashCommandBuilder()
  .setName("howgay")
  .setDescription("See how gay someone is")
  .addUserOption(option =>
    option.setName("user")
      .setDescription("User to check")
      .setRequired(false)
  ),

new SlashCommandBuilder()
  .setName("howpro")
  .setDescription("See how pro someone is")
  .addUserOption(option =>
    option.setName("user")
      .setDescription("User to check")
      .setRequired(false)
  ),
  new SlashCommandBuilder()
  .setName("fortuneteller")
  .setDescription("Get a random fortune prediction"),
new SlashCommandBuilder()
  .setName("profile")
  .setDescription("View your profile"),
  new SlashCommandBuilder()
  .setName("wordban")
  .setDescription("Ban a word")
  .addStringOption(option =>
    option.setName("word")
      .setDescription("Word to blacklist")
      .setRequired(true)
  ),
  new SlashCommandBuilder()
  .setName("sendroleselector")
  .setDescription("Send the role selector panel")
  .addChannelOption(option =>
    option.setName("channel")
      .setDescription("Channel to send the role selector panel")
      .setRequired(true)
  ),
new SlashCommandBuilder()
  .setName("sayas")
  .setDescription("Send a message or command result as a user")
  .addUserOption(option =>
    option.setName("user")
      .setDescription("User to show")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("message")
      .setDescription("Message to send")
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName("command")
      .setDescription("Command to activate")
      .setRequired(false)
.addChoices(
  { name: "/howgay", value: "howgay" },
  { name: "/howpro", value: "howpro" },
  { name: "/whosmypartner", value: "whosmypartner" },
  { name: "/fortuneteller", value: "fortuneteller" }
)
  )
  .addAttachmentOption(option =>
    option.setName("file")
      .setDescription("Attach file/image optional")
      .setRequired(false)
  )
  .addChannelOption(option =>
    option.setName("channel")
      .setDescription("Channel to send the message")
      .setRequired(false)
  ),
  new SlashCommandBuilder()
  .setName("mathquestions")
  .setDescription("Solve a math question based on difficulty")
  .addStringOption(option =>
    option.setName("level")
      .setDescription("Select difficulty")
      .setRequired(true)
      .addChoices(
        { name: "Easy", value: "easy" },
        { name: "Medium", value: "medium" },
        { name: "Hard", value: "hard" }
      )
  ),
  new SlashCommandBuilder()
  .setName("trivia")
  .setDescription("Answer a random trivia question"),
new SlashCommandBuilder()
  .setName("ticketpanel")
  .setDescription("Send ticket panel")
  .addChannelOption(option =>
    option.setName("channel")
      .setDescription("Where to send the ticket panel")
      .setRequired(true)
  ),
  new SlashCommandBuilder()
  .setName("settings")
  .setDescription("Open server settings panel"),

new SlashCommandBuilder()
  .setName("wordbanlist")
  .setDescription("View blacklisted words"),
  new SlashCommandBuilder()
  .setName("blist")
  .setDescription("View all approved blacklisted GrowIDs"),
  new SlashCommandBuilder()
  .setName("editwordban")
  .setDescription("Remove a word from blacklist")
  .addStringOption(option =>
    option.setName("word")
      .setDescription("Word to remove")
      .setRequired(true)
  ),
  new SlashCommandBuilder()
  .setName("postfeed")
  .setDescription("Post a permanent photo or reel")
  .addAttachmentOption(option =>
    option
      .setName("media")
      .setDescription("Choose an image or video")
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName("caption")
      .setDescription("Write a caption")
      .setRequired(false)
  ),
new SlashCommandBuilder()
  .setName("help")
  .setDescription("Show all bot commands"),
new SlashCommandBuilder()
  .setName("highlights")
  .setDescription("View story highlights")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("Choose a user")
      .setRequired(false)
  ),
  new SlashCommandBuilder()
  .setName("eventjoin")
  .setDescription("Send the event join panel")
  .addChannelOption(option =>
    option
      .setName("channel")
      .setDescription("Channel to send the event panel")
      .setRequired(true)
  ),
  new SlashCommandBuilder()
  .setName("selectteam")
  .setDescription("Ask a user to join your team")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("Choose your teammate")
      .setRequired(true)
  ),

  new SlashCommandBuilder()
  .setName("addauction")
  .setDescription("Create a new auction")
  .addStringOption(o =>
    o.setName("item")
      .setDescription("Item name")
      .setRequired(true)
  )
  .addIntegerOption(o =>
    o.setName("startbid")
      .setDescription("Starting bid amount")
      .setRequired(true)
  )
  .addStringOption(o =>
    o.setName("currency")
      .setDescription("Currency")
      .setRequired(true)
      .addChoices(
        { name: "WL", value: "WL" },
        { name: "DL", value: "DL" },
        { name: "BGL", value: "BGL" }
      )
  )
  .addStringOption(o =>
    o.setName("duration")
      .setDescription("Auction duration, example: 1h, 12h, 1d")
      .setRequired(false)
  ),

new SlashCommandBuilder()
  .setName("auctionlist")
  .setDescription("View active auctions"),
new SlashCommandBuilder()
  .setName("teamlist")
  .setDescription("Show confirmed event teams"),
  new SlashCommandBuilder()
  .setName("editblist")
  .setDescription("Edit an existing blacklist message")
  .addStringOption(option =>
    option.setName("messageid")
      .setDescription("Message ID of the blacklist message")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("growid")
      .setDescription("New GrowID")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("reason")
      .setDescription("New reason")
      .setRequired(true)
  ),
  new SlashCommandBuilder()
  .setName("randommessage")
  .setDescription("Generate a random message."),
  new SlashCommandBuilder()
  .setName("scanblist")
  .setDescription("Scan the approved blacklist channel and rebuild blacklist data"),
  new SlashCommandBuilder()
  .setName("poststory")
  .setDescription("Post a story that disappears after 24 hours")
  .addAttachmentOption(option =>
    option
      .setName("media")
      .setDescription("Choose an image or video")
      .setRequired(true)
  ),
  new SlashCommandBuilder()
  .setName("postnote")
  .setDescription("Post a note that disappears after 24 hours")
  .addStringOption(option =>
    option
      .setName("text")
      .setDescription("Write your note")
      .setRequired(true)
  ),
new SlashCommandBuilder()
  .setName("testdice")
  .setDescription("Roll a dice"),
new SlashCommandBuilder()
  .setName("wouldyourather")
  .setDescription("Play Would You Rather"),
new SlashCommandBuilder()
  .setName("quote")
  .setDescription("Get a random quote")
  .addStringOption(option =>
    option.setName("category")
      .setDescription("Choose a quote category")
      .setRequired(true)
      .addChoices(
        { name: "Motivational", value: "motivational" },
        { name: "Romantic", value: "romantic" },
        { name: "Funny", value: "funny" },
        { name: "Sad", value: "sad" },
        { name: "Wisdom", value: "wisdom" }
      )
  ),
  new SlashCommandBuilder()
  .setName("warn1")
  .setDescription("Warn 1 a user")
  .addUserOption(o =>
    o.setName("user")
      .setDescription("User to warn")
      .setRequired(true)
  )
  .addStringOption(o =>
    o.setName("reason")
      .setDescription("Reason")
      .setRequired(true)
  ),

new SlashCommandBuilder()
  .setName("warn2")
  .setDescription("Warn 2 a user")
  .addUserOption(o =>
    o.setName("user")
      .setDescription("User to warn")
      .setRequired(true)
  )
  .addStringOption(o =>
    o.setName("reason")
      .setDescription("Reason")
      .setRequired(true)
  ),
new SlashCommandBuilder()
  .setName("whosmypartner")
  .setDescription("Find your future partner"),
new SlashCommandBuilder()
  .setName("warn3")
  .setDescription("Warn 3 a user and ban")
  .addUserOption(o =>
    o.setName("user")
      .setDescription("User to warn")
      .setRequired(true)
  )
  .addStringOption(o =>
    o.setName("reason")
      .setDescription("Reason")
      .setRequired(true)
  ),
new SlashCommandBuilder()
  .setName("customticket")
  .setDescription("Create a custom ticket dropdown option")
  .addStringOption(option =>
    option.setName("label")
      .setDescription("Dropdown name, example: Submit My Set")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("description")
      .setDescription("Dropdown description")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("questions")
      .setDescription("Questions separated by | example: Set name?|Item name?|Upload image")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("duration")
      .setDescription("How long before it expires, example: 4d, 12h, 30m")
      .setRequired(true)
  ),
new SlashCommandBuilder()
  .setName("ticketmod")
  .setDescription("Send ticket moderation panel"),
  new SlashCommandBuilder()
    .setName("editbday")
    .setDescription("Edit your birthday")
    .addIntegerOption(o =>
      o.setName("day").setDescription("Day").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("month").setDescription("Month").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("year").setDescription("Year").setRequired(true)
    ),
new SlashCommandBuilder()
  .setName("removecustomticket")
  .setDescription("Remove a custom ticket dropdown option")
  .addStringOption(option =>
    option.setName("label")
      .setDescription("Custom ticket label to remove")
      .setRequired(true)
  ),
new SlashCommandBuilder()
  .setName("howstraight")
  .setDescription("Check how straight someone is")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("Choose a user")
      .setRequired(false)
  ),
new SlashCommandBuilder()
  .setName("refreshticketpanel")
  .setDescription("Apply updates to the current ticket panel"),
  new SlashCommandBuilder()
    .setName("bdaylist")
    .setDescription("Show birthday list"),
  new SlashCommandBuilder()
  .setName("sendinfo")
  .setDescription("Send the server info panel")
  .addChannelOption(option =>
    option.setName("channel")
      .setDescription("Channel to send the info panel")
      .setRequired(true)
  ),
  new SlashCommandBuilder()
    .setName("renderworld")
    .setDescription("Render a Growtopia world")
    .addStringOption(option =>
        option
            .setName("world")
            .setDescription("World name")
            .setRequired(true)
    ),
    new SlashCommandBuilder()
  .setName("salesman")
  .setDescription("Exchange your stuffs for World Locks"),
    new SlashCommandBuilder()
  .setName("shop")
  .setDescription("Open the item shop"),
new SlashCommandBuilder()
  .setName("sendtask")
  .setDescription("Send the daily task panel"),

new SlashCommandBuilder()
  .setName("trade")
  .setDescription("Trade items with another user")
  .addUserOption(option =>
    option.setName("user")
      .setDescription("User to trade with")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("give")
      .setDescription("Example: 25 wiggly, 5 gar, 1 whale")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("receive")
      .setDescription("Example: 10 wl, 1 alpha shark")
      .setRequired(true)
  ),
new SlashCommandBuilder()
  .setName("fish")
  .setDescription("Go fishing with your fishing rod"),
  new SlashCommandBuilder()
  .setName("call")
  .setDescription("Use the old Growtopia telephone"),
  new SlashCommandBuilder()
  .setName("addguild")
  .setDescription("Add or update a guild member")
  .addStringOption(option =>
    option.setName("growid")
      .setDescription("GrowID / in-game name")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("role")
      .setDescription("Guild role")
      .setRequired(true)
      .addChoices(
        { name: "Guild Leader", value: "GL" },
        { name: "Guild Co-Leader", value: "GC" },
        { name: "Guild Elder", value: "GE" },
        { name: "Member", value: "MEMBER" }
      )
  )
  .addUserOption(option =>
    option.setName("discord")
      .setDescription("Discord user, optional")
      .setRequired(false)
  ),
  new SlashCommandBuilder()
  .setName("guildlist")
  .setDescription("View all guild members"),
  new SlashCommandBuilder()
  .setName("wikiitem")
  .setDescription("Search an item from Growtopia Wiki")
  .addStringOption(option =>
    option.setName("item")
      .setDescription("Item name, example: Dirt or World Lock")
      .setRequired(true)
  ),
  new SlashCommandBuilder()
  .setName("suggestion")
  .setDescription("Send a suggestion")
  .addStringOption(option =>
    option.setName("title")
      .setDescription("Suggestion title or command name")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("feature")
      .setDescription("Explain the feature")
      .setRequired(true)
  ),
new SlashCommandBuilder()
  .setName("legendquest")
  .setDescription("View Legendary Quest steps")
  .addStringOption(option =>
    option.setName("quest")
      .setDescription("Choose a legendary quest")
      .setRequired(true)
      .addChoices(
        { name: "Quest For Honor", value: "honor" },
        { name: "Quest For Fire", value: "fire" },
        { name: "Quest Of Steel", value: "steel" },
        { name: "Quest Of The Heavens", value: "heavens" },
        { name: "Quest For The Blade", value: "blade" },
        { name: "Quest For Candour", value: "candour" },
        { name: "Quest For The Sky", value: "sky" },
        { name: "Quest Of The Owl", value: "owl" },
        { name: "Quest Of The Mech", value: "mech" }
      )
  ),
  new SlashCommandBuilder()
    .setName("testbday")
    .setDescription("Send a test birthday message (Admin only)"),
testLevelCommand.data
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {

  try {

    console.log("🔄 Registering commands...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log("✅ Commands registered");

  } catch (err) {
    console.error(err);
  }

})();