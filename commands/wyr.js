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
  ["Never use phone again", "Never use internet again"],
  ["Eat only sweet food", "Eat only salty food"],
  ["Be alone forever", "Always be surrounded by people"],
  ["Lose memory", "Lose emotions"],
  ["Be super strong", "Be super fast"],
  ["Live in the past", "Live in the future"],

  ["Have unlimited money", "Have unlimited time"],
  ["Be the smartest person", "Be the funniest person"],
  ["Travel the world for free", "Live in your dream house"],
  ["Never sleep again", "Sleep all the time"],
  ["Be famous online", "Be famous in real life"],
  ["Always win arguments", "Always be right"],
  ["Be feared by all", "Be loved by all"],
  ["Never get tired", "Never get hungry"],
  ["Have teleportation", "Have time travel"],
  ["Live underwater", "Live in space"],

  ["Only whisper forever", "Only shout forever"],
  ["Have no friends", "Have fake friends"],
  ["Be poor but happy", "Be rich but sad"],
  ["Know how you die", "Know when you die"],
  ["Have no music", "Have no movies"],
  ["Be stuck in a game", "Be stuck in a movie"],
  ["Lose your phone", "Lose your wallet"],
  ["Be invisible in public", "Be invisible at home"],
  ["Only eat fast food", "Only eat vegetables"],
  ["Be cold forever", "Be hot forever"],

  ["Live without WiFi", "Live without electricity"],
  ["Be a hero", "Be a villain"],
  ["Always be late", "Always be early"],
  ["Have no taste", "Have no smell"],
  ["Be stuck at school", "Be stuck at work"],
  ["Win $1M now", "Win $10M in 10 years"],
  ["Be famous but hated", "Be unknown but loved"],
  ["Only text forever", "Only call forever"],
  ["Have bad luck", "Have no luck"],
  ["Lose all your money", "Lose all your friends"],

  ["Live in anime world", "Live in game world"],
  ["Be rich and lonely", "Be poor with friends"],
  ["Have super speed", "Have super strength"],
  ["Be able to pause time", "Be able to rewind time"],
  ["Never age", "Age twice as fast"],
  ["Have unlimited food", "Have unlimited drinks"],
  ["Be a genius", "Be extremely lucky"],
  ["Have no responsibilities", "Have unlimited power"],
  ["Be invisible forever", "Be famous forever"],
  ["Only eat spicy food", "Only eat bland food"],

  // keep going...

  ["Have 100 pets", "Have no pets"],
  ["Be stuck in rain forever", "Be stuck in heat forever"],
  ["Always lose", "Never play"],
  ["Be super tall", "Be super short"],
  ["Only use emojis", "Only use text"],
  ["Be the boss", "Be the worker"],
  ["Live in luxury", "Live in peace"],
  ["Be in a horror movie", "Be in a comedy movie"],
  ["Always be watched", "Always be ignored"],
  ["Be perfect", "Be unique"],

  // ===== MINECRAFT (50) =====
["Live in Minecraft survival forever", "Live in Minecraft creative forever"],
["Fight 10 zombies", "Fight 1 warden"],
["Have full diamond armor", "Have full netherite armor"],
["Only use wooden tools", "Only use stone tools"],
["Live in a village", "Live in a jungle"],
["Fight Ender Dragon", "Fight Wither"],
["Never use beds", "Never use food"],
["Have Elytra", "Have infinite ender pearls"],
["Live underground", "Live in sky base"],
["Only mine", "Only build"],

["Have unlimited diamonds", "Have unlimited emeralds"],
["Be a redstone master", "Be a building master"],
["Play hardcore mode", "Play peaceful mode"],
["Never use armor", "Never use weapons"],
["Be chased by creepers forever", "Be chased by skeletons forever"],
["Live in the Nether", "Live in the End"],
["Have 1 heart forever", "Have no hunger bar"],
["Only use bow", "Only use sword"],
["Lose all items on death", "Lose world on death"],
["Have infinite XP", "Have infinite health"],

["Only explore caves", "Only explore surface"],
["Have no mobs", "Have double mobs"],
["Always night time", "Always daytime"],
["Only eat raw food", "Only eat cooked food"],
["Be Steve forever", "Be Alex forever"],
["Have no crafting table", "Have no furnace"],
["Only use iron", "Only use gold"],
["Have unlimited TNT", "Have unlimited lava"],
["Always spawn in desert", "Always spawn in snow"],
["Have no map", "Have no coordinates"],

["Only use shields", "Only use armor"],
["Have infinite arrows", "Have infinite durability"],
["Be stuck in cave", "Be stuck in ocean"],
["Fight mobs every night", "Fight boss every day"],
["Have no inventory", "Have limited inventory"],
["Only build houses", "Only build farms"],
["Have villagers trade OP", "Have no villagers"],
["Always get lost", "Never explore"],
["Be speedrunner", "Be casual player"],
["Only use enchantments", "Never use enchantments"],

// ===== GROWTOPIA (50) =====
["Have unlimited WLs", "Have unlimited DLs"],
["Be rich in Growtopia", "Be popular in Growtopia"],
["Only farm", "Only trade"],
["Never get scammed", "Never get banned"],
["Own a famous world", "Own rare items"],
["Have all rares", "Have unlimited gems"],
["Be pro trader", "Be pro farmer"],
["Only play events", "Only play normal worlds"],
["Have admin powers", "Have mod powers"],
["Be invisible in worlds", "Be able to fly everywhere"],

["Have unlimited locks", "Have unlimited seeds"],
["Never lose items", "Never fail trades"],
["Only use basic clothes", "Only use rare clothes"],
["Own Growganoth items", "Own Carnival items"],
["Have 100 worlds", "Have 1 perfect world"],
["Only play solo", "Only play with friends"],
["Be always lucky", "Be always safe"],
["Never lag", "Never disconnect"],
["Have unlimited BGL", "Have unlimited WL"],
["Be scammer hunter", "Be event host"],

["Only sell", "Only buy"],
["Never get hacked", "Never get muted"],
["Own legendary items", "Own rare worlds"],
["Have unlimited slots", "Have unlimited storage"],
["Always win giveaways", "Always host giveaways"],
["Only farm dirt", "Only farm trees"],
["Have no cooldown", "Have no limits"],
["Be famous YouTuber GT", "Be rich GT player"],
["Only do parkour", "Only do trading"],
["Have no taxes", "Have no restrictions"],

["Have infinite gems", "Have infinite packs"],
["Only use vending", "Only trade manually"],
["Be mod forever", "Be player forever"],
["Own top worlds", "Own rare collections"],
["Have instant grow", "Have instant harvest"],
["Never fail surgery", "Never fail anything"],
["Only build worlds", "Only farm worlds"],
["Be known by everyone", "Be unknown but rich"],
["Have unlimited friends", "Have unlimited worlds"],
["Be the richest player", "Be the most famous player"],
];

// ===== GAME STATE =====
const games = new Map();

function getRandomQuestions() {
  const shuffled = [...questions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 10);
}

function createEmbed(q) {
  return new EmbedBuilder()
    .setTitle("<:ItemSprites23:1449424903416840394> Would You Rather")
    .setDescription(
      `\n## <:arrow:1442712798969729087> ${q[0]} \n\n## <:arrow:1442712798969729087> ${q[1]}`
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