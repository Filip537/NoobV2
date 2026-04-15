const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType
} = require("discord.js");

const fs = require("fs");

// store preview data
const pendingChanges = new Map();

// store ticket panel config
const PANEL_FILE = "./panel.json";
const ROLE_REACTION_FILE = "./roleReactionPanels.json";

// temp builder data per user
const roleReactionDrafts = new Map();

function loadPanel() {
  if (!fs.existsSync(PANEL_FILE)) {
    fs.writeFileSync(
      PANEL_FILE,
      JSON.stringify(
        {
          title: "Support Ticket",
          description: "Click the button below",
          button: "Create Ticket"
        },
        null,
        2
      )
    );
  }
  return JSON.parse(fs.readFileSync(PANEL_FILE));
}

function savePanel(data) {
  fs.writeFileSync(PANEL_FILE, JSON.stringify(data, null, 2));
}

function loadRoleReactionPanels() {
  if (!fs.existsSync(ROLE_REACTION_FILE)) {
    fs.writeFileSync(ROLE_REACTION_FILE, "[]");
  }
  return JSON.parse(fs.readFileSync(ROLE_REACTION_FILE, "utf8"));
}

function saveRoleReactionPanels(data) {
  fs.writeFileSync(ROLE_REACTION_FILE, JSON.stringify(data, null, 2));
}

function getDefaultDraft() {
  return {
    name: "",
    channelId: "",
    messageType: "embed",
    selectionType: "reactions",
    reactions: []
  };
}

function getDraft(userId) {
  if (!roleReactionDrafts.has(userId)) {
    roleReactionDrafts.set(userId, getDefaultDraft());
  }
  return roleReactionDrafts.get(userId);
}

function buildRoleReactionEmbed(draft, guild) {
  const channelText = draft.channelId ? `<#${draft.channelId}>` : "`Not selected`";
  const reactionsText =
    draft.reactions.length > 0
      ? draft.reactions.map((r, i) => `**${i + 1}.** ${r}`).join("\n")
      : "`No reactions added yet`";

  return new EmbedBuilder()
    .setColor("DarkButNotBlack")
    .setTitle("MESSAGE SETTINGS")
    .addFields(
      {
        name: "Name",
        value: draft.name ? `\`${draft.name}\`` : "`Give it a unique name`",
        inline: false
      },
      {
        name: "Channel to post",
        value: channelText,
        inline: false
      },
      {
        name: "Message Type",
        value:
          draft.messageType === "plain"
            ? "✅ Plain Message\n⬜ Embed Message\n⬜ Existing Message"
            : draft.messageType === "existing"
            ? "⬜ Plain Message\n⬜ Embed Message\n✅ Existing Message"
            : "⬜ Plain Message\n✅ Embed Message\n⬜ Existing Message",
        inline: false
      },
      {
        name: "Selection Type",
        value:
          draft.selectionType === "buttons"
            ? "⬜ Reactions\n✅ Buttons\n⬜ Dropdowns"
            : draft.selectionType === "dropdowns"
            ? "⬜ Reactions\n⬜ Buttons\n✅ Dropdowns"
            : "✅ Reactions\n⬜ Buttons\n⬜ Dropdowns",
        inline: false
      },
      {
        name: "REACTION SETTINGS",
        value: reactionsText,
        inline: false
      }
    )
    .setFooter({ text: guild ? guild.name : "NoobV2" });
}

function buildRoleReactionComponents(draft) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("rr_set_name")
      .setLabel("Set Name")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("rr_set_channel")
      .setLabel("Set Channel")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("rr_add_reaction")
      .setLabel("Add Reaction")
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("rr_message_type")
      .setPlaceholder("Select Message Type")
      .addOptions([
        {
          label: "Plain Message",
          value: "plain",
          default: draft.messageType === "plain"
        },
        {
          label: "Embed Message",
          value: "embed",
          default: draft.messageType === "embed"
        },
        {
          label: "Existing Message",
          value: "existing",
          default: draft.messageType === "existing"
        }
      ])
  );

  const row3 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("rr_selection_type")
      .setPlaceholder("Select Selection Type")
      .addOptions([
        {
          label: "Reactions",
          value: "reactions",
          default: draft.selectionType === "reactions"
        },
        {
          label: "Buttons",
          value: "buttons",
          default: draft.selectionType === "buttons"
        },
        {
          label: "Dropdowns",
          value: "dropdowns",
          default: draft.selectionType === "dropdowns"
        }
      ])
  );

  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("rr_save")
      .setLabel("Save")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("rr_cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger)
  );

  return [row1, row2, row3, row4];
}

module.exports = {
  pendingChanges,

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

  async handleMenu(interaction) {
    const choice = interaction.values[0];

    if (choice === "server") {
      const guild = interaction.guild;

      const embed = new EmbedBuilder()
        .setColor("Blue")
        .setTitle("Server Info")
        .setDescription(
          `Members: **${guild.memberCount}**\nRoles: **${guild.roles.cache.size}**`
        );

      return interaction.update({
        embeds: [embed],
        components: []
      });
    }

    if (choice === "bot") {
      const modal = new ModalBuilder()
        .setCustomId("bot_modal")
        .setTitle("Customize NoobV2");

      const name = new TextInputBuilder()
        .setCustomId("name")
        .setLabel("Bot Name")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const avatar = new TextInputBuilder()
        .setCustomId("avatar")
        .setLabel("Avatar URL")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(name),
        new ActionRowBuilder().addComponents(avatar)
      );

      return interaction.showModal(modal);
    }

    if (choice === "config") {
      const embed = new EmbedBuilder()
        .setColor("Orange")
        .setTitle("Server Configs")
        .setDescription("Select what to edit");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("roles_reaction")
          .setLabel("Roles Reaction")
          .setStyle(ButtonStyle.Primary)
      );

      return interaction.update({
        content: "",
        embeds: [embed],
        components: [row]
      });
    }

    if (choice === "panel") {
      const panelMenu = new StringSelectMenuBuilder()
        .setCustomId("panel_menu")
        .setPlaceholder("Panel Configs")
        .addOptions([{ label: "Ticket Editor", value: "ticket_edit" }]);

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

  async handleModal(interaction) {
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

    if (interaction.customId === "rr_name_modal") {
      const draft = getDraft(interaction.user.id);
      draft.name = interaction.fields.getTextInputValue("rr_name");

      return interaction.reply({
        embeds: [buildRoleReactionEmbed(draft, interaction.guild)],
        components: buildRoleReactionComponents(draft),
        ephemeral: true
      });
    }

    if (interaction.customId === "rr_reaction_modal") {
      const draft = getDraft(interaction.user.id);
      const value = interaction.fields.getTextInputValue("rr_reaction").trim();

      if (!value) {
        return interaction.reply({
          content: "❌ Reaction cannot be empty.",
          ephemeral: true
        });
      }

      draft.reactions.push(value);

      return interaction.reply({
        embeds: [buildRoleReactionEmbed(draft, interaction.guild)],
        components: buildRoleReactionComponents(draft),
        ephemeral: true
      });
    }
  },

  async handleButton(interaction, client) {
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

    if (interaction.customId === "roles_reaction") {
      const draft = getDraft(interaction.user.id);

      return interaction.reply({
        embeds: [buildRoleReactionEmbed(draft, interaction.guild)],
        components: buildRoleReactionComponents(draft),
        ephemeral: true
      });
    }

    if (interaction.customId === "rr_set_name") {
      const modal = new ModalBuilder()
        .setCustomId("rr_name_modal")
        .setTitle("Set Panel Name");

      const input = new TextInputBuilder()
        .setCustomId("rr_name")
        .setLabel("Give it a unique name")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (interaction.customId === "rr_set_channel") {
      const row = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("rr_channel_select")
          .setPlaceholder("Select Channel")
          .setChannelTypes(
            ChannelType.GuildText,
            ChannelType.GuildAnnouncement
          )
      );

      return interaction.reply({
        content: "Select the channel to post the role reaction panel.",
        components: [row],
        ephemeral: true
      });
    }

    if (interaction.customId === "rr_add_reaction") {
      const modal = new ModalBuilder()
        .setCustomId("rr_reaction_modal")
        .setTitle("Add Reaction");

      const input = new TextInputBuilder()
        .setCustomId("rr_reaction")
        .setLabel("Emoji or reaction text")
        .setPlaceholder("Example: ✅ or <:wl:1455752235966533662>")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (interaction.customId === "rr_save") {
      const draft = getDraft(interaction.user.id);

      if (!draft.name) {
        return interaction.reply({
          content: "❌ Please set a name first.",
          ephemeral: true
        });
      }

      if (!draft.channelId) {
        return interaction.reply({
          content: "❌ Please select a channel first.",
          ephemeral: true
        });
      }

      const allPanels = loadRoleReactionPanels();

      if (allPanels.some(p => p.name.toLowerCase() === draft.name.toLowerCase())) {
        return interaction.reply({
          content: "❌ That panel name already exists. Please choose another name.",
          ephemeral: true
        });
      }

      const savedData = {
        id: Date.now().toString(),
        guildId: interaction.guild.id,
        createdBy: interaction.user.id,
        name: draft.name,
        channelId: draft.channelId,
        messageType: draft.messageType,
        selectionType: draft.selectionType,
        reactions: draft.reactions,
        createdAt: Date.now()
      };

      allPanels.push(savedData);
      saveRoleReactionPanels(allPanels);
      roleReactionDrafts.delete(interaction.user.id);

      return interaction.update({
        content: `✅ Role reaction panel saved.\n**Name:** ${savedData.name}\n**Channel:** <#${savedData.channelId}>`,
        embeds: [],
        components: []
      });
    }

    if (interaction.customId === "rr_cancel") {
      roleReactionDrafts.delete(interaction.user.id);

      return interaction.update({
        content: "❌ Role reaction setup cancelled.",
        embeds: [],
        components: []
      });
    }

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
  },

  async handleSelect(interaction) {
    const draft = getDraft(interaction.user.id);

    if (interaction.customId === "rr_message_type") {
      draft.messageType = interaction.values[0];

      return interaction.update({
        embeds: [buildRoleReactionEmbed(draft, interaction.guild)],
        components: buildRoleReactionComponents(draft)
      });
    }

    if (interaction.customId === "rr_selection_type") {
      draft.selectionType = interaction.values[0];

      return interaction.update({
        embeds: [buildRoleReactionEmbed(draft, interaction.guild)],
        components: buildRoleReactionComponents(draft)
      });
    }

    if (interaction.customId === "rr_channel_select") {
      draft.channelId = interaction.values[0];

      return interaction.update({
        content: "",
        embeds: [buildRoleReactionEmbed(draft, interaction.guild)],
        components: buildRoleReactionComponents(draft)
      });
    }

    return false;
  }
};