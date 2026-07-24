const {
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");

const MAX_RESULTS = 25;
const MAX_MESSAGES_PER_CHANNEL = 1000;
const FETCH_SIZE = 100;

function cleanText(text, maxLength = 300) {
  if (!text) return "*No text content*";

  const cleaned = text
    .replace(/`/g, "ˋ")
    .replace(/\n+/g, " ")
    .trim();

  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 3)}...`;
}

async function searchChannel(channel, query, targetUserId, results) {
  let before;
  let checked = 0;

  while (
    checked < MAX_MESSAGES_PER_CHANNEL &&
    results.length < MAX_RESULTS
  ) {
    const remaining = MAX_MESSAGES_PER_CHANNEL - checked;
    const limit = Math.min(FETCH_SIZE, remaining);

    const fetched = await channel.messages.fetch({
      limit,
      before
    }).catch(() => null);

    if (!fetched || fetched.size === 0) break;

    checked += fetched.size;

    for (const message of fetched.values()) {
      if (results.length >= MAX_RESULTS) break;
      if (!message.author) continue;

      if (
        targetUserId &&
        message.author.id !== targetUserId
      ) {
        continue;
      }

      const content = message.content || "";

      if (!content.toLowerCase().includes(query)) {
        continue;
      }

      results.push({
        id: message.id,
        author: message.author,
        content,
        createdTimestamp: message.createdTimestamp,
        channel,
        url: message.url
      });
    }

    before = fetched.last()?.id;

    if (!before || fetched.size < limit) break;
  }
}

async function execute(interaction) {
  if (
    !interaction.isChatInputCommand() ||
    interaction.commandName !== "searchmessage"
  ) {
    return false;
  }

  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ This command can only be used inside a server.",
      ephemeral: true
    });

    return true;
  }

  const messageQuery = interaction.options
    .getString("message", true)
    .trim()
    .toLowerCase();

  const targetUser = interaction.options.getUser("user");

  if (!messageQuery) {
    await interaction.reply({
      content: "❌ Enter a message or word to search for.",
      ephemeral: true
    });

    return true;
  }

  await interaction.deferReply({
    ephemeral: true
  });

  const botMember = interaction.guild.members.me;
  const results = [];

  const channels = interaction.guild.channels.cache
    .filter(channel => {
      if (!channel.isTextBased()) return false;
      if (!channel.messages) return false;
      if (channel.isThread()) return false;

      const botPermissions = channel.permissionsFor(botMember);
      const userPermissions = channel.permissionsFor(interaction.member);

      return (
        botPermissions?.has(PermissionFlagsBits.ViewChannel) &&
        botPermissions?.has(PermissionFlagsBits.ReadMessageHistory) &&
        userPermissions?.has(PermissionFlagsBits.ViewChannel)
      );
    })
    .sort((a, b) => a.rawPosition - b.rawPosition);

  for (const channel of channels.values()) {
    if (results.length >= MAX_RESULTS) break;

    await searchChannel(
      channel,
      messageQuery,
      targetUser?.id,
      results
    );
  }

  if (results.length === 0) {
    await interaction.editReply({
      content:
        `❌ No messages containing **${cleanText(messageQuery, 100)}** were found` +
        `${targetUser ? ` from ${targetUser}` : ""}.\n\n` +
        "The bot can only search messages it has permission to read."
    });

    return true;
  }

  const embeds = [];
  const resultChunks = [];

  for (let i = 0; i < results.length; i += 5) {
    resultChunks.push(results.slice(i, i + 5));
  }

  for (let page = 0; page < resultChunks.length; page++) {
    const chunk = resultChunks[page];

    const description = chunk.map((result, index) => {
      const resultNumber = page * 5 + index + 1;
      const timestamp = Math.floor(
        result.createdTimestamp / 1000
      );

      return (
        `### ${resultNumber}. ${result.author.username}\n` +
        `**Channel:** ${result.channel}\n` +
        `**Sent:** <t:${timestamp}:f> • <t:${timestamp}:R>\n` +
        `**Message:** ${cleanText(result.content)}\n` +
        `[Jump to message](${result.url})`
      );
    }).join("\n\n");

    embeds.push(
      new EmbedBuilder()
        .setTitle("Message Search Results")
        .setColor("Blue")
        .setDescription(description)
        .setFooter({
          text:
            `Found ${results.length} result(s)` +
            `${targetUser ? ` from ${targetUser.username}` : ""}` +
            ` • Page ${page + 1}/${resultChunks.length}`
        })
        .setTimestamp()
    );
  }

  await interaction.editReply({
    content:
      `Search: **${cleanText(messageQuery, 100)}**` +
      `${targetUser ? ` • User: ${targetUser}` : ""}`,
    embeds: embeds.slice(0, 5),
    allowedMentions: {
      parse: []
    }
  });

  return true;
}

module.exports = {
  execute
};
