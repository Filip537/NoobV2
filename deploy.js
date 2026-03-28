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