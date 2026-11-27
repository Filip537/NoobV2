const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} = require("discord.js");

const {
  createCanvas,
  loadImage
} = require("canvas");

const crypto = require("crypto");
const gameStats = require("./gameStats.js");
// ===============================
// CONFIGURATION
// ===============================

const PLAYER_LIFE = 8;
const SESSION_TIMEOUT = 15 * 60 * 1000;

const sessions = new Map();
const imageCache = new Map();

const COUNTERS = {
  fire: "muscle",
  ice: "fire",
  muscle: "lightning",
  lightning: "ice"
};

const COLORS = {
  fire: "#ff654d",
  ice: "#65eaff",
  muscle: "#83ed59",
  lightning: "#ffe65c"
};

// ===============================
// SUPERPOWER CARDS
// ===============================

const CARDS = {
  heatvision: {
    name: "Heat Vision",
    type: "fire",
    emoji: "1575701158637600819",
    description: "Deals 1 damage."
  },

  incinerate: {
    name: "Incinerate",
    type: "fire",
    emoji: "1575701156326277220",
    description: "Deals 2 damage against Muscle, otherwise 1."
  },

  flameon: {
    name: "Flame On!",
    type: "fire",
    emoji: "1575701032221282345",
    description: "Heals 1 Life and burns attackers."
  },

  liquify: {
    name: "Liquify",
    type: "fire",
    emoji: "1575701039104135188",
    description: "Deals 1 damage and melts the opponent's card."
  },

  overheat: {
    name: "Overheat",
    type: "fire",
    emoji: "1575701029603774556",
    description: "Boosts your next Fire attack."
  },

  iceshards: {
    name: "Ice Shards",
    type: "ice",
    emoji: "1575701019311087637",
    description: "Deals 1 damage."
  },

  frostbreath: {
    name: "Frost Breath",
    type: "ice",
    emoji: "1575700999920689172",
    description: "Opponent can only use Fire next turn."
  },

  icebarrier: {
    name: "Ice Barrier",
    type: "ice",
    emoji: "1575701027334918164",
    description: "Blocks the next non-Lightning hit."
  },

  puddle: {
    name: "Puddle",
    type: "ice",
    emoji: "1575701014609268786",
    description: "Punishes Lightning attacks for 3 turns."
  },

  frozenmirror: {
    name: "Frozen Mirror",
    type: "ice",
    emoji: null,
    fallback: "🪞",
    description: "Deals 1 damage and reflects Fire powers."
  },

  superstrength: {
    name: "Super Strength",
    type: "muscle",
    emoji: "1575701024985845820",
    description: "Deals 1 damage."
  },

  superspeed: {
    name: "Super Speed",
    type: "muscle",
    emoji: "1575701011933302817",
    cooldown: 2,
    description: "Deals 1 damage and reveals the next move."
  },

  enrage: {
    name: "Enrage",
    type: "muscle",
    emoji: "1575701022222061710",
    description: "Blocks 1 damage and boosts your next hit."
  },

  crush: {
    name: "Crush",
    type: "muscle",
    emoji: "1575701002387193937",
    description: "Deals 3 damage against Lightning."
  },

  regeneration: {
    name: "Regeneration",
    type: "muscle",
    emoji: "1575701017197289493",
    description: "Restores Life over 2 turns."
  },

  shockingfist: {
    name: "Shocking Fist",
    type: "lightning",
    emoji: "1575701169001594880",
    description: "Deals 1 damage."
  },

  thunderstorm: {
    name: "Thunderstorm",
    type: "lightning",
    emoji: "1575701164320628836",
    description: "Damages the opponent over 2 turns."
  },

  overcharge: {
    name: "Overcharge",
    type: "lightning",
    emoji: "1575701161867092078",
    description: "Boosts Lightning attacks until hit by Muscle."
  },

  megawattpulse: {
    name: "Megawatt Pulse",
    type: "lightning",
    emoji: "1575701166631944272",
    cooldown: 2,
    description: "Deals 2 damage."
  },

  resuscitate: {
    name: "Resuscitate",
    type: "lightning",
    emoji: "1575701043734388907",
    description: "Temporarily protects against defeat."
  },

  deathray: {
    name: "Death Ray",
    type: "fire",
    emoji: "1575701006975635566",
    description: "Deals 3 damage."
  },

  banhammer: {
    name: "Ban Hammer",
    type: "ice",
    emoji: "1575701004719226923",
    description: "Defeats the opponent after 3 warnings."
  },

  gvirus: {
    name: "g-Virus",
    type: "muscle",
    emoji: "1575701009349476453",
    description: "Summons a damaging zombie."
  },

  ducttape: {
    name: "Duct Tape",
    type: "lightning",
    emoji: "1575701041377185913",
    description: "Disables an opposing element for 3 turns."
  },

  luckyshot: {
    name: "Lucky Shot",
    type: "muscle",
    emoji: "1575701036826632382",
    description: "Special card.",
    unavailable: true
  },

  alienegg: {
    name: "Alien Egg",
    type: "ice",
    emoji: "1575701034620420096",
    description: "Special card.",
    unavailable: true
  }
};

// ===============================
// VILLAINS
// ===============================

const VILLAINS = [
  {
    name: "The Firebug",
    crime: "is running drop games.",
    life: 8,
    threat: "Villain",
    type: "fire",
    deck: [
      "heatvision",
      "incinerate",
      "flameon",
      "liquify",
      "overheat"
    ]
  },
  {
    name: "Jimmy Snow",
    crime: "is causing trouble in town.",
    life: 8,
    threat: "Villain",
    type: "ice",
    deck: [
      "iceshards",
      "frostbreath",
      "icebarrier",
      "puddle",
      "frozenmirror"
    ]
  },
  {
    name: "Big Bertha",
    crime: "is terrorizing Growtopians.",
    life: 8,
    threat: "Villain",
    type: "muscle",
    deck: [
      "superstrength",
      "superspeed",
      "enrage",
      "crush",
      "regeneration"
    ]
  },
  {
    name: "Shockinator",
    crime: "is causing chaos.",
    life: 8,
    threat: "Villain",
    type: "lightning",
    deck: [
      "shockingfist",
      "thunderstorm",
      "overcharge",
      "megawattpulse",
      "resuscitate"
    ]
  }
];

function randomItem(items) {
  return items[
    Math.floor(Math.random() * items.length)
  ];
}

// ===============================
// COMBAT STATE
// ===============================

function createFighter(deck, life) {
  return {
    life,
    maxLife: life,
    deck: [...deck],
    cooldowns: {},
    melted: -1,
    frozen: 0,
    barrier: false,
    flame: 0,
    puddle: 0,
    overheat: 0,
    enrage: false,
    regeneration: 0,
    thunder: 0,
    overcharge: false,
    resuscitate: 0,
    warnings: 0,
    zombies: 0,
    tapedType: null,
    tapedTurns: 0,
    reveal: false
  };
}

function available(fighter, index) {
  const key = fighter.deck[index];
  const card = CARDS[key];

  if (!card) return false;
  if (fighter.melted === index) return false;
  if ((fighter.cooldowns[index] || 0) > 0) return false;

  if (
    fighter.frozen > 0 &&
    card.type !== "fire"
  ) return false;

  if (
    fighter.tapedTurns > 0 &&
    card.type === fighter.tapedType
  ) return false;

  return true;
}

function availableCards(fighter) {
  return fighter.deck
    .map((_, i) => i)
    .filter(i => available(fighter, i));
}

function heal(fighter, amount) {
  fighter.life = Math.min(
    fighter.maxLife,
    fighter.life + amount
  );
}

function damage(fighter, amount, type) {
  if (amount <= 0) return 0;

  if (
    fighter.barrier &&
    type !== "lightning"
  ) {
    fighter.barrier = false;
    return 0;
  }

  if (fighter.zombies > 0) {
    const blocked = Math.min(
      fighter.zombies,
      amount
    );

    fighter.zombies -= blocked;
    amount -= blocked;
  }

  if (amount > 0 && type === "muscle") {
    fighter.overcharge = false;
  }

  fighter.life -= amount;

  return amount;
}

// ===============================
// CARD ABILITIES
// ===============================

function useCard(key, enemyKey) {
  const enemyType = CARDS[enemyKey]?.type;

  const result = {
    damage: 0,
    heal: 0,
    block: 0
  };

  switch (key) {
    case "heatvision":
    case "iceshards":
    case "superstrength":
    case "shockingfist":
    case "superspeed":
    case "frozenmirror":
    case "liquify":
      result.damage = 1;
      break;

    case "incinerate":
      result.damage =
        enemyType === "muscle" ? 2 : 1;
      break;

    case "crush":
      result.damage =
        enemyType === "lightning" ? 3 : 0;
      break;

    case "megawattpulse":
      result.damage = 2;
      break;

    case "deathray":
      result.damage = 3;
      break;

    case "flameon":
    case "regeneration":
      result.heal = 1;
      break;

    case "enrage":
      result.block = 1;
      break;
  }

  return result;
}

function applyEffect(
  actor,
  enemy,
  key,
  enemyKey,
  enemyIndex
) {
  switch (key) {
    case "flameon":
      actor.flame = 3;
      break;

    case "liquify":
      if (enemyIndex >= 0) {
        enemy.melted = enemyIndex;
      }
      break;

    case "overheat":
      actor.overheat = 1;
      break;

    case "frostbreath":
      enemy.frozen = 1;
      break;

    case "icebarrier":
      actor.barrier = true;
      break;

    case "puddle":
      actor.puddle = 3;
      break;

    case "superspeed":
      actor.reveal = true;
      break;

    case "enrage":
      actor.enrage = true;
      break;

    case "regeneration":
      actor.regeneration = 1;
      break;

    case "thunderstorm":
      enemy.thunder = 2;
      break;

    case "overcharge":
      actor.overcharge = true;
      break;

    case "resuscitate":
      actor.resuscitate = 3;
      break;

    case "banhammer":
      enemy.warnings++;

      if (enemy.warnings >= 3) {
        enemy.life = 0;
      }
      break;

    case "gvirus":
      actor.zombies++;
      break;

    case "ducttape":
      if (CARDS[enemyKey]) {
        enemy.tapedType = CARDS[enemyKey].type;
        enemy.tapedTurns = 3;
      }
      break;
  }
}

function tick(fighter) {
  for (const index of Object.keys(fighter.cooldowns)) {
    fighter.cooldowns[index] = Math.max(
      0,
      fighter.cooldowns[index] - 1
    );
  }

  for (const effect of [
    "frozen",
    "flame",
    "puddle",
    "overheat",
    "regeneration",
    "thunder",
    "resuscitate",
    "tapedTurns"
  ]) {
    fighter[effect] = Math.max(
      0,
      fighter[effect] - 1
    );
  }

  fighter.reveal = false;
}

// ===============================
// BATTLE ENGINE
// ===============================

function resolveTurn(game, playerIndex) {
  const p = game.player;
  const v = game.enemy;

  const enemyAvailable = availableCards(v);

  const enemyIndex = enemyAvailable.includes(
    game.nextEnemyIndex
  )
    ? game.nextEnemyIndex
    : randomItem(enemyAvailable) ?? -1;

  const pk = p.deck[playerIndex];
  const vk = v.deck[enemyIndex];

  const pc = CARDS[pk];
  const vc = CARDS[vk];

  const pt = pc?.type;
  const vt = vc?.type;

  game.turn++;

  const logs = [
    `You: ${pc?.name || "No available move"}`,
    `${game.villain.name}: ${vc?.name || "No available move"}`
  ];

  let pActive = Boolean(pc);
  let vActive = Boolean(vc);

  let pReflect = false;
  let vReflect = false;

  // Elemental counters

  if (pc && vc) {
    if (COUNTERS[pt] === vt) {
      if (pk === "frozenmirror") {
        pReflect = true;
      } else if (!(vt === "fire" && v.overheat)) {
        vActive = false;
        logs.push("You countered the villain!");
      }
    }

    if (COUNTERS[vt] === pt) {
      if (vk === "frozenmirror") {
        vReflect = true;
      } else if (!(pt === "fire" && p.overheat)) {
        pActive = false;
        logs.push("The villain countered your card!");
      }
    }
  }

  const pr = useCard(
    pActive ? pk : null,
    vk
  );

  const vr = useCard(
    vActive ? vk : null,
    pk
  );

  // Existing damage bonuses

  if (pActive && pr.damage > 0) {
    if (p.enrage) {
      pr.damage++;
      p.enrage = false;
    }

    if (p.overheat && pt === "fire") {
      pr.damage++;
    }

    if (p.overcharge && pt === "lightning") {
      pr.damage++;
    }
  }

  if (vActive && vr.damage > 0) {
    if (v.enrage) {
      vr.damage++;
      v.enrage = false;
    }

    if (v.overheat && vt === "fire") {
      vr.damage++;
    }

    if (v.overcharge && vt === "lightning") {
      vr.damage++;
    }
  }

  // Persistent effects

  let pExtra = 0;
  let vExtra = 0;

  if (p.regeneration) heal(p, 1);
  if (v.regeneration) heal(v, 1);

  if (p.thunder) pExtra++;
  if (v.thunder) vExtra++;

  vExtra += p.zombies;
  pExtra += v.zombies;

  if (p.puddle && vt === "lightning") {
    vExtra++;
  }

  if (v.puddle && pt === "lightning") {
    pExtra++;
  }

  const pFlame = p.flame > 0;
  const vFlame = v.flame > 0;

  const pRevive = p.resuscitate > 0;
  const vRevive = v.resuscitate > 0;

  tick(p);
  tick(v);

  // Set cooldowns even when countered

  if (playerIndex >= 0) {
    p.cooldowns[playerIndex] =
      pc.cooldown || 1;
  }

  if (enemyIndex >= 0) {
    v.cooldowns[enemyIndex] =
      vc.cooldown || 1;
  }

  // Apply healing

  if (pActive) heal(p, pr.heal);
  if (vActive) heal(v, vr.heal);

  // Defensive effects must apply before damage

  if (pActive && pk === "icebarrier") {
    p.barrier = true;
  }

  if (vActive && vk === "icebarrier") {
    v.barrier = true;
  }

  let toPlayer = Math.max(
    0,
    vr.damage - pr.block
  );

  let toEnemy = Math.max(
    0,
    pr.damage - vr.block
  );

  // Frozen Mirror reflection

  if (pReflect) {
    toEnemy += toPlayer;
    toPlayer = 0;
    logs.push("You reflected the Fire attack!");
  }

  if (vReflect) {
    toPlayer += toEnemy;
    toEnemy = 0;
    logs.push("The villain reflected your attack!");
  }

  const playerDamage = damage(
    p,
    toPlayer,
    vt
  );

  const enemyDamage = damage(
    v,
    toEnemy,
    pt
  );

  if (pFlame && playerDamage > 0) vExtra++;
  if (vFlame && enemyDamage > 0) pExtra++;

  damage(p, pExtra, null);
  damage(v, vExtra, null);

  if (pActive && !vReflect) {
    applyEffect(p, v, pk, vk, enemyIndex);
  }

  if (vActive && !pReflect) {
    applyEffect(v, p, vk, pk, playerIndex);
  }

  // Reflected secondary abilities

  if (pReflect && vc) {
    applyEffect(v, v, vk, vk, enemyIndex);
  }

  if (vReflect && pc) {
    applyEffect(p, p, pk, pk, playerIndex);
  }

  // Resuscitate

  if (
    p.life <= 0 &&
    (pRevive || p.resuscitate > 0)
  ) {
    p.life = 1;
    p.resuscitate = 0;
    logs.push("Resuscitate saved your life!");
  }

  if (
    v.life <= 0 &&
    (vRevive || v.resuscitate > 0)
  ) {
    v.life = 1;
    v.resuscitate = 0;
    logs.push("The villain recovered!");
  }

  p.life = Math.max(0, p.life);
  v.life = Math.max(0, v.life);

  logs.push(
    `Damage: You ${playerDamage + pExtra} | Villain ${enemyDamage + vExtra}`
  );

  game.lastPlayer = pk;
  game.lastEnemy = vk;
  game.logs = logs;

  if (p.life === 0 && v.life === 0) {
    game.stage = "draw";
} else if (v.life === 0) {
    game.stage = "won";

    if (!game.winRecorded) {
        game.winRecorded = gameStats.addWin(
            game.userId,
            "crime"
        );
    }

} else if (p.life === 0) {
    game.stage = "lost";
  }

  game.nextEnemyIndex =
    randomItem(availableCards(v)) ?? -1;
}

// ===============================
// IMAGE LOADING
// ===============================

async function getCardImage(key) {
  const card = CARDS[key];

  if (!card?.emoji) return null;

  if (imageCache.has(key)) {
    return imageCache.get(key);
  }

  const promise = (async () => {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      2500
    );

    try {
      const response = await fetch(
        `https://cdn.discordapp.com/emojis/${card.emoji}.png?size=128`,
        { signal: controller.signal }
      );

      if (!response.ok) return null;

      const buffer = Buffer.from(
        await response.arrayBuffer()
      );

      return await loadImage(buffer);

    } catch {
      return null;

    } finally {
      clearTimeout(timeout);
    }
  })();

  imageCache.set(key, promise);

  const image = await promise;

  if (!image) imageCache.delete(key);

  return image;
}

function text(
  ctx,
  value,
  x,
  y,
  size = 24,
  color = "#ffffff",
  bold = false
) {
  ctx.font =
    `${bold ? "bold " : ""}${size}px Arial`;

  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.fillText(String(value), x, y);
}

function healthBar(ctx, x, y, width, fighter) {
  ctx.fillStyle = "#102a3c";
  ctx.fillRect(x, y, width, 25);

  ctx.fillStyle = "#70cf42";

  ctx.fillRect(
    x,
    y,
    width * Math.max(
      0,
      fighter.life / fighter.maxLife
    ),
    25
  );

  ctx.strokeStyle = "#b9d6e5";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, 25);

  text(
    ctx,
    `${fighter.life} / ${fighter.maxLife} Life`,
    x + 8,
    y + 19,
    17,
    "#ffffff",
    true
  );
}

async function drawCard(
  ctx,
  key,
  x,
  y,
  size,
  disabled = false
) {
  const card = CARDS[key];

  ctx.fillStyle = "#15384e";
  ctx.fillRect(x, y, size, size);

  ctx.strokeStyle =
    card ? COLORS[card.type] : "#6793ad";

  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, size, size);

  if (!card) {
    text(
      ctx,
      "?",
      x + size / 2 - 8,
      y + size / 2 + 10,
      28,
      "#8bb1c8",
      true
    );
    return;
  }

  const image = await getCardImage(key);

  if (image) {
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(
      image,
      x + 5,
      y + 5,
      size - 10,
      size - 10
    );

    ctx.imageSmoothingEnabled = true;

  } else {
    text(
      ctx,
      card.name.slice(0, 8),
      x + 4,
      y + size / 2,
      14,
      "#ffffff",
      true
    );
  }

  if (disabled) {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(x, y, size, size);
  }
}

// ===============================
// GROWTOPIA CANVAS
// ===============================

async function renderCanvas(game) {
  const canvas = createCanvas(1000, 620);
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(
    0, 0, 0, 620
  );

  gradient.addColorStop(0, "#347f9b");
  gradient.addColorStop(1, "#17435f");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1000, 620);

  // Outer Growtopia-style border

  ctx.strokeStyle = "#b6d4de";
  ctx.lineWidth = 5;
  ctx.strokeRect(7, 7, 986, 606);

  ctx.strokeStyle = "#102c40";
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, 972, 592);

  text(
    ctx,
    "Crime in Progress",
    35, 60, 40,
    "#e4faff",
    true
  );

  text(
    ctx,
    `${game.villain.name} ${game.villain.crime}`,
    35, 102, 25,
    "#ffb2a6",
    true
  );

  text(
    ctx,
    "Threat Level:",
    35, 137, 22
  );

  text(
    ctx,
    game.villain.threat,
    185, 137, 22,
    "#83ed59",
    true
  );

  ctx.fillStyle = "#7299af";
  ctx.fillRect(35, 154, 930, 2);

  // =============================
  // CARD SELECTION
  // =============================

  if (game.stage === "select") {
    text(
      ctx,
      "Choose 5 Superpowers to defeat the villain!",
      35, 194, 26
    );

    text(
      ctx,
      "Your selected Superpower Cards:",
      35, 232, 24,
      "#d9efff"
    );

    text(
      ctx,
      `${game.selected.length}/5 Selected`,
      35, 272, 25,
      "#ffe779",
      true
    );

    for (let i = 0; i < 5; i++) {
      const x = 65 + i * 180;

      await drawCard(
        ctx,
        game.selected[i],
        x,
        310,
        115
      );

      const card = CARDS[game.selected[i]];

      if (card) {
        text(
          ctx,
          card.name,
          x - 5,
          455,
          19,
          COLORS[card.type],
          true
        );
      }
    }

    text(
      ctx,
      "Press a card icon below to select or remove it.",
      35, 515, 22
    );

    text(
      ctx,
      `Card Page ${game.page + 1}/2`,
      35, 560, 22,
      "#ffe779",
      true
    );

  // =============================
  // ACTIVE BATTLE
  // =============================

  } else {
    text(
      ctx,
      "Your Life",
      35, 190, 24,
      "#83ed59",
      true
    );

    text(
      ctx,
      `${game.villain.name}'s Life`,
      550, 190, 24,
      "#ffb2a6",
      true
    );

    if (game.player && game.enemy) {
      healthBar(
        ctx, 35, 205, 410, game.player
      );

      healthBar(
        ctx, 550, 205, 410, game.enemy
      );
    }

    text(
      ctx,
      `Turn ${game.turn}`,
      35, 266, 23,
      "#ffe779",
      true
    );

    await drawCard(
      ctx,
      game.lastPlayer,
      35, 287, 75
    );

    await drawCard(
      ctx,
      game.lastEnemy,
      890, 287, 75
    );

    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(125, 278, 750, 136);

    const logs = game.logs.slice(-4);

    logs.forEach((line, index) => {
      text(
        ctx,
        line,
        140,
        305 + index * 29,
        19,
        "#ffffff"
      );
    });

    for (let i = 0; i < 5; i++) {
      const x = 80 + i * 180;
      const key = game.selected[i];

      await drawCard(
        ctx,
        key,
        x,
        440,
        90,
        game.player
          ? !available(game.player, i)
          : true
      );

      text(
        ctx,
        CARDS[key]?.name || "",
        x - 10,
        555,
        18,
        COLORS[CARDS[key]?.type] || "#ffffff"
      );
    }

    let status = "Choose your next Superpower!";
    let statusColor = "#ffe779";

    if (game.stage === "won") {
      status = "You defeated the villain!";
      statusColor = "#83ff70";
    }

    if (game.stage === "lost") {
      status = "You were defeated!";
      statusColor = "#ff7070";
    }

    if (game.stage === "draw") {
      status = "Both fighters were defeated!";
    }

    if (game.stage === "fled") {
      status = "You ran away from the crime!";
      statusColor = "#ff7070";
    }

    if (game.stage === "expired") {
      status = "Crime encounter expired.";
      statusColor = "#ff7070";
    }

    if (
      game.stage === "battle" &&
      game.player?.reveal
    ) {
      const key =
        game.enemy.deck[game.nextEnemyIndex];

      status =
        `Next enemy move: ${CARDS[key]?.name || "Pass"}`;
    }

    text(
      ctx,
      status,
      35, 590, 24,
      statusColor,
      true
    );
  }

  return canvas.toBuffer("image/png");
}

// ===============================
// DISCORD BUTTONS
// ===============================

function cardButton(
  game,
  key,
  action,
  disabled = false,
  selected = false
) {
  const card = CARDS[key];

  const button = new ButtonBuilder()
    .setCustomId(
      `crime:${game.id}:${action}`
    )
    .setStyle(
      selected
        ? ButtonStyle.Success
        : ButtonStyle.Secondary
    )
    .setDisabled(disabled);

  // ICON ONLY — NO BUTTON TEXT

  if (card.emoji) {
    button.setEmoji({
      id: card.emoji
    });
  } else {
    button.setEmoji(
      card.fallback || "❔"
    );
  }

  return button;
}

function buildButtons(game) {
  const rows = [];

  // =============================
  // SELECTION BUTTONS
  // =============================

  if (game.stage === "select") {
    const keys = Object.keys(CARDS);

    const pageCards = keys.slice(
      game.page * 20,
      game.page * 20 + 20
    );

    for (let i = 0; i < pageCards.length; i += 5) {
      const row = new ActionRowBuilder();

      for (const key of pageCards.slice(i, i + 5)) {
        const selected =
          game.selected.includes(key);

        row.addComponents(
          cardButton(
            game,
            key,
            `select_${key}`,
            Boolean(CARDS[key].unavailable) ||
            (
              game.selected.length >= 5 &&
              !selected
            ),
            selected
          )
        );
      }

      rows.push(row);
    }

    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(
            `crime:${game.id}:previous`
          )
          .setEmoji("◀️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(game.page === 0),

        new ButtonBuilder()
          .setCustomId(
            `crime:${game.id}:next`
          )
          .setEmoji("▶️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(game.page === 1),

        new ButtonBuilder()
          .setCustomId(
            `crime:${game.id}:reset`
          )
          .setEmoji("🔄")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId(
            `crime:${game.id}:start`
          )
          .setEmoji("✅")
          .setStyle(ButtonStyle.Success)
          .setDisabled(
            game.selected.length !== 5
          ),

        new ButtonBuilder()
          .setCustomId(
            `crime:${game.id}:run`
          )
          .setEmoji("❌")
          .setStyle(ButtonStyle.Danger)
      )
    );

    return rows;
  }

  // =============================
  // FIVE BATTLE CARDS
  // =============================

  if (game.stage === "battle") {
    const row = new ActionRowBuilder();

    game.selected.forEach((key, index) => {
      row.addComponents(
        cardButton(
          game,
          key,
          `play_${index}`,
          !available(game.player, index)
        )
      );
    });

    rows.push(row);

    const controls = new ActionRowBuilder();

    if (
      availableCards(game.player).length === 0
    ) {
      controls.addComponents(
        new ButtonBuilder()
          .setCustomId(
            `crime:${game.id}:pass`
          )
          .setEmoji("⏭️")
          .setStyle(ButtonStyle.Secondary)
      );
    }

    controls.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `crime:${game.id}:run`
        )
        .setLabel("Run Away")
        .setStyle(ButtonStyle.Danger)
    );

    rows.push(controls);
  }

  return rows;
}

// ===============================
// MESSAGE UPDATES
// ===============================

async function buildMessage(game) {
  const buffer = await renderCanvas(game);

  return {
    content: "",
    embeds: [],
    attachments: [],
    files: [
      new AttachmentBuilder(buffer, {
        name: "crime.png"
      })
    ],
    components: buildButtons(game)
  };
}

function isFinished(game) {
  return !["select", "battle"].includes(
    game.stage
  );
}

function removeSession(game) {
  clearTimeout(game.timeout);
  sessions.delete(game.userId);
}

// ===============================
// /CRIME COMMAND
// ===============================

async function handleCrime(interaction) {
  const userId = interaction.user.id;

  if (sessions.has(userId)) {
    return interaction.reply({
      content: "You already have a crime in progress.",
      ephemeral: true
    });
  }

  const villain = randomItem(VILLAINS);

  const game = {
    id: crypto.randomBytes(5).toString("hex"),
    userId,
    villain,
    stage: "select",
    selected: [],
    page: 0,
    turn: 0,
    logs: [],
    player: null,
    enemy: null,
    lastPlayer: null,
    lastEnemy: null,
    nextEnemyIndex: -1,
    busy: true,
    message: null,
    timeout: null
  };

  sessions.set(userId, game);

  try {
    // PUBLIC REPLY

    await interaction.deferReply();

    game.message = await interaction.editReply(
      await buildMessage(game)
    );

    game.busy = false;

    game.timeout = setTimeout(async () => {
      if (sessions.get(userId) !== game) {
        return;
      }

      if (game.busy) return;

      game.busy = true;
      game.stage = "expired";

      removeSession(game);

      try {
        await game.message.edit({
          content: "This crime encounter has expired.",
          components: []
        });
      } catch (error) {
        console.error(
          "[CRIME TIMEOUT]",
          error
        );
      }
    }, SESSION_TIMEOUT);

    game.timeout.unref?.();

  } catch (error) {
    removeSession(game);

    console.error("[CRIME COMMAND]", error);

    const payload = {
      content: "Unable to start the crime encounter.",
      components: []
    };

    if (interaction.deferred) {
      await interaction.editReply(payload)
        .catch(() => {});
    } else {
      await interaction.reply(payload)
        .catch(() => {});
    }
  }
}

// ===============================
// BUTTON INTERACTIONS
// ===============================

async function handleCrimeButton(interaction) {
  const [, sessionId, action] =
    interaction.customId.split(":");

  const game = [...sessions.values()]
    .find(session => session.id === sessionId);

  if (!game) {
    return interaction.reply({
      content: "This crime encounter has ended.",
      ephemeral: true
    });
  }

  if (game.userId !== interaction.user.id) {
    return interaction.reply({
      content: "This is not your crime encounter.",
      ephemeral: true
    });
  }

  if (game.busy) {
    return interaction.reply({
      content: "Your previous move is processing.",
      ephemeral: true
    });
  }

  game.busy = true;

  try {
    await interaction.deferUpdate();

    // CARD SELECTION

    if (
      game.stage === "select" &&
      action.startsWith("select_")
    ) {
      const key = action.slice(7);

      if (!CARDS[key] || CARDS[key].unavailable) {
        return;
      }

      if (game.selected.includes(key)) {
        game.selected = game.selected.filter(
          item => item !== key
        );
      } else if (game.selected.length < 5) {
        game.selected.push(key);
      }
    }

    // NAVIGATION

    else if (
      game.stage === "select" &&
      action === "next"
    ) {
      game.page = 1;
    }

    else if (
      game.stage === "select" &&
      action === "previous"
    ) {
      game.page = 0;
    }

    else if (
      game.stage === "select" &&
      action === "reset"
    ) {
      game.selected = [];
    }

    // START BATTLE

    else if (
      game.stage === "select" &&
      action === "start"
    ) {
      if (game.selected.length !== 5) return;

      game.player = createFighter(
        game.selected,
        PLAYER_LIFE
      );

      game.enemy = createFighter(
        game.villain.deck,
        game.villain.life
      );

      game.nextEnemyIndex = randomItem(
        availableCards(game.enemy)
      );

      game.stage = "battle";

      game.logs = [
        "The fight has begun!",
        "Choose your first Superpower."
      ];
    }

    // PLAY A CARD

    else if (
      game.stage === "battle" &&
      action.startsWith("play_")
    ) {
      const index = Number(
        action.slice(5)
      );

      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index > 4 ||
        !available(game.player, index)
      ) return;

      resolveTurn(game, index);
    }

    // NO AVAILABLE CARDS

    else if (
      game.stage === "battle" &&
      action === "pass"
    ) {
      if (
        availableCards(game.player).length > 0
      ) return;

      resolveTurn(game, -1);
    }

    // RUN AWAY

    else if (action === "run") {
      if (game.stage === "select") {
        removeSession(game);

        return interaction.editReply({
          content: "Crime encounter cancelled.",
          attachments: [],
          components: []
        });
      }

      game.stage = "fled";

      game.logs = [
        "You escaped from the villain."
      ];
    }

    await interaction.editReply(
      await buildMessage(game)
    );

    if (isFinished(game)) {
      removeSession(game);
    }

  } catch (error) {
    console.error("[CRIME BUTTON]", error);

    await interaction.followUp({
      content: "An error occurred during the crime encounter.",
      ephemeral: true
    }).catch(() => {});

  } finally {
    game.busy = false;
  }
}

// ===============================
// EXPORTS
// ===============================

module.exports = {
  handleCrime,
  handleCrimeButton
};
