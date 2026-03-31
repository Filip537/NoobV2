const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const fs = require("fs");

// store preview data
const pendingChanges = new Map();

// store ticket panel config
const PANEL_FILE = "./panel.json";

function loadPanel() {
  if (!fs.existsSync(PANEL_FILE)) {
    fs.writeFileSync(PANEL_FILE, JSON.stringify({
      title: "Support Ticket",
      description: "Click the button below",
      button: "Create Ticket"
    }, null, 2));
  }
  return JSON.parse(fs.readFileSync(PANEL_FILE));
}

function savePanel(data) {
  fs.writeFileSync(PANEL_FILE, JSON.stringify(data, null, 2));
}

module.exports = {

  pendingChanges,

  // ================= MAIN =================
  async execute(interaction, adminRole) {

    if (!interaction.member.roles.cache.has(adminRole)) {
      return interaction.reply({
        content: "❌ Admin only.",
        ephemeral: true
      });
    }

    const guild = interaction.guild;

    const embed = new EmbedBuilder()
      .setColor("Blurple")
      .setTitle("NoobV2 Server")
      .setDescription(
        `Members: **${guild.memberCount}**\nRoles: **${guild.roles.cache.size}**`
      );

    const menu = new StringSelectMenuBuilder()
      .setCustomId("settings_menu")
      .setPlaceholder("Select category")
      .addOptions([
        { label: "Server Info", value: "server" },
        { label: "Customize Bot", value: "bot" },
        { label: "Server Configs", value: "config" },
        { label: "Panel Configs", value: "panel" }
      ]);

    return interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  },

  // ================= MENU =================
  async handleMenu(interaction) {

    const choice = interaction.values[0];

    // 🔹 CUSTOMIZE BOT
    if (choice === "bot") {

      const modal = new ModalBuilder()
        .setCustomId("bot_modal")
        .setTitle("Customize NoobV2");

      const name = new TextInputBuilder()
        .setCustomId("name")
        .setLabel("Bot Name")
        .setStyle(TextInputStyle.Short);

      const avatar = new TextInputBuilder()
        .setCustomId("avatar")
        .setLabel("Avatar URL")
        .setStyle(TextInputStyle.Short);

      modal.addComponents(
        new ActionRowBuilder().addComponents(name),
        new ActionRowBuilder().addComponents(avatar)
      );

      return interaction.showModal(modal);
    }

    // 🔹 PANEL CONFIGS
    if (choice === "panel") {

      const panelMenu = new StringSelectMenuBuilder()
        .setCustomId("panel_menu")
        .setPlaceholder("Panel Configs")
        .addOptions([
          { label: "Ticket Editor", value: "ticket_edit" }
        ]);

      return interaction.update({
        content: "🎫 Panel Configs",
        embeds: [],
        components: [new ActionRowBuilder().addComponents(panelMenu)]
      });
    }

    return interaction.update({
      content: `${choice} coming soon...`,
      embeds: [],
      components: []
    });
  },

  // ================= PANEL MENU =================
  async handlePanelMenu(interaction) {

    if (interaction.values[0] === "ticket_edit") {

      const panel = loadPanel();

      const embed = new EmbedBuilder()
        .setTitle("🎫 Ticket Panel Preview")
        .setDescription(panel.description)
        .setColor("Blue");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("edit_ticket")
          .setLabel("Edit Panel")
          .setStyle(ButtonStyle.Primary)
      );

      return interaction.update({
        embeds: [embed],
        components: [row]
      });
    }
  },

  // ================= MODAL =================
  async handleModal(interaction) {

    // 🔹 BOT SETTINGS
    if (interaction.customId === "bot_modal") {

      const name = interaction.fields.getTextInputValue("name");
      const avatar = interaction.fields.getTextInputValue("avatar");

      pendingChanges.set(interaction.user.id, { name, avatar });

      const preview = new EmbedBuilder()
        .setTitle("⚠️ Preview Changes")
        .setColor("Yellow");

      if (avatar) preview.setThumbnail(avatar);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("confirm_bot")
          .setLabel("Apply")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("cancel_bot")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({
        embeds: [preview],
        components: [row],
        ephemeral: true
      });
    }

    // 🔹 TICKET EDIT
    if (interaction.customId === "ticket_modal") {

      const title = interaction.fields.getTextInputValue("title");
      const desc = interaction.fields.getTextInputValue("desc");
      const button = interaction.fields.getTextInputValue("button");

      const data = { title, description: desc, button };

      savePanel(data);

      return interaction.reply({
        content: "✅ Ticket panel updated!",
        ephemeral: true
      });
    }
  },

  // ================= BUTTON =================
  async handleButton(interaction, client) {

    // 🔹 APPLY BOT
    if (interaction.customId === "confirm_bot") {

      const data = pendingChanges.get(interaction.user.id);

      try {
        if (data.name) await client.user.setUsername(data.name);
        if (data.avatar) await client.user.setAvatar(data.avatar);

        return interaction.update({
          content: "✅ Bot updated!",
          embeds: [],
          components: []
        });

      } catch {
        return interaction.update({
          content: "❌ Failed (rate limit or bad URL).",
          embeds: [],
          components: []
        });
      }
    }

    if (interaction.customId === "cancel_bot") {
      return interaction.update({
        content: "❌ Cancelled",
        embeds: [],
        components: []
      });
    }

    // 🔹 EDIT TICKET PANEL
    if (interaction.customId === "edit_ticket") {

      const modal = new ModalBuilder()
        .setCustomId("ticket_modal")
        .setTitle("Edit Ticket Panel");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("title")
            .setLabel("Panel Title")
            .setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("desc")
            .setLabel("Description")
            .setStyle(TextInputStyle.Paragraph)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("button")
            .setLabel("Button Text")
            .setStyle(TextInputStyle.Short)
        )
      );

      return interaction.showModal(modal);
    }
  }
};