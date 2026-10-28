
const {
  joinVoiceChannel,
  getVoiceConnection,
  EndBehaviorType,
  VoiceConnectionStatus,
  entersState
} = require("@discordjs/voice");

const prism = require("prism-media");

const { PermissionFlagsBits } = require("discord.js");

const TRANSCRIPT_CHANNEL_ID = "1559764189612871742";

const sessions = new Map();
const consent = new Map();

function getConsent(guildId) {
  if (!consent.has(guildId)) {
    consent.set(guildId, new Set());
  }
  return consent.get(guildId);
}

function makeWav(pcm) {
  const header = Buffer.alloc(44);
  const sampleRate = 48000;
  const channels = 2;
  const bitDepth = 16;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(
    sampleRate * channels * bitDepth / 8,
    28
  );
  header.writeUInt16LE(channels * bitDepth / 8, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

async function transcribe(pcm) {
  const form = new FormData();

  form.append(
    "file",
    new Blob([makeWav(pcm)], { type: "audio/wav" }),
    "speech.wav"
  );

  form.append("model", "whisper-1");

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: form,
      signal: AbortSignal.timeout(60000)
    }
  );

  if (!response.ok) {
    throw new Error(
      `Transcription API returned ${response.status}: ` +
      (await response.text()).slice(0, 300)
    );
  }

  const result = await response.json();
  return String(result.text || "").trim();
}

function stopSession(guildId) {
  const session = sessions.get(guildId);

  if (!session) return false;

  session.active = false;
  session.connection.receiver.speaking.removeListener(
    "start",
    session.onSpeaking
  );

  session.connection.destroy();
  sessions.delete(guildId);
  getConsent(guildId).clear();

  return true;
}

async function startSession(interaction) {
  const channel = interaction.options.getChannel("channel");

  if (sessions.has(interaction.guildId)) {
    return interaction.reply({
      content: "❌ Transcription is already active. Use /leavevoice first.",
      ephemeral: true
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return interaction.reply({
      content: "❌ OPENAI_API_KEY is missing.",
      ephemeral: true
    });
  }

  const botMember = await interaction.guild.members.fetchMe();

  const permissions = channel.permissionsFor(botMember);

  if (
    !permissions?.has(PermissionFlagsBits.Connect) ||
    !permissions?.has(PermissionFlagsBits.ViewChannel)
  ) {
    return interaction.reply({
      content: "❌ I need permission to view and join that voice channel.",
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  let connection;

  try {
    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: interaction.guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true
    });

    await entersState(
      connection,
      VoiceConnectionStatus.Ready,
      20000
    );

    const transcriptChannel =
      await interaction.guild.channels.fetch(
        TRANSCRIPT_CHANNEL_ID
      );

    if (!transcriptChannel?.isTextBased()) {
      throw new Error("Transcript channel unavailable.");
    }

    const session = {
      connection,
      active: true,
      busy: new Set(),
      channelId: channel.id,
      transcriptChannel,
      onSpeaking: null
    };

    session.onSpeaking = async userId => {
      if (!session.active) return;
      if (!getConsent(interaction.guildId).has(userId)) return;
      if (session.busy.has(userId)) return;

      const member = await interaction.guild.members
        .fetch(userId)
        .catch(() => null);

      if (
        !member ||
        member.user.bot ||
        member.voice.channelId !== session.channelId
      ) return;

      session.busy.add(userId);

      const opusStream = connection.receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 1000
        }
      });

      const decoder = new prism.opus.Decoder({
        rate: 48000,
        channels: 2,
        frameSize: 960
      });

      const chunks = [];
      let bytes = 0;
      const maxBytes = 48000 * 2 * 2 * 20;

      const timeout = setTimeout(() => {
        opusStream.destroy();
      }, 20000);

      opusStream.on("error", error => {
        console.error("Voice stream error:", error);
        decoder.destroy();
      });

      decoder.on("data", chunk => {
        bytes += chunk.length;

        if (bytes <= maxBytes) {
          chunks.push(chunk);
        } else {
          opusStream.destroy();
        }
      });

      decoder.on("error", error => {
        console.error("Voice decoder error:", error);
      });

      decoder.on("end", async () => {
        clearTimeout(timeout);

        try {
          const pcm = Buffer.concat(chunks);

          // Ignore extremely short audio
          if (pcm.length < 48000 * 2 * 2) return;

          if (!session.active) return;
          if (!getConsent(interaction.guildId).has(userId)) return;

          const transcript = await transcribe(pcm);

          if (!session.active) return;
          if (!getConsent(interaction.guildId).has(userId)) return;
          if (!transcript) return;

          const name = member.displayName
            .replace(/[\r\n]/g, " ")
            .slice(0, 80);

          const content = `**${name}:** ${transcript}`
            .slice(0, 1900);

          await transcriptChannel.send({
            content,
            allowedMentions: { parse: [] }
          });

        } catch (error) {
          console.error("Voice transcription error:", error);
        } finally {
          session.busy.delete(userId);
        }
      });

      opusStream.pipe(decoder);
    };

    connection.receiver.speaking.on(
      "start",
      session.onSpeaking
    );

    sessions.set(interaction.guildId, session);

    connection.on(
      VoiceConnectionStatus.Disconnected,
      () => stopSession(interaction.guildId)
    );

    const notice =
      "🎙️ **Voice transcription is available.**\n" +
      "NoobV2 can send transcribed speech to " +
      `<#${TRANSCRIPT_CHANNEL_ID}>.\n` +
      "Only members who explicitly use " +
      "`/voiceconsent allow:True` will be transcribed.\n" +
      "Use `/voiceconsent allow:False` to opt out. " +
      "An administrator can stop the session with `/leavevoice`.";

    // Voice channels have an associated text chat.
    await channel.send({
      content: notice,
      allowedMentions: { parse: [] }
    }).catch(error => {
      console.error("Could not post voice notice:", error);
    });

    await transcriptChannel.send({
      content:
        `🎙️ **Transcription session started** in ${channel}.\n` +
        "Only consenting members will be transcribed.",
      allowedMentions: { parse: [] }
    });

    await interaction.editReply(
      `✅ Joined ${channel}. Members must opt in before transcription begins.`
    );

  } catch (error) {
    console.error("Join voice error:", error);

    if (connection) connection.destroy();

    await interaction.editReply(
      "❌ Could not start voice transcription. Check permissions and dependencies."
    );
  }
}

async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return false;

  const name = interaction.commandName;

  if (!["joinvoice", "leavevoice", "voiceconsent"].includes(name)) {
    return false;
  }

  if (
    name === "joinvoice" ||
    name === "leavevoice"
  ) {
    if (
      !interaction.memberPermissions?.has(
        PermissionFlagsBits.Administrator
      )
    ) {
      await interaction.reply({
        content: "❌ Administrator permission required.",
        ephemeral: true
      });
      return true;
    }
  }

  if (name === "joinvoice") {
    await startSession(interaction);
    return true;
  }

  if (name === "leavevoice") {
    const stopped = stopSession(interaction.guildId);

    await interaction.reply({
      content: stopped
        ? "✅ Voice transcription stopped and bot disconnected."
        : "❌ No active transcription session.",
      ephemeral: true
    });

    return true;
  }

  if (name === "voiceconsent") {
    const allow = interaction.options.getBoolean("allow");
    const session = sessions.get(interaction.guildId);
    const users = getConsent(interaction.guildId);

    if (allow) {
      if (
        !session ||
        interaction.member.voice.channelId !== session.channelId
      ) {
        await interaction.reply({
          content: "❌ Join the active transcription voice channel first.",
          ephemeral: true
        });
        return true;
      }

      users.add(interaction.user.id);
    } else {
      users.delete(interaction.user.id);
    }

    await interaction.reply({
      content: allow
        ? "✅ You opted in to voice transcription."
        : "✅ You opted out. Your future speech will not be transcribed.",
      ephemeral: true
    });

    return true;
  }

  return false;
}

module.exports = {
  handleInteraction,
  stopSession
};
