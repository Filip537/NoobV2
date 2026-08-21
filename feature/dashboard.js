const fs = require("fs");
const path = require("path");

const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");

const CONFIG_FILE = path.join(__dirname, "..", "dashboardConfig.json");

const DEFAULT_CONFIG = {
  disabledCommands: [],

  dashboard: {
    title: "NoobV2 Administrator Dashboard",
    accentColor: 0x5865f2,
  },

  serverInfo: {
    title: "Server Information",
    description: "Welcome to the server.",
    rulesChannelId: "",
    supportChannelId: "",
    website: "",
  },

  tickets: {
    panels: [],
    types: [],
  },

  audit: [],
};

// =============================
// CONFIG
// =============================

function ensureConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify(DEFAULT_CONFIG, null, 2)
    );
  }
}

function loadConfig() {
  ensureConfig();

  try {
    const data = JSON.parse(
      fs.readFileSync(CONFIG_FILE, "utf8")
    );

    return {
      ...DEFAULT_CONFIG,
      ...data,

      dashboard: {
        ...DEFAULT_CONFIG.dashboard,
        ...(data.dashboard || {}),
      },

      serverInfo: {
        ...DEFAULT_CONFIG.serverInfo,
        ...(data.serverInfo || {}),
      },

      tickets: {
        panels: data.tickets?.panels || [],
        types: data.tickets?.types || [],
      },

      audit: data.audit || [],
      disabledCommands: data.disabledCommands || [],
    };
  } catch (err) {
    console.error("Dashboard config load error:", err);

    return structuredClone(DEFAULT_CONFIG);
  }
}

function saveConfig(config) {
  fs.writeFileSync(
    CONFIG_FILE,
    JSON.stringify(config, null, 2)
  );
}

function addAudit(config, interaction, action) {
  config.audit = config.audit || [];

  config.audit.unshift({
    action,
    userId: interaction.user.id,
    userTag: interaction.user.tag,
    at: Date.now(),
  });

  config.audit = config.audit.slice(0, 50);
}

// =============================
// ADMIN CHECK
// =============================

function isAdmin(interaction) {
  return Boolean(
    interaction.inGuild() &&
      interaction.member?.permissions?.has(
        PermissionFlagsBits.Administrator
      )
  );
}

function denied(interaction) {
  const payload = {
    content: "❌ Administrator only.",
    ephemeral: true,
  };

  if (interaction.deferred || interaction.replied) {
    return interaction.followUp(payload);
  }

  return interaction.reply(payload);
}

// =============================
// MAIN DASHBOARD
// =============================

function dashboardEmbed(client, guild, config) {
  const disabled = config.disabledCommands.length;
  const ticketTypes = config.tickets.types.length;
  const ticketPanels = config.tickets.panels.length;

  return new EmbedBuilder()
    .setColor(
      config.dashboard.accentColor || 0x5865f2
    )

    .setAuthor({
      name:
        config.dashboard.title ||
        "NoobV2 Administrator Dashboard",

      iconURL: client.user.displayAvatarURL(),
    })

    .setTitle("Control Center")

    .setDescription(
      "Manage the bot and server from one administrator panel.\n" +
        "Use the dropdown below to open a control section."
    )

    .addFields(
      {
        name: "🤖 Bot",
        value:
          `**Username:** ${client.user.username}\n` +
          `**Server Nickname:** ${
            guild.members.me?.displayName ||
            client.user.username
          }`,
        inline: true,
      },

      {
        name: "⚙️ Commands",
        value:
          `**Disabled:** ${disabled}\n` +
          `**Status:** ${
            disabled
              ? "Custom restrictions active"
              : "All enabled"
          }`,
        inline: true,
      },

      {
        name: "🎫 Tickets",
        value:
          `**Types:** ${ticketTypes}\n` +
          `**Dashboard Panels:** ${ticketPanels}`,
        inline: true,
      },

      {
        name: "🛡️ Access",
        value: "Administrator permission required",
        inline: true,
      },

      {
        name: "💾 Storage",
        value: "`dashboardConfig.json`",
        inline: true,
      },

      {
        name: "🟢 Dashboard",
        value: "Online",
        inline: true,
      }
    )

    .setFooter({
      text: "NoobV2 • Administrator Dashboard",
    })

    .setTimestamp();
}

function dashboardComponents() {
  const menu =
    new StringSelectMenuBuilder()
      .setCustomId("dash_main_menu")
      .setPlaceholder(
        "Choose an administrator section"
      )
      .addOptions(
        {
          label: "Bot Identity",
          description:
            "Nickname, username and avatar",
          value: "identity",
          emoji: "🤖",
        },

        {
          label: "Command Manager",
          description:
            "Enable or disable commands",
          value: "commands",
          emoji: "⚙️",
        },

        {
          label: "Ticket Studio",
          description:
            "Create ticket types and panels",
          value: "tickets",
          emoji: "🎫",
        },

        {
          label: "Server Information",
          description:
            "Edit and publish server info",
          value: "serverinfo",
          emoji: "📘",
        },

        {
          label: "Dashboard Settings",
          description:
            "Dashboard appearance and audit log",
          value: "dashboard",
          emoji: "🧰",
        }
      );

  const refresh =
    new ButtonBuilder()
      .setCustomId("dash_refresh")
      .setLabel("Refresh")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Secondary);

  const status =
    new ButtonBuilder()
      .setCustomId("dash_status")
      .setLabel("System Status")
      .setEmoji("📊")
      .setStyle(ButtonStyle.Primary);

  return [
    new ActionRowBuilder().addComponents(menu),

    new ActionRowBuilder().addComponents(
      refresh,
      status
    ),
  ];
}

// =============================
// EMBEDS
// =============================

function sectionEmbed(
  title,
  description,
  color = 0x5865f2
) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: "NoobV2 Administrator Dashboard",
    })
    .setTimestamp();
}

// =============================
// BUTTON ROWS
// =============================

function identityRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(
          "dash_identity_nickname"
        )
        .setLabel("Edit Nickname")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId(
          "dash_identity_username"
        )
        .setLabel("Edit Username")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId(
          "dash_identity_avatar"
        )
        .setLabel("Edit Avatar")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function commandRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(
          "dash_command_disable"
        )
        .setLabel("Disable Command")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId(
          "dash_command_enable"
        )
        .setLabel("Enable Command")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("dash_command_edit")
        .setLabel("Edit Description")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("dash_command_list")
        .setLabel("Disabled List")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function ticketRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(
          "dash_ticket_type_create"
        )
        .setLabel("Create Ticket Type")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(
          "dash_ticket_type_edit"
        )
        .setLabel("Edit Ticket Type")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId(
          "dash_ticket_type_remove"
        )
        .setLabel("Remove Ticket Type")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId(
          "dash_ticket_panel_create"
        )
        .setLabel("Create Ticket Panel")
        .setStyle(ButtonStyle.Secondary)
    ),

    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("dash_ticket_list")
        .setLabel("View Ticket Setup")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function serverInfoRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("dash_info_edit")
        .setLabel("Edit Server Info")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("dash_info_publish")
        .setLabel("Publish Info Panel")
        .setStyle(ButtonStyle.Success)
    ),
  ];
}

function dashboardSettingRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("dash_design_edit")
        .setLabel("Edit Dashboard Design")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("dash_audit")
        .setLabel("Audit Log")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("dash_export")
        .setLabel("Config Summary")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

// =============================
// MODAL HELPERS
// =============================

function textInput(
  id,
  label,
  style = TextInputStyle.Short,
  required = true,
  placeholder = "",
  value = ""
) {
  const input =
    new TextInputBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setStyle(style)
      .setRequired(required);

  if (placeholder) {
    input.setPlaceholder(placeholder);
  }

  if (value) {
    input.setValue(
      String(value).slice(0, 4000)
    );
  }

  return input;
}

function simpleModal(
  id,
  title,
  inputs
) {
  return new ModalBuilder()
    .setCustomId(id)
    .setTitle(title)
    .addComponents(
      ...inputs.map((input) =>
        new ActionRowBuilder().addComponents(
          input
        )
      )
    );
}

// =============================
// SEND DASHBOARD
// =============================

async function sendDashboard(
  interaction,
  client
) {
  if (!isAdmin(interaction)) {
    return denied(interaction);
  }

  const channel =
    interaction.options.getChannel(
      "channel",
      true
    );

  if (!channel?.isTextBased?.()) {
    return interaction.reply({
      content:
        "❌ Please choose a text channel.",
      ephemeral: true,
    });
  }

  const config = loadConfig();

  await channel.send({
    embeds: [
      dashboardEmbed(
        client,
        interaction.guild,
        config
      ),
    ],

    components: dashboardComponents(),
  });

  addAudit(
    config,
    interaction,
    `Sent dashboard to #${
      channel.name || channel.id
    }`
  );

  saveConfig(config);

  return interaction.reply({
    content:
      `✅ Administrator dashboard sent to ${channel}.`,
    ephemeral: true,
  });
}

// =============================
// COMMAND DISABLE CHECK
// =============================

function isCommandDisabled(
  commandName
) {
  if (!commandName) return false;

  const config = loadConfig();

  return config.disabledCommands.includes(
    commandName.toLowerCase()
  );
}

// =============================
// MAIN MENU
// =============================

async function showMainMenu(
  interaction,
  client
) {
  const config = loadConfig();

  return interaction.update({
    embeds: [
      dashboardEmbed(
        client,
        interaction.guild,
        config
      ),
    ],

    components: dashboardComponents(),
  });
}

async function handleMenu(
  interaction,
  client
) {
  const value =
    interaction.values[0];

  const config = loadConfig();

  if (value === "identity") {
    return interaction.reply({
      embeds: [
        sectionEmbed(
          "🤖 Bot Identity",

          "Change how the bot appears in this server.\n\n" +
            "**Nickname** changes only in this server.\n" +
            "**Username** and **avatar** affect the bot account globally and may be rate-limited by Discord."
        ),
      ],

      components: identityRows(),
      ephemeral: true,
    });
  }

  if (value === "commands") {
    return interaction.reply({
      embeds: [
        sectionEmbed(
          "⚙️ Command Manager",

          "Disable a command without deleting its slash-command registration.\n\n" +

            `**Currently disabled:** ${
              config.disabledCommands.length
                ? config.disabledCommands
                    .map(
                      (x) =>
                        `\`/${x}\``
                    )
                    .join(", ")
                : "None"
            }`
        ),
      ],

      components: commandRows(),
      ephemeral: true,
    });
  }

  if (value === "tickets") {
    return interaction.reply({
      embeds: [
        sectionEmbed(
          "🎫 Ticket Studio",

          "Build extra dashboard-managed ticket types and publish additional ticket panels.\n\n" +
            "Each ticket type can have its own label, description and category ID."
        ),
      ],

      components: ticketRows(),
      ephemeral: true,
    });
  }

  if (value === "serverinfo") {
    const info =
      config.serverInfo;

    return interaction.reply({
      embeds: [
        sectionEmbed(
          "📘 Server Information",

          `**Title:** ${info.title}\n` +
            `**Description:** ${info.description}\n` +
            `**Rules:** ${
              info.rulesChannelId
                ? `<#${info.rulesChannelId}>`
                : "Not set"
            }\n` +
            `**Support:** ${
              info.supportChannelId
                ? `<#${info.supportChannelId}>`
                : "Not set"
            }\n` +
            `**Website:** ${
              info.website || "Not set"
            }`
        ),
      ],

      components: serverInfoRows(),
      ephemeral: true,
    });
  }

  if (value === "dashboard") {
    return interaction.reply({
      embeds: [
        sectionEmbed(
          "🧰 Dashboard Settings",

          "Adjust the dashboard title/accent, inspect recent administrator changes, or view a configuration summary."
        ),
      ],

      components:
        dashboardSettingRows(),

      ephemeral: true,
    });
  }
}

// =============================
// CREATE TICKET PANEL
// =============================

async function createTicketPanel(
  interaction,
  client,
  config,
  channelId,
  title,
  description
) {
  const channel =
    await client.channels
      .fetch(channelId)
      .catch(() => null);

  if (!channel?.isTextBased?.()) {
    throw new Error(
      "Channel not found or not text based"
    );
  }

  const types =
    config.tickets.types.slice(
      0,
      25
    );

  if (!types.length) {
    throw new Error(
      "Create at least one dashboard ticket type first"
    );
  }

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "dash_ticket_open_menu"
      )
      .setPlaceholder(
        "Choose a ticket type"
      )
      .addOptions(
        types.map((type) => ({
          label:
            type.label.slice(0, 100),

          description:
            (
              type.description ||
              "Open a ticket"
            ).slice(0, 100),

          value: type.id,
          emoji: "🎫",
        }))
      );

  const sent =
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(
            config.dashboard
              .accentColor ||
              0x5865f2
          )

          .setTitle(
            title ||
              "Support Center"
          )

          .setDescription(
            description ||
              "Select a ticket type below to contact the team."
          )

          .setFooter({
            text:
              "NoobV2 Ticket System",
          }),
      ],

      components: [
        new ActionRowBuilder().addComponents(
          menu
        ),
      ],
    });

  config.tickets.panels.push({
    id: `${Date.now()}`,
    channelId: channel.id,
    messageId: sent.id,

    title:
      title ||
      "Support Center",

    createdAt: Date.now(),
  });
}

// =============================
// OPEN TICKET
// =============================

async function openDashboardTicket(
  interaction,
  client
) {
  const config = loadConfig();

  const type =
    config.tickets.types.find(
      (t) =>
        t.id ===
        interaction.values[0]
    );

  if (!type) {
    return interaction.reply({
      content:
        "❌ This ticket type no longer exists.",
      ephemeral: true,
    });
  }

  const guild =
    interaction.guild;

  const categoryId =
    type.categoryId || null;

  const safeName =
    interaction.user.username
      .toLowerCase()
      .replace(
        /[^a-z0-9-]/g,
        ""
      )
      .slice(0, 18) ||
    "user";

  const channel =
    await guild.channels.create({
      name:
        `ticket-${safeName}`.slice(
          0,
          90
        ),

      type:
        ChannelType.GuildText,

      parent:
        categoryId ||
        undefined,

      topic:
        `Dashboard ticket • ${type.label} • User ${interaction.user.id}`,

      permissionOverwrites: [
        {
          id:
            guild.roles.everyone.id,

          deny: [
            PermissionFlagsBits.ViewChannel,
          ],
        },

        {
          id:
            interaction.user.id,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        },

        {
          id:
            guild.members.me.id,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ],
    });

  await channel.send({
    content: `${interaction.user}`,

    embeds: [
      new EmbedBuilder()
        .setColor(
          config.dashboard
            .accentColor ||
            0x5865f2
        )

        .setTitle(
          `🎫 ${type.label}`
        )

        .setDescription(
          `${
            type.description ||
            "A staff member will assist you soon."
          }\n\n` +
            `Opened by ${interaction.user}.`
        )

        .setFooter({
          text:
            `Ticket type: ${type.id}`,
        }),
    ],

    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(
            "dash_ticket_close"
          )
          .setLabel(
            "Close Ticket"
          )
          .setEmoji("🔒")
          .setStyle(
            ButtonStyle.Danger
          )
      ),
    ],
  });

  return interaction.reply({
    content:
      `✅ Ticket created: ${channel}`,
    ephemeral: true,
  });
}

// =============================
// BUTTONS
// =============================

async function handleButton(
  interaction,
  client
) {
  const id =
    interaction.customId;

  const config =
    loadConfig();

  // REFRESH

  if (id === "dash_refresh") {
    return showMainMenu(
      interaction,
      client
    );
  }

  // STATUS

  if (id === "dash_status") {
    const uptime =
      Math.floor(
        process.uptime()
      );

    const memory =
      Math.round(
        process.memoryUsage()
          .rss /
          1024 /
          1024
      );

    return interaction.reply({
      embeds: [
        sectionEmbed(
          "📊 System Status",

          `**Bot:** Online\n` +
            `**Ping:** ${client.ws.ping}ms\n` +

            `**Uptime:** ${Math.floor(
              uptime / 3600
            )}h ${Math.floor(
              (uptime % 3600) /
                60
            )}m\n` +

            `**Memory:** ${memory} MB\n` +

            `**Guilds:** ${client.guilds.cache.size}\n` +

            `**Disabled Commands:** ${config.disabledCommands.length}`
        ),
      ],

      ephemeral: true,
    });
  }

  // BOT NICKNAME

  if (
    id ===
    "dash_identity_nickname"
  ) {
    return interaction.showModal(
      simpleModal(
        "dash_modal_nickname",

        "Edit Bot Nickname",

        [
          textInput(
            "nickname",
            "New server nickname",
            TextInputStyle.Short,
            true,
            "NoobV2"
          ),
        ]
      )
    );
  }

  // BOT USERNAME

  if (
    id ===
    "dash_identity_username"
  ) {
    return interaction.showModal(
      simpleModal(
        "dash_modal_username",

        "Edit Bot Username",

        [
          textInput(
            "username",
            "New bot username",
            TextInputStyle.Short,
            true,
            client.user.username
          ),
        ]
      )
    );
  }

  // AVATAR

  if (
    id ===
    "dash_identity_avatar"
  ) {
    return interaction.showModal(
      simpleModal(
        "dash_modal_avatar",

        "Edit Bot Avatar",

        [
          textInput(
            "avatar",
            "Direct image URL",
            TextInputStyle.Short,
            true,
            "https://example.com/avatar.png"
          ),
        ]
      )
    );
  }

  // COMMAND ENABLE/DISABLE

  if (
    id ===
      "dash_command_disable" ||
    id ===
      "dash_command_enable"
  ) {
    const action =
      id.endsWith("disable")
        ? "disable"
        : "enable";

    return interaction.showModal(
      simpleModal(
        `dash_modal_command_${action}`,

        `${
          action === "disable"
            ? "Disable"
            : "Enable"
        } Command`,

        [
          textInput(
            "command",
            "Command name (without /)",
            TextInputStyle.Short,
            true,
            "ticketpanel"
          ),
        ]
      )
    );
  }

  // EDIT COMMAND DESCRIPTION

  if (
    id ===
    "dash_command_edit"
  ) {
    return interaction.showModal(
      simpleModal(
        "dash_modal_command_edit",

        "Edit Command Description",

        [
          textInput(
            "command",
            "Command name (without /)",
            TextInputStyle.Short,
            true,
            "ticketpanel"
          ),

          textInput(
            "description",
            "New slash command description",
            TextInputStyle.Paragraph,
            true,
            "New command description"
          ),
        ]
      )
    );
  }

  // DISABLED COMMAND LIST

  if (
    id ===
    "dash_command_list"
  ) {
    return interaction.reply({
      embeds: [
        sectionEmbed(
          "🚫 Disabled Commands",

          config.disabledCommands
            .length
            ? config.disabledCommands
                .map(
                  (x, i) =>
                    `${i + 1}. /${x}`
                )
                .join("\n")
            : "No commands are disabled."
        ),
      ],

      ephemeral: true,
    });
  }

  // CREATE TICKET TYPE

  if (
    id ===
    "dash_ticket_type_create"
  ) {
    return interaction.showModal(
      simpleModal(
        "dash_modal_ticket_type_create",

        "Create Ticket Type",

        [
          textInput(
            "label",
            "Ticket label",
            TextInputStyle.Short,
            true,
            "General Support"
          ),

          textInput(
            "description",
            "Short description",
            TextInputStyle.Short,
            true,
            "Contact the administration team"
          ),

          textInput(
            "category",
            "Category ID (optional)",
            TextInputStyle.Short,
            false,
            "Discord category ID"
          ),
        ]
      )
    );
  }

  // EDIT TICKET TYPE

  if (
    id ===
    "dash_ticket_type_edit"
  ) {
    return interaction.showModal(
      simpleModal(
        "dash_modal_ticket_type_edit",

        "Edit Ticket Type",

        [
          textInput(
            "ticket",
            "Existing ticket ID or exact label",
            TextInputStyle.Short,
            true,
            "General Support"
          ),

          textInput(
            "label",
            "New label",
            TextInputStyle.Short,
            true,
            "General Support"
          ),

          textInput(
            "description",
            "New description",
            TextInputStyle.Short,
            true,
            "Contact the administration team"
          ),

          textInput(
            "category",
            "New category ID (optional)",
            TextInputStyle.Short,
            false,
            "Discord category ID"
          ),
        ]
      )
    );
  }

  // REMOVE TICKET TYPE

  if (
    id ===
    "dash_ticket_type_remove"
  ) {
    return interaction.showModal(
      simpleModal(
        "dash_modal_ticket_type_remove",

        "Remove Ticket Type",

        [
          textInput(
            "ticket",
            "Ticket type ID or exact label",
            TextInputStyle.Short,
            true,
            "General Support"
          ),
        ]
      )
    );
  }

  // CREATE PANEL

  if (
    id ===
    "dash_ticket_panel_create"
  ) {
    return interaction.showModal(
      simpleModal(
        "dash_modal_ticket_panel_create",

        "Create Ticket Panel",

        [
          textInput(
            "channel",
            "Channel ID",
            TextInputStyle.Short,
            true,
            "Channel ID"
          ),

          textInput(
            "title",
            "Panel title",
            TextInputStyle.Short,
            true,
            "Support Center"
          ),

          textInput(
            "description",
            "Panel description",
            TextInputStyle.Paragraph,
            true,
            "Choose a ticket type below."
          ),
        ]
      )
    );
  }

  // TICKET SETUP

  if (
    id ===
    "dash_ticket_list"
  ) {
    const typeText =
      config.tickets.types
        .length
        ? config.tickets.types
            .map(
              (t) =>
                `• **${t.label}** — ID: \`${t.id}\`` +
                `${
                  t.categoryId
                    ? ` — Category: <#${t.categoryId}>`
                    : ""
                }`
            )
            .join("\n")
        : "No dashboard ticket types.";

    return interaction.reply({
      embeds: [
        sectionEmbed(
          "🎫 Ticket Setup",

          `**Ticket Types (${config.tickets.types.length})**\n` +
            `${typeText}\n\n` +
            `**Published Panels:** ${config.tickets.panels.length}`
        ),
      ],

      ephemeral: true,
    });
  }

  // EDIT INFO

  if (
    id ===
    "dash_info_edit"
  ) {
    const info =
      config.serverInfo;

    return interaction.showModal(
      simpleModal(
        "dash_modal_info_edit",

        "Edit Server Information",

        [
          textInput(
            "title",
            "Panel title",
            TextInputStyle.Short,
            true,
            "",
            info.title
          ),

          textInput(
            "description",
            "Server description",
            TextInputStyle.Paragraph,
            true,
            "",
            info.description
          ),

          textInput(
            "rules",
            "Rules channel ID (optional)",
            TextInputStyle.Short,
            false,
            "",
            info.rulesChannelId
          ),

          textInput(
            "support",
            "Support channel ID (optional)",
            TextInputStyle.Short,
            false,
            "",
            info.supportChannelId
          ),

          textInput(
            "website",
            "Website / link (optional)",
            TextInputStyle.Short,
            false,
            "",
            info.website
          ),
        ]
      )
    );
  }

  // PUBLISH INFO

  if (
    id ===
    "dash_info_publish"
  ) {
    return interaction.showModal(
      simpleModal(
        "dash_modal_info_publish",

        "Publish Server Info",

        [
          textInput(
            "channel",
            "Channel ID",
            TextInputStyle.Short,
            true,
            "Channel ID"
          ),
        ]
      )
    );
  }

  // DESIGN

  if (
    id ===
    "dash_design_edit"
  ) {
    return interaction.showModal(
      simpleModal(
        "dash_modal_design",

        "Dashboard Design",

        [
          textInput(
            "title",
            "Dashboard title",
            TextInputStyle.Short,
            true,
            "",
            config.dashboard.title
          ),

          textInput(
            "color",
            "Accent hex color",
            TextInputStyle.Short,
            true,
            "#5865F2"
          ),
        ]
      )
    );
  }

  // AUDIT LOG

  if (id === "dash_audit") {
    const text =
      config.audit.length
        ? config.audit
            .slice(0, 15)
            .map(
              (a) =>
                `• <t:${Math.floor(
                  a.at / 1000
                )}:R> — <@${
                  a.userId
                }> — ${a.action}`
            )
            .join("\n")
        : "No dashboard changes recorded yet.";

    return interaction.reply({
      embeds: [
        sectionEmbed(
          "🧾 Dashboard Audit Log",
          text
        ),
      ],

      ephemeral: true,
    });
  }

  // CONFIG SUMMARY

  if (id === "dash_export") {
    return interaction.reply({
      embeds: [
        sectionEmbed(
          "💾 Configuration Summary",

          `**Disabled commands:** ${config.disabledCommands.length}\n` +
            `**Ticket types:** ${config.tickets.types.length}\n` +
            `**Ticket panels:** ${config.tickets.panels.length}\n` +
            `**Audit entries:** ${config.audit.length}\n` +
            `**Config file:** \`dashboardConfig.json\``
        ),
      ],

      ephemeral: true,
    });
  }

  // CLOSE TICKET

  if (
    id ===
    "dash_ticket_close"
  ) {
    if (
      !interaction.channel?.name?.startsWith(
        "ticket-"
      )
    ) {
      return interaction.reply({
        content:
          "❌ This is not a dashboard ticket channel.",
        ephemeral: true,
      });
    }

    await interaction.reply({
      content:
        "🔒 Ticket closing...",
      ephemeral: true,
    });

    return setTimeout(
      () =>
        interaction.channel
          .delete(
            "Dashboard ticket closed"
          )
          .catch(() => {}),

      1200
    );
  }
}

// =============================
// MODALS
// =============================

async function handleModal(
  interaction,
  client
) {
  const id =
    interaction.customId;

  const config =
    loadConfig();

  // NICKNAME

  if (
    id ===
    "dash_modal_nickname"
  ) {
    const nickname =
      interaction.fields
        .getTextInputValue(
          "nickname"
        )
        .trim();

    await interaction.guild.members.me.setNickname(
      nickname
    );

    addAudit(
      config,
      interaction,
      `Changed bot server nickname to ${nickname}`
    );

    saveConfig(config);

    return interaction.reply({
      content:
        `✅ Bot nickname changed to **${nickname}**.`,
      ephemeral: true,
    });
  }

  // USERNAME

  if (
    id ===
    "dash_modal_username"
  ) {
    const username =
      interaction.fields
        .getTextInputValue(
          "username"
        )
        .trim();

    await client.user.setUsername(
      username
    );

    addAudit(
      config,
      interaction,
      `Changed bot username to ${username}`
    );

    saveConfig(config);

    return interaction.reply({
      content:
        `✅ Bot username changed to **${username}**. Discord may rate-limit repeated username changes.`,
      ephemeral: true,
    });
  }

  // AVATAR

  if (
    id ===
    "dash_modal_avatar"
  ) {
    const avatar =
      interaction.fields
        .getTextInputValue(
          "avatar"
        )
        .trim();

    await client.user.setAvatar(
      avatar
    );

    addAudit(
      config,
      interaction,
      "Changed bot avatar"
    );

    saveConfig(config);

    return interaction.reply({
      content:
        "✅ Bot avatar updated.",
      ephemeral: true,
    });
  }

  // ENABLE / DISABLE COMMAND

  if (
    id ===
      "dash_modal_command_disable" ||
    id ===
      "dash_modal_command_enable"
  ) {
    const command =
      interaction.fields
        .getTextInputValue(
          "command"
        )
        .trim()
        .replace(/^\//, "")
        .toLowerCase();

    if (!command) {
      return interaction.reply({
        content:
          "❌ Invalid command.",
        ephemeral: true,
      });
    }

    if (
      command ===
      "senddashboard"
    ) {
      return interaction.reply({
        content:
          "❌ `/senddashboard` cannot be disabled from the dashboard.",
        ephemeral: true,
      });
    }

    if (
      id.endsWith(
        "disable"
      )
    ) {
      if (
        !config.disabledCommands.includes(
          command
        )
      ) {
        config.disabledCommands.push(
          command
        );
      }

      addAudit(
        config,
        interaction,
        `Disabled /${command}`
      );
    } else {
      config.disabledCommands =
        config.disabledCommands.filter(
          (x) =>
            x !== command
        );

      addAudit(
        config,
        interaction,
        `Enabled /${command}`
      );
    }

    saveConfig(config);

    return interaction.reply({
      content:
        `✅ \`/${command}\` is now **${
          id.endsWith(
            "disable"
          )
            ? "disabled"
            : "enabled"
        }**.`,

      ephemeral: true,
    });
  }

  // EDIT COMMAND DESCRIPTION

  if (
    id ===
    "dash_modal_command_edit"
  ) {
    const commandName =
      interaction.fields
        .getTextInputValue(
          "command"
        )
        .trim()
        .replace(/^\//, "")
        .toLowerCase();

    const description =
      interaction.fields
        .getTextInputValue(
          "description"
        )
        .trim()
        .slice(0, 100);

    const commands =
      await interaction.guild.commands.fetch();

    const command =
      commands.find(
        (cmd) =>
          cmd.name ===
          commandName
      );

    if (!command) {
      return interaction.reply({
        content:
          `❌ Slash command \`/${commandName}\` was not found in this server.`,

        ephemeral: true,
      });
    }

    await interaction.guild.commands.edit(
      command.id,
      {
        description,
      }
    );

    addAudit(
      config,
      interaction,
      `Edited /${commandName} description`
    );

    saveConfig(config);

    return interaction.reply({
      content:
        `✅ Updated \`/${commandName}\` description to: **${description}**`,

      ephemeral: true,
    });
  }

  // CREATE TICKET TYPE

  if (
    id ===
    "dash_modal_ticket_type_create"
  ) {
    const label =
      interaction.fields
        .getTextInputValue(
          "label"
        )
        .trim();

    const description =
      interaction.fields
        .getTextInputValue(
          "description"
        )
        .trim();

    const categoryId =
      interaction.fields
        .getTextInputValue(
          "category"
        )
        .trim();

    const ticketId =
      `dt_${Date.now().toString(
        36
      )}`;

    config.tickets.types.push({
      id: ticketId,
      label,
      description,
      categoryId,
    });

    config.tickets.types =
      config.tickets.types.slice(
        -25
      );

    addAudit(
      config,
      interaction,
      `Created ticket type ${label}`
    );

    saveConfig(config);

    return interaction.reply({
      content:
        `✅ Ticket type **${label}** created. ID: \`${ticketId}\``,

      ephemeral: true,
    });
  }

  // EDIT TICKET TYPE

  if (
    id ===
    "dash_modal_ticket_type_edit"
  ) {
    const query =
      interaction.fields
        .getTextInputValue(
          "ticket"
        )
        .trim()
        .toLowerCase();

    const ticketType =
      config.tickets.types.find(
        (t) =>
          t.id.toLowerCase() ===
            query ||
          t.label.toLowerCase() ===
            query
      );

    if (!ticketType) {
      return interaction.reply({
        content:
          "❌ Ticket type not found.",
        ephemeral: true,
      });
    }

    ticketType.label =
      interaction.fields
        .getTextInputValue(
          "label"
        )
        .trim();

    ticketType.description =
      interaction.fields
        .getTextInputValue(
          "description"
        )
        .trim();

    ticketType.categoryId =
      interaction.fields
        .getTextInputValue(
          "category"
        )
        .trim()
        .replace(
          /[^0-9]/g,
          ""
        );

    addAudit(
      config,
      interaction,
      `Edited ticket type ${ticketType.id}`
    );

    saveConfig(config);

    return interaction.reply({
      content:
        `✅ Ticket type \`${ticketType.id}\` updated. Existing published panels keep their old dropdown until republished.`,

      ephemeral: true,
    });
  }

  // REMOVE TICKET TYPE

  if (
    id ===
    "dash_modal_ticket_type_remove"
  ) {
    const query =
      interaction.fields
        .getTextInputValue(
          "ticket"
        )
        .trim()
        .toLowerCase();

    const before =
      config.tickets.types.length;

    config.tickets.types =
      config.tickets.types.filter(
        (t) =>
          t.id.toLowerCase() !==
            query &&
          t.label.toLowerCase() !==
            query
      );

    if (
      before ===
      config.tickets.types.length
    ) {
      return interaction.reply({
        content:
          "❌ Ticket type not found.",
        ephemeral: true,
      });
    }

    addAudit(
      config,
      interaction,
      `Removed ticket type ${query}`
    );

    saveConfig(config);

    return interaction.reply({
      content:
        "✅ Ticket type removed.",
      ephemeral: true,
    });
  }

  // CREATE TICKET PANEL

  if (
    id ===
    "dash_modal_ticket_panel_create"
  ) {
    const channelId =
      interaction.fields
        .getTextInputValue(
          "channel"
        )
        .trim()
        .replace(
          /[^0-9]/g,
          ""
        );

    const title =
      interaction.fields
        .getTextInputValue(
          "title"
        )
        .trim();

    const description =
      interaction.fields
        .getTextInputValue(
          "description"
        )
        .trim();

    try {
      await createTicketPanel(
        interaction,
        client,
        config,
        channelId,
        title,
        description
      );

      addAudit(
        config,
        interaction,
        `Published ticket panel in ${channelId}`
      );

      saveConfig(config);

      return interaction.reply({
        content:
          "✅ New ticket panel published.",
        ephemeral: true,
      });
    } catch (err) {
      return interaction.reply({
        content:
          `❌ Could not create panel: ${err.message}`,

        ephemeral: true,
      });
    }
  }

  // EDIT SERVER INFO

  if (
    id ===
    "dash_modal_info_edit"
  ) {
    config.serverInfo = {
      title:
        interaction.fields
          .getTextInputValue(
            "title"
          )
          .trim(),

      description:
        interaction.fields
          .getTextInputValue(
            "description"
          )
          .trim(),

      rulesChannelId:
        interaction.fields
          .getTextInputValue(
            "rules"
          )
          .trim()
          .replace(
            /[^0-9]/g,
            ""
          ),

      supportChannelId:
        interaction.fields
          .getTextInputValue(
            "support"
          )
          .trim()
          .replace(
            /[^0-9]/g,
            ""
          ),

      website:
        interaction.fields
          .getTextInputValue(
            "website"
          )
          .trim(),
    };

    addAudit(
      config,
      interaction,
      "Edited server information"
    );

    saveConfig(config);

    return interaction.reply({
      content:
        "✅ Server information saved.",
      ephemeral: true,
    });
  }

  // PUBLISH SERVER INFO

  if (
    id ===
    "dash_modal_info_publish"
  ) {
    const channelId =
      interaction.fields
        .getTextInputValue(
          "channel"
        )
        .trim()
        .replace(
          /[^0-9]/g,
          ""
        );

    const channel =
      await client.channels
        .fetch(channelId)
        .catch(() => null);

    if (
      !channel?.isTextBased?.()
    ) {
      return interaction.reply({
        content:
          "❌ Text channel not found.",
        ephemeral: true,
      });
    }

    const info =
      config.serverInfo;

    const lines = [
      info.description,
    ];

    if (
      info.rulesChannelId
    ) {
      lines.push(
        `\n📜 **Rules:** <#${info.rulesChannelId}>`
      );
    }

    if (
      info.supportChannelId
    ) {
      lines.push(
        `🎫 **Support:** <#${info.supportChannelId}>`
      );
    }

    if (info.website) {
      lines.push(
        `🌐 **Website:** ${info.website}`
      );
    }

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(
            config.dashboard
              .accentColor ||
              0x5865f2
          )

          .setTitle(
            info.title
          )

          .setDescription(
            lines.join("\n")
          )

          .setFooter({
            text:
              interaction.guild.name,
          }),
      ],
    });

    addAudit(
      config,
      interaction,
      `Published server info in ${channelId}`
    );

    saveConfig(config);

    return interaction.reply({
      content:
        `✅ Server information published in ${channel}.`,
      ephemeral: true,
    });
  }

  // DASHBOARD DESIGN

  if (
    id ===
    "dash_modal_design"
  ) {
    const title =
      interaction.fields
        .getTextInputValue(
          "title"
        )
        .trim();

    const colorRaw =
      interaction.fields
        .getTextInputValue(
          "color"
        )
        .trim()
        .replace("#", "");

    const color =
      /^[0-9a-fA-F]{6}$/.test(
        colorRaw
      )
        ? parseInt(
            colorRaw,
            16
          )
        : 0x5865f2;

    config.dashboard.title =
      title;

    config.dashboard.accentColor =
      color;

    addAudit(
      config,
      interaction,
      "Edited dashboard design"
    );

    saveConfig(config);

    return interaction.reply({
      content:
        "✅ Dashboard design saved. Use **Refresh** on the main panel to display it.",

      ephemeral: true,
    });
  }
}

// =============================
// INTERACTION ROUTER
// =============================

async function handleInteraction(
  interaction,
  client
) {
  const relevant =
    (interaction.isChatInputCommand() &&
      interaction.commandName ===
        "senddashboard") ||

    (interaction.customId &&
      interaction.customId.startsWith(
        "dash_"
      ));

  if (!relevant) {
    return false;
  }

  if (
    !isAdmin(interaction) &&
    interaction.customId !==
      "dash_ticket_open_menu" &&
    interaction.customId !==
      "dash_ticket_close"
  ) {
    await denied(interaction);

    return true;
  }

  try {
    // /senddashboard

    if (
      interaction.isChatInputCommand() &&
      interaction.commandName ===
        "senddashboard"
    ) {
      await sendDashboard(
        interaction,
        client
      );

      return true;
    }

    // MAIN DASHBOARD MENU

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId ===
        "dash_main_menu"
    ) {
      await handleMenu(
        interaction,
        client
      );

      return true;
    }

    // PUBLIC TICKET MENU

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId ===
        "dash_ticket_open_menu"
    ) {
      await openDashboardTicket(
        interaction,
        client
      );

      return true;
    }

    // BUTTONS

    if (interaction.isButton()) {
      await handleButton(
        interaction,
        client
      );

      return true;
    }

    // MODALS

    if (
      interaction.isModalSubmit()
    ) {
      await handleModal(
        interaction,
        client
      );

      return true;
    }
  } catch (err) {
    console.error(
      "Dashboard interaction error:",
      err
    );

    const payload = {
      content:
        `❌ Dashboard error: ${
          err.message ||
          "Unknown error"
        }`,

      ephemeral: true,
    };

    if (
      interaction.deferred ||
      interaction.replied
    ) {
      await interaction
        .followUp(payload)
        .catch(() => {});
    } else {
      await interaction
        .reply(payload)
        .catch(() => {});
    }

    return true;
  }

  return false;
}



module.exports = {
  handleInteraction,
  isCommandDisabled,
  loadConfig,
};