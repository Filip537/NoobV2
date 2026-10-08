
const fs = require("fs");
const path = require("path");

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require("discord.js");

const DATA_FILE = path.join(__dirname, "..", "hiddenVotes.json");
const TIMEZONE = "Australia/Melbourne";

function loadVotes() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveVotes(data) {
  const tempFile = DATA_FILE + ".tmp";
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
  fs.renameSync(tempFile, DATA_FILE);
}

function melbourneDate(timestamp) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(new Date(timestamp))
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value])
  );
}

function nextMelbourneMidnight() {
    
function parseVoteDuration(input) {
  if (typeof input !== "string") return null;

  const match = input.trim().toLowerCase().match(/^(\d+)(m|h|d|w)$/);

  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];

  const units = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000
  };

  const duration = amount * units[unit];

  // Minimum 1 minute, maximum 30 days
  if (
    !Number.isSafeInteger(duration) ||
    duration < 60 * 1000 ||
    duration > 30 * 24 * 60 * 60 * 1000
  ) {
    return null;
  }

  return duration;
}

  const now = Date.now();
  const today = melbourneDate(now);

  let low = now;
  let high = now + 27 * 60 * 60 * 1000;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const date = melbourneDate(mid);

    if (
      date.year === today.year &&
      date.month === today.month &&
      date.day === today.day
    ) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return high;
}

function buildVoteEmbed(vote, finished = false) {
  const counts = vote.options.map((_, index) =>
    Object.values(vote.votes).filter(value => value === index).length
  );

  const total = Object.keys(vote.votes).length;

  let description = finished
    ? "**Voting has ended! Here are the final results.**\n\n"
    : "**Voting is now open!**\n\n" +
      "Select one of the buttons below to vote.\n" +
"All voting numbers are hidden until voting ends.\n\n";
  vote.options.forEach((option, index) => {
    const name = `${option.emoji || "🔹"} ${option.label}`;

    if (finished) {
      const count = counts[index];
      const percent = total
        ? Math.round((count / total) * 100)
        : 0;

      description +=
        `**${name}**\n` +
        `Votes: **${count}** (${percent}%)\n\n`;
    } else {
      description += `**${name}**\n`;
    }
  });

  if (finished) {
    const max = Math.max(...counts);

    const winners = max > 0
      ? vote.options
          .filter((_, index) => counts[index] === max)
          .map(option => option.label)
      : [];

    description += "\n";

    if (winners.length === 1) {
      description += `**Winner: ${winners[0]}**\n`;
    } else if (winners.length > 1) {
      description += `**Tie: ${winners.join(", ")}**\n`;
    } else {
      description += "No votes were submitted.\n";
    }

    description += `\n**Total voters:** ${total}`;
  } else {
    description +=
      `\n\n**Ends:** <t:${Math.floor(vote.endsAt / 1000)}:F>\n` +
      "Vote counts are hidden.\n" +
      "You may change your vote before closing.";
  }

  return new EmbedBuilder()
    .setColor(finished ? 0x57f287 : 0x5865f2)
    .setTitle(`🗳 ${vote.title}`)
    .setDescription(description)
    .setFooter({
      text: "NoobV2 Voting System • Secret Ballot"
    })
    .setTimestamp();
}

function buildVoteButtons(vote) {
  if (vote.closed) return [];

  const rows = [];

  vote.options.forEach((option, index) => {
    if (index % 5 === 0) {
      rows.push(new ActionRowBuilder());
    }

    const button = new ButtonBuilder()
      .setCustomId(`hv_vote:${vote.id}:${index}`)
      .setLabel(option.label.slice(0, 80))
      .setStyle(ButtonStyle.Secondary);

    if (option.emoji) {
      try {
        button.setEmoji(option.emoji);
      } catch {}
    }

    rows[rows.length - 1].addComponents(button);
  });

  return rows;
}

async function closeVote(client, id) {
  const data = loadVotes();
  const vote = data[id];

  if (!vote || vote.closed || Date.now() < vote.endsAt) {
    return;
  }

  vote.closed = true;
  saveVotes(data);

  try {
    const channel = await client.channels.fetch(vote.channelId);
    const message = await channel.messages.fetch(vote.messageId);

    await message.edit({
      embeds: [buildVoteEmbed(vote, true)],
      components: []
    });

    console.log(`[HiddenVote] Vote ${id} completed.`);
  } catch (error) {
    console.error("[HiddenVote] Result publication failed:", error);
  }
}

async function hvHandle(interaction, client) {
  // ADMIN COMMAND: /hiddenvote
  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "hiddenvote"
  ) {
    if (
      !interaction.memberPermissions?.has(
        PermissionFlagsBits.Administrator
      )
    ) {
      await interaction.reply({
        content: "❌ Only administrators can create votes.",
        ephemeral: true
      });
      return true;
    }


const title = interaction.options.getString("question");
const rawOptions = interaction.options.getString("options");
const durationInput = interaction.options.getString("duration");

const durationMs = parseVoteDuration(durationInput);

if (durationMs === null) {
  await interaction.reply({
    content:
      "Invalid voting duration.\n\n" +
      "Supported formats:\n" +
      "`30m` = 30 minutes\n" +
      "`5h` = 5 hours\n" +
      "`1d` = 1 day\n" +
      "`7d` = 7 days\n" +
      "`1w` = 1 week\n\n" +
      "Minimum: 1 minute\n" +
      "Maximum: 30 days",
    ephemeral: true
  });

  return true;
}


    const entries = rawOptions
      .split("|")
      .map(entry => entry.trim())
      .filter(Boolean);

    if (entries.length < 2 || entries.length > 20) {
      await interaction.reply({
        content: "❌ Please provide between 2 and 20 voting options.",
        ephemeral: true
      });
      return true;
    }

    const options = entries.map(entry => {
      const match = entry.match(
        /^(<a?:\w+:\d+>|\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s+(.+)$/u
      );

      return match
        ? { emoji: match[1], label: match[2].trim() }
        : { emoji: null, label: entry };
    });

    if (options.some(option =>
      !option.label || option.label.length > 80
    )) {
      await interaction.reply({
        content: "❌ Each option must have a label of 1–80 characters.",
        ephemeral: true
      });
      return true;
    }

    await interaction.deferReply({ ephemeral: true });

    const id =
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 7);

    const vote = {
      id,
      title,
      options,
      votes: {},
endsAt: Date.now() + durationMs,
      channelId: interaction.channelId,
      messageId: null,
      closed: false
    };

    try {
      const message = await interaction.channel.send({
        embeds: [buildVoteEmbed(vote)],
        components: buildVoteButtons(vote),
        allowedMentions: { parse: [] }
      });

      vote.messageId = message.id;

      const data = loadVotes();
      data[id] = vote;
      saveVotes(data);

      await interaction.editReply({
        content:
          "**Hidden vote successfully created!**\n" +
          `${message.url}\n` +
`Results will be revealed automatically after ${durationInput}.`      });
    } catch (error) {
      console.error("[HiddenVote] Creation failed:", error);

      await interaction.editReply({
        content: "❌ Unable to create voting panel."
      });
    }

    return true;
  }

  // MEMBER VOTING BUTTONS
  if (
    interaction.isButton() &&
    interaction.customId.startsWith("hv_vote:")
  ) {
    const [, id, indexString] = interaction.customId.split(":");

    const data = loadVotes();
    const vote = data[id];
    const index = Number(indexString);

    if (
      !vote ||
      vote.closed ||
      Date.now() >= vote.endsAt ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= vote.options.length
    ) {
      await interaction.reply({
        content: "This voting session has ended or is unavailable.",
        ephemeral: true
      });

      if (vote && !vote.closed && Date.now() >= vote.endsAt) {
        await closeVote(client, id);
      }

      return true;
    }

    const previousVote = vote.votes[interaction.user.id];

    vote.votes[interaction.user.id] = index;
    saveVotes(data);

    const option = vote.options[index];

    await interaction.reply({
      content:
        previousVote === undefined
          ? `Your vote for **${option.label}** has been recorded privately!`
          : `Your vote has been updated to **${option.label}**!`,
      ephemeral: true
    });

    return true;
  }

  return false;
}

// AUTOMATIC MIDNIGHT RESULTS
function hvStart(client) {
  async function checkVotes() {
    const data = loadVotes();

    for (const [id, vote] of Object.entries(data)) {
      if (!vote.closed && Date.now() >= vote.endsAt) {
        await closeVote(client, id);
      }
    }
  }

  if (client.isReady()) {
    checkVotes().catch(error =>
      console.error("[HiddenVote] Startup:", error)
    );
  } else {
    client.once("ready", () => {
      checkVotes().catch(error =>
        console.error("[HiddenVote] Startup:", error)
      );
    });
  }

  const timer = setInterval(() => {
    checkVotes().catch(error =>
      console.error("[HiddenVote] Timer:", error)
    );
  }, 30000);

  timer.unref?.();
}

module.exports = {
  hvHandle,
  hvStart
};
