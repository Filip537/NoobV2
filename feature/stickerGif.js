const fs = require("fs");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const { downloadAttachment } = require("./mediaUpload.js");

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
  if (!["sendsticker", "sendgif"].includes(interaction.commandName)) {
    return false;
  }

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
    const label = type === "sticker" ? "Sticker" : "GIF";
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
    const normalizedName = name.toLowerCase();

    if (
      list.some(item => item.approvalMessageId && item.name.toLowerCase() === normalizedName) ||
      data.pending.some(item => item.name.toLowerCase() === normalizedName)
    ) {
      await interaction.reply({
        content: `A ${type} with this name already exists or is waiting for approval.`,
        ephemeral: true
      });
      return true;
    }

    await interaction.deferReply({ ephemeral: true });

    const approvalChannel = await client.channels.fetch(APPROVAL_CHANNEL).catch(() => null);

    if (!approvalChannel) {
      await interaction.editReply("Approval channel not found.");
      return true;
    }

    const requestId = makeId();

    const embed = new EmbedBuilder()
      .setColor(type === "sticker" ? "Blue" : "Purple")
      .setTitle(`${label} Approval Request`)
      .setDescription(
        `**Name:** ${name}\n` +
        `**Type:** ${type}\n` +
        `**Submitted By:** ${interaction.user}\n` +
        `**Request ID:** ${requestId}`
      )
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

    try {
      const upload = await downloadAttachment(file);
      embed.setImage(`attachment://${upload.name}`);

      const approval = await approvalChannel.send({
        embeds: [embed],
        components: [buttons],
        files: [upload],
        allowedMentions: { parse: [] }
      });

      const current = loadData();
      current.pending.push({
        id: requestId,
        type,
        name,
        approvalMessageId: approval.id,
        submittedBy: interaction.user.id,
        createdAt: Date.now()
      });
      saveData(current);
    } catch (error) {
      console.error("[MEDIA] Approval upload failed", error.code ?? error.message);
      await interaction.editReply("Could not upload the preview to the approval channel.");
      return true;
    }

    await interaction.editReply(`${label} submitted for admin approval.`);
    return true;
  }

  if (interaction.commandName === "sendsticker" || interaction.commandName === "sendgif") {
    const type = interaction.commandName === "sendsticker" ? "sticker" : "gif";
    const label = type === "sticker" ? "Sticker" : "GIF";
    const name = interaction.options.getString("name").trim().toLowerCase();

    const data = loadData();
    const list = type === "sticker" ? data.stickers : data.gifs;
    const item = list.find(entry => entry.name.toLowerCase() === name);

    if (!item) {
      await interaction.reply({
        content: `${label} not found.`,
        ephemeral: true
      });
      return true;
    }

    await interaction.deferReply();

    try {
      let source = { url: item.url };

      if (item.approvalMessageId) {
        const approvalChannel = await client.channels.fetch(APPROVAL_CHANNEL);
        const approval = await approvalChannel.messages.fetch({
          message: item.approvalMessageId,
          force: true
        });

        source = approval.attachments.first();

        if (!source) {
          throw new Error("The approval message has no attachment.");
        }
      }

      const upload = await downloadAttachment(source);
      await interaction.editReply({ files: [upload] });
    } catch (error) {
      const detail = error.code ?? error.message;
      console.error("[MEDIA] Saved media send failed", detail);

      const expired =
        !item.approvalMessageId &&
        ["CDN_403", "CDN_404"].includes(error.code);

      await interaction.editReply(
        expired
          ? "This saved file has expired. Submit it again under the same name for admin approval."
          : `Could not send the saved file (${detail}).`
      );
    }

    return true;
  }

  return false;
}

async function handleButton(interaction, client) {
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith("sg_")) return false;

  if (!interaction.member?.roles?.cache?.has(ADMIN_ROLE)) {
    await interaction.reply({
      content: "You cannot approve or deny sticker/GIF requests.",
      ephemeral: true
    });
    return true;
  }

  const [, action, ...idParts] = interaction.customId.split("_");
  const requestId = idParts.join("_");

  if (action !== "approve" && action !== "deny") return false;

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
      approvalMessageId: pending.approvalMessageId,
      addedBy: pending.submittedBy,
      approvedBy: interaction.user.id,
      addedAt: Date.now()
    };

    const collection = pending.type === "sticker" ? "stickers" : "gifs";
    data[collection] = data[collection].filter(item =>
      item.name.toLowerCase() !== pending.name.toLowerCase()
    );
    data[collection].push(savedItem);
  }

  saveData(data);

  const status = action === "approve" ? "Approved" : "Denied";

  await interaction.update({
    content: `${status} by ${interaction.user}`,
    components: [],
    allowedMentions: { parse: [] }
  });

  const user = await client.users.fetch(pending.submittedBy).catch(() => null);

  if (user) {
    await user.send(
      `Your ${pending.type} **${pending.name}** was ${status.toLowerCase()}.`
    ).catch(() => {});
  }

  return true;
}

module.exports = {
  handleAutocomplete,
  handleCommand,
  handleButton
};
