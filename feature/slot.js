const fs = require("fs");
const { EmbedBuilder } = require("discord.js");

const LEVELS_FILE = "./levels.json";
const SPIN_COST = 2;
const JACKPOT_REWARD = 40;

const symbols = ["🍒", "🍋", "🍇", "🍉", "⭐", "💎", "7️⃣"];

function loadLevelsData() {
  if (!fs.existsSync(LEVELS_FILE)) {
    fs.writeFileSync(LEVELS_FILE, "{}");
  }

  try {
    return JSON.parse(fs.readFileSync(LEVELS_FILE, "utf8"));
  } catch {
    fs.writeFileSync(LEVELS_FILE, "{}");
    return {};
  }
}

function saveLevelsData(data) {
  fs.writeFileSync(LEVELS_FILE, JSON.stringify(data, null, 2));
}

function spinSlot() {
  return [
    symbols[Math.floor(Math.random() * symbols.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
    symbols[Math.floor(Math.random() * symbols.length)]
  ];
}

async function handleCommand(interaction) {
  if (!interaction.isChatInputCommand()) return false;
  if (interaction.commandName !== "slot") return false;

  const levels = loadLevelsData();
  const userId = interaction.user.id;

  if (!levels[userId]) {
    levels[userId] = {
      xp: 0,
      level: 1,
      wl: 0
    };
  }

  const userData = levels[userId];
  userData.wl = userData.wl || 0;

  if (userData.wl < SPIN_COST) {
    return interaction.reply({
      content: `❌ You need **${SPIN_COST} WL** to spin.\nYou currently have **${userData.wl} WL**.`,
      ephemeral: true
    });
  }

  userData.wl -= SPIN_COST;

  const result = spinSlot();

  let title = "Slot Machine";
  let message = `You lost **${SPIN_COST} WL**. Better luck next time.`;
  let color = "Red";
  let won = false;

  if (result[0] === result[1] && result[1] === result[2]) {
    userData.wl += JACKPOT_REWARD;
    title = "JACKPOT!";
    message = `You won **${JACKPOT_REWARD} WL**!\nSpin cost: **-${SPIN_COST} WL**`;
    color = "Gold";
    won = true;
  } else if (
    result[0] === result[1] ||
    result[1] === result[2] ||
    result[0] === result[2]
  ) {
    title = "Almost!";
    message = `Two matched, but no reward.\nSpin cost: **-${SPIN_COST} WL**`;
    color = "Yellow";
  }

  levels[userId] = userData;
  saveLevelsData(levels);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(
      `🎰 | **${result[0]} ${result[1]} ${result[2]}** | 🎰\n\n` +
      `${message}\n\n` +
      `Your Balance: **${userData.wl} WL**`
    )
    .setFooter({ text: `Played by ${interaction.user.username}` })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed]
  });

  return true;
}

module.exports = {
  handleCommand
};