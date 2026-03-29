const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField
} = require("discord.js");

const ADMIN_ROLE = "1411991650573484073";
const SUPPORT_ROLE = "1483338429675868203";
const LOG_CHANNEL = "1487791856216571915";

module.exports = {

  async execute(interaction) {

    // 🔒 Admin check
    if (!interaction.member.roles.cache.has(ADMIN_ROLE)) {
      return interaction.reply({
        content: "❌ Only admins can use this command.",
        ephemeral: true
      });
    }

    const channel = interaction.options.getChannel("channel");

    const embed = new EmbedBuilder()
      .setColor("Red")
      .setTitle("Please read before creating the ticket")
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setDescription(
`Creating a ticket without a valid reason may put you one step closer to receiving a permanent timeout or even a ban/blacklist. Please be mindful when creating tickets.

Please tag <@&${SUPPORT_ROLE}> or <@&${ADMIN_ROLE}> if you need help.`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("create_ticket")
        .setLabel("🎫 Create Ticket")
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({
      embeds: [embed],
      components: [row]
    });

    return interaction.reply({
      content: `✅ Ticket panel sent in ${channel}`,
      ephemeral: true
    });
  },

  async handleButton(interaction) {

    if (interaction.customId === "create_ticket") {

      const guild = interaction.guild;

      const channel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: SUPPORT_ROLE,
            allow: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: ADMIN_ROLE,
            allow: [PermissionsBitField.Flags.ViewChannel]
          }
        ]
      });

      const embed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("🎫 Ticket Created")
        .setDescription(`Hello ${interaction.user}, please describe your issue.\n\nStaff will assist you shortly.`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("🔒 Close Ticket")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `<@${interaction.user.id}> <@&${SUPPORT_ROLE}>`,
        embeds: [embed],
        components: [row]
      });

      // 📜 LOG CREATE
      const logChannel = await guild.channels.fetch(LOG_CHANNEL);

      logChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("Blue")
            .setTitle("Ticket Created")
            .addFields(
              { name: "User", value: `${interaction.user}`, inline: true },
              { name: "Channel", value: `${channel}`, inline: true }
            )
            .setTimestamp()
        ]
      });

      return interaction.reply({
        content: `✅ Ticket created: ${channel}`,
        ephemeral: true
      });
    }

    // 🔒 CLOSE TICKET
    if (interaction.customId === "close_ticket") {

      const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL);

      logChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("Red")
            .setTitle("Ticket Closed")
            .addFields(
              { name: "Closed By", value: `${interaction.user}`, inline: true },
              { name: "Channel", value: `${interaction.channel}`, inline: true }
            )
            .setTimestamp()
        ]
      });

      await interaction.reply("🔒 Closing ticket...");
      
      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 2000);
    }
  }
};