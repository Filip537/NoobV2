const { EmbedBuilder } = require("discord.js");

const symbols = ["🍒", "🍋", "🍇", "🍉", "⭐", "💎", "7️⃣"];

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

  const result = spinSlot();

  let title = "Slot Machine";
  let message = "Better luck next time.";
  let color = "Red";

  if (result[0] === result[1] && result[1] === result[2]) {
    title = "JACKPOT!";
    message = "You hit the jackpot!";
    color = "Gold";
  } else if (
    result[0] === result[1] ||
    result[1] === result[2] ||
    result[0] === result[2]
  ) {
    title = "Almost!";
    message = "Two matched! So close.";
    color = "Yellow";
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(
      `🎰 | **${result[0]} ${result[1]} ${result[2]}** | 🎰\n\n` +
      `${message}`
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