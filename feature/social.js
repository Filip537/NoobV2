// feature/social.js
const fs = require("fs");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
} = require("discord.js");

const STORY_FILE = "./stories.json";
const POST_FILE = "./posts.json";
const STORY_CHANNEL = "1493097672373047347";

function ensureFile(path, fallback) {
  if (!fs.existsSync(path)) {
    fs.writeFileSync(path, JSON.stringify(fallback, null, 2));
  }
}

function loadStories() {
  ensureFile(STORY_FILE, []);
  return JSON.parse(fs.readFileSync(STORY_FILE, "utf8"));
}

function saveStories(data) {
  fs.writeFileSync(STORY_FILE, JSON.stringify(data, null, 2));
}

function loadPosts() {
  ensureFile(POST_FILE, []);
  return JSON.parse(fs.readFileSync(POST_FILE, "utf8"));
}

function savePosts(data) {
  fs.writeFileSync(POST_FILE, JSON.stringify(data, null, 2));
}

function makeId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 999999)}`;
}

function buildPostViewEmbed(post) {
  const embed = new EmbedBuilder()
    .setColor("Purple")
    .setAuthor({
      name: `${post.ownerTag}'s Post`
    })
    .setDescription(post.caption || "No caption")
    .setFooter({
      text: `Views: ${post.views || 0} | Likes: ${(post.likes || []).length} | Comments: ${(post.comments || []).length}`
    });

  if (post.mediaType?.startsWith("image/")) {
    embed.setImage(post.mediaUrl);
  }

  return embed;
}

function buildPostButtons(postId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`post_like_${postId}`)
      .setLabel("Like")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`post_comment_${postId}`)
      .setLabel("Comment")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`post_view_${postId}`)
      .setLabel("Open")
      .setStyle(ButtonStyle.Secondary)
  );
}

async function handleCommand(interaction) {
  if (interaction.commandName === "postfeed") {
    const media = interaction.options.getAttachment("media");
    const caption = interaction.options.getString("caption") || "";

    if (!media) {
      return interaction.reply({ content: "❌ Upload an image or video.", ephemeral: true });
    }

    const contentType = media.contentType || "";
    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      return interaction.reply({ content: "❌ Only image or video files are allowed.", ephemeral: true });
    }

    const channel = await interaction.client.channels.fetch(STORY_CHANNEL).catch(() => null);
    if (!channel) {
      return interaction.reply({ content: "❌ Feed channel not found.", ephemeral: true });
    }

    const postId = makeId("post");
    const posts = loadPosts();

    const postData = {
      postId,
      ownerId: interaction.user.id,
      ownerTag: interaction.user.tag,
      mediaUrl: media.url,
      mediaType: contentType,
      caption,
      createdAt: Date.now(),
      likes: [],
      comments: [],
      views: 0
    };

    posts.push(postData);
    savePosts(posts);

    const embed = buildPostViewEmbed(postData);

    const sent = await channel.send({
      embeds: [embed],
      components: [buildPostButtons(postId)]
    });

    postData.messageId = sent.id;
    savePosts(posts);

    return interaction.reply({
      content: "✅ Your post has been published.",
      ephemeral: true
    });
  }

  if (interaction.commandName === "highlights") {
    const user = interaction.options.getUser("user") || interaction.user;
    const stories = loadStories();

    const highlighted = stories
      .filter(s => s.ownerId === user.id && s.highlights === true)
      .sort((a, b) => (b.expiresAt || 0) - (a.expiresAt || 0));

    if (!highlighted.length) {
      return interaction.reply({
        content: `❌ ${user.id === interaction.user.id ? "You do" : "That user does"} not have any highlighted stories yet.`,
        ephemeral: true
      });
    }

    const lines = highlighted.slice(0, 10).map((s, i) => {
      const type = s.mediaType?.startsWith("video/") ? "Video" : s.mediaType === "note" ? "Note" : "Image";
      return `**${i + 1}.** ${type} highlight • <t:${Math.floor((s.expiresAt || Date.now()) / 1000)}:R>`;
    });

    const embed = new EmbedBuilder()
      .setColor("Purple")
      .setTitle(`${user.username}'s Highlights`)
      .setDescription(lines.join("\n"));

    return interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
}

async function handleButton(interaction) {
  const posts = loadPosts();

  if (interaction.customId.startsWith("post_like_")) {
    const postId = interaction.customId.replace("post_like_", "");
    const post = posts.find(p => p.postId === postId);

    if (!post) {
      return interaction.reply({ content: "❌ Post not found.", ephemeral: true });
    }

    post.likes = post.likes || [];
    if (post.likes.includes(interaction.user.id)) {
      return interaction.reply({ content: "❌ You already liked this post.", ephemeral: true });
    }

    post.likes.push(interaction.user.id);
    savePosts(posts);

    return interaction.reply({ content: "❤️ You liked this post!", ephemeral: true });
  }

  if (interaction.customId.startsWith("post_comment_")) {
    const postId = interaction.customId.replace("post_comment_", "");

    const modal = new ModalBuilder()
      .setCustomId(`post_comment_modal_${postId}`)
      .setTitle("Comment on Post");

    const input = new TextInputBuilder()
      .setCustomId("post_comment_input")
      .setLabel("Your comment")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (interaction.customId.startsWith("post_view_")) {
    const postId = interaction.customId.replace("post_view_", "");
    const post = posts.find(p => p.postId === postId);

    if (!post) {
      return interaction.reply({ content: "❌ Post not found.", ephemeral: true });
    }

    post.views = (post.views || 0) + 1;
    savePosts(posts);

    if (post.mediaType?.startsWith("image/")) {
      return interaction.reply({
        embeds: [buildPostViewEmbed(post)],
        ephemeral: true
      });
    }

    return interaction.reply({
      content: `Reel:\n${post.mediaUrl}`,
      ephemeral: true
    });
  }

  return false;
}

async function handleModal(interaction) {
  if (interaction.customId.startsWith("post_comment_modal_")) {
    const postId = interaction.customId.replace("post_comment_modal_", "");
    const comment = interaction.fields.getTextInputValue("post_comment_input");

    const posts = loadPosts();
    const post = posts.find(p => p.postId === postId);

    if (!post) {
      return interaction.reply({ content: "❌ Post not found.", ephemeral: true });
    }

    post.comments = post.comments || [];
    post.comments.push({
      userId: interaction.user.id,
      user: interaction.user.tag,
      text: comment,
      createdAt: Date.now()
    });

    savePosts(posts);

    return interaction.reply({
      content: "Comment added to post!",
      ephemeral: true
    });
  }

  return false;
}

module.exports = {
  handleCommand,
  handleButton,
  handleModal
};