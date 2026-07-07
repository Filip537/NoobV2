const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

function cleanWorldName(name) {
  return name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function buildWorldUrl(world) {
  return `https://growtopiagame.com/worlds/${encodeURIComponent(world)}.png`;
}

function buildEmbed(world, user) {
  const clean = cleanWorldName(world);
  const imageUrl = buildWorldUrl(clean);

  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`🌍 World: ${clean.toUpperCase()}`)
    .setDescription(
      `**Rendered world image below**\n\n` +
      `Powered by Growtopia World Renderer`
    )
    .setImage(imageUrl)
    .setFooter({
      text: `Requested by ${user.username} • NoobV2`
    })
    .setTimestamp();
}

function buildRows(world) {
  const clean = cleanWorldName(world);
  const imageUrl = buildWorldUrl(clean);

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Download")
        .setEmoji("📥")
        .setURL(imageUrl)
        .setStyle(ButtonStyle.Link),

      new ButtonBuilder()
        .setCustomId("render_search_again")
        .setLabel("Search Again")
        .setEmoji("🔍")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

async function execute(interaction) {
  const world = cleanWorldName(interaction.options.getString("world"));

  if (!world) {
    return interaction.reply({
      content: "❌ Please enter a valid world name.",
      ephemeral: true
    });
  }

  return interaction.reply({
    embeds: [buildEmbed(world, interaction.user)],
    components: buildRows(world)
  });
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

  const world = cleanWorldName(
    interaction.fields.getTextInputValue("render_world_input")
  );

  if (!world) {
    await interaction.reply({
      content: "❌ Please enter a valid world name.",
      ephemeral: true
    });
    return true;
  }

  await interaction.reply({
    embeds: [buildEmbed(world, interaction.user)],
    components: buildRows(world)
  });

  return true;
}

module.exports = {
  execute,
  handleButton,
  handleModal
};