const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

// ===== QUESTIONS (150 total pool) =====
const questions = [
  ["Be invisible", "Fly"],
  ["Be rich", "Be famous"],
  ["Live forever", "Die young with legacy"],
  ["Read minds", "Control time"],
  ["Never use phone", "Never use internet"],
  ["Eat only sweet", "Eat only salty"],
  ["Be alone forever", "Always surrounded by people"],
  ["Lose memory", "Lose emotions"],
  ["Be super strong", "Be super fast"],
  ["Live in past", "Live in future"],
  ["Have no ads", "Have free everything"],
  ["Win lottery", "Find true love"],
  ["Be feared", "Be loved"],
  ["Work dream job", "Never work again"],
  ["Live in city", "Live in countryside"],
  ["Be smart", "Be lucky"],
  ["Have 1M now", "100k yearly forever"],
  ["Be cold always", "Be hot always"],
  ["Have more time", "Have more money"],
  ["Travel space", "Travel ocean"],
];

// 🔁 Duplicate to reach ~150 (randomized pool)
while (questions.length < 150) {
  const q = questions[Math.floor(Math.random() * 20)];
  questions.push([q[0], q[1]]);
}

// ===== GAME STATE =====
const games = new Map();

function getRandomQuestions() {
  return questions.sort(() => 0.5 - Math.random()).slice(0, 10);
}

function createEmbed(q) {
  return new EmbedBuilder()
    .setTitle("<:ItemSprites23:1449424903416840394> Would You Rather")
    .setDescription(
      `\n## <:arrow:1442712798969729087> ${q[0]}\n\n**or**\n\n## <:arrow:1442712798969729087> ${q[1]}`
    )
    .setColor("Purple");
}

function createButtons(qIndex, q) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`wyr_${qIndex}_0`)
      .setLabel(q[0].slice(0, 80))
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`wyr_${qIndex}_1`)
      .setLabel(q[1].slice(0, 80))
      .setStyle(ButtonStyle.Success)
  );
}

// ===== EXPORT =====
module.exports = {
  name: "wouldyourather",

  async execute(interaction) {

    const qs = getRandomQuestions();

    games.set(interaction.user.id, {
      index: 0,
      questions: qs
    });

    const q = qs[0];

    await interaction.reply({
      embeds: [createEmbed(q)],
      components: [createButtons(0, q)]
    });
  },

  async handleButton(interaction) {

    if (!interaction.customId.startsWith("wyr_")) return;

    const game = games.get(interaction.user.id);
    if (!game) return;

    game.index++;

    if (game.index >= 10) {
      games.delete(interaction.user.id);

      return interaction.update({
        content: "You finished all 10 questions!",
        embeds: [],
        components: []
      });
    }

    const q = game.questions[game.index];

    return interaction.update({
      embeds: [createEmbed(q)],
      components: [createButtons(game.index, q)]
    });
  }
};