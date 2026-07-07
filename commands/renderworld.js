const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder
} = require("discord.js");

function cleanWorldName(name) {
  return name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function buildWorldUrl(world) {
  return `https://growtopiagame.com/worlds/${encodeURIComponent(world)}.png`;
}

async function fetchWorldImage(world) {
  const url = buildWorldUrl(world);

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!res.ok) return null;

  const buffer = Buffer.from(await res.arrayBuffer());

  return new AttachmentBuilder(buffer, {
    name: `${world}.png`
  });
}

function buildEmbed(world, user) {
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`🌍 World: ${world.toUpperCase()}`)
    .setDescription(
      `**Last rendered:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
      `Powered by Growtopia World Renderer`
    )
    .setImage(`attachment://${world}.png`)
    .setFooter({
      text: `Requested by ${user.username} • NoobV2`
    })
    .setTimestamp();
}

function buildRows(world) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Download")
        .setEmoji("📥")
        .setURL(buildWorldUrl(world))
        .setStyle(ButtonStyle.Link),

      new ButtonBuilder()
        .setCustomId("render_search_again")
        .setLabel("Search Again")
        .setEmoji("🔍")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

async function sendWorld(interaction, world, isModal = false) {
  const clean = cleanWorldName(world);

  if (!clean) {
    return interaction.reply({
      content: "❌ Please enter a valid world name.",
      ephemeral: true
    });
  }

  await interaction.deferReply();

  const attachment = await fetchWorldImage(clean);

  if (!attachment) {
    return interaction.editReply({
      content: `❌ Could not render **${clean.toUpperCase()}**. The world may not exist or Growtopia has not generated the render yet.`
    });
  }

  return interaction.editReply({
    embeds: [buildEmbed(clean, interaction.user)],
    files: [attachment],
    components: buildRows(clean)
  });
}

async function execute(interaction) {
  const world = interaction.options.getString("world");
  return sendWorld(interaction, world);
}

async function handleButton(interaction) {
  if (interaction.customId !== "render_search_again") return false;

  const modal = new ModalBuilder()
    .setCustomId("render_search_modal")
    .setTitle("Search Another World");

  const input = new TextInputBuilder()
    .setCustomId("render_world_input")
    .setLabel("World Name")
    .setPlaceholder("Example: NOOBV2")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(input)
  );

  await interaction.showModal(modal);
  return true;
}

async function handleModal(interaction) {
  if (interaction.customId !== "render_search_modal") return false;

  const world = interaction.fields.getTextInputValue("render_world_input");
  await sendWorld(interaction, world, true);

  return true;
}

module.exports = {
  execute,
  handleButton,
  handleModal
};