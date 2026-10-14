
const { Events } = require("discord.js");

// ============================================
// IHEMO -> NOOBV2 CHANNEL SYNC
// ============================================

// Format:
// "IHEMO_CHANNEL_ID": "NOOBV2_CHANNEL_ID"

const CHANNEL_MAP = new Map([
  // Consumables
  ["847201895873118218", "1559747700151422997"],

  // Services
  ["742543229269835839", "1559747702743502908"],

  // Worlds
  ["734717853965615124", "1559747704513499216"],

  // Crime
  ["742546954503848006", "1559747706484822036"],

  // Gems
  ["762442071830822914", "1559747708896419870"],

  // Ancestral
  ["782720570143277116", "1559747711119663114"],

  // Science
  ["762448042011000842", "1559747713212358657"],

  // Growmoji
  ["782911415676960778", "1559747714810380308"],

  // Packs
  ["733350990010384464", "1559747716681048204"],

  // Paints
  ["774455258407370752", "1559747718518276116"],

  // Silk
  ["762435331856269343", "1559747720082624625"],

  // Blast
  ["782718823488290826", "1559747723131879539"],

  // Crystals
  ["742547014197313576", "1559747727267463171"],

  // Machine
  ["782722952256159754", "1559747729331200032"],

  // Jammers
  ["806523338797219860", "1559747731352715396"],

  // Mines
  ["889189591083520060", "1559747732992688278"],

  // Locks
  ["878779329864167504", "1559747734678802482"],

  // Music
  ["782718975091933214", "1559747736646193162"],

  // Unicorn
  ["879846165196181616", "1559747738252353646"],

  // Steam
  ["806499108801478676", "1559747740270067856"],

  // Providers
  ["880294786236579860", "1559747742727667753"],

  // Adventure
  ["900812336116416563", "1559747745445711892"],

  // Treasure Map
  // IMPORTANT: Source ID needs confirmation.
  // The ID provided was identical to Adventure.
  // Uncomment after replacing SOURCE_ID with the correct ID.
  // ["SOURCE_ID", "1559747747731480588"],

  // Dungeons
  ["1324916884205998242", "1559747750415966229"],

  // Role Drops
  ["782718661336760380", "1559747752752189461"]
]);

// ============================================
// SYNC SETTINGS
// ============================================

const SETTINGS = {
  // Skip bot messages to prevent loops
  ignoreBots: true,

  // Forward attachment links
  forwardAttachments: true,

  // Log successful syncs
  logging: true
};

// ============================================
// DUPLICATE PROTECTION
// ============================================

const processing = new Set();

// ============================================
// START MARKET SYNC
// ============================================

function startMarketSync(client) {

  client.on(Events.MessageCreate, async (message) => {

    // Ignore DMs
    if (!message.guild) return;

    // Ignore bot messages
    if (SETTINGS.ignoreBots && message.author?.bot) {
      return;
    }

    // Ignore webhook messages
    if (message.webhookId) return;

    // Check whether this is an IHEMO source channel
    const destinationId = CHANNEL_MAP.get(message.channelId);

    if (!destinationId) return;

    // Prevent processing the same message twice
    if (processing.has(message.id)) return;

    processing.add(message.id);

    try {

      // Find destination channel in NoobV2
      const destination = await client.channels
        .fetch(destinationId)
        .catch(() => null);

      if (
        !destination ||
        !destination.isTextBased() ||
        typeof destination.send !== "function"
      ) {
        console.error(
          `[MARKET SYNC] Destination not accessible: ${destinationId}`
        );
        return;
      }

      // Get original message
      const originalContent = message.content || "";

      // Get image/file attachment links
      const attachmentLinks = SETTINGS.forwardAttachments
        ? [...message.attachments.values()].map(
            attachment => attachment.url
          )
        : [];

      // Do not add labels, headings, or descriptions
      const content = [
        originalContent,
        ...attachmentLinks
      ].filter(Boolean).join("\n");

      // Ignore empty messages
      if (!content.trim()) return;

      // Discord limits messages to 2000 characters.
      // Split long messages without adding any labels.
      for (let index = 0; index < content.length; index += 2000) {

        const part = content.slice(index, index + 2000);

        await destination.send({
          content: part,

          // Avoid pinging everyone or roles through relayed messages
          allowedMentions: {
            parse: []
          }
        });
      }

      if (SETTINGS.logging) {
        console.log(
          `[MARKET SYNC] ${message.channelId} -> ${destinationId}`
        );
      }

    } catch (error) {

      console.error(
        `[MARKET SYNC ERROR] Source: ${message.channelId}`,
        error
      );

    } finally {

      processing.delete(message.id);

    }

  });

  console.log(
    `[MARKET SYNC] Active with ${CHANNEL_MAP.size} channel mappings.`
  );
}

module.exports = {
  startMarketSync
};
