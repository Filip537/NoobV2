const sharp = require("sharp");

const CHAT_BUBBLE_CHANNEL_ID = "1440115926325264465";

async function renderBubble(content) {
  const escaped = content.replace(/[&<>]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;"
  })[character]);

  const { data, info } = await sharp({
    text: {
      text: `<span foreground="#102821">${escaped}</span>`,
      font: "Sans 28",
      width: 520,
      dpi: 72,
      rgba: true
    }
  }).png().toBuffer({ resolveWithObject: true });

  const width = Math.max(info.width + 64, 112);
  const bottom = info.height + 48;
  const height = bottom + 24;

  const outline = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <path fill="#D9FBC5" stroke="#224D3E" stroke-width="4" stroke-linejoin="round"
        d="M 16 4 H ${width - 16} L ${width - 4} 16 V ${bottom - 12}
           L ${width - 16} ${bottom} H 53 L 29 ${bottom + 18}
           V ${bottom} H 16 L 4 ${bottom - 12} V 16 Z"/>
      <path d="M 18 13 H ${width - 18}" stroke="#F7FFED" stroke-width="3"/>
    </svg>
  `);

  return sharp(outline)
    .composite([{ input: data, left: 32, top: 24 }])
    .png()
    .toBuffer();
}

async function handleMessage(message) {
  if (
    message.channelId !== CHAT_BUBBLE_CHANNEL_ID ||
    !message.guild ||
    message.author.bot ||
    message.webhookId ||
    message.system ||
    message.attachments.size ||
    message.stickers.size
  ) return;

  const content = message.cleanContent
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/gu, "")
    .trim();

  if (
    !content ||
    content.length > 400 ||
    content.split("\n").length > 8 ||
    /https?:\/\/|<a?:[\w]+:\d+>|^[!/]/i.test(content)
  ) return;

  try {
    const image = await renderBubble(content);
    const embed = {
      author: {
        name: message.member?.displayName ?? message.author.displayName ?? message.author.username,
        icon_url: message.member?.displayAvatarURL() ?? message.author.displayAvatarURL()
      },
      image: { url: "attachment://chat-bubble.png" }
    };

    await message.reply({
      embeds: [embed],
      files: [{ attachment: image, name: "chat-bubble.png", description: content }],
      allowedMentions: { parse: [], repliedUser: false }
    });
  } catch (error) {
    console.error("Chat bubble failed:", error);
  }
}

module.exports = { handleMessage };
