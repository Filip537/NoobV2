const fs = require("fs");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const activeBusiness = new Map();
const LEVELS_FILE = "./levels.json";

function loadLevelsData() {
  if (!fs.existsSync(LEVELS_FILE)) fs.writeFileSync(LEVELS_FILE, "{}");

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

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addWL(userId, amount) {
  const levels = loadLevelsData();
  const data = levels[userId] || { wl: 0, xp: 0, level: 1 };

  data.wl = Math.max(0, (data.wl || 0) + amount);
  data.xp = (data.xp || 0) + rand(10, 35);

  levels[userId] = data;
  saveLevelsData(levels);

  return data.wl;
}

async function getRandomCustomer(guild, ownerId) {
  const members = await guild.members.fetch().catch(() => null);
  if (!members) return "Random Customer";

  const realMembers = members.filter(m => !m.user.bot && m.id !== ownerId);
  if (!realMembers.size) return "Random Customer";

  const picked = realMembers.random();
  return `<@${picked.id}>`;
}

function businessInfo(type) {
  const data = {
    restaurant: {
      name: "🍔 Restaurant",
      min: 20,
      max: 300,
      steps: 5,
      description: "Serve real server members as customers.",
    },
    mining: {
      name: "⛏ Mining Company",
      min: 25,
      max: 500,
      steps: 5,
      description: "Dig rocks, find gems, avoid collapse.",
    },
    delivery: {
      name: "🚚 Delivery Company",
      min: 20,
      max: 400,
      steps: 4,
      description: "Deliver packages and choose safe routes.",
    },
    fishing: {
      name: "🎣 Fishing Boat",
      min: 15,
      max: 250,
      steps: 5,
      description: "Catch fish and avoid losing equipment.",
    },
  };

  return data[type];
}

function menuEmbed(user, balance) {
  return new EmbedBuilder()
    .setTitle("🏢 Business Investment")
    .setColor("Gold")
    .setDescription(
      `Choose a business below.\n\n` +
      `Your Balance: **${balance} WL**\n\n` +
      `🍔 **Restaurant** — low risk, interactive customers\n` +
      `⛏ **Mining Company** — medium risk, high reward\n` +
      `🚚 **Delivery Company** — medium risk, route choices\n` +
      `🎣 **Fishing Boat** — low-medium risk, reaction luck\n\n` +
      `Use:\n` +
      `</business:0> with business type and investment amount.`
    )
    .setFooter({ text: `Requested by ${user.username}` });
}

function gameEmbed(game, text = "") {
  const profit = game.revenue - game.investment;

  return new EmbedBuilder()
    .setTitle(`${game.info.name}`)
    .setColor(profit >= 0 ? "Green" : "Red")
    .setDescription(
      `Owner: <@${game.userId}>\n` +
      `Investment: **${game.investment} WL**\n` +
      `Revenue: **${game.revenue} WL**\n` +
      `Current Profit: **${profit >= 0 ? "+" : ""}${profit} WL**\n\n` +
      `Progress: **${game.step}/${game.info.steps}**\n\n` +
      `${text || game.message}`
    )
    .setFooter({ text: "Finish all rounds to receive your final return." })
    .setTimestamp();
}

function businessButtons(type) {
  if (type === "restaurant") {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("business_action_good").setLabel("Serve Correct Order").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("business_action_mid").setLabel("Serve Fast").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("business_action_bad").setLabel("Ignore Customer").setStyle(ButtonStyle.Danger)
    );
  }

  if (type === "mining") {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("business_action_good").setLabel("Mine Deep").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("business_action_mid").setLabel("Mine Safely").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("business_action_bad").setLabel("Use TNT").setStyle(ButtonStyle.Danger)
    );
  }

  if (type === "delivery") {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("business_action_good").setLabel("Safe Route").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("business_action_mid").setLabel("Fast Route").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("business_action_bad").setLabel("Risky Shortcut").setStyle(ButtonStyle.Danger)
    );
  }

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("business_action_good").setLabel("Reel Carefully").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("business_action_mid").setLabel("Pull Hard").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("business_action_bad").setLabel("Use Cheap Bait").setStyle(ButtonStyle.Danger)
  );
}

async function nextScenario(game, guild) {
  if (game.type === "restaurant") {
    const customer = await getRandomCustomer(guild, game.userId);
    const orders = ["🍔 Burger + 🥤 Cola", "🍟 Fries + 🍗 Chicken", "🍕 Pizza + 🧃 Juice", "🍜 Noodles + 🧋 Milk Tea"];
    game.message = `${customer} entered your restaurant.\nOrder: **${orders[rand(0, orders.length - 1)]}**`;
  }

  if (game.type === "mining") {
    const events = [
      "You found a dark tunnel. What do you do?",
      "You hear rocks cracking above you.",
      "Your worker found a shiny gem wall.",
      "The mine is getting unstable.",
    ];
    game.message = events[rand(0, events.length - 1)];
  }

  if (game.type === "delivery") {
    const events = [
      "A package must be delivered before sunset.",
      "Traffic is blocking the main road.",
      "A VIP customer is waiting.",
      "Your truck is low on fuel.",
    ];
    game.message = events[rand(0, events.length - 1)];
  }

  if (game.type === "fishing") {
    const events = [
      "Something is biting the hook.",
      "You see bubbles near the boat.",
      "A rare fish shadow appears.",
      "The water suddenly becomes wild.",
    ];
    game.message = events[rand(0, events.length - 1)];
  }
}

async function handleCommand(interaction) {
  if (interaction.commandName !== "business") return false;

  const type = interaction.options.getString("type");
  const investment = interaction.options.getInteger("investment");

  if (!type || !investment) {
    const levels = loadLevelsData();
    const data = levels[interaction.user.id] || { wl: 0 };
    return interaction.reply({
      embeds: [menuEmbed(interaction.user, data.wl || 0)],
      ephemeral: true,
    });
  }

  const info = businessInfo(type);

  if (!info) {
    return interaction.reply({
      content: "❌ Invalid business type.",
      ephemeral: true,
    });
  }

  if (investment < info.min || investment > info.max) {
    return interaction.reply({
      content: `❌ ${info.name} investment must be between **${info.min} WL** and **${info.max} WL**.`,
      ephemeral: true,
    });
  }

  if (activeBusiness.has(interaction.user.id)) {
    return interaction.reply({
      content: "❌ You already have an active business. Finish it first.",
      ephemeral: true,
    });
  }

  const levels = loadLevelsData();
  const userData = levels[interaction.user.id] || { wl: 0, xp: 0, level: 1 };

  if ((userData.wl || 0) < investment) {
    return interaction.reply({
      content: `❌ You need **${investment} WL** to start this business.\nYou currently have **${userData.wl || 0} WL**.`,
      ephemeral: true,
    });
  }

  userData.wl -= investment;
  levels[interaction.user.id] = userData;
  saveLevelsData(levels);

  const game = {
    userId: interaction.user.id,
    type,
    info,
    investment,
    revenue: 0,
    step: 0,
    message: "",
    startedAt: Date.now(),
  };

  await nextScenario(game, interaction.guild);
  activeBusiness.set(interaction.user.id, game);

  await interaction.reply({
    embeds: [gameEmbed(game)],
    components: [businessButtons(type)],
  });

  setTimeout(() => {
    if (activeBusiness.has(interaction.user.id)) {
      activeBusiness.delete(interaction.user.id);
    }
  }, 120000);

  return true;
}

async function handleButton(interaction) {
  if (!interaction.customId.startsWith("business_action_")) return false;

  const game = activeBusiness.get(interaction.user.id);

  if (!game) {
    return interaction.reply({
      content: "❌ This is not your active business, or it already expired.",
      ephemeral: true,
    });
  }

  const action = interaction.customId.replace("business_action_", "");

  let gain = 0;
  let resultText = "";

  if (action === "good") {
    gain = Math.floor(game.investment * (rand(18, 38) / 100));
    resultText = `✅ Good choice! Your business earned **${gain} WL** revenue.`;
  }

  if (action === "mid") {
    gain = Math.floor(game.investment * (rand(8, 25) / 100));
    resultText = `🟦 Safe choice. Your business earned **${gain} WL** revenue.`;
  }

  if (action === "bad") {
    const chance = rand(1, 100);

    if (chance <= 35) {
      gain = Math.floor(game.investment * (rand(30, 60) / 100));
      resultText = `🔥 Risk paid off! Your business earned **${gain} WL** revenue.`;
    } else {
      gain = -Math.floor(game.investment * (rand(5, 18) / 100));
      resultText = `💀 Bad luck! Your business lost **${Math.abs(gain)} WL** revenue.`;
    }
  }

  game.revenue += gain;
  game.step++;

  if (game.step >= game.info.steps) {
    activeBusiness.delete(interaction.user.id);

    const finalReturn = Math.max(0, game.investment + game.revenue);
    const profit = finalReturn - game.investment;
    const balance = addWL(interaction.user.id, finalReturn);

    const finalEmbed = new EmbedBuilder()
      .setTitle(`${game.info.name} Complete`)
      .setColor(profit >= 0 ? "Green" : "Red")
      .setDescription(
        `Owner: <@${game.userId}>\n\n` +
        `Investment: **${game.investment} WL**\n` +
        `Final Return: **${finalReturn} WL**\n` +
        `Profit/Loss: **${profit >= 0 ? "+" : ""}${profit} WL**\n\n` +
        `New Balance: **${balance} WL**`
      )
      .setTimestamp();

    return interaction.update({
      embeds: [finalEmbed],
      components: [],
    });
  }

  await nextScenario(game, interaction.guild);

  return interaction.update({
    embeds: [gameEmbed(game, `${resultText}\n\n${game.message}`)],
    components: [businessButtons(game.type)],
  });
}

module.exports = {
  handleCommand,
  handleButton,
};