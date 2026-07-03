 const fs = require("fs");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const LEVELS_FILE = "./levels.json";
const games = new Map();

function loadLevels() {
  if (!fs.existsSync(LEVELS_FILE)) fs.writeFileSync(LEVELS_FILE, "{}");
  try {
    return JSON.parse(fs.readFileSync(LEVELS_FILE, "utf8"));
  } catch {
    fs.writeFileSync(LEVELS_FILE, "{}");
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

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function gameId() {
  return `${Date.now()}_${Math.floor(Math.random() * 999999)}`;
}

function acceptRow(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pvp_accept_${id}`).setLabel("Accept").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`pvp_decline_${id}`).setLabel("Decline").setStyle(ButtonStyle.Danger)
  );
}

function rpsRow(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rps_rock_${id}`).setLabel("Rock").setEmoji("🪨").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`rps_paper_${id}`).setLabel("Paper").setEmoji("📄").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`rps_scissors_${id}`).setLabel("Scissors").setEmoji("✂️").setStyle(ButtonStyle.Primary)
  );
}

function bombRow(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bomb_pass_${id}`).setLabel("Pass Bomb").setEmoji("💣").setStyle(ButtonStyle.Danger)
  );
}

function battleRow(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`battle_slash_${id}`).setLabel("Slash").setEmoji("⚔️").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`battle_block_${id}`).setLabel("Block").setEmoji("🛡️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`battle_heal_${id}`).setLabel("Heal").setEmoji("❤️").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`battle_charge_${id}`).setLabel("Charge").setEmoji("⚡").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`battle_ultimate_${id}`).setLabel("Ultimate").setEmoji("🔥").setStyle(ButtonStyle.Danger)
  );
}

function takeBet(player1, player2, bet) {
  const levels = loadLevels();
  const p1 = getUser(levels, player1);
  const p2 = getUser(levels, player2);

  if (p1.wl < bet) return { ok: false, msg: "You do not have enough WL." };
  if (p2.wl < bet) return { ok: false, msg: "The other player does not have enough WL." };

  p1.wl -= bet;
  p2.wl -= bet;

  saveLevels(levels);
  return { ok: true };
}

function payWinner(winnerId, amount) {
  const levels = loadLevels();
  const winner = getUser(levels, winnerId);
  winner.wl += amount;
  saveLevels(levels);
}

async function handleCommand(interaction) {
  if (!interaction.isChatInputCommand()) return false;

  if (!["rps", "bombpass", "battle"].includes(interaction.commandName)) return false;

  const target = interaction.options.getUser("user");
  const bet = interaction.options.getInteger("bet");

  if (!target || target.bot || target.id === interaction.user.id) {
    await interaction.reply({ content: "❌ Choose a real user to challenge.", ephemeral: true });
    return true;
  }

  if (!bet || bet <= 0) {
    await interaction.reply({ content: "❌ Bet must be higher than 0.", ephemeral: true });
    return true;
  }

  const id = gameId();

  games.set(id, {
    id,
    type: interaction.commandName,
    challenger: interaction.user.id,
    opponent: target.id,
    bet,
    pot: bet * 2,
    status: "pending",
    channelId: interaction.channel.id,
    createdAt: Date.now()
  });

  const names = {
    rps: "Rock Paper Scissors",
    bombpass: "Bomb Pass",
    battle: "Arena Battle"
  };

  const embed = new EmbedBuilder()
    .setColor("Yellow")
    .setTitle(`${names[interaction.commandName]} Challenge`)
    .setDescription(
      `${interaction.user} challenged ${target}!\n\n` +
      `Bet: **${bet} WL each**\n` +
      `Prize Pool: **${bet * 2} WL**\n\n` +
      `${target}, accept or decline.`
    )
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    components: [acceptRow(id)]
  });

  return true;
}

async function handleButton(interaction) {
  if (!interaction.isButton()) return false;

  const parts = interaction.customId.split("_");
  const prefix = parts[0];

  if (!["pvp", "rps", "bomb", "battle"].includes(prefix)) return false;

  if (prefix === "pvp") {
    const action = parts[1];
    const id = parts.slice(2).join("_");
    const game = games.get(id);

    if (!game) {
      await interaction.reply({ content: "❌ This game no longer exists.", ephemeral: true });
      return true;
    }

    if (interaction.user.id !== game.opponent) {
      await interaction.reply({ content: "❌ Only the challenged player can press this.", ephemeral: true });
      return true;
    }

    if (action === "decline") {
      games.delete(id);
      await interaction.update({
        content: "Challenge declined.",
        embeds: [],
        components: []
      });
      return true;
    }

    const betResult = takeBet(game.challenger, game.opponent, game.bet);

    if (!betResult.ok) {
      games.delete(id);
      await interaction.update({
        content: `❌ ${betResult.msg}`,
        embeds: [],
        components: []
      });
      return true;
    }

    game.status = "active";

    if (game.type === "rps") {
      game.choices = {};

      const embed = new EmbedBuilder()
        .setColor("Blue")
        .setTitle("🪨 Rock Paper Scissors")
        .setDescription(
          `<@${game.challenger}> VS <@${game.opponent}>\n\n` +
          `Prize Pool: **${game.pot} WL**\n\n` +
          `Both players must choose.`
        );

      await interaction.update({
        embeds: [embed],
        components: [rpsRow(id)]
      });

      return true;
    }

    if (game.type === "bombpass") {
      game.holder = Math.random() < 0.5 ? game.challenger : game.opponent;
      game.passCount = 0;
      game.explodeAt = random(8, 20);

      const embed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("💣 Bomb Pass")
        .setDescription(
          `<@${game.challenger}> VS <@${game.opponent}>\n\n` +
          `Prize Pool: **${game.pot} WL**\n` +
          `Current Holder: <@${game.holder}>\n\n` +
          `Pass the bomb before it explodes.`
        );

      await interaction.update({
        embeds: [embed],
        components: [bombRow(id)]
      });

      return true;
    }

    if (game.type === "battle") {
      game.turn = game.challenger;
      game.players = {
        [game.challenger]: { hp: 100, energy: 20, block: false },
        [game.opponent]: { hp: 100, energy: 20, block: false }
      };

      const embed = buildBattleEmbed(game, "Battle started!");

      await interaction.update({
        embeds: [embed],
        components: [battleRow(id)]
      });

      return true;
    }
  }

  if (prefix === "rps") {
    const choice = parts[1];
    const id = parts.slice(2).join("_");
    const game = games.get(id);

    if (!game || game.type !== "rps") return true;

    if (![game.challenger, game.opponent].includes(interaction.user.id)) {
      await interaction.reply({ content: "❌ You are not in this game.", ephemeral: true });
      return true;
    }

    if (game.choices[interaction.user.id]) {
      await interaction.reply({ content: "You already chose.", ephemeral: true });
      return true;
    }

    game.choices[interaction.user.id] = choice;

    await interaction.reply({
      content: `You chose **${choice}**.`,
      ephemeral: true
    });

    if (!game.choices[game.challenger] || !game.choices[game.opponent]) return true;

    const c1 = game.choices[game.challenger];
    const c2 = game.choices[game.opponent];

    let winner = null;

    if (c1 === c2) {
      payWinner(game.challenger, game.bet);
      payWinner(game.opponent, game.bet);
    } else if (
      (c1 === "rock" && c2 === "scissors") ||
      (c1 === "paper" && c2 === "rock") ||
      (c1 === "scissors" && c2 === "paper")
    ) {
      winner = game.challenger;
      payWinner(winner, game.pot);
    } else {
      winner = game.opponent;
      payWinner(winner, game.pot);
    }

    games.delete(id);

    const resultText = winner
      ? `🏆 <@${winner}> wins **${game.pot} WL**!`
      : `🤝 Tie! Bets refunded.`;

    const embed = new EmbedBuilder()
      .setColor(winner ? "Green" : "Yellow")
      .setTitle("🪨 Rock Paper Scissors Result")
      .setDescription(
        `<@${game.challenger}> chose **${c1}**\n` +
        `<@${game.opponent}> chose **${c2}**\n\n` +
        resultText
      );

    await interaction.message.edit({
      embeds: [embed],
      components: []
    });

    return true;
  }

  if (prefix === "bomb") {
    const id = parts.slice(2).join("_");
    const game = games.get(id);

    if (!game || game.type !== "bombpass") return true;

    if (interaction.user.id !== game.holder) {
      await interaction.reply({ content: "❌ You are not holding the bomb.", ephemeral: true });
      return true;
    }

    game.passCount++;

    if (game.passCount >= game.explodeAt) {
      const loser = game.holder;
      const winner = loser === game.challenger ? game.opponent : game.challenger;

      payWinner(winner, game.pot);
      games.delete(id);

      const embed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("💥 BOOM!")
        .setDescription(
          `The bomb exploded on <@${loser}>!\n\n` +
          `🏆 <@${winner}> wins **${game.pot} WL**!`
        );

      await interaction.update({
        embeds: [embed],
        components: []
      });

      return true;
    }

    game.holder = game.holder === game.challenger ? game.opponent : game.challenger;

    const embed = new EmbedBuilder()
      .setColor("Red")
      .setTitle("💣 Bomb Pass")
      .setDescription(
        `<@${game.challenger}> VS <@${game.opponent}>\n\n` +
        `Prize Pool: **${game.pot} WL**\n` +
        `Passes: **${game.passCount}**\n` +
        `Current Holder: <@${game.holder}>\n\n` +
        `Pass it before it explodes.`
      );

    await interaction.update({
      embeds: [embed],
      components: [bombRow(id)]
    });

    return true;
  }

  if (prefix === "battle") {
    const move = parts[1];
    const id = parts.slice(2).join("_");
    const game = games.get(id);

    if (!game || game.type !== "battle") return true;

    if (interaction.user.id !== game.turn) {
      await interaction.reply({ content: "❌ It is not your turn.", ephemeral: true });
      return true;
    }

    const current = game.players[game.turn];
    const enemyId = game.turn === game.challenger ? game.opponent : game.challenger;
    const enemy = game.players[enemyId];

    let log = "";

    if (move === "slash") {
      let dmg = random(10, 20);
      if (Math.random() < 0.1) {
        dmg *= 2;
        log += "💥 Critical hit!\n";
      }

      if (enemy.block) {
        dmg = Math.floor(dmg * 0.3);
        enemy.block = false;
      }

      enemy.hp -= dmg;
      current.energy = Math.min(100, current.energy + 10);
      log += `<@${game.turn}> used Slash and dealt **${dmg}** damage.`;
    }

    if (move === "block") {
      current.block = true;
      current.energy = Math.min(100, current.energy + 15);
      log = `<@${game.turn}> is blocking. Next damage is reduced.`;
    }

    if (move === "heal") {
      if (current.energy < 20) {
        await interaction.reply({ content: "❌ You need 20 energy to heal.", ephemeral: true });
        return true;
      }

      current.energy -= 20;
      const heal = random(12, 22);
      current.hp = Math.min(100, current.hp + heal);
      log = `<@${game.turn}> healed **${heal} HP**.`;
    }

    if (move === "charge") {
      current.energy = Math.min(100, current.energy + 30);
      log = `<@${game.turn}> charged energy.`;
    }

    if (move === "ultimate") {
      if (current.energy < 100) {
        await interaction.reply({ content: "❌ You need 100 energy to use Ultimate.", ephemeral: true });
        return true;
      }

      current.energy = 0;
      let dmg = random(40, 60);

      if (enemy.block) {
        dmg = Math.floor(dmg * 0.5);
        enemy.block = false;
      }

      enemy.hp -= dmg;
      log = `🔥 <@${game.turn}> used Ultimate and dealt **${dmg}** damage!`;
    }

    if (enemy.hp <= 0) {
      payWinner(game.turn, game.pot);
      games.delete(id);

      const embed = buildBattleEmbed(game, `${log}\n\n🏆 <@${game.turn}> wins **${game.pot} WL**!`);
      await interaction.update({
        embeds: [embed],
        components: []
      });

      return true;
    }

    game.turn = enemyId;

    const embed = buildBattleEmbed(game, log);

    await interaction.update({
      embeds: [embed],
      components: [battleRow(id)]
    });

    return true;
  }

  return false;
}

function buildBattleEmbed(game, log) {
  const p1 = game.players[game.challenger];
  const p2 = game.players[game.opponent];

  return new EmbedBuilder()
    .setColor("Purple")
    .setTitle("⚔️ Arena Battle")
    .setDescription(
      `${log}\n\n` +
      `<@${game.challenger}>\n` +
      `❤️ HP: **${Math.max(0, p1.hp)}**\n` +
      `⚡ Energy: **${p1.energy}**\n\n` +
      `<@${game.opponent}>\n` +
      `❤️ HP: **${Math.max(0, p2.hp)}**\n` +
      `⚡ Energy: **${p2.energy}**\n\n` +
      `Current Turn: <@${game.turn}>\n` +
      `Prize Pool: **${game.pot} WL**`
    );
}

module.exports = {
  handleCommand,
  handleButton
};