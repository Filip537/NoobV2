// feature/growtopiaSync.js

const fs = require("fs");
const path = require("path");
const https = require("https");
const { EmbedBuilder, MessageFlags } = require("discord.js");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "growtopiaSync.json");

const DETAIL_URL = "https://www.growtopiagame.com/detail";
const CACHE_MS = 60 * 1000;

let cache = null;
let cacheTime = 0;
let pendingRequest = null;

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { users: {} };
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    return {
      users: data.users || {}
    };
  } catch (error) {
    console.error("[GT Sync] Database read error:", error);
    throw new Error("Unable to read Growtopia registration data.");
  }
}

function saveData(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const tempFile = `${DATA_FILE}.tmp`;

  fs.writeFileSync(
    tempFile,
    JSON.stringify(data, null, 2),
    "utf8"
  );

  fs.renameSync(tempFile, DATA_FILE);
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "NoobV2-GrowtopiaSync/1.0",
          Accept: "application/json"
        }
      },
      res => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(
            new Error(`Growtopia returned HTTP ${res.statusCode}`)
          );
        }

        let body = "";

        res.setEncoding("utf8");

        res.on("data", chunk => {
          body += chunk;

          if (body.length > 1024 * 1024) {
            req.destroy(new Error("Response too large"));
          }
        });

        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error("Invalid Growtopia response"));
          }
        });

        res.on("error", reject);
      }
    );

    req.setTimeout(8000, () => {
      req.destroy(new Error("Growtopia request timed out"));
    });

    req.on("error", reject);
  });
}

async function getDetails() {
  if (cache && Date.now() - cacheTime < CACHE_MS) {
    return cache;
  }

  if (pendingRequest) {
    return pendingRequest;
  }

  pendingRequest = fetchJSON(DETAIL_URL)
    .then(data => {
      cache = data;
      cacheTime = Date.now();
      return data;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}

function extractOnline(data) {
  const value = data?.online_user ?? data?.onlineUsersCount;

  if (value === undefined || value === null) {
    return null;
  }

  const number = Number(String(value).replace(/,/g, ""));

  return Number.isFinite(number) && number >= 0
    ? number
    : null;
}

function extractWOTD(data) {
  const rawURL =
    data?.world_day_images?.full_size ||
    data?.worldOfDay?.renderURL ||
    null;

  const directName =
    data?.world_day_name ||
    data?.worldOfDay?.worldName ||
    null;

  let name = directName;

  if (!name && rawURL) {
    try {
      const filename = new URL(rawURL)
        .pathname
        .split("/")
        .pop();

      name = decodeURIComponent(filename)
        .replace(/\.(png|jpg|jpeg|webp)$/i, "")
        .toUpperCase();
    } catch {
      name = null;
    }
  }

  let image = null;

  if (rawURL) {
    try {
      const parsed = new URL(rawURL);

      if (parsed.protocol === "https:") {
        image = parsed.toString();
      }
    } catch {}
  }

  return { name, image };
}

function createEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0x39b86a)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "NoobV2 • Growtopia Sync" })
    .setTimestamp();
}

function validateName(value) {
  return /^[A-Za-z0-9_]{3,24}$/.test(value);
}

async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) {
    return false;
  }

  const command = interaction.commandName;

  const supported = [
    "gtstatus",
    "gtonline",
    "gtwotd",
    "gtlink",
    "gtprofile",
    "registerworld",
    "myworlds"
  ];

  if (!supported.includes(command)) {
    return false;
  }

  try {
    if (["gtstatus", "gtonline", "gtwotd"].includes(command)) {
      await interaction.deferReply();

      let details;

      try {
        details = await getDetails();
      } catch (error) {
        console.error("[GT Sync] API error:", error.message);

        await interaction.editReply({
          embeds: [
            createEmbed(
              "Growtopia Information Unavailable",
              "Could not retrieve Growtopia's public information right now. Please try again later.\n\nThis does not necessarily mean the game servers are offline."
            )
          ]
        });

        return true;
      }

      const online = extractOnline(details);
      const wotd = extractWOTD(details);

      if (command === "gtstatus") {
        const embed = createEmbed(
          "Growtopia Public Information",
          "The public information endpoint responded successfully. This does not confirm that gameplay servers are online."
        ).addFields(
          {
            name: "Public endpoint",
            value: "Responding",
            inline: true
          },
          {
            name: "Players Online",
            value: online === null
              ? "Unavailable"
              : online.toLocaleString("en-US"),
            inline: true
          },
          {
            name: "World of the Day",
            value: wotd.name || "Unavailable"
          }
        );

        await interaction.editReply({ embeds: [embed] });
        return true;
      }

      if (command === "gtonline") {
        const embed = createEmbed(
          "Growtopia Online Players",
          online === null
            ? "The public response did not contain a usable online player count."
            : `**${online.toLocaleString("en-US")}** players reported online.`
        );

        await interaction.editReply({ embeds: [embed] });
        return true;
      }

      if (command === "gtwotd") {
        const embed = createEmbed(
          "Growtopia World of the Day",
          wotd.name
            ? `**${wotd.name}**`
            : "World of the Day information is currently unavailable."
        );

        if (wotd.image) {
          embed.setImage(wotd.image);
        }

        await interaction.editReply({ embeds: [embed] });
        return true;
      }
    }

    if (command === "gtlink") {
      const growid = interaction.options.getString("growid").trim();

      if (!validateName(growid)) {
        await interaction.reply({
          content: "Invalid GrowID format. Use 3–24 letters, numbers, or underscores.",
          flags: MessageFlags.Ephemeral
        });

        return true;
      }

      const data = loadData();
      const id = interaction.user.id;

      if (!data.users[id]) {
        data.users[id] = {
          growid: null,
          worlds: []
        };
      }

      data.users[id].growid = growid;

      saveData(data);

      await interaction.reply({
        embeds: [
          createEmbed(
            "GrowID Registered",
            `Your Discord account is now associated with **${growid}**.\n\nThis is a self-reported GrowID and has not been verified with Growtopia.`
          )
        ],
        flags: MessageFlags.Ephemeral
      });

      return true;
    }

    if (command === "gtprofile") {
      const target =
        interaction.options.getUser("user") ||
        interaction.user;

      const data = loadData();
      const profile = data.users[target.id];

      if (!profile?.growid) {
        await interaction.reply({
          content: "This user has not registered a GrowID.",
          flags: MessageFlags.Ephemeral
        });

        return true;
      }

      const worlds = Array.isArray(profile.worlds)
        ? profile.worlds
        : [];

      const embed = createEmbed(
        "Growtopia Profile",
        `**Discord:** ${target.username}\n**Registered GrowID:** ${profile.growid}\n**Registered Worlds:** ${worlds.length}\n\n*Registration is self-reported and unverified.*`
      );

      await interaction.reply({ embeds: [embed] });
      return true;
    }

    if (command === "registerworld") {
      const world = interaction.options
        .getString("world")
        .trim()
        .toUpperCase();

      if (!validateName(world)) {
        await interaction.reply({
          content: "Invalid world name. Use 3–24 letters, numbers, or underscores.",
          flags: MessageFlags.Ephemeral
        });

        return true;
      }

      const data = loadData();
      const id = interaction.user.id;
      const profile = data.users[id];

      if (!profile?.growid) {
        await interaction.reply({
          content: "Register your GrowID first using `/gtlink`.",
          flags: MessageFlags.Ephemeral
        });

        return true;
      }

      if (!Array.isArray(profile.worlds)) {
        profile.worlds = [];
      }

      if (profile.worlds.includes(world)) {
        await interaction.reply({
          content: `**${world}** is already registered.`,
          flags: MessageFlags.Ephemeral
        });

        return true;
      }

      if (profile.worlds.length >= 20) {
        await interaction.reply({
          content: "You can register a maximum of 20 worlds.",
          flags: MessageFlags.Ephemeral
        });

        return true;
      }

      profile.worlds.push(world);

      saveData(data);

      await interaction.reply({
        embeds: [
          createEmbed(
            "World Registered",
            `**${world}** has been added to your profile.\n\nWorld ownership has not been verified.`
          )
        ],
        flags: MessageFlags.Ephemeral
      });

      return true;
    }

    if (command === "myworlds") {
      const target =
        interaction.options.getUser("user") ||
        interaction.user;

      const data = loadData();
      const profile = data.users[target.id];

      const worlds = Array.isArray(profile?.worlds)
        ? profile.worlds
        : [];

      const description = worlds.length
        ? worlds.map((world, index) =>
            `**${index + 1}.** ${world}`
          ).join("\n")
        : "No registered worlds found.";

      await interaction.reply({
        embeds: [
          createEmbed(
            `${target.username}'s Registered Worlds`,
            `${description}\n\n*World registrations are self-reported.*`
          )
        ]
      });

      return true;
    }

    return true;
  } catch (error) {
    console.error("[GT Sync] Command error:", error);

    const response = {
      content: "Something went wrong while processing the Growtopia command.",
      flags: MessageFlags.Ephemeral
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(response).catch(console.error);
    } else {
      await interaction.reply(response).catch(console.error);
    }

    return true;
  }
}

module.exports = {
  handleInteraction
};