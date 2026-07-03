const fs = require("fs");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const APPROVAL_CHANNEL = "1522529403337183376";
const ADMIN_ROLE = "1411991650573484073";
const DATA_FILE = "./stickerGifStorage.json";

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      stickers: [],
      gifs: [],
      pending: []
    }, null, 2));
  }

  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    if (!data.stickers) data.stickers = [];
    if (!data.gifs) data.gifs = [];
    if (!data.pending) data.pending = [];

    return data;
  } catch {
    return { stickers: [], gifs: [], pending: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function makeId() {
  return `${Date.now()}_${Math.floor(Math.random() * 999999)}`;
}

async function handleAutocomplete(interaction) {
  if (!["sendsticker", "sendgif"].includes(interaction.commandName)) return false;

  const focused = interaction.options.getFocused().toLowerCase();
  const data = loadData();

  const list = interaction.commandName === "sendsticker"
    ? data.stickers
    : data.gifs;

  const choices = list
    .filter(item => item.name.toLowerCase().includes(focused))
    .slice(0, 25)
    .map(item => ({
      name: item.name,
      value: item.name
    }));

  await interaction.respond(choices).catch(() => {});
  return true;
}

async function handleCommand(interaction, client) {
  if (!interaction.isChatInputCommand()) return false;

  if (interaction.commandName === "addsticker" || interaction.commandName === "addgif") {
    const type = interaction.commandName === "addsticker" ? "sticker" : "gif";
    const name = interaction.options.getString("name").trim();
    const file = interaction.options.getAttachment("file");

    if (!file) {
      await interaction.reply({
        content: "Please upload a file.",
        ephemeral: true
      });
      return true;
    }

    if (type === "sticker" && !file.contentType?.startsWith("image/")) {
      await interaction.reply({
        content: "Sticker must be an image file.",
        ephemeral: true
      });
      return true;
    }

    if (type === "gif" && file.contentType !== "image/gif") {
      await interaction.reply({
        content: "GIF must be a .gif file.",
        ephemeral: true
      });
      return true;
    }

    const data = loadData();
    const list = type === "sticker" ? data.stickers : data.gifs;

    if (
      list.some(item => item.name.toLowerCase() === name.toLowerCase()) ||
      data.pending.some(item => item.name.toLowerCase() === name.toLowerCase())
    ) {
      await interaction.reply({
        content: `A ${type} with this name already exists or is waiting for approval.`,
        ephemeral: true
      });
      return true;
    }

    const approvalChannel = await client.channels.fetch(APPROVAL_CHANNEL).catch(() => null);

    if (!approvalChannel) {
      await interaction.reply({
        content: "Approval channel not found.",
        ephemeral: true
      });
      return true;
    }

    const requestId = makeId();

    data.pending.push({
      id: requestId,
      type,
      name,
      url: file.url,
      submittedBy: interaction.user.id,
      createdAt: Date.now()
    });

    saveData(data);

    const embed = new EmbedBuilder()
      .setColor(type === "sticker" ? "Blue" : "Purple")
      .setTitle(`${type === "sticker" ? "Sticker" : "GIF"} Approval Request`)
      .setDescription(
        `**Name:** ${name}\n` +
        `**Type:** ${type}\n` +
        `**Submitted By:** ${interaction.user}\n` +
        `**Request ID:** ${requestId}`
      )
      .setImage(file.url)
      .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`sg_approve_${requestId}`)
        .setLabel("Approve")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`sg_deny_${requestId}`)
        .setLabel("Deny")
        .setStyle(ButtonStyle.Danger)
    );

    await approvalChannel.send({
      embeds: [embed],
      components: [buttons]
    });

    await interaction.reply({
      content: `${type === "sticker" ? "Sticker" : "GIF"} submitted for admin approval.`,
      ephemeral: true
    });

    return true;
  }

  if (interaction.commandName === "sendsticker" || interaction.commandName === "sendgif") {
    const type = interaction.commandName === "sendsticker" ? "sticker" : "gif";
    const name = interaction.options.getString("name").trim();

    const data = loadData();
    const list = type === "sticker" ? data.stickers : data.gifs;

    const item = list.find(x => x.name.toLowerCase() === name.toLowerCase());

    if (!item) {
      await interaction.reply({
        content: `${type === "sticker" ? "Sticker" : "GIF"} not found.`,
        ephemeral: true
      });
      return true;
    }

    await interaction.reply({
      files: [item.url]
    });

    return true;
  }

  return false;
}

async function handleButton(interaction, client) {
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith("sg_")) return false;

  if (!interaction.member.roles.cache.has(ADMIN_ROLE)) {
    await interaction.reply({
      content: "You cannot approve or deny sticker/GIF requests.",
      ephemeral: true
    });
    return true;
  }

  const [, action, requestId] = interaction.customId.split("_");

  const data = loadData();
  const pending = data.pending.find(item => item.id === requestId);

  if (!pending) {
    await interaction.reply({
      content: "This request was already handled.",
      ephemeral: true
    });
    return true;
  }

  data.pending = data.pending.filter(item => item.id !== requestId);

  if (action === "approve") {
    const savedItem = {
      name: pending.name,
      url: pending.url,
      addedBy: pending.submittedBy,
      approvedBy: interaction.user.id,
      addedAt: Date.now()
    };

    if (pending.type === "sticker") {
      data.stickers.push(savedItem);
    } else {
      data.gifs.push(savedItem);
    }

    saveData(data);

    await interaction.update({
      content: `Approved by ${interaction.user}`,
      components: []
    });

    const user = await client.users.fetch(pending.submittedBy).catch(() => null);
    if (user) {
      user.send(`Your ${pending.type} **${pending.name}** was approved.`).catch(() => {});
    }

    return true;
  }

  saveData(data);

  await interaction.update({
    content: `Denied by ${interaction.user}`,
    components: []
  });

  const user = await client.users.fetch(pending.submittedBy).catch(() => null);
  if (user) {
    user.send(`Your ${pending.type} **${pending.name}** was denied.`).catch(() => {});
  }

  return true;
}

module.exports = {
  handleAutocomplete,
  handleCommand,
  handleButton
};