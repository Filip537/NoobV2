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

const fs = require("fs");

const ADMIN_ROLE = "1411991650573484073";
const SUPPORT_ROLE = "1483338429675868203";
const LOG_CHANNEL = "1487791856216571915";
const CATEGORY_ID = "1442702423885086781";

const CUSTOM_FILE = "./customTickets.json";
const PANEL_FILE = "./ticketPanels.json";

function loadCustomTickets() {
  if (!fs.existsSync(CUSTOM_FILE)) fs.writeFileSync(CUSTOM_FILE, "[]");
  return JSON.parse(fs.readFileSync(CUSTOM_FILE, "utf8"));
}

function saveCustomTickets(data) {
  fs.writeFileSync(CUSTOM_FILE, JSON.stringify(data, null, 2));
}

function loadPanels() {
  if (!fs.existsSync(PANEL_FILE)) fs.writeFileSync(PANEL_FILE, "[]");
  return JSON.parse(fs.readFileSync(PANEL_FILE, "utf8"));
}

function savePanels(data) {
  fs.writeFileSync(PANEL_FILE, JSON.stringify(data, null, 2));
}

function parseDuration(input) {
  const match = input.toLowerCase().match(/^(\d+)(m|h|d)$/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];

  if (unit === "m") return amount * 60 * 1000;
  if (unit === "h") return amount * 60 * 60 * 1000;
  if (unit === "d") return amount * 24 * 60 * 60 * 1000;

  return null;
}

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

function buildTicketPanel(client) {
  const customTickets = loadCustomTickets()
    .filter(t => t.expiresAt > Date.now())
    .slice(0, 22);

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("Please read before creating the ticket")
    .setThumbnail(client.user.displayAvatarURL())
    .setDescription(
`Creating a ticket without a valid reason may put you one step closer to receiving a permanent timeout or even a ban/blacklist.
Please be mindful when creating tickets.

Please choose the correct option below.`
    );

  const options = [
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
    },
    ...customTickets.map(t => ({
      label: t.label.slice(0, 100),
      description: `${t.description} | Ends ${t.durationRaw}`.slice(0, 100),
      value: `custom_${t.id}`
    }))
  ];

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_create_menu")
    .setPlaceholder("Select ticket type")
    .addOptions(options);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)]
  };
}

async function lockTicketChannel(channel) {
  const topic = channel.topic || "";
  const ownerMatch = topic.match(/ticketOwner:(\d+)/);
  const ownerId = ownerMatch ? ownerMatch[1] : null;

  if (ownerId) {
    await channel.permissionOverwrites.edit(ownerId, {
      ViewChannel: true,
      SendMessages: false,
      ReadMessageHistory: true
    }).catch(() => {});
  }

  await channel.send({
    content: "🔒 This ticket has expired and has been locked."
  }).catch(() => {});
}

async function createTicket(interaction, type, customData = null) {
  const guild = interaction.guild;
  const user = interaction.user;

  const channelName = customData
    ? `${customData.label}-${user.username}`
    : type === "admin"
      ? `admin-${user.username}`
      : type === "support"
        ? `support-${user.username}`
        : `ticket-${user.username}`;

  const expiresAt = customData ? Date.now() + customData.durationMs : null;

  const channel = await guild.channels.create({
    name: channelName.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90),
    type: ChannelType.GuildText,
    parent: CATEGORY_ID,
    topic: customData
      ? `ticketOwner:${user.id} expiresAt:${expiresAt}`
      : `ticketOwner:${user.id}`,
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
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles
        ]
      },
      {
        id: ADMIN_ROLE,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles
        ]
      },
      {
        id: SUPPORT_ROLE,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles
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

  if (customData) {
    await channel.send({
      content:
`Hello ${user},

You opened a **${customData.label}** ticket.

Please answer the questions below in **one message**.

${customData.questions.map(q => `- ${q}`).join("\n")}

${customData.questions.some(q => q.toLowerCase().includes("image")) ? "\nYou may upload the image in this ticket channel." : ""}

This ticket will be locked <t:${Math.floor(expiresAt / 1000)}:R>.`,
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
            { name: "Type", value: customData ? customData.label : type, inline: true },
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
  async removeCustomTicket(interaction) {
  if (!interaction.member.roles.cache.has(ADMIN_ROLE)) {
    return interaction.reply({
      content: "❌ Only admins can remove custom ticket dropdowns.",
      ephemeral: true
    });
  }

  const label = interaction.options.getString("label").toLowerCase();
  const customTickets = loadCustomTickets();

  const filtered = customTickets.filter(t => t.label.toLowerCase() !== label);

  if (filtered.length === customTickets.length) {
    return interaction.reply({
      content: "❌ No custom ticket found with that label.",
      ephemeral: true
    });
  }

  saveCustomTickets(filtered);
  await this.refreshAllTicketPanels(interaction.client);

  return interaction.reply({
    content: "✅ Custom ticket removed and the current ticket panel has been updated.",
    ephemeral: true
  });
},

async refreshTicketPanelCommand(interaction) {
  if (!interaction.member.roles.cache.has(ADMIN_ROLE)) {
    return interaction.reply({
      content: "❌ Only admins can refresh ticket panels.",
      ephemeral: true
    });
  }

  await this.refreshAllTicketPanels(interaction.client);

  return interaction.reply({
    content: "✅ Current ticket panel has been refreshed.",
    ephemeral: true
  });
},
  async customTicket(interaction) {
    if (!interaction.member.roles.cache.has(ADMIN_ROLE)) {
      return interaction.reply({
        content: "❌ Only admins can create custom ticket dropdowns.",
        ephemeral: true
      });
    }

    const label = interaction.options.getString("label");
    const description = interaction.options.getString("description");
    const questionsRaw = interaction.options.getString("questions");
    const durationRaw = interaction.options.getString("duration");

    const durationMs = parseDuration(durationRaw);

    if (!durationMs) {
      return interaction.reply({
        content: "❌ Invalid duration. Use `30m`, `12h`, or `4d`.",
        ephemeral: true
      });
    }

    const customTickets = loadCustomTickets();

    const data = {
      id: Date.now().toString(),
      label,
      description,
      questions: questionsRaw.split("|").map(q => q.trim()).filter(Boolean),
      durationRaw,
      durationMs,
      createdAt: Date.now(),
      expiresAt: Date.now() + durationMs,
      createdBy: interaction.user.id
    };

    customTickets.push(data);
    saveCustomTickets(customTickets);

    await this.refreshAllTicketPanels(interaction.client);

    return interaction.reply({
      content: `✅ Custom ticket dropdown created: **${label}**\nThe current ticket panel has been updated.\nThis dropdown will disappear <t:${Math.floor(data.expiresAt / 1000)}:R>.`,
      ephemeral: true
    });
  },

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(ADMIN_ROLE)) {
      return interaction.reply({
        content: "❌ Only admins can use this command.",
        ephemeral: true
      });
    }

    const channel = interaction.options.getChannel("channel");

    const sent = await channel.send(buildTicketPanel(interaction.client));

    const panels = loadPanels();
    panels.push({
      channelId: channel.id,
      messageId: sent.id
    });
    savePanels(panels);

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

      if (value.startsWith("custom_")) {
        const id = value.replace("custom_", "");
        const customTickets = loadCustomTickets();
        const customData = customTickets.find(t => t.id === id);

        if (!customData || customData.expiresAt <= Date.now()) {
          await this.refreshAllTicketPanels(interaction.client);

          return interaction.reply({
            content: "❌ This custom ticket dropdown has expired.",
            ephemeral: true
          });
        }

        return createTicket(interaction, "custom", customData);
      }
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
  },

  async refreshAllTicketPanels(client) {
    const panels = loadPanels();
    const kept = [];

    for (const panel of panels) {
      const channel = await client.channels.fetch(panel.channelId).catch(() => null);
      if (!channel) continue;

      const message = await channel.messages.fetch(panel.messageId).catch(() => null);
      if (!message) continue;

      await message.edit(buildTicketPanel(client)).catch(() => {});
      kept.push(panel);
    }

    savePanels(kept);
  },

  async cleanupCustomTickets(client) {
    const customTickets = loadCustomTickets();
    const activeTickets = customTickets.filter(t => t.expiresAt > Date.now());

    if (activeTickets.length !== customTickets.length) {
      saveCustomTickets(activeTickets);
      await this.refreshAllTicketPanels(client);
    }

    const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
    if (!guild) return;

    const channels = await guild.channels.fetch().catch(() => null);
    if (!channels) return;

    for (const channel of channels.values()) {
      if (!channel || channel.type !== ChannelType.GuildText) continue;
      if (!channel.topic || !channel.topic.includes("expiresAt:")) continue;
      if (channel.topic.includes("locked:true")) continue;

      const match = channel.topic.match(/expiresAt:(\d+)/);
      if (!match) continue;

      const expiresAt = Number(match[1]);

      if (Date.now() >= expiresAt) {
        await lockTicketChannel(channel);
        await channel.setTopic(`${channel.topic} locked:true`).catch(() => {});
      }
    }
  }
};