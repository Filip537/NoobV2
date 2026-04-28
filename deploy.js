require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

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
  .addAttachmentOption(o =>
  o.setName("image")
   .setDescription("Upload proof (optional)")
   .setRequired(false)
),
new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("View leaderboard")
  .addStringOption(option =>
    option.setName("category")
      .setDescription("Choose leaderboard category")
      .setRequired(true)
      .addChoices(
        { name: "Level", value: "level" }
      )
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
  .setName("games")
  .setDescription("Play mini games"),
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
    .setName("bdaylist")
    .setDescription("Show birthday list"),
new SlashCommandBuilder()
  .setName("createprofile")
  .setDescription("Create your profile"),
  new SlashCommandBuilder()
  .setName("viewprofile")
  .setDescription("View another user's profile")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("Select a user")
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
    .setName("testbday")
    .setDescription("Send a test birthday message (Admin only)")

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