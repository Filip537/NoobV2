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
  .setName("profile")
  .setDescription("View your profile")
  .addUserOption(option =>
    option.setName("user")
      .setDescription("Select a user")
      .setRequired(false)
  ),
  new SlashCommandBuilder()
  .setName("wordban")
  .setDescription("Ban a word")
  .addStringOption(option =>
    option.setName("word")
      .setDescription("Word to blacklist")
      .setRequired(true)
  ),
new SlashCommandBuilder()
  .setName("buy")
  .setDescription("Buy items")
  .addStringOption(option =>
    option.setName("item")
      .setDescription("Choose item to buy")
      .setRequired(true)
      .addChoices(
        { name: "Riding Hot Chocolate", value: "hotchoco" }
      )
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
  .setName("myset")
  .setDescription("View your equipped set"),
new SlashCommandBuilder()
  .setName("wordbanlist")
  .setDescription("View blacklisted words"),
  new SlashCommandBuilder()
  .setName("editwordban")
  .setDescription("Remove a word from blacklist")
  .addStringOption(option =>
    option.setName("word")
      .setDescription("Word to remove")
      .setRequired(true)
  ),
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
  .setName("postgif")
  .setDescription("Post a gif that disappears after 24 hours")
  .addAttachmentOption(option =>
    option
      .setName("gif")
      .setDescription("Choose a gif")
      .setRequired(true)
  ),
  new SlashCommandBuilder()
    .setName("bdaylist")
    .setDescription("Show birthday list"),

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