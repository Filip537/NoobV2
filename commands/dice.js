const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "testdice",

  async execute(interaction) {

    const roll = Math.floor(Math.random() * 6) + 1;

    const embed = new EmbedBuilder()
      .setTitle("<:ItemSprites23:1449424903416840394> Dice Roll")
      .setDescription(
        `You spun a dice and got **${roll}**\n\n<:arrow:1442712798969729087> You punched the dice and got **${roll}**`
      )
      .setColor("Purple");

    await interaction.reply({ embeds: [embed] });
  }
};