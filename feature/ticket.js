const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require("discord.js");

module.exports = {
  name: "ticketpanel",

  async execute(interaction) {

    const embed = new EmbedBuilder()
      .setColor("Red")
      .setTitle("Please read before creating the ticket")
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setDescription(
`Creating a ticket without a valid reason may put you one step closer to receiving a permanent timeout or even a ban/blacklist. Please be mindful when creating tickets.

Please tag <@&1483338429675868203> or <@&1411991650573484073> if you need help.`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("create_ticket")
        .setLabel("🎫 Create Ticket")
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }
};