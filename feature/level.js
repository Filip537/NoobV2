
const fs = require("fs");
const path = require("path");

const levelFile = path.join(__dirname, "..", "levels.json");
const migrationFile = path.join(__dirname, "..", "arcane-migration.json");

// ==========================================
// CONFIGURATION
// ==========================================

const GUILD_ID = "1411983843442823272";

// NoobV2 level announcements
const LEVEL_CHANNEL_ID = "1442714367568248916";

// Original Arcane level announcements
const ARCANE_CHANNEL_ID = "1439934982847205490";
const ARCANE_BOT_ID = "437808476106784770";

// Original Level 5 role
const LEVEL_5_ROLE_ID = "1485405233990467735";

const MAX_LEVEL = 150;

const LEVEL_ROLES = [
  { level: 10, roleId: "1551190845825220669" },
  { level: 20, roleId: "1451111483269447866" },
  { level: 40, roleId: "1451111522339389493" }
];

// ==========================================
// XP CONFIGURATION
// ==========================================

const XP_COOLDOWN = 60 * 1000;
const MIN_XP = 5;
const MAX_XP = 10;

const xpCooldowns = new Map();

let migrationPromise = null;
let migrationCompleted = false;

// ==========================================
// LOAD LEVEL DATA
// ==========================================

function loadLevels() {
  try {
    if (!fs.existsSync(levelFile)) {
      fs.writeFileSync(levelFile, "{}");
      return {};
    }

    const raw = fs.readFileSync(levelFile, "utf8").trim();

    if (!raw) {
      throw new Error("levels.json is empty");
    }

    const data = JSON.parse(raw);

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Invalid level data");
    }

    return data;

  } catch (error) {
    console.error("[LEVEL] Failed to load data:", error);
    return null;
  }
}

// ==========================================
// SAVE LEVEL DATA
// ==========================================

function saveLevels(data) {
  try {
    const tempFile = `${levelFile}.tmp`;

    fs.writeFileSync(
      tempFile,
      JSON.stringify(data, null, 2)
    );

    fs.renameSync(tempFile, levelFile);

    return true;

  } catch (error) {
    console.error("[LEVEL] Failed to save data:", error);
    return false;
  }
}

// ==========================================
// XP CALCULATION
// ==========================================

function getXPNeeded(level) {
  const earlyLevels = {
    0: 15,
    1: 25,
    2: 40,
    3: 60,
    4: 100
  };

  if (level >= MAX_LEVEL) return 0;

  if (level < 5) {
    return earlyLevels[level];
  }

  return Math.floor(
    200 + Math.pow(level, 1.7) * 15
  );
}

function getRandomXP() {
  return Math.floor(
    Math.random() * (MAX_XP - MIN_XP + 1)
  ) + MIN_XP;
}

// ==========================================
// READ ARCANE ANNOUNCEMENT
// ==========================================

function parseArcaneMessage(message) {
  if (message.author.id !== ARCANE_BOT_ID) {
    return null;
  }

  const parts = [message.content || ""];

  for (const embed of message.embeds || []) {
    parts.push(embed.title || "");
    parts.push(embed.description || "");

    for (const field of embed.fields || []) {
      parts.push(field.name || "");
      parts.push(field.value || "");
    }
  }

  const content = parts.join(" ")
    .replace(/\*/g, "")
    .replace(/`/g, "");

  const match = content.match(
    /<@!?(\d+)>\s+has reached level\s+(\d+)/i
  );

  if (!match) return null;

  const userId = match[1];
  const level = Number(match[2]);

  if (!Number.isSafeInteger(level) || level < 1) {
    return null;
  }

  return {
    userId,
    level: Math.min(level, MAX_LEVEL)
  };
}

// ==========================================
// AUTOMATIC ARCANE MIGRATION
// ==========================================

async function importArcaneLevels(client) {
  if (migrationCompleted) return true;

  if (migrationPromise) {
    return migrationPromise;
  }

  migrationPromise = (async () => {
    try {
      // Do not repeat a completed migration.
      if (
        fs.existsSync(migrationFile) &&
        fs.existsSync(levelFile)
      ) {
        const report = JSON.parse(
          fs.readFileSync(migrationFile, "utf8")
        );

        if (
          report.completed === true &&
          report.guildId === GUILD_ID &&
          report.channelId === ARCANE_CHANNEL_ID &&
          loadLevels() !== null
        ) {
          migrationCompleted = true;
          return true;
        }
      }

      console.log("[ARCANE] Starting level migration...");

      const guild = await client.guilds.fetch(GUILD_ID);

      const channel = await guild.channels.fetch(
        ARCANE_CHANNEL_ID
      );

      if (!channel || !channel.messages) {
        throw new Error("Arcane level channel not found");
      }

      const imported = new Map();

      let before;
      let scanned = 0;
      let matched = 0;

      // Scan the entire channel history.
      while (true) {
        const messages = await channel.messages.fetch({
          limit: 100,
          cache: false,
          ...(before ? { before } : {})
        });

        if (!messages.size) break;

        for (const message of messages.values()) {
          scanned++;

          const result = parseArcaneMessage(message);

          if (!result) continue;

          matched++;

          const previous = imported.get(result.userId) || 0;

          imported.set(
            result.userId,
            Math.max(previous, result.level)
          );
        }

        before = messages.last().id;

        if (scanned % 1000 === 0) {
          console.log(
            `[ARCANE] Scanned ${scanned} messages...`
          );
        }

        if (messages.size < 100) break;
      }

      // Prevent an empty or incorrect import.
      if (matched === 0) {
        throw new Error(
          "No Arcane announcements matched. Check the bot ID and message format."
        );
      }

      const arcaneLevels = new Map(imported);

      // ======================================
      // LEVEL 5 ROLE FALLBACK
      // ======================================

      const members = await guild.members.fetch();

      let roleFallbacks = 0;

      for (const member of members.values()) {
        if (member.user.bot) continue;

        if (!member.roles.cache.has(LEVEL_5_ROLE_ID)) {
          continue;
        }

        const previous = imported.get(member.id) || 0;

        if (previous < 5) {
          imported.set(member.id, 5);
          roleFallbacks++;
        }
      }

      // Remove departed members and bots.
      for (const userId of imported.keys()) {
        const member = members.get(userId);

        if (!member || member.user.bot) {
          imported.delete(userId);
        }
      }

      // Reload latest data before merging.
      const levels = loadLevels();

      if (levels === null) {
        throw new Error("Unable to load existing levels.json");
      }

      // Create backup before modifying data.
      const backupFile =
        `${levelFile}.backup-${Date.now()}`;

      fs.copyFileSync(levelFile, backupFile);

      let updated = 0;
      let preserved = 0;

      const reportUsers = {};

      // ======================================
      // MERGE WITHOUT LOSING EXISTING DATA
      // ======================================

      for (const [userId, importedLevel] of imported) {
        if (!levels[userId]) {
          levels[userId] = {
            level: 0,
            xp: 0,
            wl: 0
          };
        }

        const userData = levels[userId];

        if (
          !Number.isInteger(userData.level) ||
          userData.level < 0 ||
          !Number.isFinite(userData.xp) ||
          userData.xp < 0
        ) {
          throw new Error(`Invalid existing data: ${userId}`);
        }

        const previousLevel = userData.level;

        if (importedLevel > previousLevel) {
          userData.level = importedLevel;

          // Arcane announcements do not contain partial XP.
          userData.xp = 0;

          updated++;
        } else {
          preserved++;
        }

        // Keep existing WL balances and other properties.
        userData.arcaneLevel =
          arcaneLevels.get(userId) || 0;

        userData.importedLevel = importedLevel;

        userData.levelSource =
          arcaneLevels.has(userId) &&
          arcaneLevels.get(userId) >= importedLevel
            ? "Arcane"
            : "Level 5 Role";

        reportUsers[userId] = {
          arcaneLevel: userData.arcaneLevel,
          importedLevel,
          previousLevel,
          finalLevel: userData.level,
          source: userData.levelSource
        };
      }

      if (!saveLevels(levels)) {
        throw new Error("Failed to save imported levels");
      }

      // Save migration completion report.
      const report = {
        completed: true,
        guildId: GUILD_ID,
        channelId: ARCANE_CHANNEL_ID,
        completedAt: new Date().toISOString(),
        scannedMessages: scanned,
        matchedAnnouncements: matched,
        importedUsers: imported.size,
        roleFallbacks,
        updatedUsers: updated,
        preservedUsers: preserved,
        backupFile,
        users: reportUsers
      };

      fs.writeFileSync(
        migrationFile,
        JSON.stringify(report, null, 2)
      );

      migrationCompleted = true;

      console.log("[ARCANE] Migration completed!");
      console.log(`[ARCANE] Messages scanned: ${scanned}`);
      console.log(`[ARCANE] Announcements matched: ${matched}`);
      console.log(`[ARCANE] Members imported: ${imported.size}`);
      console.log(`[ARCANE] Level 5 fallbacks: ${roleFallbacks}`);
      console.log(`[ARCANE] Levels updated: ${updated}`);
      console.log(`[ARCANE] Existing levels preserved: ${preserved}`);

      return true;

    } catch (error) {
      console.error("[ARCANE] Migration failed:", error);

      return false;
    }
  })();

  try {
    return await migrationPromise;
  } finally {
    migrationPromise = null;
  }
}

// ==========================================
// LEVEL REWARD ROLES
// ==========================================

async function updateLevelRoles(member, level) {
  if (!member) return;

  for (const levelRole of LEVEL_ROLES) {
    if (level < levelRole.level) continue;

    try {
      const role = member.guild.roles.cache.get(
        levelRole.roleId
      );

      if (!role) continue;

      if (!member.roles.cache.has(levelRole.roleId)) {
        await member.roles.add(role);
      }

    } catch (error) {
      console.error("[LEVEL] Failed to update role:", error);
    }
  }
}

// ==========================================
// LEVEL-UP ANNOUNCEMENT
// NO MEMBER PINGS
// ==========================================

async function sendLevelUpMessage(message, level) {
  try {
    const channel = await message.guild.channels
      .fetch(LEVEL_CHANNEL_ID)
      .catch(() => null);

    if (!channel || !channel.isTextBased()) {
      console.error("[LEVEL] Announcement channel not found");
      return;
    }

    await channel.send({
      content:
        `<@${message.author.id}> has reached level **${level}**. GG!`,

      allowedMentions: {
        parse: [],
        users: [],
        roles: [],
        repliedUser: false
      }
    });

  } catch (error) {
    console.error("[LEVEL] Announcement failed:", error);
  }
}

// ==========================================
// MESSAGE XP HANDLER
// ==========================================

async function handleLevelXP(message) {
  if (!message.guild) return;
  if (message.guild.id !== GUILD_ID) return;
  if (message.author.bot) return;
  if (message.webhookId) return;

  if (message.channel.id === LEVEL_CHANNEL_ID) return;
  if (message.channel.id === ARCANE_CHANNEL_ID) return;

  // Ensure Arcane levels are imported before awarding XP.
  const ready = await importArcaneLevels(message.client);

  if (!ready) return;

  const userId = message.author.id;
  const now = Date.now();

  const lastXP = xpCooldowns.get(userId);

  if (lastXP && now - lastXP < XP_COOLDOWN) {
    return;
  }

  const levels = loadLevels();

  if (levels === null) return;

  if (!levels[userId]) {
    levels[userId] = {
      level: 0,
      xp: 0,
      wl: 0
    };
  }

  const userData = levels[userId];

  if (
    !Number.isInteger(userData.level) ||
    userData.level < 0 ||
    !Number.isFinite(userData.xp) ||
    userData.xp < 0
  ) {
    console.error(`[LEVEL] Invalid data for ${userId}`);
    return;
  }

  if (userData.level >= MAX_LEVEL) return;

  xpCooldowns.set(userId, now);

  const cooldownTimer = setTimeout(() => {
    if (xpCooldowns.get(userId) === now) {
      xpCooldowns.delete(userId);
    }
  }, XP_COOLDOWN);

  cooldownTimer.unref();

  const previousLevel = userData.level;

  // Award 5-10 XP.
  userData.xp += getRandomXP();

  while (
    userData.level < MAX_LEVEL &&
    userData.xp >= getXPNeeded(userData.level)
  ) {
    userData.xp -= getXPNeeded(userData.level);
    userData.level++;
  }

  if (userData.level >= MAX_LEVEL) {
    userData.xp = 0;
  }

  if (!saveLevels(levels)) {
    xpCooldowns.delete(userId);
    return;
  }

  if (userData.level > previousLevel) {
    await updateLevelRoles(
      message.member,
      userData.level
    );

    await sendLevelUpMessage(
      message,
      userData.level
    );
  }
}

// ==========================================
// GET USER LEVEL
// ==========================================

function getUserLevel(userId) {
  const levels = loadLevels();

  const userData = levels?.[userId] || {
    level: 0,
    xp: 0,
    wl: 0
  };

  return {
    ...userData,
    requiredXP: getXPNeeded(userData.level)
  };
}

// ==========================================
// /TESTLEVEL COMMAND
// READ-ONLY DIAGNOSTIC
// ==========================================

async function handleTestLevel(interaction) {
  if (interaction.commandName !== "testlevel") return;

  if (
    interaction.guildId !== GUILD_ID ||
    !interaction.memberPermissions?.has(8n)
  ) {
    return interaction.reply({
      content: "Administrator only.",
      ephemeral: true
    });
  }

  await interaction.deferReply({
    ephemeral: true
  });

  try {
    const user = interaction.options.getUser("user", true);

    if (!migrationCompleted) {
      return interaction.editReply({
        content:
          "Arcane migration has not completed yet. " +
          "Check the bot console or wait for the import to finish."
      });
    }

    const levels = loadLevels();

    if (levels === null) {
      throw new Error("Unable to read levels.json");
    }

    const data = levels[user.id];

    if (!data) {
      return interaction.editReply({
        content: "No saved level data found for this member."
      });
    }

    const requiredXP = getXPNeeded(data.level);

    const remainingXP = Math.max(
      0,
      requiredXP - data.xp
    );

    const estimatedMessages = Math.ceil(
      remainingXP / ((MIN_XP + MAX_XP) / 2)
    );

    const importedLevel = data.importedLevel || 0;

    const verified =
      importedLevel > 0 &&
      data.level >= importedLevel;

    const status = verified
      ? "Arcane migration verified"
      : importedLevel > 0
        ? "Imported level mismatch"
        : "No imported level recorded";

    await interaction.editReply({
      embeds: [{
        title: "Level System Test",
        color: verified ? 0x57F287 : 0xFEE75C,

        thumbnail: {
          url: user.displayAvatarURL()
        },

        fields: [
          {
            name: "Member",
            value: `<@${user.id}>`
          },
          {
            name: "Arcane Level",
            value: data.arcaneLevel
              ? String(data.arcaneLevel)
              : "Not found",
            inline: true
          },
          {
            name: "Imported Level",
            value: String(importedLevel),
            inline: true
          },
          {
            name: "Current NoobV2 Level",
            value: String(data.level),
            inline: true
          },
          {
            name: "Current XP",
            value: `${data.xp.toLocaleString()} XP`,
            inline: true
          },
          {
            name: "XP Until Next Level",
            value: `${remainingXP.toLocaleString()} XP`,
            inline: true
          },
          {
            name: "Estimated Messages",
            value: estimatedMessages.toLocaleString(),
            inline: true
          },
          {
            name: "Next Level",
            value: data.level >= MAX_LEVEL
              ? "Maximum level reached"
              : String(data.level + 1),
            inline: true
          },
          {
            name: "Level Source",
            value: data.levelSource || "NoobV2",
            inline: true
          },
          {
            name: "Status",
            value: status
          }
        ],

        footer: {
          text: "Read-only test | No XP or levels modified"
        },

        timestamp: new Date().toISOString()
      }],

      allowedMentions: {
        parse: []
      }
    });

  } catch (error) {
    console.error("[TESTLEVEL]", error);

    await interaction.editReply({
      content: `Level test failed: ${error.message}`
    }).catch(console.error);
  }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  handleLevelXP,
  handleMessage: handleLevelXP,
  getUserLevel,
  getXPNeeded,
  updateLevelRoles,
  importArcaneLevels,
  handleTestLevel,
  MAX_LEVEL
};
