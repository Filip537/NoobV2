require("dotenv").config();

const testLevelCommand = require("./commands/testlevelup.js");
const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const worldcup = require("./feature/worldcup");

const commands = [
new SlashCommandBuilder()
  .setName("addbirthday")
  .setDescription("Add your birthday")
  .addIntegerOption(option =>
    option
      .setName("date")
      .setDescription("Birth date (1-31)")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(31)
  )
  .addStringOption(option =>
    option
      .setName("month")
      .setDescription("Birth month")
      .setRequired(true)
      .addChoices(
        { name: "January", value: "01" },
        { name: "February", value: "02" },
        { name: "March", value: "03" },
        { name: "April", value: "04" },
        { name: "May", value: "05" },
        { name: "June", value: "06" },
        { name: "July", value: "07" },
        { name: "August", value: "08" },
        { name: "September", value: "09" },
        { name: "October", value: "10" },
        { name: "November", value: "11" },
        { name: "December", value: "12" }
      )
  )
  .addIntegerOption(option =>
    option
      .setName("year")
      .setDescription("Type your birth year (e.g. 2005)")
      .setRequired(true)
      .setMinValue(1900)
      .setMaxValue(new Date().getFullYear())
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
  .setName("importblacklist")
  .setDescription("Import GrowIDs from a blacklist channel export")
  .addAttachmentOption(option =>
    option
      .setName("file")
      .setDescription("The exported blacklist .txt file")
      .setRequired(true)
  ),
  new SlashCommandBuilder()
  .setName("changeavar")
  .setDescription("Temporarily change a user's bot avatar for 5 minutes")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("User to change")
      .setRequired(true)
  )
  .addAttachmentOption(option =>
    option
      .setName("avatar")
      .setDescription("Upload the temporary avatar")
      .setRequired(true)
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
  .setName("roledisplay")
  .setDescription("Display all members in a role by nickname")
  .addRoleOption(option =>
    option
      .setName("role")
      .setDescription("Choose the role")
      .setRequired(true)
  ),
  new SlashCommandBuilder()
  .setName("price")
  .setDescription("Check the current Growtopia item price")
  .addStringOption(option =>
    option
      .setName("item")
      .setDescription("Item name, example: Golden Angel Wings")
      .setRequired(true)
  ),
new SlashCommandBuilder()
  .setName("addqueue")
  .setDescription("Add a song to the music queue")
  .addStringOption(option =>
    option
      .setName("query")
      .setDescription("YouTube link or song name")
      .setRequired(true)
  ),
new SlashCommandBuilder()
  .setName("addreaction")
  .setDescription("Add 16 random reactions to a message")
  .addStringOption(option =>
    option
      .setName("messageid")
      .setDescription("The ID of the message to react to")
      .setRequired(true)
  ),
new SlashCommandBuilder()
  .setName("checkqueue")
  .setDescription("View the current music queue"),

new SlashCommandBuilder()
  .setName("stop")
  .setDescription("Stop music and clear the queue"),
new SlashCommandBuilder()
  .setName("spk")
  .setDescription("Send a message or command result as a user")
  .addUserOption(option =>
    option.setName("user")
      .setDescription("User to show")
      .setRequired(false)
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
  )
  .addStringOption(option =>
    option.setName("nickname")
      .setDescription("Custom webhook nickname")
      .setRequired(false)
  )
  .addAttachmentOption(option =>
    option.setName("avatar")
      .setDescription("Custom webhook profile picture")
      .setRequired(false)
  ),
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
  .setName("randommessage")
  .setDescription("Generate a random message."),

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
  .setDescription("Show birthday list")
  .addStringOption(option =>
    option
      .setName("month")
      .setDescription("Choose a month to display")
      .setRequired(true)
      .addChoices(
        { name: "Show All", value: "all" },
        { name: "January", value: "01" },
        { name: "February", value: "02" },
        { name: "March", value: "03" },
        { name: "April", value: "04" },
        { name: "May", value: "05" },
        { name: "June", value: "06" },
        { name: "July", value: "07" },
        { name: "August", value: "08" },
        { name: "September", value: "09" },
        { name: "October", value: "10" },
        { name: "November", value: "11" },
        { name: "December", value: "12" }
      )
  ),
  new SlashCommandBuilder()
    .setName("checkbirthday")
    .setDescription("Check a user's birthday")
    .addUserOption(option =>
        option
            .setName("user")
            .setDescription("User to check")
            .setRequired(true)
    ),
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
  .setName("whosgay")
  .setDescription("Spot a random gay member"),

new SlashCommandBuilder()
  .setName("whospro")
  .setDescription("Spot a random pro member"),
    new SlashCommandBuilder()
  .setName("luck")
  .setDescription("Check how lucky you are today"),

new SlashCommandBuilder()
  .setName("today")
  .setDescription("See your fortune for today"),

new SlashCommandBuilder()
  .setName("braincells")
  .setDescription("See how many brain cells you have left")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("Choose a user")
      .setRequired(false)
  ),
new SlashCommandBuilder()
  .setName("scan")
  .setDescription("Scan a random user's stats")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("Choose a user")
      .setRequired(false)
  ),

new SlashCommandBuilder()
  .setName("whosmart")
  .setDescription("Find a random smart member"),

new SlashCommandBuilder()
  .setName("whosnpc")
  .setDescription("Find a random NPC"),

new SlashCommandBuilder()
  .setName("futurejob")
  .setDescription("Predict your future job")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("Choose a user")
      .setRequired(false)
  ),

new SlashCommandBuilder()
  .setName("futurewife")
  .setDescription("Predict your future wife")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("Choose a user")
      .setRequired(false)
  ),
new SlashCommandBuilder()
  .setName("typingrace")
  .setDescription("Race to type a random sentence"),

new SlashCommandBuilder()
  .setName("whostraight")
  .setDescription("Spot a random straight member"),
new SlashCommandBuilder()
  .setName("myfavgame")
  .setDescription("Guess your favorite game")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("Choose a user")
      .setRequired(false)
  ),
  new SlashCommandBuilder()
  .setName("howfurry")
  .setDescription("See how furry someone is")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("User to check")
      .setRequired(false)
  ),
  new SlashCommandBuilder()
  .setName("unblist")
  .setDescription("Submit a GrowID to be unblacklisted")
  .addStringOption(o =>
    o.setName("growid")
      .setDescription("GrowID")
      .setRequired(true)
  )
  .addStringOption(o =>
    o.setName("blacklist_reason")
      .setDescription("Reason they were originally blacklisted")
      .setRequired(true)
  )
  .addStringOption(o =>
    o.setName("unblacklist_reason")
      .setDescription("Reason they should be unblacklisted")
      .setRequired(true)
  ),
  new SlashCommandBuilder()
  .setName("mystats")
  .setDescription("Check your or another user's server activity stats")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("User to check")
      .setRequired(false)
  ),
  new SlashCommandBuilder()
  .setName("furrytest")
  .setDescription("Find out how furry you really are"),
new SlashCommandBuilder()
  .setName("whosfurry")
  .setDescription("Spot a random furry member"),
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
  .setName("export")
  .setDescription("Export all messages from a channel into a text file")
  .addChannelOption(option =>
    option
      .setName("channelid")
      .setDescription("Channel to export")
      .setRequired(true)
  ),
  new SlashCommandBuilder()
  .setName("senddashboard")
  .setDescription("Send the administrator dashboard")
  .addChannelOption(option =>
    option
      .setName("channel")
      .setDescription("Channel where the dashboard will be sent")
      .setRequired(true)
  ),
  new SlashCommandBuilder()
    .setName("testbday")
    .setDescription("Send a test birthday message (Admin only)"),
testLevelCommand.data,
worldcup.data
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