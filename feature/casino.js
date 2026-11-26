const fs = require("fs");
const path = require("path");

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} = require("discord.js");

// ==========================================
// DASHBOARD CONFIGURATION
// ==========================================

const CHANNEL = "1575351151057051668";

const FILE = path.join(
  __dirname,
  "..",
  "ticketConfig.json"
);

const BANNER =
  "https://media.discordapp.net/attachments/1413401200728084550/1452451475014811851/F84FD9FD-0DD1-49D3-B755-1FDB60F0E455.jpg";

// ==========================================
// DEFAULT SETTINGS
// ==========================================

const defaults = {
  public: {
    title: "NoobV2 Ticket Center",
    description:
      "Click **Create Ticket** to contact our team. Application forms are available inside your ticket. Please only create a ticket for a valid reason.",
    color: "#F1C40F",
    image: "",
    footer: ""
  },

  welcome: {
    title: "Welcome to your ticket",
    description:
      "**Applications**\nSelect a form from the dropdown below if you wish to apply.\n\n**Other issues**\nPlease describe your issue directly in this ticket and wait for staff.",
    color: "#F1C40F",
    image: "",
    footer: ""
  },

  dashboard: {
    title: "Ticket Dashboard",
    description:
      "Manage and customize the NoobV2 ticket system using the configuration options below.\n\n" +
      "**Ticket Panel**\n" +
      "Customize embed messages, buttons and appearance.\n\n" +
      "**Ticket Forms**\n" +
      "Manage application forms and dropdown options.\n\n" +
      "**Ticket Settings**\n" +
      "Configure ticket categories, permissions and logging.\n\n" +
      "All configuration changes are saved automatically.",
    color: "#F1C40F",
    image: BANNER,
    footer: "NoobV2 | Administration Dashboard"
  },

  buttons: {
    create: {
      label: "Create Ticket",
      style: "Secondary"
    },

    close: {
      label: "Close Ticket",
      style: "Danger"
    },

    links: []
  },

  forms: {
    admin: {
      label: "Admin Form",
      description: "Apply for an Admin position",
      text: ""
    },

    support: {
      label: "Support Form",
      description: "Apply for a Support position",
      text: ""
    }
  },

  placeholder: "Select an application form",

  category: "1442702423885086781",
  adminRole: "1411991650573484073",
  supportRole: "1483338429675868203",
  log: "1487791856216571915",

  dashboardMessage: ""
};

// ==========================================
// CONFIGURATION STORAGE
// ==========================================

function config() {
  const base = JSON.parse(
    JSON.stringify(defaults)
  );

  if (!fs.existsSync(FILE)) {
    return base;
  }

  const saved = JSON.parse(
    fs.readFileSync(FILE, "utf8")
  );

  return {
    ...base,
    ...saved
  };
}

function save(settings) {
  fs.writeFileSync(
    FILE + ".tmp",
    JSON.stringify(settings, null, 2)
  );

  fs.renameSync(
    FILE + ".tmp",
    FILE
  );
}

// ==========================================
// EMBED BUILDER
// ==========================================

function embed(guild, key) {
  const settings = config()[key];

  const result = new EmbedBuilder()
    .setTitle(settings.title)
    .setDescription(settings.description)
    .setColor(
      parseInt(
        settings.color.slice(1),
        16
      )
    );

  const icon = guild?.iconURL({
    size: 256
  });

  if (icon) {
    result.setThumbnail(icon);
  }

  if (settings.image) {
    result.setImage(settings.image);
  }

  if (settings.footer) {
    result.setFooter({
      text: settings.footer
    });
  }

  return result;
}

// ==========================================
// TICKET BUTTON BUILDER
// ==========================================

function button(key) {
  const settings = config().buttons[key];

  return new ButtonBuilder()
    .setCustomId(
      key === "create"
        ? "create_ticket"
        : "close_ticket"
    )
    .setLabel(settings.label)
    .setStyle(
      ButtonStyle[settings.style]
    );
}

// ==========================================
// PUBLIC PANEL BUTTONS
// ==========================================

function publicRows() {
  const settings = config();

  const buttons = [
    button("create")
  ];

  for (const link of settings.buttons.links) {
    buttons.push(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel(link.label)
        .setURL(link.url)
    );
  }

  return [
    new ActionRowBuilder()
      .addComponents(...buttons)
  ];
}

// ==========================================
// DASHBOARD OPTIONS
// ==========================================

const actions = [
  ["public", "Edit Public Panel"],
  ["welcome", "Edit Ticket Welcome"],
  ["dashboard", "Edit Dashboard Embed"],
  ["create", "Edit Create Button"],
  ["close", "Edit Close Button"],
  ["linkadd", "Add Link Button"],
  ["linkremove", "Remove Link Button"],
  ["admin", "Edit Admin Form"],
  ["support", "Edit Support Form"],
  ["formadd", "Add Custom Form"],
  ["formremove", "Remove Form"],
  ["placeholder", "Edit Dropdown Placeholder"],
  ["settings", "Ticket Settings"],
  ["preview", "Preview Public Panel"],
  ["refresh", "Publish Changes"]
];

// ==========================================
// BUILD DASHBOARD
// ==========================================

function dashboard(guild) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("td:menu")
    .setPlaceholder("Select a configuration")
    .addOptions(
      actions.map(([value, label]) => ({
        value,
        label
      }))
    );

  return {
    embeds: [
      embed(guild, "dashboard")
    ],

    components: [
      new ActionRowBuilder()
        .addComponents(menu)
    ]
  };
}

// ==========================================
// AUTOMATIC DASHBOARD PUBLISHING
// ==========================================

async function start(client) {
  const channel = await client.channels.fetch(
    CHANNEL
  );

  if (!channel?.isTextBased()) {
    throw new Error(
      "Ticket Dashboard channel unavailable."
    );
  }

  const settings = config();

  let message = null;

  if (settings.dashboardMessage) {
    message = await channel.messages
      .fetch(settings.dashboardMessage)
      .catch(error => {
        if (error.code === 10008) {
          return null;
        }

        throw error;
      });
  }

  // Find existing dashboard to prevent duplicates.

  if (!message) {
    const recent = await channel.messages.fetch({
      limit: 50
    });

    message = recent.find(msg =>
      msg.author.id === client.user.id &&
      msg.components.some(row =>
        row.components.some(
          component =>
            component.customId === "td:menu"
        )
      )
    );
  }

  if (message) {
    await message.edit(
      dashboard(channel.guild)
    );

    console.log(
      "[Ticket Dashboard] Existing panel updated."
    );
  } else {
    message = await channel.send(
      dashboard(channel.guild)
    );

    console.log(
      "[Ticket Dashboard] New panel published."
    );
  }

  const latest = config();

  latest.dashboardMessage = message.id;

  save(latest);
}

// ==========================================
// MODAL INPUT BUILDER
// ==========================================

function field(
  id,
  label,
  value = "",
  max = 100,
  paragraph = false,
  required = true
) {
  const input = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(
      paragraph
        ? TextInputStyle.Paragraph
        : TextInputStyle.Short
    )
    .setMaxLength(max)
    .setRequired(required);

  if (value) {
    input.setValue(
      String(value).slice(0, max)
    );
  }

  return new ActionRowBuilder()
    .addComponents(input);
}

// ==========================================
// URL VALIDATION
// ==========================================

function url(value) {
  if (!value) return "";

  const parsed = new URL(value);

  if (
    !["https:", "http:"].includes(
      parsed.protocol
    )
  ) {
    throw new Error(
      "Please use a valid HTTP or HTTPS URL."
    );
  }

  return value;
}

// ==========================================
// BUTTON STYLE VALIDATION
// ==========================================

function style(value) {
  const validStyles = [
    "Primary",
    "Secondary",
    "Success",
    "Danger"
  ];

  const selected = validStyles.find(
    item =>
      item.toLowerCase() === value.toLowerCase()
  );

  if (!selected) {
    throw new Error(
      "Available styles: Primary, Secondary, Success, Danger."
    );
  }

  return selected;
}

// ==========================================
// INTERACTION HANDLER
// ==========================================

async function handle(interaction) {
  if (
    !interaction.customId?.startsWith("td:")
  ) {
    return false;
  }

  try {
    // ======================================
    // ADMINISTRATOR PERMISSIONS
    // ======================================

    if (
      interaction.channelId !== CHANNEL ||
      !interaction.memberPermissions?.has(
        PermissionFlagsBits.Administrator
      )
    ) {
      await interaction.reply({
        content:
          "Administrator access is required to manage this dashboard.",
        ephemeral: true
      });

      return true;
    }

    const settings = config();

    // ======================================
    // DROPDOWN INTERACTIONS
    // ======================================

    if (interaction.isStringSelectMenu()) {
      const action = interaction.values[0];

      // ====================================
      // PREVIEW PUBLIC PANEL
      // ====================================

      if (action === "preview") {
        await interaction.reply({
          embeds: [
            embed(
              interaction.guild,
              "public"
            )
          ],
          ephemeral: true
        });

        return true;
      }

      // ====================================
      // PUBLISH CONFIGURATION
      // ====================================

      if (action === "refresh") {
        await interaction.deferReply({
          ephemeral: true
        });

        await require("./ticket.js")
          .refreshAllTicketPanels(
            interaction.client
          );

        await start(interaction.client);

        await interaction.editReply(
          "All registered ticket panels have been refreshed."
        );

        return true;
      }

      let fields = [];

      // ====================================
      // EMBED CUSTOMIZATION
      // ====================================

      if (
        [
          "public",
          "welcome",
          "dashboard"
        ].includes(action)
      ) {
        const current = settings[action];

        fields = [
          field(
            "title",
            "Embed Title",
            current.title,
            256
          ),

          field(
            "description",
            "Embed Description",
            current.description,
            4000,
            true
          ),

          field(
            "color",
            "Embed Colour (Hex)",
            current.color,
            7
          ),

          field(
            "image",
            "Image URL (Blank to remove)",
            current.image,
            1000,
            false,
            false
          ),

          field(
            "footer",
            "Embed Footer",
            current.footer,
            500,
            false,
            false
          )
        ];
      }

      // ====================================
      // BUTTON CUSTOMIZATION
      // ====================================

      else if (
        ["create", "close"].includes(action)
      ) {
        fields = [
          field(
            "label",
            "Button Label",
            settings.buttons[action].label,
            80
          ),

          field(
            "style",
            "Primary / Secondary / Success / Danger",
            settings.buttons[action].style,
            20
          )
        ];
      }

      // ====================================
      // ADD LINK BUTTON
      // ====================================

      else if (action === "linkadd") {
        fields = [
          field(
            "label",
            "Button Label",
            "",
            80
          ),

          field(
            "url",
            "Destination URL",
            "",
            512
          )
        ];
      }

      // ====================================
      // REMOVE LINK BUTTON
      // ====================================

      else if (action === "linkremove") {
        fields = [
          field(
            "label",
            "Exact Button Label",
            "",
            80
          )
        ];
      }

      // ====================================
      // APPLICATION FORM CUSTOMIZATION
      // ====================================

      else if (
        [
          "admin",
          "support",
          "formadd"
        ].includes(action)
      ) {
        const form =
          settings.forms[action] || {};

        fields = [
          field(
            "label",
            "Dropdown Label",
            form.label,
            100
          ),

          field(
            "description",
            "Dropdown Description",
            form.description,
            100
          ),

          field(
            "text",
            "Full Form Text ({user} mentions applicant)",
            form.text,
            1800,
            true,
            false
          )
        ];

        if (action === "formadd") {
          fields.unshift(
            field(
              "key",
              "Unique Form ID (Letters and numbers)",
              "",
              30
            )
          );
        }
      }

      // ====================================
      // REMOVE APPLICATION FORM
      // ====================================

      else if (action === "formremove") {
        fields = [
          field(
            "key",
            "Form ID (admin, support or custom ID)",
            "",
            30
          )
        ];
      }

      // ====================================
      // DROPDOWN PLACEHOLDER
      // ====================================

      else if (action === "placeholder") {
        fields = [
          field(
            "text",
            "Dropdown Placeholder",
            settings.placeholder,
            100
          )
        ];
      }

      // ====================================
      // TICKET SETTINGS
      // ====================================

      else if (action === "settings") {
        fields = [
          field(
            "category",
            "Ticket Category ID",
            settings.category,
            20
          ),

          field(
            "adminRole",
            "Administrator Role ID",
            settings.adminRole,
            20
          ),

          field(
            "supportRole",
            "Support Role ID",
            settings.supportRole,
            20
          ),

          field(
            "log",
            "Ticket Log Channel ID",
            settings.log,
            20
          )
        ];
      }

      else {
        return true;
      }

      const modal = new ModalBuilder()
        .setCustomId("td:save:" + action)
        .setTitle(
          actions.find(
            item => item[0] === action
          )[1]
        )
        .addComponents(...fields);

      await interaction.showModal(modal);

      return true;
    }

    // ======================================
    // MODAL SUBMISSION HANDLER
    // ======================================

    if (interaction.isModalSubmit()) {
      const action =
        interaction.customId.split(":")[2];

      const get = key =>
        interaction.fields
          .getTextInputValue(key)
          .trim();

      await interaction.deferReply({
        ephemeral: true
      });

      // ====================================
      // SAVE EMBED CONFIGURATION
      // ====================================

      if (
        [
          "public",
          "welcome",
          "dashboard"
        ].includes(action)
      ) {
        const color = get("color");

        if (
          !/^#[0-9a-f]{6}$/i.test(color)
        ) {
          throw new Error(
            "Invalid hexadecimal colour. Example: #F1C40F"
          );
        }

        settings[action] = {
          title: get("title"),
          description: get("description"),
          color,
          image: url(get("image")),
          footer: get("footer")
        };
      }

      // ====================================
      // SAVE BUTTON CONFIGURATION
      // ====================================

      else if (
        ["create", "close"].includes(action)
      ) {
        settings.buttons[action] = {
          label: get("label"),
          style: style(get("style"))
        };
      }

      // ====================================
      // SAVE NEW LINK BUTTON
      // ====================================

      else if (action === "linkadd") {
        if (
          settings.buttons.links.length >= 4
        ) {
          throw new Error(
            "A maximum of four additional link buttons is allowed."
          );
        }

        if (!get("url")) {
          throw new Error(
            "A destination URL is required."
          );
        }

        settings.buttons.links.push({
          label: get("label"),
          url: url(get("url"))
        });
      }

      // ====================================
      // REMOVE LINK BUTTON
      // ====================================

      else if (action === "linkremove") {
        const label = get("label");

        const exists =
          settings.buttons.links.some(
            item => item.label === label
          );

        if (!exists) {
          throw new Error(
            "The specified button could not be found."
          );
        }

        settings.buttons.links =
          settings.buttons.links.filter(
            item => item.label !== label
          );
      }

      // ====================================
      // SAVE APPLICATION FORM
      // ====================================

      else if (
        [
          "admin",
          "support",
          "formadd"
        ].includes(action)
      ) {
        const key =
          action === "formadd"
            ? get("key").toLowerCase()
            : action;

        if (
          !/^[a-z0-9]{1,30}$/.test(key)
        ) {
          throw new Error(
            "The form ID must contain only letters and numbers."
          );
        }

        if (
          action === "formadd" &&
          settings.forms[key]
        ) {
          throw new Error(
            "This form ID already exists."
          );
        }

        if (
          !settings.forms[key] &&
          Object.keys(settings.forms).length >= 25
        ) {
          throw new Error(
            "A maximum of 25 forms is allowed."
          );
        }

        if (
          !get("text") &&
          !["admin", "support"].includes(key)
        ) {
          throw new Error(
            "Form text is required."
          );
        }

        settings.forms[key] = {
          label: get("label"),
          description: get("description"),
          text: get("text")
        };
      }

      // ====================================
      // REMOVE APPLICATION FORM
      // ====================================

      else if (action === "formremove") {
        const key = get("key").toLowerCase();

        if (!settings.forms[key]) {
          throw new Error(
            "The specified form could not be found."
          );
        }

        delete settings.forms[key];
      }

      // ====================================
      // SAVE DROPDOWN PLACEHOLDER
      // ====================================

      else if (action === "placeholder") {
        settings.placeholder = get("text");
      }

      // ====================================
      // SAVE TICKET SETTINGS
      // ====================================

      else if (action === "settings") {
        const keys = [
          "category",
          "adminRole",
          "supportRole",
          "log"
        ];

        for (const key of keys) {
          const value = get(key);

          if (
            !/^\d{17,20}$/.test(value)
          ) {
            throw new Error(
              "Invalid Discord ID: " + key
            );
          }

          if (key.endsWith("Role")) {
            const role =
              await interaction.guild.roles.fetch(
                value
              );

            if (
              !role ||
              role.id === interaction.guild.id
            ) {
              throw new Error(
                "Invalid role: " + key
              );
            }
          } else {
            const channel =
              await interaction.guild.channels.fetch(
                value
              );

            if (
              !channel ||
              (
                key === "category"
                  ? channel.type !== 4
                  : !channel.isTextBased()
              )
            ) {
              throw new Error(
                "Invalid channel: " + key
              );
            }
          }

          settings[key] = value;
        }
      }

      else {
        throw new Error(
          "Unknown configuration option."
        );
      }

      // ====================================
      // APPLY CONFIGURATION
      // ====================================

      save(settings);

      await require("./ticket.js")
        .refreshAllTicketPanels(
          interaction.client
        );

      await start(interaction.client);

      await interaction.editReply(
        "Configuration saved successfully.\n\n" +
        "All registered ticket panels have been refreshed. Newly created tickets will use the updated configuration."
      );

      return true;
    }

    return true;

  } catch (error) {
    console.error(
      "[Ticket Dashboard]",
      error
    );

    const content =
      "Unable to complete action: " +
      String(error.message).slice(0, 500);

    if (
      interaction.deferred ||
      interaction.replied
    ) {
      await interaction.editReply({
        content
      }).catch(() => {});
    } else {
      await interaction.reply({
        content,
        ephemeral: true
      }).catch(() => {});
    }

    return true;
  }
}

// ==========================================
// RETIRED CASINO COMMANDS
// ==========================================

async function handleCommand(interaction) {
  if (!interaction.isChatInputCommand()) {
    return false;
  }

  if (
    !["coinflip", "blackjack"].includes(
      interaction.commandName
    )
  ) {
    return false;
  }

  await interaction.reply({
    content:
      "This feature has been retired.",
    ephemeral: true
  });

  return true;
}

// ==========================================
// MODULE EXPORTS
// ==========================================

module.exports = {
  config,
  embed,
  button,
  publicRows,
  start,
  handle,
  handleCommand,

  handleButton: async () => false
};
