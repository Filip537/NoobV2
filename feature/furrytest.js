const fs = require("node:fs");
const path = require("node:path");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const quiz = require("./furrytest.quiz.js");

const CHANNEL_ID = "1490619230452846633";
const PREFIX = "nv2setup:";
const DATA_FILE = path.join(__dirname, "..", "profileSetup.json");
const MAX_ENTRIES = 4;
const MAX_LENGTH = 32;

const LABELS = {
  hobbies: "Hobbies",
  games: "Favourite games"
};

function loadData() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    if (
      !data?.profiles ||
      typeof data.profiles !== "object" ||
      Array.isArray(data.profiles)
    ) {
      throw new Error("Invalid profileSetup.json");
    }

    return data;
  } catch (error) {
    if (error.code === "ENOENT") return { profiles: {} };
    throw error;
  }
}

function saveData(data) {
  const temporaryFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(data, null, 2), {
    mode: 0o600
  });
  fs.renameSync(temporaryFile, DATA_FILE);
}

function profileKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function getProfileDetails(guildId, userId) {
  const details = loadData().profiles[profileKey(guildId, userId)];
  return {
    hobbies: details?.hobbies ?? [],
    games: details?.games ?? []
  };
}

function button(action, label, style = ButtonStyle.Secondary) {
  return new ButtonBuilder()
    .setCustomId(`${PREFIX}${action}`)
    .setLabel(label)
    .setStyle(style);
}

async function startProfileSetup(client) {
  const channel = await client.channels.fetch(CHANNEL_ID);

  if (!channel?.guild || typeof channel.send !== "function") {
    throw new Error("Profile setup channel must be a server text channel.");
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("Set up your NoobV2 profile")
    .setDescription(
      "Add up to **4 hobbies** and **4 favourite games**. " +
      "They appear on your public `/profile` About page.\n\n" +
      "Open a form again to edit your entries. Clear a field to remove that entry."
    );

  const row = new ActionRowBuilder().addComponents(
    button("hobbies", "Edit Hobbies", ButtonStyle.Primary),
    button("games", "Edit Favourite Games", ButtonStyle.Primary),
    button("clear", "Remove All", ButtonStyle.Danger),
    button("info", "Server Info")
  );

  const payload = {
    embeds: [embed],
    components: [row],
    allowedMentions: { parse: [] }
  };

  const { panelMessageId } = loadData();
  let panel;

  if (panelMessageId) {
    panel = await channel.messages.fetch(panelMessageId).catch(error => {
      if (Number(error.code) === 10008) return null;
      throw error;
    });
  }

  if (panel?.author.id !== client.user.id) {
    const recent = await channel.messages.fetch({ limit: 25 });
    panel = recent.find(message =>
      message.author.id === client.user.id &&
      message.components.some(row =>
        row.components.some(component =>
          component.customId === `${PREFIX}hobbies`
        )
      )
    );
  }

  const message = panel ? await panel.edit(payload) : await channel.send(payload);

  const data = loadData();
  data.panelMessageId = message.id;
  saveData(data);

  console.log(`[PROFILE SETUP] Panel ready: ${message.url}`);
  return message;
}

async function handleProfileSetup(interaction) {
  if (
    interaction.channelId !== CHANNEL_ID ||
    !interaction.guild ||
    !interaction.customId?.startsWith(PREFIX)
  ) {
    return false;
  }

  const action = interaction.customId.slice(PREFIX.length);
  const guild = interaction.guild;
  const userId = interaction.user.id;
  const key = profileKey(guild.id, userId);

  if (interaction.isButton()) {
    if (action === "info") {
      const created = Math.floor(guild.createdTimestamp / 1000);
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(guild.name)
        .addFields(
          { name: "Members", value: String(guild.memberCount), inline: true },
          { name: "Created", value: `<t:${created}:D>`, inline: true }
        );

      const icon = guild.iconURL({ size: 128 });
      if (icon) embed.setThumbnail(icon);

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return true;
    }

    if (action === "clear") {
      const row = new ActionRowBuilder().addComponents(
        button(`confirm:${userId}`, "Confirm Remove All", ButtonStyle.Danger)
      );

      await interaction.reply({
        content: "Remove all hobbies and favourite games from your profile?",
        components: [row],
        ephemeral: true
      });
      return true;
    }

    if (action === `confirm:${userId}`) {
      const data = loadData();
      delete data.profiles[key];
      saveData(data);

      await interaction.update({
        content: "Your hobbies and favourite games were removed.",
        components: []
      });
      return true;
    }

    if (!Object.hasOwn(LABELS, action)) return false;

    const entries = getProfileDetails(guild.id, userId)[action];
    const label = action === "hobbies" ? "Hobby" : "Game";
    const modal = new ModalBuilder()
      .setCustomId(`${PREFIX}save:${action}`)
      .setTitle(`Edit ${LABELS[action]}`);

    for (let index = 0; index < MAX_ENTRIES; index++) {
      const input = new TextInputBuilder()
        .setCustomId(`entry${index}`)
        .setLabel(`${label} ${index + 1}`)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(MAX_LENGTH)
        .setRequired(false);

      if (entries[index]) input.setValue(entries[index]);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
    }

    await interaction.showModal(modal);
    return true;
  }

  if (!interaction.isModalSubmit() || !action.startsWith("save:")) {
    return false;
  }

  const category = action.slice("save:".length);
  if (!Object.hasOwn(LABELS, category)) return false;

  const entries = [];
  const seen = new Set();

  for (let index = 0; index < MAX_ENTRIES; index++) {
    const value = interaction.fields
      .getTextInputValue(`entry${index}`)
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, MAX_LENGTH);

    const normalized = value.toLowerCase();
    if (value && !seen.has(normalized)) {
      entries.push(value);
      seen.add(normalized);
    }
  }

  const data = loadData();
  data.profiles[key] = {
    hobbies: [],
    games: [],
    ...data.profiles[key],
    [category]: entries
  };
  saveData(data);

  await interaction.reply({
    content: `${LABELS[category]} saved. They appear on your \`/profile\` About page.`,
    ephemeral: true
  });

  return true;
}

module.exports = {
  execute: quiz.execute,
  handleButton: quiz.handleButton,
  startProfileSetup,
  handleProfileSetup,
  getProfileDetails
};
