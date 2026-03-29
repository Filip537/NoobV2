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
const CATEGORY_ID = "1442702423885086781";

module.exports = {

  async execute(interaction) {

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

    // ================= CREATE TICKET =================
    if (interaction.customId === "create_ticket") {

      const guild = interaction.guild;

      const channel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: CATEGORY_ID, // ✅ CATEGORY ADDED
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
        .setDescription(
`Hello ${interaction.user}, please describe your issue.

Staff will assist you shortly.

---

**What's your purpose for creating this ticket?**
Please click one of the buttons below.

If your issue is not related, do NOT click unnecessarily.`
        );

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("admin_form")
          .setLabel("📋 Admin Form")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("support_form")
          .setLabel("🛠️ Support Form")
          .setStyle(ButtonStyle.Secondary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("🔒 Close Ticket")
          .setStyle(ButtonStyle.Danger)
      );
await channel.send({
  content: `Hello <@${interaction.user.id}>`,
        embeds: [embed],
        components: [row1, row2]
      });

      // LOG
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

    // ================= ADMIN FORM =================
    if (interaction.customId === "admin_form") {

      return interaction.reply({
        content:
`Hello ${interaction.user},

**To apply for an Admin position, you must complete this form. Trolling or submitting joke responses is strictly prohibited, as all applications will be forwarded to the owners and the admin team for review.

DO not send your messages one by one, you must do it in one go otherwise your response wont be accepted**

Any use of **GenAI** is **strictly prohibited**. All responses must be your own **text**, as you are the one who apply not an **AI**.

\`\`\`
- GrowID:
- Discord User:
- Account Age:
- Why would you like to become an admin?
- How would you respond if you witnessed an admin raiding the world?
- What actions would you take to help keep the world active and entertained?
- How could we trust you to be an admin? 
- If a player breaks the rule, should you ban them immediately?
- Do you currently have advanced account protection enabled?
- How can you ensure that your account is secure?

Extra Note: Since having access to the world comes with responsibility, a compromised account could cause serious issues. Please confirm that your account is fully protected against potential hackers.
\`\`\``,
      });
    }

    // ================= SUPPORT FORM =================
    if (interaction.customId === "support_form") {

      return interaction.reply({
        content:
`Hello ${interaction.user},

**To apply for a Support position, you must complete this form. Forms of trolling is not allowed since admins and owners of NOOBV2 will confirm if you get the position or not. 

Do NOT send your messages one by one, you must say it in one message, otherwise your form will not be accepted.**

\`\`\`
- Your GrowID:
- Discord User:
- Why would you like to become a support in NOOBV2?
- How would you respond if someone opened a ticket?
- How could we trust you to be a support?
\`\`\``,
      });
    }

    // ================= CLOSE =================
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