// NoobV2 Parkour Tower - discord.js v14, Node.js 18+
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags
} = require('discord.js');
const maps = require('./parkourMaps');

const CHANNELS = {
  play: '1559764156608024667',
  leaderboard: '1559764175126007838',
  records: '1559764189612871742',
  updates: '1559764203156414494'
};
const FILE = path.join(__dirname, '..', 'data', 'parkour.json');
const sessions = new Map();
const MAX_SESSION_AGE = 30 * 60 * 1000;
const COOLDOWN = 350;
let leaderboardUpdate = Promise.resolve();

function load() {
  try {
    if (!fs.existsSync(FILE)) return { users: {}, leaderboardMessage: null };
    const db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { users: db.users || {}, leaderboardMessage: db.leaderboardMessage || null };
  } catch (e) {
    console.error('[Parkour] Database read failed:', e);
    throw e;
  }
}
function save(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}
function profile(db, id) {
  if (!db.users[id]) db.users[id] = { unlocked: 1, completed: [], best: {}, xp: 0 };
  return db.users[id];
}
function row(buttons) {
  return new ActionRowBuilder().addComponents(buttons);
}
function btn(id, label, style = ButtonStyle.Secondary, disabled = false) {
  return new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled);
}
function panel() {
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('NOOBV2 PARKOUR TOWER')
    .setDescription('Jump over spikes, reach checkpoints, beat all 10 stages, and compete for the fastest times!\n\n**How to play**\n1. Press **Start Parkour**.\n2. Use **Left**, **Jump**, and **Right** to move.\n3. Jump over spikes and reach the flag.\n4. Checkpoints save your position after a fall.\n\nYour game is private. Your records are saved automatically.');
  return {
    embeds: [embed],
    components: [row([
      btn('pk:start', 'Start Parkour', ButtonStyle.Success),
      btn('pk:stages', 'Choose Stage', ButtonStyle.Primary),
      btn('pk:rank', 'My Records')
    ])]
  };
}
function format(ms) { return `${(ms / 1000).toFixed(2)}s`; }
function mapView(session) {
  const map = maps[session.stage - 1];
  const cells = map.tiles.map((tile, i) => {
    if (i === session.pos) return '🟦';
    if (tile === '^') return '🔺';
    if (tile === 'C') return '🟨';
    if (tile === 'F') return '🏁';
    if (tile === '#') return '🟩';
    return '⬛';
  });
  return `\`${map.name}\`\n${cells.join('')}\n\n🟦 You  🔺 Spikes  🟨 Checkpoint  🏁 Finish`;
}
function gameView(session, finished = false) {
  const map = maps[session.stage - 1];
  const elapsed = (session.elapsed || 0) + (finished ? 0 : Date.now() - session.startedAt);
  const embed = new EmbedBuilder()
    .setColor(finished ? 0xf1c40f : 0x3498db)
    .setTitle(finished ? `Stage ${session.stage} Complete!` : `Parkour • Stage ${session.stage}/10`)
    .setDescription(mapView(session))
    .addFields(
      { name: 'Deaths', value: String(session.deaths), inline: true },
      { name: 'Moves', value: String(session.moves), inline: true },
      { name: 'Time', value: format(elapsed), inline: true }
    );
  const components = finished
    ? [row([
      btn(`pk:next:${session.token}`, session.stage === 10 ? 'Replay Tower' : 'Next Stage', ButtonStyle.Success),
      btn(`pk:quit:${session.token}`, 'Close', ButtonStyle.Secondary)
    ])]
    : [row([
      btn(`pk:left:${session.token}`, 'Left'),
      btn(`pk:jump:${session.token}`, 'Jump', ButtonStyle.Primary),
      btn(`pk:right:${session.token}`, 'Right')
    ]), row([
      btn(`pk:restart:${session.token}`, 'Restart Stage'),
      btn(`pk:quit:${session.token}`, 'Exit')
    ])];
  return { embeds: [embed], components };
}
function start(userId, stage) {
  const session = {
    userId, stage, token: randomUUID().slice(0, 8), pos: 0, checkpoint: 0, deaths: 0, moves: 0,
    startedAt: Date.now(), lastInput: 0, finished: false
  };
  sessions.set(userId, session);
  return session;
}
function move(session, action) {
  const map = maps[session.stage - 1];
  let next = session.pos;
  if (action === 'left') next -= 1;
  if (action === 'right') next += 1;
  if (action === 'jump') next += 4;
  next = Math.max(0, Math.min(map.tiles.length - 1, next));
  session.moves++;
  if (map.tiles[next] === '^') {
    session.deaths++;
    session.pos = session.checkpoint;
    return;
  }
  session.pos = next;
  if (map.tiles[next] === 'C') session.checkpoint = next;
  if (map.tiles[next] === 'F') session.finished = true;
}
async function finish(interaction, session) {
  const duration = Date.now() - session.startedAt;
  const db = load();
  const p = profile(db, interaction.user.id);
  const map = maps[session.stage - 1];
  const first = !p.completed.includes(session.stage);
  if (first) {
    p.completed.push(session.stage);
    p.unlocked = Math.max(p.unlocked, Math.min(10, session.stage + 1));
    p.xp += map.reward; // Parkour XP only; integrate main XP after reviewing its code.
  }
  const previous = p.best[session.stage];
  const record = !previous || duration < previous.time;
  if (record) p.best[session.stage] = { time: duration, deaths: session.deaths, moves: session.moves };
  save(db);
  session.elapsed = duration;
  await interaction.update(gameView(session, true));
  if (record || first) {
    const channel = await interaction.client.channels.fetch(CHANNELS.records).catch(() => null);
    if (channel?.isTextBased()) {
      const message = `🏁 <@${interaction.user.id}> completed **Stage ${session.stage}: ${map.name}** in **${format(duration)}** (${session.deaths} deaths).${first ? ` First-clear reward: **${map.reward} Parkour XP**.` : ''}${record ? ' **New personal best!**' : ''}`;
      await channel.send({ content: message, allowedMentions: { parse: [] } }).catch(console.error);
    }
  }
  scheduleLeaderboard(interaction.client);
}
function ranking(db) {
  const scores = Object.entries(db.users).map(([id, p]) => {
    const completed = new Set(p.completed || []).size;
    const totalTime = Object.values(p.best || {}).reduce((n, x) => n + (x.time || 0), 0);
    return { id, completed, totalTime, xp: p.xp || 0 };
  }).filter(x => x.completed).sort((a, b) => b.completed - a.completed || a.totalTime - b.totalTime).slice(0, 10);
  return scores.map((x, i) => `**${i + 1}.** <@${x.id}> — ${x.completed}/10 stages • ${x.xp} XP`).join('\n') || 'No records yet. Be the first!';
}
async function updateLeaderboard(client) {
  const db = load();
  const channel = await client.channels.fetch(CHANNELS.leaderboard).catch(() => null);
  if (!channel?.isTextBased()) return;
  const payload = {
    embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle('NoobV2 Parkour Leaderboard').setDescription(ranking(db)).setFooter({ text: 'Ranked by stages cleared, then combined personal-best time' }).setTimestamp()],
    allowedMentions: { parse: [] }
  };
  let message = null;
  if (db.leaderboardMessage) message = await channel.messages.fetch(db.leaderboardMessage).catch(() => null);
  if (message) await message.edit(payload);
  else {
    message = await channel.send(payload);
    db.leaderboardMessage = message.id;
    save(db);
  }
}
function scheduleLeaderboard(client) {
  leaderboardUpdate = leaderboardUpdate.then(() => updateLeaderboard(client)).catch(console.error);
}
async function handleInteraction(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith('pk:')) return false;
  const [action, argument] = interaction.customId.slice(3).split(':');
  try {
    const id = interaction.user.id;
    if (action === 'start' || action === 'stages') {
      const db = load();
      const p = profile(db, id);
      const stage = action === 'start' ? p.unlocked : 1;
      if (action === 'stages') {
        const options = maps.map(m => btn(`pk:stage:${m.id}`, String(m.id), m.id <= p.unlocked ? ButtonStyle.Primary : ButtonStyle.Secondary, m.id > p.unlocked));
        await interaction.reply({
          content: `**Choose a stage** • Unlocked through Stage ${p.unlocked}`,
          components: [row(options.slice(0, 5)), row(options.slice(5, 10))],
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.reply({ ...gameView(start(id, stage)), flags: MessageFlags.Ephemeral });
      }
      return true;
    }
    if (action === 'stage') {
      const stage = Number(argument);
      const db = load();
      const p = profile(db, id);
      if (!Number.isInteger(stage) || stage < 1 || stage > p.unlocked || stage > 10) {
        await interaction.reply({ content: 'This stage is locked.', flags: MessageFlags.Ephemeral });
      } else {
        await interaction.update(gameView(start(id, stage)));
      }
      return true;
    }
    if (action === 'rank') {
      const db = load();
      const p = profile(db, id);
      const personal = Object.entries(p.best).map(([stage, b]) => `Stage ${stage}: ${format(b.time)}`).join('\n') || 'No completed stages yet.';
      await interaction.reply({ content: `**Your Parkour Records**\n${personal}\n\nParkour XP: **${p.xp}**`, flags: MessageFlags.Ephemeral });
      return true;
    }
    const session = sessions.get(id);
    if (!session || Date.now() - session.startedAt > MAX_SESSION_AGE) {
      sessions.delete(id);
      await interaction.reply({ content: 'Your parkour session expired. Press Start Parkour again.', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (argument !== session.token) {
      await interaction.reply({ content: 'That game panel is outdated. Use your newest parkour panel.', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (action === 'quit') {
      sessions.delete(id);
      await interaction.update({ content: 'Parkour session closed.', embeds: [], components: [] });
      return true;
    }
    if (action === 'next') {
      if (!session.finished) {
        await interaction.reply({ content: 'Finish the stage first.', flags: MessageFlags.Ephemeral });
      } else {
        const next = session.stage === 10 ? 1 : session.stage + 1;
        await interaction.update(gameView(start(id, next)));
      }
      return true;
    }
    if (action === 'restart') {
      await interaction.update(gameView(start(id, session.stage)));
      return true;
    }
    if (!['left', 'right', 'jump'].includes(action)) return true;
    if (session.finished) {
      await interaction.reply({ content: 'This stage is already finished.', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (Date.now() - session.lastInput < COOLDOWN) {
      await interaction.deferUpdate();
      return true;
    }
    session.lastInput = Date.now();
    move(session, action);
    if (session.finished) await finish(interaction, session);
    else await interaction.update(gameView(session));
    return true;
  } catch (e) {
    console.error('[Parkour] Interaction error:', e);
    const msg = { content: 'Parkour encountered an error. Try again.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) await interaction.followUp(msg).catch(console.error);
    else await interaction.reply(msg).catch(console.error);
    return true;
  }
}
async function installPanels(client) {
  const play = await client.channels.fetch(CHANNELS.play);
  const updates = await client.channels.fetch(CHANNELS.updates);
  if (!play?.isTextBased() || !updates?.isTextBased()) throw new Error('Play/updates channel is not a text channel');
  await play.send(panel());
  await updateLeaderboard(client);
  await updates.send({ content: '**NoobV2 Parkour Tower is live!**\n10 stages, checkpoints, personal bests, and Parkour XP. Visit <#' + CHANNELS.play + '> and press **Start Parkour** to play.' });
}
module.exports = { handleInteraction, installPanels, updateLeaderboard, CHANNELS };
