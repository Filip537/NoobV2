const fs = require("fs");
const path = require("path");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const profileFile = path.join(__dirname, "..", "profiles.json");
const storyFile = path.join(__dirname, "..", "stories.json");

function ensureFile(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
}

function loadProfiles() {
  ensureFile(profileFile, {});
  return JSON.parse(fs.readFileSync(profileFile, "utf8"));
}

function saveProfiles(data) {
  fs.writeFileSync(profileFile, JSON.stringify(data, null, 2));
}

function loadStories() {
  ensureFile(storyFile, []);
  return JSON.parse(fs.readFileSync(storyFile, "utf8"));
}

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

function isUsernameTaken(username, exceptUserId = null) {
  const profiles = loadProfiles();
  const wanted = normalizeUsername(username);

  for (const [userId, profile] of Object.entries(profiles)) {
    if (exceptUserId && userId === exceptUserId) continue;
    if (normalizeUsername(profile.username) === wanted) return true;
  }

  return false;
}

function getProfile(userId) {
  const profiles = loadProfiles();
  return profiles[userId] || null;
}

function createProfile(userId, username) {
  const profiles = loadProfiles();

  profiles[userId] = {
    username,
    followers: [],
    following: [],
    createdAt: Date.now()
  };

  saveProfiles(profiles);
  return profiles[userId];
}

function buildProfileEmbed(user, profile, isOwnProfile = false) {
  return new EmbedBuilder()
    .setColor("Purple")
    .setAuthor({
      name: `${profile.username}'s Profile`,
      iconURL: user.displayAvatarURL({ dynamic: true })
    })
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: "Username", value: profile.username, inline: true },
      { name: "Followers", value: String(profile.followers?.length || 0), inline: true },
      { name: "Following", value: String(profile.following?.length || 0), inline: true }
    )
    .setFooter({ text: isOwnProfile ? "Your profile" : "User profile" });
}

function buildOwnProfileButtons(ownerId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`profile_followers_${ownerId}`)
      .setLabel("View Followers")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`profile_following_${ownerId}`)
      .setLabel("View Following")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`profile_archive_${ownerId}`)
      .setLabel("View Archive")
      .setStyle(ButtonStyle.Primary)
  );
}

function buildViewProfileButtons(targetUserId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`follow_user_${targetUserId}`)
      .setLabel("Follow This User")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`view_followers_${targetUserId}`)
      .setLabel("View Followers")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`view_following_${targetUserId}`)
      .setLabel("View Following")
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildCreateProfileModal() {
  const modal = new ModalBuilder()
    .setCustomId("create_profile_modal")
    .setTitle("Create Profile");

  const usernameInput = new TextInputBuilder()
    .setCustomId("profile_username")
    .setLabel("Select username")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(20)
    .setPlaceholder("Enter a unique username");

  modal.addComponents(
    new ActionRowBuilder().addComponents(usernameInput)
  );

  return modal;
}

async function executeCreateProfile(interaction) {
  const existing = getProfile(interaction.user.id);

  if (existing) {
    return interaction.reply({
      content: "❌ You already created a profile. You can only create it once.",
      ephemeral: true
    });
  }

  return interaction.showModal(buildCreateProfileModal());
}

async function handleModal(interaction) {
  if (interaction.customId !== "create_profile_modal") return false;

  const existing = getProfile(interaction.user.id);
  if (existing) {
    await interaction.reply({
      content: "❌ You already created a profile. You can only create it once.",
      ephemeral: true
    });
    return true;
  }

  const username = interaction.fields.getTextInputValue("profile_username").trim();

  if (!username) {
    await interaction.reply({
      content: "❌ Please enter a username.",
      ephemeral: true
    });
    return true;
  }

  if (isUsernameTaken(username)) {
    await interaction.reply({
      content: "❌ The name has been taken by the other user, please find a new name.",
      ephemeral: true
    });
    return true;
  }

  const profile = createProfile(interaction.user.id, username);
  const embed = buildProfileEmbed(interaction.user, profile, true);

  await interaction.reply({
    content: "✅ Profile created successfully.",
    embeds: [embed],
    components: [buildOwnProfileButtons(interaction.user.id)],
    ephemeral: true
  });

  return true;
}

async function executeProfile(interaction) {
  const profile = getProfile(interaction.user.id);

  if (!profile) {
    return interaction.reply({
      content: "❌ You do not have a profile yet. Use /createprofile first.",
      ephemeral: true
    });
  }

  const embed = buildProfileEmbed(interaction.user, profile, true);

  return interaction.reply({
    embeds: [embed],
    components: [buildOwnProfileButtons(interaction.user.id)]
  });
}

async function executeViewProfile(interaction) {
  const target = interaction.options.getUser("user");

  if (!target) {
    return interaction.reply({
      content: "❌ Please mention a user.",
      ephemeral: true
    });
  }

  const profile = getProfile(target.id);

  if (!profile) {
    return interaction.reply({
      content: "❌ That user has not created a profile yet.",
      ephemeral: true
    });
  }

  const embed = buildProfileEmbed(target, profile, false);

  return interaction.reply({
    embeds: [embed],
    components: [buildViewProfileButtons(target.id)]
  });
}

async function sendFollowerList(interaction, targetUserId, title, ids, client) {
  const profiles = loadProfiles();

  const names = await Promise.all(
    ids.map(async (id) => {
      const profile = profiles[id];
      if (profile?.username) return profile.username;
      const user = await client.users.fetch(id).catch(() => null);
      return user ? user.username : id;
    })
  );

  return interaction.reply({
    content: names.length ? `**${title}:**\n${names.join("\n")}` : `No ${title.toLowerCase()} yet.`,
    ephemeral: true
  });
}

async function handleButton(interaction, client) {
  const profiles = loadProfiles();

  if (interaction.customId.startsWith("profile_followers_")) {
    const ownerId = interaction.customId.replace("profile_followers_", "");

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content: "❌ This is not your profile control.",
        ephemeral: true
      });
      return true;
    }

    const profile = profiles[ownerId];
    if (!profile) {
      await interaction.reply({ content: "❌ Profile not found.", ephemeral: true });
      return true;
    }

    await sendFollowerList(interaction, ownerId, "Followers", profile.followers || [], client);
    return true;
  }

  if (interaction.customId.startsWith("profile_following_")) {
    const ownerId = interaction.customId.replace("profile_following_", "");

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content: "❌ This is not your profile control.",
        ephemeral: true
      });
      return true;
    }

    const profile = profiles[ownerId];
    if (!profile) {
      await interaction.reply({ content: "❌ Profile not found.", ephemeral: true });
      return true;
    }

    await sendFollowerList(interaction, ownerId, "Following", profile.following || [], client);
    return true;
  }

  if (interaction.customId.startsWith("profile_archive_")) {
    const ownerId = interaction.customId.replace("profile_archive_", "");

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content: "❌ This is not your profile control.",
        ephemeral: true
      });
      return true;
    }

    const stories = loadStories()
      .filter((s) => s.ownerId === ownerId)
      .sort((a, b) => b.expiresAt - a.expiresAt);

    if (!stories.length) {
      await interaction.reply({
        content: "❌ No archive found.",
        ephemeral: true
      });
      return true;
    }

    try {
      for (const item of stories.slice(0, 15)) {
        const embed = new EmbedBuilder()
          .setColor("Purple")
          .setAuthor({ name: "Archive" });

        if (item.mediaType === "note") {
          embed
            .setTitle("Archived Note")
            .setDescription(item.noteText || "No text");
        } else if (item.mediaType === "gif") {
          embed
            .setTitle("Archived GIF")
            .setImage(item.mediaUrl);
        } else if ((item.mediaType || "").startsWith("image/")) {
          embed
            .setTitle("Archived Story")
            .setImage(item.mediaUrl);
        } else {
          embed
            .setTitle("Archived Story / Media")
            .setDescription(item.mediaUrl || "No media URL");
        }

        await interaction.user.send({ embeds: [embed] }).catch(() => {});
      }

      await interaction.reply({
        content: "✅ Your archive has been sent to your DMs.",
        ephemeral: true
      });
    } catch {
      await interaction.reply({
        content: "❌ Could not send archive to your DMs.",
        ephemeral: true
      });
    }

    return true;
  }

  if (interaction.customId.startsWith("view_followers_")) {
    const targetUserId = interaction.customId.replace("view_followers_", "");
    const profile = profiles[targetUserId];

    if (!profile) {
      await interaction.reply({ content: "❌ Profile not found.", ephemeral: true });
      return true;
    }

    await sendFollowerList(interaction, targetUserId, "Followers", profile.followers || [], client);
    return true;
  }

  if (interaction.customId.startsWith("view_following_")) {
    const targetUserId = interaction.customId.replace("view_following_", "");
    const profile = profiles[targetUserId];

    if (!profile) {
      await interaction.reply({ content: "❌ Profile not found.", ephemeral: true });
      return true;
    }

    await sendFollowerList(interaction, targetUserId, "Following", profile.following || [], client);
    return true;
  }

  if (interaction.customId.startsWith("follow_user_")) {
    const targetUserId = interaction.customId.replace("follow_user_", "");

    if (targetUserId === interaction.user.id) {
      await interaction.reply({
        content: "❌ You cannot follow yourself.",
        ephemeral: true
      });
      return true;
    }

    const followerProfile = profiles[interaction.user.id];
    const targetProfile = profiles[targetUserId];

    if (!followerProfile) {
      await interaction.reply({
        content: "❌ Create your profile first using /createprofile.",
        ephemeral: true
      });
      return true;
    }

    if (!targetProfile) {
      await interaction.reply({
        content: "❌ That user does not have a profile.",
        ephemeral: true
      });
      return true;
    }

    followerProfile.following ||= [];
    targetProfile.followers ||= [];

    if (followerProfile.following.includes(targetUserId)) {
      await interaction.reply({
        content: "❌ You already follow this user.",
        ephemeral: true
      });
      return true;
    }

    followerProfile.following.push(targetUserId);
    targetProfile.followers.push(interaction.user.id);
    saveProfiles(profiles);

    await interaction.reply({
      content: `✅ You are now following **${targetProfile.username}**.`,
      ephemeral: true
    });
    return true;
  }

  return false;
}

module.exports = {
  executeCreateProfile,
  executeProfile,
  executeViewProfile,
  handleModal,
  handleButton,
  getProfile
};