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

// ==========================================
// CONFIGURATION
// ==========================================

const ADMIN_ROLE = "1411991650573484073";
const SUPPORT_ROLE = "1483338429675868203";
const LOG_CHANNEL = "1487791856216571915";
const CATEGORY_ID = "1442702423885086781";

const CUSTOM_FILE = "./customTickets.json";
const PANEL_FILE = "./ticketPanels.json";

const CHECK = "<:emoji_28:1439046091201839225>";
const CROSS = "<:ban:1447775399068307617>";

const EMBED_COLOR = 0xF1C40F;

const creatingTickets = new Set();

// ==========================================
// FILE MANAGEMENT
// ==========================================

function loadCustomTickets() {
  if (!fs.existsSync(CUSTOM_FILE)) {
    fs.writeFileSync(CUSTOM_FILE, "[]");
  }

  return JSON.parse(
    fs.readFileSync(CUSTOM_FILE, "utf8")
  );
}

function saveCustomTickets(data) {
  fs.writeFileSync(
    CUSTOM_FILE,
    JSON.stringify(data, null, 2)
  );
}

function loadPanels() {
  if (!fs.existsSync(PANEL_FILE)) {
    fs.writeFileSync(PANEL_FILE, "[]");
  }

  return JSON.parse(
    fs.readFileSync(PANEL_FILE, "utf8")
  );
}

function savePanels(data) {
  fs.writeFileSync(
    PANEL_FILE,
    JSON.stringify(data, null, 2)
  );
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

// ==========================================
// ADMIN APPLICATION FORM
// ==========================================

const adminForm = user =>
`Hello ${user},

**To apply for an Admin position, you must complete this form. Trolling or submitting joke responses is strictly prohibited, as all applications will be forwarded to the owners and the admin team for review.

DO not send your messages one by one, you must do it in one go otherwise your response wont be accepted**

Any use of **GenAI** is **strictly prohibited**. All responses must be your own **text**, as you are the one who apply not an **AI**.

\`\`\`
1. GrowID:
2. Discord User:
3. Account Age:
4. Timezone (Specify it in GMT++)
5. How do you find out about NoobV2?
6. How many hours are you available to play each day?
7. How long you’ve been playing this world and what was your first impression?
8. Why would you like to become an admin?
9. How would you respond if you witnessed an admin raiding the world?
10. What actions would you take to help keep the world active and entertained?
11. How could we trust you to be an admin?
12. If a player breaks the rule, should you ban them immediately?
13. Do you currently have advanced account protection enabled?
\`\`\``;

// ==========================================
// SUPPORT APPLICATION FORM
// ==========================================

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

// ==========================================
// CLOSE TICKET BUTTON
// ==========================================

function closeButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("Close Ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );
}

// ==========================================
// MAIN TICKET PANEL
// ==========================================

function buildTicketPanel(client) {

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle("NoobV2 Ticket Center")
    .setThumbnail(client.user.displayAvatarURL())
    .setDescription(
`Welcome to the NoobV2 Ticket Center.

If you require assistance, wish to apply for a position, or have any other concerns, please create a ticket using the button below.

**Important Notice**
Please only create a ticket for a valid reason. Misusing the ticket system may result in administrative action.

Our team will assist you as soon as possible.`
    );

  const button = new ButtonBuilder()
    .setCustomId("create_ticket")
    .setLabel("Create Ticket")
    .setEmoji("🎫")
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(button)
    ]
  };
}

// ==========================================
// APPLICATION FORM DROPDOWN
// ==========================================

function ticketFormMenu() {

  const customTickets = loadCustomTickets()
    .filter(t => t.expiresAt > Date.now())
    .slice(0, 23);

  const options = [
    {
      label: "Admin Form",
      description: "Apply for an Admin position",
      value: "ticket_admin"
    },
    {
      label: "Support Form",
      description: "Apply for a Support position",
      value: "ticket_support"
    },
    ...customTickets.map(t => ({
      label: t.label.slice(0, 100),
      description:
        t.description.slice(0, 100) || "Custom form",
      value: `custom_${t.id}`
    }))
  ];

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_create_menu")
    .setPlaceholder("Select an application form")
    .addOptions(options);

  return new ActionRowBuilder().addComponents(menu);
}

// ==========================================
// LOCK EXPIRED TICKET
// ==========================================

async function lockTicketChannel(channel) {

  const topic = channel.topic || "";

  const ownerMatch = topic.match(/ticketOwner:(\d+)/);
  const ownerId = ownerMatch ? ownerMatch[1] : null;

  if (ownerId) {
    await channel.permissionOverwrites.edit(ownerId, {
      ViewChannel: true,
      SendMessages: false,
      ReadMessageHistory: true
    });
  }

  await channel.send({
    content: "🔒 This ticket has expired and has been locked."
  }).catch(console.error);
}

// ==========================================
// CREATE TICKET
// ==========================================

async function createTicket(interaction) {

  const guild = interaction.guild;
  const user = interaction.user;
  const key = `${guild.id}:${user.id}`;

  if (creatingTickets.has(key)) {
    return interaction.reply({
      content: `${CROSS} Your ticket is already being created.`,
      ephemeral: true
    });
  }

  creatingTickets.add(key);

  let channel = null;
  let initialized = false;

  try {

    await interaction.deferReply({
      ephemeral: true
    });

    const channelName = `ticket-${user.username}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 90);

    channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,

      topic: `ticketOwner:${user.id}`,

      permissionOverwrites: [
        {
          id: guild.id,
          deny: [
            PermissionsBitField.Flags.ViewChannel
          ]
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
        },
        {
          id: interaction.client.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.EmbedLinks,
            PermissionsBitField.Flags.AttachFiles
          ]
        }
      ]
    });

    // ======================================
    // WELCOME EMBED
    // ======================================

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle("Welcome to your ticket")
      .setThumbnail(
        interaction.client.user.displayAvatarURL()
      )
      .setDescription(
`Thank you for contacting the NoobV2 team.

**Applications**
If you wish to apply for an Admin or Support position, please select the appropriate application form from the dropdown below.

**Other Issues**
If your ticket is regarding another matter, please describe your issue directly in this ticket. You do not need to select an application form.

Please provide all relevant information, including screenshots or evidence if necessary.

**Closing Your Ticket**
Once your issue has been resolved, you may close this ticket using the button below.

Please be patient while waiting for a response from our team.`
      )
      .setFooter({
        text: "NoobV2 Management"
      })
      .setTimestamp();

    await channel.send({
      content: `${user}`,
      embeds: [embed],
      components: [
        closeButton(),
        ticketFormMenu()
      ]
    });

    initialized = true;

    await interaction.editReply({
      content: `${CHECK} Your ticket has been created: ${channel}`
    });

    // ======================================
    // TICKET CREATION LOG
    // ======================================

    const logChannel = await guild.channels
      .fetch(LOG_CHANNEL)
      .catch(() => null);

    if (logChannel && logChannel.isTextBased()) {

      await logChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("Blue")
            .setTitle("Ticket Created")
            .addFields(
              {
                name: "User",
                value: `${user}`,
                inline: true
              },
              {
                name: "Type",
                value: "General Ticket",
                inline: true
              },
              {
                name: "Channel",
                value: `${channel}`,
                inline: true
              }
            )
            .setTimestamp()
        ]
      }).catch(console.error);
    }

  } catch (error) {

    console.error("Ticket creation error:", error);

    if (channel && !initialized) {
      await channel.delete().catch(console.error);
    }

    const response = {
      content: initialized
        ? `${CHECK} Your ticket has been created: ${channel}`
        : `${CROSS} Unable to create your ticket. Please contact an administrator.`
    };

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(response).catch(() => {});
    }

    return interaction.reply({
      ...response,
      ephemeral: true
    }).catch(() => {});

  } finally {

    creatingTickets.delete(key);

  }
}

// ==========================================
// MODULE EXPORTS
// ==========================================

module.exports = {

  // ========================================
  // /ticketpanel
  // ========================================

  async execute(interaction) {

    if (!interaction.member.roles.cache.has(ADMIN_ROLE)) {
      return interaction.reply({
        content: `${CROSS} Only admins can use this command.`,
        ephemeral: true
      });
    }

    await interaction.deferReply({
      ephemeral: true
    });

    try {

      const channel = interaction.options.getChannel("channel");

      if (!channel || !channel.isTextBased() || typeof channel.send !== "function") {
        return interaction.editReply({
          content: `${CROSS} Please select a valid text channel.`
        });
      }

      const sent = await channel.send(
        buildTicketPanel(interaction.client)
      );

      const panels = loadPanels();

      panels.push({
        channelId: channel.id,
        messageId: sent.id
      });

      savePanels(panels);

      return interaction.editReply({
        content: `${CHECK} Ticket panel sent in ${channel}.`
      });

    } catch (error) {

      console.error("Ticket panel error:", error);

      return interaction.editReply({
        content: `${CROSS} Failed to send the ticket panel. Please check the bot's permissions.`
      });

    }
  },

  // ========================================
  // /refreshticketpanel
  // ========================================

  async refreshTicketPanelCommand(interaction) {

    if (!interaction.member.roles.cache.has(ADMIN_ROLE)) {
      return interaction.reply({
        content: `${CROSS} Only admins can refresh ticket panels.`,
        ephemeral: true
      });
    }

    await interaction.deferReply({
      ephemeral: true
    });

    try {

      const updated = await this.refreshAllTicketPanels(
        interaction.client
      );

      if (updated === 0) {
        return interaction.editReply({
          content: `${CROSS} No ticket panels were refreshed. Use /ticketpanel to send a new panel or check the bot's permissions.`
        });
      }

      return interaction.editReply({
        content: `${CHECK} Successfully refreshed ${updated} ticket panel(s).`
      });

    } catch (error) {

      console.error("Ticket refresh error:", error);

      return interaction.editReply({
        content: `${CROSS} Failed to refresh the ticket panel.`
      });

    }
  },

  // ========================================
  // /customticket
  // ========================================

  async customTicket(interaction) {

    if (!interaction.member.roles.cache.has(ADMIN_ROLE)) {
      return interaction.reply({
        content: `${CROSS} Only admins can create custom ticket forms.`,
        ephemeral: true
      });
    }

    const label = interaction.options.getString("label");
    const description = interaction.options.getString("description");
    const questionsRaw = interaction.options.getString("questions");
    const durationRaw = interaction.options.getString("duration");

    const durationMs = parseDuration(durationRaw);

    if (!durationMs || !Number.isSafeInteger(durationMs)) {
      return interaction.reply({
        content: `${CROSS} Invalid duration. Use \`30m\`, \`12h\`, or \`4d\`.`,
        ephemeral: true
      });
    }

    const customTickets = loadCustomTickets();

    const questions = questionsRaw
      .split("|")
      .map(q => q.trim())
      .filter(Boolean);

    if (!questions.length || questionsRaw.length > 1400) {
      return interaction.reply({
        content: `${CROSS} Please provide valid questions under 1,400 characters.`,
        ephemeral: true
      });
    }

    if (label.length > 100 || description.length > 100) {
      return interaction.reply({
        content: `${CROSS} The label and description must be under 100 characters.`,
        ephemeral: true
      });
    }

    const activeTickets = customTickets.filter(
      t => t.expiresAt > Date.now()
    );

    if (activeTickets.length >= 23) {
      return interaction.reply({
        content: `${CROSS} The maximum number of custom ticket forms has been reached.`,
        ephemeral: true
      });
    }

    const data = {
      id: Date.now().toString(),
      label,
      description,
      questions,
      durationRaw,
      durationMs,
      createdAt: Date.now(),
      expiresAt: Date.now() + durationMs,
      createdBy: interaction.user.id
    };

    customTickets.push(data);

    saveCustomTickets(customTickets);

    return interaction.reply({
      content:
`${CHECK} Custom ticket form created: **${label}**

The form will appear inside newly created tickets.

This form will expire <t:${Math.floor(data.expiresAt / 1000)}:R>.`,
      ephemeral: true
    });
  },

  // ========================================
  // /removecustomticket
  // ========================================

  async removeCustomTicket(interaction) {

    if (!interaction.member.roles.cache.has(ADMIN_ROLE)) {
      return interaction.reply({
        content: `${CROSS} Only admins can remove custom ticket forms.`,
        ephemeral: true
      });
    }

    const label = interaction.options
      .getString("label")
      .toLowerCase();

    const customTickets = loadCustomTickets();

    const filtered = customTickets.filter(
      t => t.label.toLowerCase() !== label
    );

    if (filtered.length === customTickets.length) {
      return interaction.reply({
        content: `${CROSS} No custom ticket form found with that label.`,
        ephemeral: true
      });
    }

    saveCustomTickets(filtered);

    return interaction.reply({
      content: `${CHECK} Custom ticket form removed.`,
      ephemeral: true
    });
  },

  // ========================================
  // /ticketmod
  // ========================================

  async ticketMod(interaction) {

    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({
        content: `${CROSS} Administrator only.`,
        ephemeral: true
      });
    }

    if (!interaction.channel.topic?.includes("ticketOwner:")) {
      return interaction.reply({
        content: `${CROSS} This command must be used inside a ticket.`,
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle("Ticket Moderator Panel")
      .setThumbnail(
        interaction.client.user.displayAvatarURL()
      )
      .setDescription(
        "Use the dropdown below to manage this ticket."
      );

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
      components: [
        new ActionRowBuilder().addComponents(menu)
      ],
      ephemeral: true
    });
  },

  // ========================================
  // DROPDOWN INTERACTIONS
  // ========================================

  async handleSelect(interaction) {

    const value = interaction.values[0];

    // ======================================
    // APPLICATION FORM DROPDOWN
    // ======================================

    if (interaction.customId === "ticket_create_menu") {

      const ownerId = interaction.channel.topic
        ?.match(/ticketOwner:(\d+)/)?.[1];

      if (!ownerId) {
        return interaction.reply({
          content: `${CROSS} Please use the updated Create Ticket panel.`,
          ephemeral: true
        });
      }

      if (ownerId !== interaction.user.id) {
        return interaction.reply({
          content: `${CROSS} Only the ticket owner can select an application form.`,
          ephemeral: true
        });
      }

      if (interaction.channel.topic.includes("locked:true")) {
        return interaction.reply({
          content: `${CROSS} This ticket has been locked.`,
          ephemeral: true
        });
      }

      // ====================================
      // ADMIN FORM
      // ====================================

      if (value === "ticket_admin") {

        return interaction.reply({
          content: adminForm(interaction.user)
        });
      }

      // ====================================
      // SUPPORT FORM
      // ====================================

      if (value === "ticket_support") {

        return interaction.reply({
          content: supportForm(interaction.user)
        });
      }

      // ====================================
      // CUSTOM TICKET FORM
      // ====================================

      if (value.startsWith("custom_")) {

        const id = value.replace("custom_", "");

        const customTickets = loadCustomTickets();

        const customData = customTickets.find(
          t => t.id === id && t.expiresAt > Date.now()
        );

        if (!customData) {
          return interaction.reply({
            content: `${CROSS} This custom ticket form has expired or been removed.`,
            ephemeral: true
          });
        }

        await interaction.deferReply({
          ephemeral: true
        });

        try {

          const expiresAt = Date.now() + customData.durationMs;

          await interaction.channel.setTopic(
            `ticketOwner:${ownerId} expiresAt:${expiresAt}`
          );

          const formEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle(customData.label)
            .setDescription(
`Hello ${interaction.user},

Please answer the questions below in **one message**.

${customData.questions.map(q => `- ${q}`).join("\n")}

${customData.questions.some(q =>
  q.toLowerCase().includes("image")
) ? "You may upload the image directly in this ticket.\n" : ""}
This ticket will be locked <t:${Math.floor(expiresAt / 1000)}:R>.`
            );

          await interaction.channel.send({
            embeds: [formEmbed],
            allowedMentions: {
              parse: []
            }
          });

          return interaction.editReply({
            content: `${CHECK} Application form sent.`
          });

        } catch (error) {

          console.error("Custom form error:", error);

          return interaction.editReply({
            content: `${CROSS} Failed to send the application form.`
          });

        }
      }

      return interaction.reply({
        content: `${CROSS} This option is no longer available.`,
        ephemeral: true
      });
    }

    // ======================================
    // TICKET MODERATION DROPDOWN
    // ======================================

    if (interaction.customId === "ticket_mod_menu") {

      if (!interaction.member.permissions.has("Administrator")) {
        return interaction.reply({
          content: `${CROSS} Administrator only.`,
          ephemeral: true
        });
      }

      const ownerId = interaction.channel.topic
        ?.match(/ticketOwner:(\d+)/)?.[1];

      if (!ownerId) {
        return interaction.reply({
          content: `${CROSS} This is not a ticket channel.`,
          ephemeral: true
        });
      }

      // ====================================
      // ADD USER
      // ====================================

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

        modal.addComponents(
          new ActionRowBuilder().addComponents(input)
        );

        return interaction.showModal(modal);
      }

      // ====================================
      // SEND ADMIN FORM
      // ====================================

      if (value === "ticketmod_admin_form") {

        await interaction.deferReply({
          ephemeral: true
        });

        await interaction.channel.send({
          content: adminForm(`<@${ownerId}>`)
        });

        return interaction.editReply({
          content: `${CHECK} Admin application form sent.`
        });
      }

      // ====================================
      // SEND SUPPORT FORM
      // ====================================

      if (value === "ticketmod_support_form") {

        await interaction.deferReply({
          ephemeral: true
        });

        await interaction.channel.send({
          content: supportForm(`<@${ownerId}>`)
        });

        return interaction.editReply({
          content: `${CHECK} Support application form sent.`
        });
      }
    }
  },

  // ========================================
  // BUTTON INTERACTIONS
  // ========================================

  async handleButton(interaction) {

    // CREATE TICKET

    if (interaction.customId === "create_ticket") {
      return createTicket(interaction);
    }

    // CLOSE TICKET

    if (interaction.customId !== "close_ticket") {
      return;
    }

    const channel = interaction.channel;

    const ownerId = channel.topic
      ?.match(/ticketOwner:(\d+)/)?.[1];

    if (!ownerId) {
      return interaction.reply({
        content: `${CROSS} This is not a valid ticket channel.`,
        ephemeral: true
      });
    }

    const isStaff =
      interaction.member.roles.cache.has(ADMIN_ROLE) ||
      interaction.member.roles.cache.has(SUPPORT_ROLE) ||
      interaction.member.permissions.has("Administrator");

    if (interaction.user.id !== ownerId && !isStaff) {
      return interaction.reply({
        content: `${CROSS} You do not have permission to close this ticket.`,
        ephemeral: true
      });
    }

    await interaction.reply({
      content: "🔒 Closing ticket..."
    });

    // ======================================
    // TICKET CLOSURE LOG
    // ======================================

    const logChannel = await interaction.guild.channels
      .fetch(LOG_CHANNEL)
      .catch(() => null);

    if (logChannel && logChannel.isTextBased()) {

      await logChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("Red")
            .setTitle("Ticket Closed")
            .addFields(
              {
                name: "Ticket Owner",
                value: `<@${ownerId}>`,
                inline: true
              },
              {
                name: "Closed By",
                value: `${interaction.user}`,
                inline: true
              },
              {
                name: "Channel",
                value: channel.name,
                inline: true
              }
            )
            .setTimestamp()
        ]
      }).catch(console.error);
    }

    setTimeout(() => {
      channel.delete().catch(async error => {

        console.error("Ticket close error:", error);

        await channel.send({
          content: `${CROSS} Failed to close the ticket. Please contact an administrator.`
        }).catch(() => {});

      });
    }, 2000);
  },

  // ========================================
  // MODAL INTERACTIONS
  // ========================================

  async handleModal(interaction) {

    if (interaction.customId !== "ticket_add_user_modal") {
      return;
    }

    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({
        content: `${CROSS} Administrator only.`,
        ephemeral: true
      });
    }

    if (!interaction.channel.topic?.includes("ticketOwner:")) {
      return interaction.reply({
        content: `${CROSS} This is not a ticket channel.`,
        ephemeral: true
      });
    }

    const userId = interaction.fields
      .getTextInputValue("user_id")
      .trim();

    await interaction.deferReply({
      ephemeral: true
    });

    try {

      const member = await interaction.guild.members
        .fetch(userId)
        .catch(() => null);

      if (!member) {
        return interaction.editReply({
          content: `${CROSS} Invalid user ID or user not found.`
        });
      }

      await interaction.channel.permissionOverwrites.edit(
        userId,
        {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true
        }
      );

      return interaction.editReply({
        content: `${CHECK} <@${userId}> has been added to this ticket.`
      });

    } catch (error) {

      console.error("Add ticket user error:", error);

      return interaction.editReply({
        content: `${CROSS} Failed to add the user to this ticket.`
      });

    }
  },

  // ========================================
  // REFRESH MAIN TICKET PANELS
  // ========================================

  async refreshAllTicketPanels(client) {

    const panels = loadPanels();
    const kept = [];

    let updated = 0;

    for (const panel of panels) {

      try {

        const channel = await client.channels.fetch(
          panel.channelId
        );

        if (!channel || !channel.isTextBased()) {
          continue;
        }

        const message = await channel.messages.fetch(
          panel.messageId
        );

        kept.push(panel);

        await message.edit(
          buildTicketPanel(client)
        );

        updated++;

      } catch (error) {

        console.error("Panel refresh error:", error);

        // Remove deleted messages or channels.
        // Keep panels with temporary permission/API errors.

        if (
          error.code !== 10008 &&
          error.code !== 10003 &&
          !kept.some(p => p.messageId === panel.messageId)
        ) {
          kept.push(panel);
        }
      }
    }

    savePanels(kept);

    return updated;
  },

  // ========================================
  // EXPIRED CUSTOM TICKET CLEANUP
  // ========================================

  async cleanupCustomTickets(client) {

    const customTickets = loadCustomTickets();

    const activeTickets = customTickets.filter(
      t => t.expiresAt > Date.now()
    );

    if (activeTickets.length !== customTickets.length) {
      saveCustomTickets(activeTickets);
    }

    const guild = await client.guilds
      .fetch(process.env.GUILD_ID)
      .catch(() => null);

    if (!guild) return;

    const channels = await guild.channels
      .fetch()
      .catch(() => null);

    if (!channels) return;

    for (const channel of channels.values()) {

      if (!channel) continue;

      if (channel.type !== ChannelType.GuildText) {
        continue;
      }

      if (!channel.topic) continue;

      if (!channel.topic.includes("ticketOwner:")) {
        continue;
      }

      if (!channel.topic.includes("expiresAt:")) {
        continue;
      }

      if (channel.topic.includes("locked:true")) {
        continue;
      }

      const match = channel.topic.match(/expiresAt:(\d+)/);

      if (!match) continue;

      const expiresAt = Number(match[1]);

      if (Date.now() >= expiresAt) {

        try {

          await lockTicketChannel(channel);

          await channel.setTopic(
            `${channel.topic} locked:true`
          );

        } catch (error) {

          console.error("Ticket cleanup error:", error);

        }
      }
    }
  }
};
