const fs = require("fs");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { renderBlackjack } = require("./renderBlackjack.js");

const LEVELS_FILE = "./levels.json";
const games = new Map();

const suits = ["S", "H", "D", "C"];
const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function loadLevels() {
  if (!fs.existsSync(LEVELS_FILE)) fs.writeFileSync(LEVELS_FILE, "{}");
  try {
    return JSON.parse(fs.readFileSync(LEVELS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveLevels(data) {
  fs.writeFileSync(LEVELS_FILE, JSON.stringify(data, null, 2));
}

function getUser(data, id) {
  if (!data[id]) data[id] = { xp: 0, level: 1, wl: 0 };
  if (typeof data[id].wl !== "number") data[id].wl = 0;
  return data[id];
}

function makeDeck() {
  const deck = [];
  for (const s of suits) {
    for (const r of ranks) deck.push({ rank: r, suit: s });
  }
  return deck.sort(() => Math.random() - 0.5);
}

function cardValue(card) {
  if (["J", "Q", "K"].includes(card.rank)) return 10;
  if (card.rank === "A") return 11;
  return Number(card.rank);
}

function handValue(hand) {
  let total = hand.reduce((sum, c) => sum + cardValue(c), 0);
  let aces = hand.filter(c => c.rank === "A").length;

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

function cardText(card) {
  const suit = { S: "♠️", H: "♥️", D: "♦️", C: "♣️" }[card.suit];
  return `${card.rank}${suit}`;
}

function draw(game) {
  return game.deck.pop();
}

function updateTotals(game) {
  game.playerTotal = handValue(game.playerHand);
  game.dealerTotal = handValue(game.dealerHand);
}

function buttonRow(id, ended = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bj_hit_${id}`)
      .setLabel("Hit")
      .setEmoji("🃏")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(ended),

    new ButtonBuilder()
      .setCustomId(`bj_stand_${id}`)
      .setLabel("Stand")
      .setEmoji("✋")
      .setStyle(ButtonStyle.Success)
      .setDisabled(ended)
  );
}

function buildEmbed(game, note = "") {
  const dealerShown = game.finished
    ? game.dealerHand.map(cardText).join(" ")
    : `${cardText(game.dealerHand[0])} 🂠`;

  return new EmbedBuilder()
    .setColor(game.finished ? "Gold" : "Green")
    .setTitle("🃏 Blackjack")
    .setDescription(
      `${note ? `${note}\n\n` : ""}` +
      `**Bet:** ${game.bet} WL\n\n` +
      `**Dealer:**\n${dealerShown}\nTotal: **${game.finished ? game.dealerTotal : "?"}**\n\n` +
      `**You:**\n${game.playerHand.map(cardText).join(" ")}\nTotal: **${game.playerTotal}**`
    )
    .setFooter({ text: `Player: ${game.username}` });
}

function pay(userId, amount) {
  const levels = loadLevels();
  const user = getUser(levels, userId);
  user.wl += amount;
  saveLevels(levels);
  return user.wl;
}

function takeBet(userId, amount) {
  const levels = loadLevels();
  const user = getUser(levels, userId);

  if (user.wl < amount) return { ok: false, balance: user.wl };

  user.wl -= amount;
  saveLevels(levels);
  return { ok: true, balance: user.wl };
}

async function handleCommand(interaction) {
  if (!interaction.isChatInputCommand()) return false;

  if (interaction.commandName === "coinflip") {
    const bet = interaction.options.getInteger("bet");
    const side = interaction.options.getString("side");

    if (!bet || bet <= 0) {
      await interaction.reply({ content: "Bet must be above 0.", ephemeral: true });
      return true;
    }

    const betResult = takeBet(interaction.user.id, bet);

    if (!betResult.ok) {
      await interaction.reply({
        content: `You only have **${betResult.balance} WL**.`,
        ephemeral: true
      });
      return true;
    }

    const result = Math.random() < 0.5 ? "heads" : "tails";
    const win = result === side;
    let balance = betResult.balance;

    if (win) balance = pay(interaction.user.id, bet * 2);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(win ? "Green" : "Red")
          .setTitle("🪙 Coin Flip")
          .setDescription(
            `Choice: **${side}**\n` +
            `Result: **${result}**\n\n` +
            (win ? `🎉 You won **${bet} WL**!` : `💀 You lost **${bet} WL**.`) +
            `\nBalance: **${balance} WL**`
          )
      ]
    });

    return true;
  }

  if (interaction.commandName === "blackjack") {
    const bet = interaction.options.getInteger("bet");

    if (!bet || bet <= 0) {
      await interaction.reply({ content: "Bet must be above 0.", ephemeral: true });
      return true;
    }

    const betResult = takeBet(interaction.user.id, bet);

    if (!betResult.ok) {
      await interaction.reply({
        content: `You only have **${betResult.balance} WL**.`,
        ephemeral: true
      });
      return true;
    }

    const id = `${Date.now()}_${Math.floor(Math.random() * 999999)}`;

    const game = {
      id,
      userId: interaction.user.id,
      username: interaction.user.username,
      bet,
      deck: makeDeck(),
      playerHand: [],
      dealerHand: [],
      finished: false,
      playerTotal: 0,
      dealerTotal: 0
    };

    game.playerHand.push(draw(game), draw(game));
    game.dealerHand.push(draw(game), draw(game));
    updateTotals(game);

    games.set(id, game);

    if (game.playerTotal === 21) {
      game.finished = true;
      updateTotals(game);

      const winAmount = Math.floor(bet * 2.5);
      const balance = pay(interaction.user.id, winAmount);
      const image = await renderBlackjack(game, "BLACKJACK!");

      await interaction.reply({
        embeds: [buildEmbed(game, `🔥 BLACKJACK! You won **${winAmount} WL**!\nBalance: **${balance} WL**`)],
        files: [image],
        components: [buttonRow(id, true)]
      });

      games.delete(id);
      return true;
    }

    const image = await renderBlackjack(game, "Choose Hit or Stand");

    await interaction.reply({
      embeds: [buildEmbed(game, "Choose **Hit** or **Stand**.")],
      files: [image],
      components: [buttonRow(id)]
    });

    return true;
  }

  return false;
}

async function finishGame(interaction, game) {
  game.finished = true;

  updateTotals(game);

  while (game.dealerTotal < 17) {
    game.dealerHand.push(draw(game));
    updateTotals(game);
  }

  let note = "";

  if (game.playerTotal > 21) {
    note = `💥 You busted and lost **${game.bet} WL**.`;
  } else if (game.dealerTotal > 21) {
    const balance = pay(game.userId, game.bet * 2);
    note = `🎉 Dealer busted! You won **${game.bet} WL**.\nBalance: **${balance} WL**`;
  } else if (game.playerTotal > game.dealerTotal) {
    const balance = pay(game.userId, game.bet * 2);
    note = `🎉 You beat the dealer and won **${game.bet} WL**.\nBalance: **${balance} WL**`;
  } else if (game.playerTotal === game.dealerTotal) {
    const balance = pay(game.userId, game.bet);
    note = `🤝 Push! Your **${game.bet} WL** was refunded.\nBalance: **${balance} WL**`;
  } else {
    note = `💀 Dealer wins. You lost **${game.bet} WL**.`;
  }

  games.delete(game.id);

  const image = await renderBlackjack(game, note.replace(/\n/g, " "));

  await interaction.update({
    embeds: [buildEmbed(game, note)],
    files: [image],
    components: [buttonRow(game.id, true)]
  });
}

async function handleButton(interaction) {
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith("bj_")) return false;

  const parts = interaction.customId.split("_");
  const action = parts[1];
  const id = parts.slice(2).join("_");

  const game = games.get(id);

  if (!game) {
    await interaction.reply({
      content: "This Blackjack game already ended.",
      ephemeral: true
    });
    return true;
  }

  if (interaction.user.id !== game.userId) {
    await interaction.reply({
      content: "This is not your Blackjack game.",
      ephemeral: true
    });
    return true;
  }

  if (action === "hit") {
    game.playerHand.push(draw(game));
    updateTotals(game);

    if (game.playerTotal > 21) {
      await finishGame(interaction, game);
      return true;
    }

    const image = await renderBlackjack(game, "You drew a card");

    await interaction.update({
      embeds: [buildEmbed(game, "You drew a card. Hit or Stand?")],
      files: [image],
      components: [buttonRow(id)]
    });

    return true;
  }

  if (action === "stand") {
    await finishGame(interaction, game);
    return true;
  }

  return false;
}

module.exports = {
  handleCommand,
  handleButton
};