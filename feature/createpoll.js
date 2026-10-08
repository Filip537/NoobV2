
const fs = require("fs");
const path = require("path");
const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require("discord.js");

const FILE = path.join(__dirname, "polls.json");
const MAX_DURATION = 30 * 86400000;

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

function save(data) {
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, FILE);
}

function counts(poll) {
  const result = poll.options.map(() => 0);
  for (const index of Object.values(poll.votes)) {
    if (Number.isInteger(index) && result[index] !== undefined) {
      result[index]++;
    }
  }
  return result;
}

function buildEmbed(poll) {
  const totals = counts(poll);
  const total = totals.reduce((a, b) => a + b, 0);
  const ended = poll.status === "ended";
  const show = poll.visible || ended;

  const lines = poll.options.map((option, i) => {
    if (!show) return `**${i + 1}. ${option}**`;

    const count = totals[i];
    const percent = total ? Math.round(count / total * 100) : 0;
    const filled = Math.round(percent / 10);
    const bar = "█".repeat(filled) + "░".repeat(10 - filled);

    return `**${i + 1}. ${option}**\n${bar} ${count} vote(s) (${percent}%)`;
  });

  let result = "";
  if (ended) {
    const highest = Math.max(...totals);
    const winners = highest > 0
      ? poll.options.filter((_, i) => totals[i] === highest)
      : [];

    result = winners.length
      ? `\n\n**Winner${winners.length > 1 ? "s" : ""}:** ${winners.join(", ")} (${highest} votes)`
      : "\n\n**No votes were submitted.**";
  }

  return new EmbedBuilder()
    .setColor(ended ? 0x57F287 : 0x5865F2)
    .setTitle(ended ? "Poll Results" : "Community Poll")
    .setDescription(
      `### ${poll.question}\n\n` +
      lines.join("\n\n") +
      result +
      `\n\n**Total votes:** ${show ? total : "Hidden"}` +
      `\n**Mode:** ${poll.visible ? "Public" : "Hidden"}` +
      `\n**Status:** ${ended ? "Closed" : "Open"}` +
      (ended ? "" : `\n**Ends:** <t:${Math.floor(poll.endsAt / 1000)}:R>`)
    )
    .setFooter({
      text: ended
        ? "Voting has ended."
        : "Choose an option below. You may change your vote."
    });
}

function buildMenu(poll) {
  if (poll.status === "ended") return [];

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`poll_vote_${poll.id}`)
        .setPlaceholder("Select your vote")
        .addOptions(poll.options.map((name, index) => ({
          label: name.slice(0, 100),
          value: String(index),
          description: `Vote for option ${index + 1}`
        })))
    )
  ];
}

async function create(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      content: "Polls can only be created in a server.",
      ephemeral: true
    });
  }

  const visible = interaction.options.getBoolean("visible");
  const question = interaction.options.getString("question").trim();
  const raw = interaction.options.getString("options");
  const duration = interaction.options.getString("duration").trim();

  const options = raw.split("|").map(x => x.trim());

  if (
    options.length < 2 ||
    options.length > 25 ||
    options.some(x => !x || x.length > 100) ||
    new Set(options.map(x => x.toLowerCase())).size !== options.length
  ) {
    return interaction.reply({
      content: "Provide 2-25 unique options, each 1-100 characters long, separated by |.",
      ephemeral: true
    });
  }

  const match = /^(\d+)(m|h|d)$/i.exec(duration);
  if (!match) {
    return interaction.reply({
      content: "Invalid duration. Use 30m, 5h, 1d or 7d.",
      ephemeral: true
    });
  }

  const unit = { m: 60000, h: 3600000, d: 86400000 };
  const ms = Number(match[1]) * unit[match[2].toLowerCase()];

  if (!Number.isSafeInteger(ms) || ms < 60000 || ms > MAX_DURATION) {
    return interaction.reply({
      content: "Duration must be between 1 minute and 30 days.",
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const id = `${Date.now()}_${interaction.user.id}`;
  const poll = {
    id,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    messageId: null,
    creatorId: interaction.user.id,
    question,
    options,
    visible,
    votes: {},
    endsAt: Date.now() + ms,
    status: "open"
  };

  try {
    const message = await interaction.channel.send({
      embeds: [buildEmbed(poll)],
      components: buildMenu(poll),
      allowedMentions: { parse: [] }
    });

    poll.messageId = message.id;
    const data = load();
    data[id] = poll;
    save(data);

    await interaction.editReply(
      `Poll created successfully!\n${message.url}`
    );
  } catch (error) {
    console.error("[POLL CREATE]", error);
    await interaction.editReply("Failed to create the poll.");
  }
}

const locks = new Set();

async function vote(interaction) {
  const id = interaction.customId.slice("poll_vote_".length);
  const key = id + ":" + interaction.user.id;

  if (locks.has(key)) {
    return interaction.reply({
      content: "Your previous vote is still processing.",
      ephemeral: true
    });
  }

  locks.add(key);

  try {
    const data = load();
    const poll = data[id];

    if (!poll || poll.messageId !== interaction.message.id) {
      return interaction.reply({
        content: "This poll is no longer available.",
        ephemeral: true
      });
    }

    if (poll.status !== "open" || Date.now() >= poll.endsAt) {
      return interaction.reply({
        content: "Voting has ended.",
        ephemeral: true
      });
    }

    const selected = Number(interaction.values[0]);

    if (!Number.isInteger(selected) || !poll.options[selected]) {
      return interaction.reply({
        content: "Invalid option.",
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const previous = poll.votes[interaction.user.id];
    poll.votes[interaction.user.id] = selected;
    save(data);

    if (poll.visible) {
      await interaction.message.edit({
        embeds: [buildEmbed(poll)],
        components: buildMenu(poll),
        allowedMentions: { parse: [] }
      }).catch(console.error);
    }

    await interaction.editReply(
      previous === undefined
        ? `Your vote for **${poll.options[selected]}** has been recorded.`
        : `Your vote has been updated to **${poll.options[selected]}**.`
    );
  } catch (error) {
    console.error("[POLL VOTE]", error);
    if (interaction.deferred) {
      await interaction.editReply("Failed to record your vote.").catch(() => {});
    } else if (!interaction.replied) {
      await interaction.reply({
        content: "Failed to record your vote.",
        ephemeral: true
      }).catch(() => {});
    }
  } finally {
    locks.delete(key);
  }
}

const closing = new Set();

async function checkExpired(client) {
  const data = load();

  for (const poll of Object.values(data)) {
if (
  (poll.status !== "open" && poll.status !== "ended") ||
  Date.now() < poll.endsAt ||
  closing.has(poll.id)
) continue;
    closing.add(poll.id);

    try {
      const channel = await client.channels.fetch(poll.channelId);
      if (!channel || !channel.messages) continue;

      const message = await channel.messages.fetch(poll.messageId);

      // Mark closed before revealing the results.
      const latest = load();
if (!latest[poll.id]) continue;
      latest[poll.id].status = "ended";
      save(latest);

      await message.edit({
        embeds: [buildEmbed(latest[poll.id])],
        components: [],
        allowedMentions: { parse: [] }
      });
    } catch (error) {
      console.error("[POLL CLOSE]", poll.id, error);
    } finally {
      closing.delete(poll.id);
    }
  }
}

module.exports = {
  create,
  vote,
  checkExpired
};
