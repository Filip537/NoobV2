const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const ADMIN_ROLE = "1411991650573484073";
const SUPPORT_ROLE = "1483338429675868203";
const LOG_CHANNEL = "1487791856216571915";
const CATEGORY_ID = "1442702423885086781";

const adminForm = user => 
`Hello ${user},

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
\`\`\``;

const supportForm = user =>
`Hello ${user},

**To apply for a Support position, you must complete this form. Forms of trolling is not allowed since admins and owners of NOOBV2 will confirm if you get the position or not.

Do NOT send your messages one by one, you must say it in one message, otherwise your form will not be accepted.**

\`\`\`
- Your GrowID:
- Discord User:
- Why would you like to become a support in NOOBV2?
- How would you respond if someone opened a ticket?
- How could we trust you to be a support?
\`\`\``;

function closeButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("🔒 Close Ticket")
      .setStyle(ButtonStyle.Danger)
  );
}

async function createTicket(interaction, type) {
  const guild = interaction.guild;
  const user = interaction.user;

  const channelName =
    type === "admin"
      ? `admin-${user.username}`
      : type === "support"
      ? `support-${user.username}`
      : `ticket-${user.username}`;

  const channel = await guild.channels.create({
    name: channelName.toLowerCase().replace(/[^a-z0-9-]/g, ""),
    type: ChannelType.GuildText,
    parent: CATEGORY_ID,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      },
      {
        id: ADMIN_ROLE,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      },
      {
        id: SUPPORT_ROLE,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      }
    ]
  });

  if (type === "admin") {
    await channel.send({
      content: adminForm(user),
      components: [closeButton()]
    });
  }

  if (type === "support") {
    await channel.send({
      content: supportForm(user),
      components: [closeButton()]
    });
  }

  if (type === "others") {
    await channel.send({
      content: `Hello ${user}, if your issue is not related, do **NOT** click unnecessarily.\n\nPlease describe your issue clearly.`,
      components: [closeButton()]
    });
  }

  const logChannel = await guild.channels.fetch(LOG_CHANNEL).catch(() => null);

  if (logChannel) {
    await logChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("Blue")
          .setTitle("Ticket Created")
          .addFields(
            { name: "User", value: `${user}`, inline: true },
            { name: "Type", value: type, inline: true },
            { name: "Channel", value: `${channel}`, inline: true }
          )
          .setTimestamp()
      ]
    });
  }

  return interaction.reply({
    content: `✅ Ticket created: ${channel}`,
    ephemeral: true
  });
}

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
`Creating a ticket without a valid reason may put you one step closer to receiving a permanent timeout or even a ban/blacklist.
Please be mindful when creating tickets.

Please choose the correct option below.`
      );

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_create_menu")
      .setPlaceholder("Select ticket type")
      .addOptions(
        {
          label: "Apply for Admin",
          description: "Create an admin application ticket",
          value: "ticket_admin"
        },
        {
          label: "Apply for Support",
          description: "Create a support application ticket",
          value: "ticket_support"
        },
        {
          label: "Others",
          description: "Create a normal ticket",
          value: "ticket_others"
        }
      );

    await channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)]
    });

    return interaction.reply({
      content: `✅ Ticket panel sent in ${channel}`,
      ephemeral: true
    });
  },

  async ticketMod(interaction) {
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({
        content: "❌ Administrator only.",
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle("Ticket Moderator Panel")
      .setDescription("Use the dropdown below to manage this ticket.");

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_mod_menu")
      .setPlaceholder("Select ticket action")
      .addOptions(
        {
          label: "Add User to Ticket",
          description: "Give another user access to this ticket",
          value: "ticketmod_add_user"
        },
        {
          label: "Send Admin Application",
          description: "Send the admin application form",
          value: "ticketmod_admin_form"
        },
        {
          label: "Send Support Application",
          description: "Send the support application form",
          value: "ticketmod_support_form"
        }
      );

    return interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  },

  async handleSelect(interaction) {
    const value = interaction.values[0];

    if (interaction.customId === "ticket_create_menu") {
      if (value === "ticket_admin") return createTicket(interaction, "admin");
      if (value === "ticket_support") return createTicket(interaction, "support");
      if (value === "ticket_others") return createTicket(interaction, "others");
    }

    if (interaction.customId === "ticket_mod_menu") {
      if (!interaction.member.permissions.has("Administrator")) {
        return interaction.reply({
          content: "❌ Administrator only.",
          ephemeral: true
        });
      }

      if (value === "ticketmod_add_user") {
        const modal = new ModalBuilder()
          .setCustomId("ticket_add_user_modal")
          .setTitle("Add User to Ticket");

        const input = new TextInputBuilder()
          .setCustomId("user_id")
          .setLabel("User ID")
          .setPlaceholder("Example: 123456789012345678")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        return interaction.showModal(modal);
      }

      if (value === "ticketmod_admin_form") {
        return interaction.reply({
          content: adminForm(interaction.user)
        });
      }

      if (value === "ticketmod_support_form") {
        return interaction.reply({
          content: supportForm(interaction.user)
        });
      }
    }
  },

  async handleButton(interaction) {
    if (interaction.customId !== "close_ticket") return;

    const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL).catch(() => null);

    if (logChannel) {
      await logChannel.send({
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
    }

    await interaction.reply("Closing ticket...");

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 2000);
  },

  async handleModal(interaction) {
    const userId = interaction.fields.getTextInputValue("user_id");

    await interaction.channel.permissionOverwrites.edit(userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    });

    return interaction.reply({
      content: `✅ <@${userId}> has been added to this ticket.`
    });
  }
};