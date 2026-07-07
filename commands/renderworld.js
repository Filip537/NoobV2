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

function buildWorldUrl(world, refresh = false) {
  const base = `https://growtopiagame.com/worlds/${encodeURIComponent(world)}.png`;
  return refresh ? `${base}?t=${Date.now()}` : base;
}

function buildEmbed(world, user, refresh = true) {
  const clean = cleanWorldName(world);
  const imageUrl = buildWorldUrl(clean, refresh);

  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`🌍 World: ${clean.toUpperCase()}`)
    .setDescription(
      `**Last rendered:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
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
  const url = buildWorldUrl(clean, false);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`render_refresh_${clean}`)
      .setLabel("Refresh Render")
      .setEmoji("🖼️")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setLabel("Open in Browser")
      .setEmoji("🌐")
      .setURL(url)
      .setStyle(ButtonStyle.Link)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Download")
      .setEmoji("📥")
      .setURL(url)
      .setStyle(ButtonStyle.Link),

    new ButtonBuilder()
      .setCustomId("render_search_again")
      .setLabel("Search Again")
      .setEmoji("🔍")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`render_copy_${clean}`)
      .setLabel("Copy URL")
      .setEmoji("📋")
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

async function execute(interaction) {
  const world = cleanWorldName(interaction.options.getString("world"));

  if (!world) {
    return interaction.reply({
      content: "❌ Please enter a valid world name.",
      ephemeral: true
    });
  }

  const embed = buildEmbed(world, interaction.user, true);

  return interaction.reply({
    embeds: [embed],
    components: buildRows(world)
  });
}

async function handleButton(interaction) {
  if (!interaction.customId.startsWith("render_")) return false;

  if (interaction.customId.startsWith("render_refresh_")) {
    const world = interaction.customId.replace("render_refresh_", "");
    const embed = buildEmbed(world, interaction.user, true);

    await interaction.update({
      embeds: [embed],
      components: buildRows(world)
    });

    return true;
  }

  if (interaction.customId.startsWith("render_copy_")) {
    const world = interaction.customId.replace("render_copy_", "");
    const url = buildWorldUrl(world, false);

    await interaction.reply({
      content: url,
      ephemeral: true
    });

    return true;
  }

  if (interaction.customId === "render_search_again") {
    const modal = new ModalBuilder()
      .setCustomId("render_search_modal")
      .setTitle("Search Another World");

    const input = new TextInputBuilder()
      .setCustomId("render_world_input")
      .setLabel("World Name")
      .setPlaceholder("Example: NOOBV2")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    await interaction.showModal(modal);
    return true;
  }

  return false;
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

  const embed = buildEmbed(world, interaction.user, true);

  await interaction.reply({
    embeds: [embed],
    components: buildRows(world)
  });

  return true;
}

module.exports = {
  execute,
  handleButton,
  handleModal
};