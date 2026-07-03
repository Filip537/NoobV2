const path = require("path");
const { createCanvas, loadImage } = require("canvas");
const { AttachmentBuilder } = require("discord.js");

const CARD_WIDTH = 120;
const CARD_HEIGHT = 174;
const CARD_GAP = 28;

function cardFile(card) {
  const rankMap = {
    A: "ace",
    J: "jack",
    Q: "queen",
    K: "king"
  };

  const suitMap = {
    S: "spades",
    H: "hearts",
    D: "diamonds",
    C: "clubs"
  };

  const rank = rankMap[card.rank] || card.rank;
  const suit = suitMap[card.suit];

  return path.join(process.cwd(), "assets", "cards", `${rank}_of_${suit}.png`);
}

function backFile() {
  return path.join(process.cwd(), "assets", "cards", "back.png");
}

async function drawCard(ctx, imgPath, x, y) {
  const img = await loadImage(imgPath);

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetX = 6;
  ctx.shadowOffsetY = 8;
  ctx.drawImage(img, x, y, CARD_WIDTH, CARD_HEIGHT);
  ctx.restore();
}

async function renderBlackjack(game, note = "") {
  const canvas = createCanvas(1000, 650);
  const ctx = canvas.getContext("2d");

  // Background
  const gradient = ctx.createLinearGradient(0, 0, 1000, 650);
  gradient.addColorStop(0, "#063b22");
  gradient.addColorStop(1, "#0d7a43");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1000, 650);

  // Gold border
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, 960, 610);

  // Title
  ctx.fillStyle = "#f8e7a2";
  ctx.font = "bold 44px Arial";
  ctx.textAlign = "center";
  ctx.fillText("BLACKJACK", 500, 72);

  // Labels
  ctx.textAlign = "left";
  ctx.fillStyle = "white";
  ctx.font = "bold 28px Arial";
  ctx.fillText("DEALER", 70, 135);
  ctx.fillText("YOU", 70, 390);

  // Divider
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(60, 330);
  ctx.lineTo(940, 330);
  ctx.stroke();

  // Dealer cards
  for (let i = 0; i < game.dealerHand.length; i++) {
    const imgPath = !game.finished && i === 1
      ? backFile()
      : cardFile(game.dealerHand[i]);

    await drawCard(ctx, imgPath, 70 + i * (CARD_WIDTH + CARD_GAP), 155);
  }

  // Player cards
  for (let i = 0; i < game.playerHand.length; i++) {
    const imgPath = cardFile(game.playerHand[i]);
    await drawCard(ctx, imgPath, 70 + i * (CARD_WIDTH + CARD_GAP), 410);
  }

  // Info panel
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(690, 145, 250, 250);

  ctx.fillStyle = "#f8e7a2";
  ctx.font = "bold 24px Arial";
  ctx.fillText("BET", 720, 190);
  ctx.fillStyle = "white";
  ctx.font = "24px Arial";
  ctx.fillText(`${game.bet} WL`, 720, 225);

  ctx.fillStyle = "#f8e7a2";
  ctx.font = "bold 24px Arial";
  ctx.fillText("PLAYER", 720, 275);
  ctx.fillStyle = "white";
  ctx.font = "24px Arial";
  ctx.fillText(`${game.playerTotal}`, 720, 310);

  ctx.fillStyle = "#f8e7a2";
  ctx.font = "bold 24px Arial";
  ctx.fillText("DEALER", 720, 355);
  ctx.fillStyle = "white";
  ctx.font = "24px Arial";
  ctx.fillText(game.finished ? `${game.dealerTotal}` : "?", 720, 390);

  if (note) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px Arial";
    ctx.fillText(note.slice(0, 55), 500, 610);
  }

  return new AttachmentBuilder(canvas.toBuffer("image/png"), {
    name: "blackjack.png"
  });
}

module.exports = {
  renderBlackjack
};