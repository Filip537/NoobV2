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
  data.xp = (data.xp || 0) + rand(25, 80);

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
  return {
    restaurant: {
      name: "🍔 Hardcore Restaurant",
      min: 50,
      max: 1000,
      steps: 7,
      description: "Serve real members. One bad service can destroy your rating.",
    },
    mining: {
      name: "⛏ Extreme Mining Company",
      min: 75,
      max: 1500,
      steps: 8,
      description: "Huge rewards, but collapses can bankrupt you.",
    },
    delivery: {
      name: "🚚 Dangerous Delivery Company",
      min: 60,
      max: 1200,
      steps: 7,
      description: "Fast delivery pays well, but risky routes are brutal.",
    },
    fishing: {
      name: "🎣 Deep Sea Fishing Boat",
      min: 50,
      max: 1000,
      steps: 7,
      description: "Rare catches pay big, but storms can ruin everything.",
    },
  }[type];
}

function gameEmbed(game, text = "") {
  const liveReturn = Math.max(0, game.investment + game.revenue);
  const profit = liveReturn - game.investment;

  return new EmbedBuilder()
    .setTitle(game.info.name)
    .setColor(profit >= 0 ? "Green" : "Red")
    .setDescription(
      `Owner: <@${game.userId}>\n` +
      `Investment: **${game.investment} WL**\n` +
      `Current Return: **${liveReturn} WL**\n` +
      `Current Profit/Loss: **${profit >= 0 ? "+" : ""}${profit} WL**\n` +
      `Danger Level: **${game.danger}/100**\n\n` +
      `Progress: **${game.step}/${game.info.steps}**\n\n` +
      `${text || game.message}`
    )
    .setFooter({ text: "Extreme mode: high risk, high reward." })
    .setTimestamp();
}

function businessButtons(type) {
  if (type === "restaurant") {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("business_action_safe").setLabel("Slow Perfect Service").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("business_action_risky").setLabel("Rush VIP Order").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("business_action_gamble").setLabel("Overcharge Customer").setStyle(ButtonStyle.Danger)
    );
  }

  if (type === "mining") {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("business_action_safe").setLabel("Secure Tunnel").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("business_action_risky").setLabel("Mine Diamond Vein").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("business_action_gamble").setLabel("Detonate TNT").setStyle(ButtonStyle.Danger)
    );
  }

  if (type === "delivery") {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("business_action_safe").setLabel("Safe Route").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("business_action_risky").setLabel("Express Route").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("business_action_gamble").setLabel("Illegal Shortcut").setStyle(ButtonStyle.Danger)
    );
  }

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("business_action_safe").setLabel("Fish Safely").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("business_action_risky").setLabel("Chase Rare Fish").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("business_action_gamble").setLabel("Enter Storm Zone").setStyle(ButtonStyle.Danger)
  );
}

async function nextScenario(game, guild) {
  if (game.type === "restaurant") {
    const customer = await getRandomCustomer(guild, game.userId);
    const orders = [
      "VIP wants 🍔 + 🥤 + 🍟 in 10 seconds.",
      "Angry customer demands a refund.",
      "Food critic entered the restaurant.",
      "Kitchen is burning but customers are still ordering.",
      "Rich customer wants secret menu food.",
    ];
    game.message = `${customer} entered your restaurant.\n**${orders[rand(0, orders.length - 1)]}**`;
  }

  if (game.type === "mining") {
    game.message = [
      "The wall is glowing with diamonds, but the ceiling is cracking.",
      "Workers found ancient lava under the mine.",
      "Your drill overheated near a rare crystal vein.",
      "A tunnel collapsed behind your team.",
      "You detected treasure under unstable stone.",
    ][rand(0, 4)];
  }

  if (game.type === "delivery") {
    game.message = [
      "A VIP package must arrive in 30 minutes.",
      "Police checkpoint ahead.",
      "Bridge is broken but shortcut is open.",
      "Fuel tank is almost empty.",
      "A customer offers bonus pay for dangerous delivery.",
    ][rand(0, 4)];
  }

  if (game.type === "fishing") {
    game.message = [
      "A legendary fish appears under the boat.",
      "Storm clouds are getting closer.",
      "The fishing net is about to snap.",
      "A shark is circling your boat.",
      "Deep sea sonar found something huge.",
    ][rand(0, 4)];
  }
}

function rollOutcome(game, action) {
  const base = game.investment;
  const dangerPenalty = Math.floor(game.danger / 10);

  let chance = rand(1, 100);
  let gain = 0;
  let text = "";

  if (action === "safe") {
    game.danger += rand(4, 9);

    if (chance <= 55 - dangerPenalty) {
      gain = Math.floor(base * rand(8, 18) / 100);
      text = `✅ Safe move worked. Revenue increased by **${gain} WL**.`;
    } else {
      gain = -Math.floor(base * rand(10, 24) / 100);
      text = `⚠️ Even the safe move failed. Lost **${Math.abs(gain)} WL**.`;
    }
  }

  if (action === "risky") {
    game.danger += rand(10, 18);

    if (chance <= 35 - dangerPenalty) {
      gain = Math.floor(base * rand(35, 85) / 100);
      text = `🔥 Risk paid off! Revenue increased by **${gain} WL**.`;
    } else {
      gain = -Math.floor(base * rand(25, 60) / 100);
      text = `💀 Risk failed badly. Lost **${Math.abs(gain)} WL**.`;
    }
  }

  if (action === "gamble") {
    game.danger += rand(18, 30);

    if (chance <= 18 - dangerPenalty) {
      gain = Math.floor(base * rand(90, 220) / 100);
      text = `🚀 INSANE SUCCESS! Revenue increased by **${gain} WL**.`;
    } else {
      gain = -Math.floor(base * rand(55, 120) / 100);
      text = `☠️ DISASTER! Lost **${Math.abs(gain)} WL**.`;
    }
  }

  if (game.danger >= 100) {
    const collapseLoss = Math.floor(base * rand(60, 140) / 100);
    gain -= collapseLoss;
    text += `\n\n🚨 **CRITICAL FAILURE!** Danger reached 100/100. Extra loss: **${collapseLoss} WL**.`;
  }

  return { gain, text };
}

async function handleCommand(interaction) {
  if (interaction.commandName !== "business") return false;

  const type = interaction.options.getString("type");
  const investment = interaction.options.getInteger("investment");
  const info = businessInfo(type);

  if (!info) {
    return interaction.reply({ content: "❌ Invalid business type.", ephemeral: true });
  }

  if (investment < info.min || investment > info.max) {
    return interaction.reply({
      content: `❌ ${info.name} investment must be between **${info.min} WL** and **${info.max} WL**.`,
      ephemeral: true,
    });
  }

  if (activeBusiness.has(interaction.user.id)) {
    return interaction.reply({
      content: "❌ You already have an active business.",
      ephemeral: true,
    });
  }

  const levels = loadLevelsData();
  const userData = levels[interaction.user.id] || { wl: 0, xp: 0, level: 1 };

  if ((userData.wl || 0) < investment) {
    return interaction.reply({
      content: `❌ You need **${investment} WL**. You have **${userData.wl || 0} WL**.`,
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
    danger: rand(10, 25),
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
    activeBusiness.delete(interaction.user.id);
  }, 180000);

  return true;
}

async function handleButton(interaction) {
  if (!interaction.customId.startsWith("business_action_")) return false;

  const game = activeBusiness.get(interaction.user.id);

  if (!game) {
    return interaction.reply({
      content: "❌ This is not your business, or it expired.",
      ephemeral: true,
    });
  }

  const action = interaction.customId.replace("business_action_", "");
  const outcome = rollOutcome(game, action);

  game.revenue += outcome.gain;
  game.step++;

  const currentReturn = game.investment + game.revenue;

  if (currentReturn <= 0 || game.danger >= 120) {
    activeBusiness.delete(interaction.user.id);

    const finalEmbed = new EmbedBuilder()
      .setTitle(`${game.info.name} Bankrupt`)
      .setColor("Red")
      .setDescription(
        `Owner: <@${game.userId}>\n\n` +
        `Investment: **${game.investment} WL**\n` +
        `Final Return: **0 WL**\n` +
        `Profit/Loss: **-${game.investment} WL**\n\n` +
        `${outcome.text}\n\n` +
        `☠️ Your business collapsed. You lost the investment.`
      )
      .setTimestamp();

    return interaction.update({ embeds: [finalEmbed], components: [] });
  }

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
        `New Balance: **${balance} WL**\n\n` +
        `${outcome.text}`
      )
      .setTimestamp();

    return interaction.update({ embeds: [finalEmbed], components: [] });
  }

  await nextScenario(game, interaction.guild);

  return interaction.update({
    embeds: [gameEmbed(game, `${outcome.text}\n\n${game.message}`)],
    components: [businessButtons(game.type)],
  });
}

module.exports = {
  handleCommand,
  handleButton,
};