const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  AttachmentBuilder
} = require("discord.js");

const path = require("path");

const phoneImagePath = path.join(__dirname, "../images/telephone.png");

function phoneAttachment() {
  return new AttachmentBuilder(phoneImagePath, {
    name: "telephone.png"
  });
}

function phoneEmbed(title, description) {
  return new EmbedBuilder()
    .setColor("Blue")
    .setTitle(title)
    .setDescription(description)
    .setThumbnail("attachment://telephone.png");
}

function phoneMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("call_dropdown")
      .setPlaceholder("Dial a number")
      .addOptions(
        {
          label: "12345",
          description: "Try the starter number",
          value: "12345"
        },
        {
          label: "77777",
          description: "Call nobody",
          value: "77777"
        }
      )
  );
}

async function handleCommand(interaction) {
  if (!interaction.isChatInputCommand()) return false;
  if (interaction.commandName !== "call") return false;

  const embed = phoneEmbed(
    "Telephone",
    "It's a phone! Dial it with your wrench (and try 12345 to start - trust us!). Growtopia doesn't have any cell service, so you're stuck with this old thing."
  );

  await interaction.reply({
    content: `Hello ${interaction.user},`,
    embeds: [embed],
    components: [phoneMenu()],
    files: [phoneAttachment()]
  });

  return true;
}

async function handleSelect(interaction) {
  if (!interaction.isStringSelectMenu()) return false;
  if (interaction.customId !== "call_dropdown") return false;

  const picked = interaction.values[0];

  if (picked === "12345") {
    const embed = phoneEmbed(
      "Oops!",
      "Looks like the update isn't ready yet. Also... you forgot to pay the telephone bill, so the phone is just sitting there looking useful."
    );

    await interaction.update({
      embeds: [embed],
      components: [phoneMenu()],
      files: [phoneAttachment()]
    });

    return true;
  }

  if (picked === "77777") {
    const embed = phoneEmbed(
      "Nobody",
      "There's nobody there. I know, it really seemed like 77777 would be a valid phone number, didn't it? Sorry, it's not. You just wasted 3 seconds of your life. And now you're wasting like 5 more reading this text. Anyway, have fun playing Growtopia! We put in goofy stuff like this just to amuse you!"
    );

    await interaction.update({
      embeds: [embed],
      components: [phoneMenu()],
      files: [phoneAttachment()]
    });

    return true;
  }

  return false;
}

module.exports = {
  handleCommand,
  handleSelect
};