const fs = require("fs");
const path = require("path");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const levelsFile = path.join(__dirname, "..", "levels.json");
const pendingTrades = new Map();

function loadLevels() {
  if (!fs.existsSync(levelsFile)) fs.writeFileSync(levelsFile, "{}");
  try {
    return JSON.parse(fs.readFileSync(levelsFile, "utf8"));
  } catch {
    fs.writeFileSync(levelsFile, "{}");
    return {};
  }
}

function saveLevels(data) {
  fs.writeFileSync(levelsFile, JSON.stringify(data, null, 2));
}

function ensureUser(levels, userId) {
  if (!levels[userId]) levels[userId] = { level: 1, xp: 0, wl: 0 };
  if (!levels[userId].items) levels[userId].items = {};
  if (!Array.isArray(levels[userId].fishBackpack)) levels[userId].fishBackpack = [];
  return levels[userId];
}

function normalize(value = "") {
  return String(value).toLowerCase().replace(/\.(webp|png|jpg|jpeg)$/i, "").replace(/[^a-z0-9]/g, "");
}

function parseItems(text) {
  return text.split(",").map(part => {
    const match = part.trim().match(/^(\d+)\s+(.+)$/i);
    if (!match) return null;

    const amount = Number(match[1]);
    const name = normalize(match[2]);

    return { amount, name };
  }).filter(Boolean);
}

function getItemAmount(data, name) {
  if (name === "wl" || name === "worldlock" || name === "worldlocks") {
    return data.wl || 0;
  }

  if (name === "dl" || name === "diamondlock" || name === "diamondlocks") {
    return Math.floor((data.wl || 0) / 100);
  }

  if (name === "wiggly" || name === "wigglyworm" || name === "wigglyworms") {
    return data.items?.wigglyWorm || 0;
  }

  let total = 0;

  for (const fish of data.fishBackpack || []) {
    const fishKey = normalize(fish.key);
    const fishName = normalize(fish.name);
    const fishFile = normalize(fish.file);

    if ([fishKey, fishName, fishFile].includes(name)) {
      total += Number(fish.amount || 1);
    }
  }

  return total;
}

function hasItems(data, items) {
  return items.every(item => getItemAmount(data, item.name) >= item.amount);
}

function removeItems(data, items) {
  for (const item of items) {
    if (item.name === "wl" || item.name === "worldlock" || item.name === "worldlocks") {
      data.wl -= item.amount;
      continue;
    }

    if (item.name === "dl" || item.name === "diamondlock" || item.name === "diamondlocks") {
      data.wl -= item.amount * 100;
      continue;
    }

    if (item.name === "wiggly" || item.name === "wigglyworm" || item.name === "wigglyworms") {
      data.items.wigglyWorm -= item.amount;
      continue;
    }

    let remaining = item.amount;

    for (const fish of data.fishBackpack || []) {
      const fishKey = normalize(fish.key);
      const fishName = normalize(fish.name);
      const fishFile = normalize(fish.file);

      if (![fishKey, fishName, fishFile].includes(item.name)) continue;

      const current = Number(fish.amount || 1);
      const take = Math.min(current, remaining);

      fish.amount = current - take;
      remaining -= take;

      if (remaining <= 0) break;
    }

    data.fishBackpack = data.fishBackpack.filter(fish => Number(fish.amount || 0) > 0);
  }
}

function addItems(data, items) {
  for (const item of items) {
    if (item.name === "wl" || item.name === "worldlock" || item.name === "worldlocks") {
      data.wl = (data.wl || 0) + item.amount;
      continue;
    }

    if (item.name === "dl" || item.name === "diamondlock" || item.name === "diamondlocks") {
      data.wl = (data.wl || 0) + item.amount * 100;
      continue;
    }

    if (item.name === "wiggly" || item.name === "wigglyworm" || item.name === "wigglyworms") {
      data.items.wigglyWorm = (data.items.wigglyWorm || 0) + item.amount;
      continue;
    }

    const existing = data.fishBackpack.find(fish =>
      [normalize(fish.key), normalize(fish.name), normalize(fish.file)].includes(item.name)
    );

    if (existing) {
      existing.amount = (existing.amount || 0) + item.amount;
    } else {
      data.fishBackpack.push({
        key: item.name,
        name: item.name,
        file: `${item.name}.webp`,
        rarity: "Trade",
        amount: item.amount,
        caughtAt: Date.now()
      });
    }
  }
}

function formatItems(items) {
  return items.map(i => `**${i.amount}x ${i.name}**`).join(", ");
}

async function handleCommand(interaction) {
  if (!interaction.isChatInputCommand()) return false;
  if (interaction.commandName !== "trade") return false;

  const target = interaction.options.getUser("user");
  const giveText = interaction.options.getString("give");
  const receiveText = interaction.options.getString("receive");

  if (!target || target.bot || target.id === interaction.user.id) {
    return interaction.reply({
      content: "❌ Choose a valid user.",
      ephemeral: true
    });
  }

  const give = parseItems(giveText);
  const receive = parseItems(receiveText);

  if (!give.length || !receive.length) {
    return interaction.reply({
      content: "❌ Invalid format. Example: `25 wiggly, 5 gar`",
      ephemeral: true
    });
  }

  const levels = loadLevels();
  const senderData = ensureUser(levels, interaction.user.id);
  const targetData = ensureUser(levels, target.id);

  if (!hasItems(senderData, give)) {
    return interaction.reply({
      content: "❌ You don't have the items you are trying to give.",
      ephemeral: true
    });
  }

  if (!hasItems(targetData, receive)) {
    return interaction.reply({
      content: "❌ The other user doesn't have the requested items.",
      ephemeral: true
    });
  }

  const tradeId = `${Date.now()}_${Math.floor(Math.random() * 999999)}`;

  pendingTrades.set(tradeId, {
    tradeId,
    senderId: interaction.user.id,
    targetId: target.id,
    give,
    receive,
    expiresAt: Date.now() + 5 * 60 * 1000
  });

  const embed = new EmbedBuilder()
    .setTitle("Trade Request")
    .setColor("Yellow")
    .setDescription(
      `${interaction.user} wants to trade with ${target}.\n\n` +
      `**${interaction.user.username} gives:** ${formatItems(give)}\n` +
      `**${target.username} gives:** ${formatItems(receive)}\n\n` +
      `${target}, click **Accept Trade** to confirm.`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`trade_accept_${tradeId}`)
      .setLabel("Accept Trade")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`trade_cancel_${tradeId}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger)
  );

  return interaction.reply({
    embeds: [embed],
    components: [row]
  });
}

async function handleButton(interaction) {
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith("trade_")) return false;

  const tradeId = interaction.customId.replace("trade_accept_", "").replace("trade_cancel_", "");
  const trade = pendingTrades.get(tradeId);

  if (!trade) {
    await interaction.reply({
      content: "❌ This trade expired or no longer exists.",
      ephemeral: true
    });
    return true;
  }

  if (Date.now() > trade.expiresAt) {
    pendingTrades.delete(tradeId);
    await interaction.reply({
      content: "❌ This trade has expired.",
      ephemeral: true
    });
    return true;
  }

  if (interaction.customId.startsWith("trade_cancel_")) {
    if (![trade.senderId, trade.targetId].includes(interaction.user.id)) {
      await interaction.reply({
        content: "❌ You cannot cancel this trade.",
        ephemeral: true
      });
      return true;
    }

    pendingTrades.delete(tradeId);

    await interaction.update({
      content: "❌ Trade cancelled.",
      embeds: [],
      components: []
    });

    return true;
  }

  if (interaction.user.id !== trade.targetId) {
    await interaction.reply({
      content: "❌ Only the selected user can accept this trade.",
      ephemeral: true
    });
    return true;
  }

  const levels = loadLevels();
  const senderData = ensureUser(levels, trade.senderId);
  const targetData = ensureUser(levels, trade.targetId);

  if (!hasItems(senderData, trade.give)) {
    pendingTrades.delete(tradeId);
    await interaction.update({
      content: "❌ Trade failed. Sender no longer has the required items.",
      embeds: [],
      components: []
    });
    return true;
  }

  if (!hasItems(targetData, trade.receive)) {
    pendingTrades.delete(tradeId);
    await interaction.update({
      content: "❌ Trade failed. Receiver no longer has the required items.",
      embeds: [],
      components: []
    });
    return true;
  }

  removeItems(senderData, trade.give);
  removeItems(targetData, trade.receive);

  addItems(senderData, trade.receive);
  addItems(targetData, trade.give);

  levels[trade.senderId] = senderData;
  levels[trade.targetId] = targetData;

  saveLevels(levels);
  pendingTrades.delete(tradeId);

  await interaction.update({
    content: `✅ Trade completed between <@${trade.senderId}> and <@${trade.targetId}>.`,
    embeds: [],
    components: [],
    allowedMentions: { parse: [] }
  });

  return true;
}

module.exports = {
  handleCommand,
  handleButton
};