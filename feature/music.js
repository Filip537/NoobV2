const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require("discord.js");

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState
} = require("@discordjs/voice");

const { spawn } = require("child_process");

// guildId -> music state
const musicStates = new Map();

// userId -> temporary search
const musicSearches = new Map();

const MAX_SEARCH_RESULTS = 10;
const MAX_QUEUE_SIZE = 50;

// ==============================
// HELPERS
// ==============================

function isYoutubeURL(input) {
  if (!input) return false;

  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(
    input.trim()
  );
}

function formatDuration(seconds) {
  seconds = Number(seconds || 0);

  if (!seconds) return "Unknown";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      secs
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function getMusicState(guildId) {
  if (!musicStates.has(guildId)) {
    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause
      }
    });

    musicStates.set(guildId, {
      guildId,
      player,
      connection: null,
      queue: [],
      current: null,
      textChannelId: null,
      voiceChannelId: null,
      playing: false
    });

    setupPlayerEvents(guildId);
  }

  return musicStates.get(guildId);
}

// ==============================
// YT-DLP SEARCH
// ==============================

function searchYoutube(query, limit = MAX_SEARCH_RESULTS) {
  return new Promise((resolve, reject) => {
    const args = [
      `ytsearch${limit}:${query}`,
      "--flat-playlist",
      "--dump-single-json",
      "--no-warnings",
      "--skip-download"
    ];

    const process = spawn("yt-dlp", args);

    let stdout = "";
    let stderr = "";

    process.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });

    process.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });

    process.on("error", error => {
      reject(error);
    });

    process.on("close", code => {
      if (code !== 0) {
        console.error("YT-DLP SEARCH ERROR:", stderr);

        return reject(
          new Error("YouTube search failed.")
        );
      }

      try {
        const json = JSON.parse(stdout);

        const results = (json.entries || [])
          .filter(Boolean)
          .slice(0, limit)
          .map(entry => {
            const videoId =
              entry.id ||
              entry.url?.match(/[?&]v=([^&]+)/)?.[1];

            return {
              id: videoId,
              title: entry.title || "Unknown title",
              url: videoId
                ? `https://www.youtube.com/watch?v=${videoId}`
                : entry.url,
              duration: entry.duration || 0,
              uploader:
                entry.channel ||
                entry.uploader ||
                entry.channel_name ||
                "Unknown",
              thumbnail:
                entry.thumbnail ||
                (videoId
                  ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
                  : null)
            };
          })
          .filter(track => track.url);

        resolve(results);
      } catch (error) {
        console.error(
          "YT-DLP SEARCH JSON ERROR:",
          error,
          stdout
        );

        reject(error);
      }
    });
  });
}

// ==============================
// GET DIRECT VIDEO INFO
// ==============================

function getYoutubeInfo(url) {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      "--dump-single-json",
      "--no-playlist",
      "--no-warnings",
      "--skip-download"
    ];

    const process = spawn("yt-dlp", args);

    let stdout = "";
    let stderr = "";

    process.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });

    process.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });

    process.on("error", reject);

    process.on("close", code => {
      if (code !== 0) {
        console.error("YT-DLP INFO ERROR:", stderr);

        return reject(
          new Error("Could not read that YouTube video.")
        );
      }

      try {
        const data = JSON.parse(stdout);

        resolve({
          id: data.id,
          title: data.title || "Unknown title",
          url:
            data.webpage_url ||
            `https://www.youtube.com/watch?v=${data.id}`,
          duration: data.duration || 0,
          uploader:
            data.channel ||
            data.uploader ||
            "Unknown",
          thumbnail:
            data.thumbnail ||
            `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg`
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

// ==============================
// JOIN VOICE
// ==============================

async function joinUsersVoice(interaction) {
  const member = await interaction.guild.members
    .fetch(interaction.user.id)
    .catch(() => null);

  const voiceChannel = member?.voice?.channel;

  if (!voiceChannel) {
    throw new Error(
      "You need to join a voice channel first."
    );
  }

  const state = getMusicState(interaction.guild.id);

  let connection = getVoiceConnection(
    interaction.guild.id
  );

  if (
    !connection ||
    state.voiceChannelId !== voiceChannel.id
  ) {
    if (connection) {
      connection.destroy();
    }

    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guild.id,
      adapterCreator:
        interaction.guild.voiceAdapterCreator,
      selfDeaf: true
    });
  }

  try {
    await entersState(
      connection,
      VoiceConnectionStatus.Ready,
      20_000
    );
  } catch {
    connection.destroy();

    throw new Error(
      "I couldn't connect to your voice channel."
    );
  }

  connection.subscribe(state.player);

  state.connection = connection;
  state.voiceChannelId = voiceChannel.id;
  state.textChannelId = interaction.channelId;

  return state;
}

// ==============================
// STREAM
// ==============================

function createYoutubeStream(url) {
  const process = spawn(
    "yt-dlp",
    [
      url,

      // Get best audio
      "-f",
      "bestaudio/best",

      // Output media to stdout
      "-o",
      "-",

      "--no-playlist",
      "--quiet",
      "--no-warnings"
    ],
    {
      stdio: [
        "ignore",
        "pipe",
        "pipe"
      ]
    }
  );

  process.stderr.on("data", chunk => {
    const message = chunk.toString().trim();

    if (message) {
      console.error(
        "YT-DLP PLAYBACK:",
        message
      );
    }
  });

  return process;
}

// ==============================
// PLAY NEXT
// ==============================

async function playNext(guildId) {
  const state = musicStates.get(guildId);

  if (!state) return;

  if (state.queue.length === 0) {
    state.current = null;
    state.playing = false;

    return;
  }

  const track = state.queue.shift();

  state.current = track;
  state.playing = true;

  try {
    const ytProcess =
      createYoutubeStream(track.url);

    const resource = createAudioResource(
      ytProcess.stdout,
      {
        metadata: {
          track,
          ytProcess
        }
      }
    );

    state.player.play(resource);

    const client =
      state.connection?.joinConfig
        ? null
        : null;

    return track;
  } catch (error) {
    console.error(
      "MUSIC PLAY ERROR:",
      error
    );

    state.current = null;
    state.playing = false;

    return playNext(guildId);
  }
}

// ==============================
// PLAYER EVENTS
// ==============================

function setupPlayerEvents(guildId) {
  const state = musicStates.get(guildId);

  if (!state) return;

  state.player.on(
    AudioPlayerStatus.Idle,
    async oldState => {
      try {
        const oldProcess =
          oldState.resource?.metadata?.ytProcess;

        if (
          oldProcess &&
          !oldProcess.killed
        ) {
          oldProcess.kill("SIGKILL");
        }
      } catch {}

      state.current = null;
      state.playing = false;

      if (state.queue.length > 0) {
        await playNext(guildId);
      }
    }
  );

  state.player.on("error", async error => {
    console.error(
      "AUDIO PLAYER ERROR:",
      error
    );

    try {
      const process =
        error.resource?.metadata?.ytProcess;

      if (
        process &&
        !process.killed
      ) {
        process.kill("SIGKILL");
      }
    } catch {}

    state.current = null;
    state.playing = false;

    if (state.queue.length > 0) {
      await playNext(guildId);
    }
  });
}

// ==============================
// ADD TRACK
// ==============================

async function addTrack(
  interaction,
  track,
  shouldPlayImmediately = false
) {
  const state =
    await joinUsersVoice(interaction);

  track.requestedBy =
    interaction.user.id;

  if (
    shouldPlayImmediately &&
    !state.current
  ) {
    state.queue.unshift(track);

    await playNext(
      interaction.guild.id
    );

    return {
      state,
      position: 0,
      started: true
    };
  }

  if (state.queue.length >= MAX_QUEUE_SIZE) {
    throw new Error(
      `The music queue is full. Maximum: ${MAX_QUEUE_SIZE} songs.`
    );
  }

  state.queue.push(track);

  if (!state.current) {
    await playNext(
      interaction.guild.id
    );

    return {
      state,
      position: 0,
      started: true
    };
  }

  return {
    state,
    position: state.queue.length,
    started: false
  };
}

// ==============================
// BUILD SEARCH MENU
// ==============================

function buildSearchMenu(
  userId,
  searchId,
  results,
  mode
) {
  const select =
    new StringSelectMenuBuilder()
      .setCustomId(
        `musicsearch_${mode}_${userId}_${searchId}`
      )
      .setPlaceholder(
        "Select a song"
      )
      .addOptions(
        results.map(
          (track, index) => ({
            label:
              track.title.slice(0, 100),

            description:
              `${track.uploader} • ${formatDuration(
                track.duration
              )}`.slice(0, 100),

            value: String(index)
          })
        )
      );

  return new ActionRowBuilder()
    .addComponents(select);
}

// ==============================
// /PLAY
// ==============================

async function handlePlay(interaction) {
  const query =
    interaction.options
      .getString("query", true)
      .trim();

  const member =
    await interaction.guild.members
      .fetch(interaction.user.id)
      .catch(() => null);

  if (!member?.voice?.channel) {
    return interaction.reply({
      content:
        "Join a voice channel first.",
      ephemeral: true
    });
  }

  await interaction.deferReply();

  try {
    // ==============================
    // DIRECT YOUTUBE LINK
    // ==============================

    if (isYoutubeURL(query)) {
      const track =
        await getYoutubeInfo(query);

      const result =
        await addTrack(
          interaction,
          track,
          true
        );

      const embed =
        new EmbedBuilder()
          .setColor("Purple")
          .setTitle(
            result.started
              ? "Now Playing"
              : "Added to Queue"
          )
          .setDescription(
            `**[${track.title}](${track.url})**\n\n` +
            `Uploader: **${track.uploader}**\n` +
            `Duration: **${formatDuration(
              track.duration
            )}**`
          )
          .setThumbnail(
            track.thumbnail
          )
          .setFooter({
            text:
              `Requested by ${interaction.user.username}`
          });

      return interaction.editReply({
        embeds: [embed]
      });
    }

    // ==============================
    // SEARCH
    // ==============================

    let searchQuery = query;

    // Make plain "ncs" searches better
    if (
      query.toLowerCase() === "ncs"
    ) {
      searchQuery =
        "NCS NoCopyrightSounds popular";
    }

    const results =
      await searchYoutube(
        searchQuery,
        MAX_SEARCH_RESULTS
      );

    if (!results.length) {
      return interaction.editReply({
        content:
          "I couldn't find any songs for that search."
      });
    }

    const searchId =
      Date.now().toString(36);

    musicSearches.set(searchId, {
      userId:
        interaction.user.id,

      guildId:
        interaction.guild.id,

      mode: "play",

      results,

      createdAt:
        Date.now()
    });

    const list =
      results
        .map(
          (track, index) =>
            `**${index + 1}.** ${track.title}\n` +
            `${track.uploader} • ${formatDuration(
              track.duration
            )}`
        )
        .join("\n\n");

    const embed =
      new EmbedBuilder()
        .setColor("Purple")
        .setTitle(
          `Search Results: ${query}`
        )
        .setDescription(
          list.slice(0, 4000)
        )
        .setFooter({
          text:
            "Select the song you want to play."
        });

    const row =
      buildSearchMenu(
        interaction.user.id,
        searchId,
        results,
        "play"
      );

    return interaction.editReply({
      embeds: [embed],
      components: [row]
    });
  } catch (error) {
    console.error(
      "/PLAY ERROR:",
      error
    );

    return interaction.editReply({
      content:
        `Could not play that song.\n\`${error.message}\``
    });
  }
}

// ==============================
// /ADDQUEUE
// ==============================

async function handleAddQueue(
  interaction
) {
  const query =
    interaction.options
      .getString("query", true)
      .trim();

  const member =
    await interaction.guild.members
      .fetch(interaction.user.id)
      .catch(() => null);

  if (!member?.voice?.channel) {
    return interaction.reply({
      content:
        "Join a voice channel first.",
      ephemeral: true
    });
  }

  await interaction.deferReply();

  try {
    // DIRECT LINK

    if (isYoutubeURL(query)) {
      const track =
        await getYoutubeInfo(query);

      const result =
        await addTrack(
          interaction,
          track,
          false
        );

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("Green")
            .setTitle(
              result.started
                ? "Now Playing"
                : "Added to Queue"
            )
            .setDescription(
              `**[${track.title}](${track.url})**\n\n` +
              (
                result.started
                  ? "Playing now."
                  : `Queue position: **${result.position}**`
              )
            )
            .setThumbnail(
              track.thumbnail
            )
        ]
      });
    }

    // SEARCH

    let searchQuery = query;

    if (
      query.toLowerCase() === "ncs"
    ) {
      searchQuery =
        "NCS NoCopyrightSounds popular";
    }

    const results =
      await searchYoutube(
        searchQuery,
        MAX_SEARCH_RESULTS
      );

    if (!results.length) {
      return interaction.editReply({
        content:
          "No songs found."
      });
    }

    const searchId =
      Date.now().toString(36);

    musicSearches.set(searchId, {
      userId:
        interaction.user.id,

      guildId:
        interaction.guild.id,

      mode: "queue",

      results,

      createdAt:
        Date.now()
    });

    const description =
      results
        .map(
          (track, index) =>
            `**${index + 1}.** ${track.title}\n` +
            `${track.uploader} • ${formatDuration(
              track.duration
            )}`
        )
        .join("\n\n");

    const embed =
      new EmbedBuilder()
        .setColor("Green")
        .setTitle(
          `Add to Queue: ${query}`
        )
        .setDescription(
          description.slice(0, 4000)
        )
        .setFooter({
          text:
            "Choose a song to add."
        });

    const row =
      buildSearchMenu(
        interaction.user.id,
        searchId,
        results,
        "queue"
      );

    return interaction.editReply({
      embeds: [embed],
      components: [row]
    });
  } catch (error) {
    console.error(
      "/ADDQUEUE ERROR:",
      error
    );

    return interaction.editReply({
      content:
        `Could not add that song.\n\`${error.message}\``
    });
  }
}

// ==============================
// SEARCH SELECT
// ==============================

async function handleSelect(
  interaction
) {
  if (
    !interaction.customId.startsWith(
      "musicsearch_"
    )
  ) {
    return false;
  }

  const parts =
    interaction.customId.split("_");

  const mode = parts[1];
  const ownerId = parts[2];
  const searchId = parts[3];

  if (
    interaction.user.id !== ownerId
  ) {
    await interaction.reply({
      content:
        "This isn't your music search.",
      ephemeral: true
    });

    return true;
  }

  const search =
    musicSearches.get(searchId);

  if (!search) {
    await interaction.reply({
      content:
        "This music search expired. Run the command again.",
      ephemeral: true
    });

    return true;
  }

  // 5 minute expiry
  if (
    Date.now() -
      search.createdAt >
    5 * 60 * 1000
  ) {
    musicSearches.delete(searchId);

    await interaction.reply({
      content:
        "This music search expired.",
      ephemeral: true
    });

    return true;
  }

  const selectedIndex =
    Number(interaction.values[0]);

  const track =
    search.results[
      selectedIndex
    ];

  if (!track) {
    await interaction.reply({
      content:
        "Song not found.",
      ephemeral: true
    });

    return true;
  }

  await interaction.deferUpdate();

  try {
    const result =
      await addTrack(
        interaction,
        track,
        mode === "play"
      );

    musicSearches.delete(searchId);

    const embed =
      new EmbedBuilder()
        .setColor(
          result.started
            ? "Purple"
            : "Green"
        )
        .setTitle(
          result.started
            ? "Now Playing"
            : "Added to Queue"
        )
        .setThumbnail(
          track.thumbnail
        )
        .setDescription(
          `**[${track.title}](${track.url})**\n\n` +
          `Uploader: **${track.uploader}**\n` +
          `Duration: **${formatDuration(
            track.duration
          )}**\n` +
          (
            result.started
              ? "\nPlaying now."
              : `\nQueue position: **${result.position}**`
          )
        );

    await interaction.editReply({
      embeds: [embed],
      components: []
    });

    return true;
  } catch (error) {
    console.error(
      "MUSIC SELECT ERROR:",
      error
    );

    await interaction.editReply({
      content:
        `Could not play that song.\n\`${error.message}\``,
      embeds: [],
      components: []
    });

    return true;
  }
}

// ==============================
// /CHECKQUEUE
// ==============================

async function handleCheckQueue(
  interaction
) {
  const state =
    musicStates.get(
      interaction.guild.id
    );

  if (
    !state ||
    (!state.current &&
      state.queue.length === 0)
  ) {
    return interaction.reply({
      content:
        "The music queue is empty."
    });
  }

  let description = "";

  if (state.current) {
    description +=
      `## Now Playing\n` +
      `**[${state.current.title}](${state.current.url})**\n` +
      `${state.current.uploader} • ${formatDuration(
        state.current.duration
      )}\n\n`;
  }

  description +=
    "## Up Next\n";

  if (
    state.queue.length === 0
  ) {
    description +=
      "Nothing queued.";
  } else {
    description +=
      state.queue
        .slice(0, 15)
        .map(
          (track, index) =>
            `**${index + 1}.** ` +
            `[${track.title}](${track.url}) ` +
            `• ${formatDuration(
              track.duration
            )}`
        )
        .join("\n");

    if (
      state.queue.length > 15
    ) {
      description +=
        `\n\n+ ${
          state.queue.length - 15
        } more songs`;
    }
  }

  const embed =
    new EmbedBuilder()
      .setColor("Blue")
      .setTitle("Music Queue")
      .setDescription(
        description.slice(
          0,
          4000
        )
      )
      .setFooter({
        text:
          `${state.queue.length} song(s) waiting`
      });

  return interaction.reply({
    embeds: [embed]
  });
}

// ==============================
// /STOP
// ==============================

async function handleStop(
  interaction
) {
  const state =
    musicStates.get(
      interaction.guild.id
    );

  const connection =
    getVoiceConnection(
      interaction.guild.id
    );

  if (
    !state &&
    !connection
  ) {
    return interaction.reply({
      content:
        "I'm not playing anything.",
      ephemeral: true
    });
  }

  if (state) {
    try {
      const resource =
        state.player
          .state
          .resource;

      const process =
        resource
          ?.metadata
          ?.ytProcess;

      if (
        process &&
        !process.killed
      ) {
        process.kill("SIGKILL");
      }
    } catch {}

    state.queue = [];
    state.current = null;
    state.playing = false;

    state.player.stop(true);
  }

  if (connection) {
    connection.destroy();
  }

  musicStates.delete(
    interaction.guild.id
  );

  return interaction.reply({
    content:
      "Music stopped and queue cleared."
  });
}

// ==============================
// MAIN COMMAND HANDLER
// ==============================

async function handleCommand(
  interaction
) {
  if (
    !interaction.isChatInputCommand()
  ) {
    return false;
  }

  if (
    interaction.commandName ===
    "play"
  ) {
    await handlePlay(
      interaction
    );

    return true;
  }

  if (
    interaction.commandName ===
    "addqueue"
  ) {
    await handleAddQueue(
      interaction
    );

    return true;
  }

  if (
    interaction.commandName ===
    "checkqueue"
  ) {
    await handleCheckQueue(
      interaction
    );

    return true;
  }

  if (
    interaction.commandName ===
    "stop"
  ) {
    await handleStop(
      interaction
    );

    return true;
  }

  return false;
}

module.exports = {
  handleCommand,
  handleSelect
};