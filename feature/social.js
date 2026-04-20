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

function getUserPosts(userId) {
  return loadPosts()
    .filter((post) => post.ownerId === userId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function getUserStories(userId) {
  return loadStories()
    .filter((story) => story.ownerId === userId)
    .sort((a, b) => (b.expiresAt || 0) - (a.expiresAt || 0));
}

function getUserHighlights(userId) {
  return loadStories()
    .filter((story) => story.ownerId === userId && story.highlights === true)
    .sort((a, b) => (b.expiresAt || 0) - (a.expiresAt || 0));
}

function getUserSocialStats(userId) {
  const posts = getUserPosts(userId);
  const stories = getUserStories(userId);
  const highlights = stories.filter((story) => story.highlights === true);

  return {
    postsCount: posts.length,
    storiesCount: stories.length,
    highlightsCount: highlights.length,
    posts,
    stories,
    highlights
  };
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

  if ((post.mediaType || "").startsWith("image/")) {
    embed.setImage(post.mediaUrl);
  }

  if ((post.mediaType || "").startsWith("video/")) {
    embed.addFields({
      name: "Reel",
      value: `[Open Reel](${post.mediaUrl})`
    });
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
      .setCustomId(`post_comments_${postId}`)
      .setLabel("View Comments")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`post_view_${postId}`)
      .setLabel("Open")
      .setStyle(ButtonStyle.Success)
  );
}

function buildCommentListEmbed(post) {
  const comments = post.comments || [];

  return new EmbedBuilder()
    .setColor("Purple")
    .setTitle("Post Comments")
    .setDescription(
      comments.length
        ? comments.slice(0, 15).map((comment, index) => {
            return `**${index + 1}. ${comment.user || "Unknown"}**\n${comment.text || "No comment text"}`;
          }).join("\n\n")
        : "No comments yet."
    )
    .setFooter({
      text: `Showing ${Math.min(comments.length, 15)} of ${comments.length} comments`
    });
}

function buildHighlightsEmbed(user, highlights) {
  return new EmbedBuilder()
    .setColor("Purple")
    .setTitle(`${user.username}'s Highlights`)
    .setDescription(
      highlights.slice(0, 10).map((story, index) => {
        const type =
          story.mediaType === "note"
            ? "Note"
            : (story.mediaType || "").startsWith("video/")
            ? "Video"
            : "Image";

        return `**${index + 1}.** ${type}\nViews: ${story.views || 0} | Likes: ${(story.likes || []).length} | Comments: ${(story.comments || []).length}`;
      }).join("\n\n")
    );
}

async function handleCommand(interaction) {
  if (interaction.commandName === "postfeed") {
    const media = interaction.options.getAttachment("media");
    const caption = interaction.options.getString("caption") || "";

    if (!media) {
      return interaction.reply({
        content: "❌ Upload an image or video.",
        ephemeral: true
      });
    }

    const contentType = media.contentType || "";
    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      return interaction.reply({
        content: "❌ Only image or video files are allowed.",
        ephemeral: true
      });
    }

    const channel = await interaction.client.channels.fetch(STORY_CHANNEL).catch(() => null);
    if (!channel) {
      return interaction.reply({
        content: "❌ Feed channel not found.",
        ephemeral: true
      });
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

    const sent = await channel.send({
      embeds: [buildPostViewEmbed(postData)],
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
    const highlights = getUserHighlights(user.id);

    if (!highlights.length) {
      return interaction.reply({
        content: `❌ ${user.id === interaction.user.id ? "You do" : "That user does"} not have any highlighted stories yet.`,
        ephemeral: true
      });
    }

    return interaction.reply({
      embeds: [buildHighlightsEmbed(user, highlights)],
      ephemeral: true
    });
  }

  return false;
}

async function handleButton(interaction) {
  const posts = loadPosts();

  if (interaction.customId.startsWith("post_like_")) {
    const postId = interaction.customId.replace("post_like_", "");
    const post = posts.find((p) => p.postId === postId);

    if (!post) {
      return interaction.reply({
        content: "❌ Post not found.",
        ephemeral: true
      });
    }

    post.likes ||= [];

    if (post.likes.includes(interaction.user.id)) {
      return interaction.reply({
        content: "❌ You already liked this post.",
        ephemeral: true
      });
    }

    post.likes.push(interaction.user.id);
    savePosts(posts);

    return interaction.reply({
      content: "❤️ You liked this post!",
      ephemeral: true
    });
  }

  if (interaction.customId.startsWith("post_comment_") && !interaction.customId.startsWith("post_comments_")) {
    const postId = interaction.customId.replace("post_comment_", "");

    const modal = new ModalBuilder()
      .setCustomId(`post_comment_modal_${postId}`)
      .setTitle("Comment on Post");

    const input = new TextInputBuilder()
      .setCustomId("post_comment_input")
      .setLabel("Your comment")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(500);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (interaction.customId.startsWith("post_comments_")) {
    const postId = interaction.customId.replace("post_comments_", "");
    const post = posts.find((p) => p.postId === postId);

    if (!post) {
      return interaction.reply({
        content: "❌ Post not found.",
        ephemeral: true
      });
    }

    if (!(post.comments || []).length) {
      return interaction.reply({
        content: "❌ No comments on this post yet.",
        ephemeral: true
      });
    }

    return interaction.reply({
      embeds: [buildCommentListEmbed(post)],
      ephemeral: true
    });
  }

  if (interaction.customId.startsWith("post_view_")) {
    const postId = interaction.customId.replace("post_view_", "");
    const post = posts.find((p) => p.postId === postId);

    if (!post) {
      return interaction.reply({
        content: "❌ Post not found.",
        ephemeral: true
      });
    }

    post.views = (post.views || 0) + 1;
    savePosts(posts);

    if ((post.mediaType || "").startsWith("image/")) {
      return interaction.reply({
        embeds: [buildPostViewEmbed(post)],
        components: [buildPostButtons(postId)],
        ephemeral: true
      });
    }

    return interaction.reply({
      embeds: [buildPostViewEmbed(post)],
      components: [buildPostButtons(postId)],
      ephemeral: true
    });
  }

  return false;
}

async function handleModal(interaction) {
  if (interaction.customId.startsWith("post_comment_modal_")) {
    const postId = interaction.customId.replace("post_comment_modal_", "");
    const comment = interaction.fields.getTextInputValue("post_comment_input").trim();

    const posts = loadPosts();
    const post = posts.find((p) => p.postId === postId);

    if (!post) {
      return interaction.reply({
        content: "❌ Post not found.",
        ephemeral: true
      });
    }

    if (!comment) {
      return interaction.reply({
        content: "❌ Comment cannot be empty.",
        ephemeral: true
      });
    }

    post.comments ||= [];
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
  handleModal,
  loadPosts,
  savePosts,
  loadStories,
  saveStories,
  getUserPosts,
  getUserStories,
  getUserHighlights,
  getUserSocialStats
};