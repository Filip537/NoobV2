
const {
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { randomUUID } = require("crypto");

// ==========================================
// CONFIGURATION
// ==========================================

const CONFIG = {
  surgeonSkill: 100,
  baseSkillFail: 0.05,
  sessionTimeout: 15 * 60 * 1000,
  syncInterval: 24 * 60 * 60 * 1000,
  specialConditionChance: 0.15,
  wikiAPI: "https://growtopiawiki.com/api.php"
};

const DATA_FILE = path.join(
  __dirname, "surgeryData.json"
);

const MALADY_FILE = path.join(
  __dirname, "maladies.json"
);

const FIST_FILE = path.join(
  __dirname, "..", "images", "fist-192x192.png"
);

const sessions = new Map();

let maladies = {};
let syncRunning = false;
let syncTimer = null;
let fistBase64 = null;

// ==========================================
// EMOJIS
// ==========================================

const STATUS = {
  green: "<:greenblock192x192:1575688199827759164>",
  yellow: "<:yellowblock192x192:1575688203254505482>",
  red: "<:redblock192x192:1575688206035320922>"
};

const EMOJIS = {
  antiseptic: "1575685600361586809",
  scalpel: "1575685597752983723",
  fix: "1575685594955260068",
  labkit: "1575685591624847491",
  antibiotics: "1575685589154668564",
  splint: "1575685586705064036",
  clamp: "1575685583366258878",
  sponge: "1575685486641422366",
  transfusion: "1575685483676172419",
  anesthetic: "1575685481062998123",
  defibrillator: "1575685478575902851",
  pins: "1575685474905882816",
  stitches: "1575685471055642776",
  ultrasound: "1575685467842543737"
};

const COLORS = {
  white: "#F5F5ED",
  green: "#80EF48",
  yellow: "#F2D58B",
  red: "#FF7777",
  blue: "#BDE5F5",
  background: "#245F7B",
  border: "#9DCAD8"
};

// ==========================================
// NORMAL DIAGNOSES
// ==========================================

const NORMAL_DIAGNOSES = [
  {
    name: "Broken Arm",
    cuts: 0,
    broken: 1,
    bleeding: 1,
    type: "bones"
  },
  {
    name: "Broken Leg",
    cuts: 1,
    broken: 1,
    shattered: 1,
    bleeding: 1,
    type: "bones"
  },
  {
    name: "Bird Flu",
    cuts: 0,
    temp: 103,
    fever: 0.5,
    visibility: 40,
    type: "flu"
  },
  {
    name: "Turtle Flu",
    cuts: 0,
    temp: 101,
    fever: 0.9,
    visibility: 40,
    type: "flu"
  },
  {
    name: "Monkey Flu",
    cuts: 0,
    temp: 105,
    fever: 0.9,
    type: "flu"
  },
  {
    name: "Nose Job",
    cuts: 1,
    known: true
  },
  {
    name: "Lung Tumor",
    cuts: 1
  },
  {
    name: "Heart Attack",
    cuts: 2
  },
  {
    name: "Brain Tumor",
    cuts: 5
  },
  {
    name: "Liver Infection",
    cuts: 2,
    temp: 103,
    fever: 0.5,
    dirt: 2
  },
  {
    name: "Kidney Failure",
    cuts: 1,
    temp: 101,
    fever: 0.5,
    dirt: 2
  },
  {
    name: "Appendicitis",
    cuts: 3,
    temp: 101,
    fever: 0.9,
    dirt: 3
  },
  {
    name: "Swallowed a World Lock",
    cuts: 2,
    temp: 101,
    fever: 0.9,
    dirt: 2,
    visibility: 40
  },
  {
    name: "Herniated Disc",
    aliases: ["Damaged spine"],
    cuts: 3,
    temp: 100
  },
  {
    name: "Broken Everything",
    aliases: ["Run over by a truck"],
    cuts: 2,
    shattered: 4,
    bleeding: 1,
    dirt: 3,
    visibility: 40
  },
  {
    name: "Serious Head Injury",
    cuts: 1,
    blood: 45,
    bleeding: 3,
    dirt: 3,
    visibility: 40
  },
  {
    name: "Serious Trauma",
    aliases: [
      "Serious Trauma with a punctured lung"
    ],
    cuts: 2,
    broken: 2,
    shattered: 1,
    bleeding: 2,
    dirt: 3,
    visibility: 40
  },
  {
    name: "Massive Trauma",
    cuts: 3,
    blood: 75,
    broken: 3,
    shattered: 2,
    bleeding: 3,
    dirt: 3,
    visibility: 40
  }
];

// ==========================================
// MALADY DIAGNOSES
// ==========================================

const MALADY_DIAGNOSES = [
  {
    name: "Torn Punching Muscle",
    cuts: 1
  },
  {
    name: "Gem Cuts",
    cuts: 2,
    bleeding: 1
  },
  {
    name: "Broken Heart",
    cuts: 2,
    shattered: 2,
    temp: 105,
    fever: 0.9,
    heartRisk: 0.09
  },
  {
    name: "Grumbleteeth",
    cuts: 1,
    shattered: 1,
    temp: 103,
    fever: 0.3,
    visibility: 40
  },
  {
    name: "Chicken Feet",
    cuts: 2,
    shattered: 2,
    temp: 101,
    fever: 0.9,
    dirt: 3
  },
  {
    name: "Chaos Infection",
    cuts: 3,
    broken: 2,
    bleeding: 2,
    temp: 105,
    fever: 0.9,
    visibility: 40
  },
  {
    name: "Lupus",
    cuts: 3,
    blood: 45,
    temp: 100,
    fever: 0.9,
    bleeding: 1
  },
  {
    name: "Brainworms",
    cuts: 2,
    shattered: 1,
    temp: 103,
    fever: 0.5,
    bleeding: 2,
    visibility: 40
  },
  {
    name: "Moldy Guts",
    cuts: 2,
    shattered: 1,
    temp: 103,
    fever: 0.5,
    dirt: 3,
    visibility: 40
  },
  {
    name: "Ecto-Bones",
    cuts: 0,
    broken: 6,
    shattered: 2,
    visibility: 40,
    type: "bones"
  },
  {
    name: "Fatty-Liver",
    cuts: 3,
    temp: 103,
    fever: 0.9,
    heartRisk: 0.08
  }
].map(d => ({
  ...d,
  isMalady: true
}));

const FALLBACK = [
  ...NORMAL_DIAGNOSES,
  ...MALADY_DIAGNOSES
];

let diagnoses = FALLBACK.map(d => ({ ...d }));

const CONDITIONS = [
  "Tough Skin",
  "Antibiotic Resistant",
  "Absolutely Filthy",
  "Hyperactive",
  "Hemophiliac"
];

// ==========================================
// UTILITIES
// ==========================================

function chance(value) {
  return Math.random() < value;
}

function pick(array) {
  return array[
    Math.floor(Math.random() * array.length)
  ];
}

function limit(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\(malady\)/gi, "")
    .replace(/[^a-z0-9]/g, "");
}

function cleanText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeXML(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function plainText(text) {
  return String(text || "")
    .replace(/<a?:[a-zA-Z0-9_]+:\d+>/g, "")
    .replace(/\*\*/g, "")
    .trim();
}

function wrapText(text, maxLength = 58) {
  const lines = [];

  for (
    const paragraph of String(text).split("\n")
  ) {
    let current = "";

    for (
      const word of paragraph.split(/\s+/)
    ) {
      if (
        current.length &&
        current.length + word.length + 1 >
          maxLength
      ) {
        lines.push(current);
        current = word;
      } else {
        current +=
          (current ? " " : "") + word;
      }
    }

    if (current) lines.push(current);
  }

  return lines;
}

// ==========================================
// MALADY DATABASE
// ==========================================

function loadMaladies() {
  try {
    if (!fs.existsSync(MALADY_FILE)) {
      maladies = {};
      return;
    }

    const data = JSON.parse(
      fs.readFileSync(MALADY_FILE, "utf8")
    );

    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    ) {
      throw new Error("Invalid malady database");
    }

    maladies = data;

  } catch (error) {
    console.error(
      "[MALADY] Failed to load database:",
      error.message
    );
    throw error;
  }
}

function saveMaladies() {
  const temp = MALADY_FILE + ".tmp";

  fs.writeFileSync(
    temp,
    JSON.stringify(maladies, null, 2),
    "utf8"
  );

  fs.renameSync(temp, MALADY_FILE);
}

function maladyKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function getMalady(guildId, userId) {
  return maladies[
    maladyKey(guildId, userId)
  ] || null;
}

function assignMalady(guildId, userId) {
  const key = maladyKey(guildId, userId);

  const existing = maladies[key];

  if (existing) return existing;

  const selected = pick(
    diagnoses.filter(d => d.isMalady)
  );

  const record = {
    id: randomUUID(),
    name: selected.name,
    infectedAt: Date.now(),
    cured: false
  };

  maladies[key] = record;

  try {
    saveMaladies();
  } catch (error) {
    delete maladies[key];
    throw error;
  }

  return record;
}

function cureMalady(p) {
  if (
    !p.targetId ||
    !p.maladyId ||
    !p.guildId
  ) {
    return false;
  }

  const key = maladyKey(
    p.guildId,
    p.targetId
  );

  const record = maladies[key];

  if (
    !record ||
    record.id !== p.maladyId
  ) {
    return false;
  }

  if (record.cured) return true;

  maladies[key] = {
    ...record,
    cured: true,
    curedAt: Date.now(),
    curedBy: p.userId
  };

  try {
    saveMaladies();
    return true;
  } catch (error) {
    maladies[key] = record;
    throw error;
  }
}

// ==========================================
// ACTIVE PATIENT PROTECTION
// ==========================================

function activePatient(guildId, targetId) {
  return Array.from(
    sessions.values()
  ).find(p =>
    p.guildId === guildId &&
    p.targetId === targetId &&
    (
      p.busy ||
      (
        !p.finished &&
        Date.now() - p.updatedAt <
          CONFIG.sessionTimeout
      )
    )
  );
}

// ==========================================
// MALADY SCANNER
// ==========================================

async function scan(interaction) {
  if (!interaction.guildId) {
    return interaction.reply({
      content:
        "This command is only available in a server.",
      ephemeral: true
    });
  }

  const target =
    interaction.options.getUser("user");

  if (!target || target.bot) {
    return interaction.reply({
      content: "Please select a valid member.",
      ephemeral: true
    });
  }

  try {
    const record = getMalady(
      interaction.guildId,
      target.id
    ) || assignMalady(
      interaction.guildId,
      target.id
    );

    const embed = new EmbedBuilder()
      .setTitle("Malady Scanner")
      .setColor(
        record.cured
          ? 0x80EF48
          : 0xFF7777
      )
      .setThumbnail(
        target.displayAvatarURL({
          size: 256
        })
      )
      .setDescription(
        record.cured
          ? `You scanned <@${target.id}>.\n\n` +
            `${STATUS.green} No malady detected.\n` +
            "This patient has been cured."
          : `You scanned <@${target.id}>.\n\n` +
            `### ${record.name}\n` +
            `${STATUS.red} Malady detected!\n\n` +
            "Use `/surgery user:` to treat this patient."
      )
      .setFooter({
        text: "NoobV2 • Growtopia simulation"
      });

    return interaction.reply({
      embeds: [embed],
      allowedMentions: {
        parse: []
      }
    });

  } catch (error) {
    console.error(
      "[MALADY] Scanner error:",
      error
    );

    return interaction.reply({
      content: "Unable to scan this patient.",
      ephemeral: true
    }).catch(() => {});
  }
}

// ==========================================
// LOAD CACHED WIKI DATA
// ==========================================

function loadCachedData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;

    const data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    if (!Array.isArray(data.diagnoses)) {
      return;
    }

    diagnoses = FALLBACK.map(base => {
      const cached = data.diagnoses.find(
        d => d.name === base.name
      );

      if (
        cached &&
        Number.isInteger(cached.cuts) &&
        cached.cuts >= 0 &&
        cached.cuts <= 10
      ) {
        return {
          ...base,
          cuts: cached.cuts
        };
      }

      return { ...base };
    });

    console.log(
      `[SURGERY] Loaded ${diagnoses.length} diagnoses.`
    );

  } catch (error) {
    console.error(
      "[SURGERY] Cache error:",
      error.message
    );
  }
}

// ==========================================
// FETCH GROWTopia WIKI
// ==========================================

async function fetchWiki(page) {
  const params = new URLSearchParams({
    action: "parse",
    page,
    prop: "text",
    redirects: "1",
    format: "json"
  });

  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    15000
  );

  try {
    const response = await fetch(
      `${CONFIG.wikiAPI}?${params}`,
      {
        signal: controller.signal,
        headers: {
          "User-Agent": "NoobV2 Surgery Simulator"
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Wiki HTTP ${response.status}`
      );
    }

    const data = await response.json();
    const html = data?.parse?.text?.["*"];

    if (!html) {
      throw new Error(
        "Wiki returned no content."
      );
    }

    return html;

  } finally {
    clearTimeout(timer);
  }
}

function extractCuts(description) {
  const patterns = [
    /\b(\d+)\s+incisions?\s+using\s+(?:a\s+)?surgical scalpel/i,
    /cut\s+(\d+)\s+incisions?/i,
    /using\s+(\d+)\s+surgical scalpels?/i,
    /make\s+(\d+)\s+incisions?/i,
    /\b(\d+)\s+surgical scalpels?/i
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);

    if (match) {
      const number = Number(match[1]);

      if (
        Number.isInteger(number) &&
        number >= 0 &&
        number <= 10
      ) {
        return number;
      }
    }
  }

  if (
    /using a surgical scalpel/i.test(description) ||
    /cut one incision/i.test(description)
  ) {
    return 1;
  }

  return null;
}

async function syncWiki() {
  if (syncRunning) return false;

  syncRunning = true;

  try {
    let html;

    for (const page of [
      "Guide:Surgery",
      "Surgery Guide",
      "Performing Surgery"
    ]) {
      try {
        html = await fetchWiki(page);
        if (html) break;
      } catch (error) {
        console.warn(
          `[SURGERY] ${page}: ${error.message}`
        );
      }
    }

    if (!html) {
      throw new Error(
        "No accessible surgery guide."
      );
    }

    const $ = cheerio.load(html);
    const rows = [];

    $("table tr").each((_, row) => {
      const cells = $(row).children("td, th");

      if (cells.length < 2) return;

      rows.push({
        name: cleanText($(cells[0]).text()),
        description: cleanText(
          cells.slice(1).text()
        )
      });
    });

    let matched = 0;
    let parsed = 0;

    const updated = diagnoses.map(base => {
      const names = [
        base.name,
        ...(base.aliases || [])
      ].map(normalize);

      const row = rows.find(item =>
        names.includes(normalize(item.name))
      );

      if (!row) return { ...base };

      matched++;

      if (
        base.type === "flu" ||
        base.type === "bones"
      ) {
        return { ...base };
      }

      const cuts = extractCuts(
        row.description
      );

      if (cuts === null) {
        return { ...base };
      }

      const original = FALLBACK.find(
        d => d.name === base.name
      );

      if (
        Math.abs(cuts - original.cuts) > 2
      ) {
        return { ...base };
      }

      parsed++;

      return {
        ...base,
        cuts
      };
    });

    if (matched < 10 || parsed < 5) {
      throw new Error(
        "Insufficient documented surgery data."
      );
    }

    const cache = {
      lastSync: Date.now(),
      matched,
      parsed,
      diagnoses: updated.map(d => ({
        name: d.name,
        cuts: d.cuts
      }))
    };

    fs.writeFileSync(
      DATA_FILE + ".tmp",
      JSON.stringify(cache, null, 2)
    );

    fs.renameSync(
      DATA_FILE + ".tmp",
      DATA_FILE
    );

    diagnoses = updated;

    console.log(
      `[SURGERY] Wiki sync complete. Matched: ${matched}, parsed: ${parsed}`
    );

    return true;

  } catch (error) {
    console.error(
      "[SURGERY] Wiki sync failed:",
      error.message
    );

    return false;

  } finally {
    syncRunning = false;
  }
}

// ==========================================
// START FEATURE
// ==========================================

function start() {
  if (syncTimer) return;

  loadMaladies();
  loadCachedData();

  syncWiki().catch(console.error);

  syncTimer = setInterval(() => {
    syncWiki().catch(console.error);
  }, CONFIG.syncInterval);

  syncTimer.unref();
}

// ==========================================
// CREATE PATIENT
// ==========================================

function createPatient(
  userId,
  username,
  guildId,
  target = null,
  record = null
) {
  let diagnosis;

  if (target && record) {
    diagnosis = diagnoses.find(
      d =>
        d.isMalady &&
        d.name === record.name
    );

    if (!diagnosis) {
      throw new Error("Unknown malady");
    }

  } else {
    diagnosis = pick(
      diagnoses.filter(d => !d.isMalady)
    );
  }

  const condition = chance(
    CONFIG.specialConditionChance
  )
    ? pick(CONDITIONS)
    : null;

  return {
    id: randomUUID().slice(0, 12),

    userId,
    username,
    guildId,

    targetId: target?.id || null,
    targetName:
      target?.globalName ||
      target?.username ||
      null,

    maladyId: record?.id || null,

    diagnosis: diagnosis.name,
    isMalady: Boolean(diagnosis.isMalady),

    type: diagnosis.type || "operation",

    diagnosed: Boolean(diagnosis.known),
    conditionRevealed: false,

    ultrasound: false,
    lab: false,

    condition,

    requiredCuts: diagnosis.cuts,

    incisions: 0,

    broken: diagnosis.broken || 0,
    shattered: diagnosis.shattered || 0,

    blood: diagnosis.blood ?? 100,

    // Bleeding from initial injuries,
    // not ordinary scalpel incisions.
    bleeding: diagnosis.bleeding || 0,

    // Additional bleeding caused by incisions.
    incisionBleeding: 0,

    temp: diagnosis.temp ?? 98.6,
    fever: diagnosis.fever || 0,

    dirt: diagnosis.dirt || 0,
    visibility: diagnosis.visibility ?? 100,

    sleep: 0,

    heartStopped: false,
    heartTurns: 0,
    heartRisk:
      diagnosis.heartRisk ?? 0.005,

    fixUnlocked: false,
    fixed: false,

    turns: 0,
    skillFails: 0,

    finished: false,
    success: false,
    busy: false,

    imageFallback: false,

    createdAt: Date.now(),
    updatedAt: Date.now(),

    feedback:
      "You begin examining the patient."
  };
}

// ==========================================
// BLEEDING PROGRESSION
// ==========================================

function incisionBleedingLevel(cuts) {
  if (cuts >= 7) return 3;
  if (cuts >= 5) return 2;
  if (cuts >= 3) return 1;

  return 0;
}

function totalBleeding(p) {
  return limit(
    p.bleeding + p.incisionBleeding,
    0,
    6
  );
}

function bleedingStatus(p) {
  const bleeding = totalBleeding(p);

  if (bleeding >= 3) {
    return "Losing blood quickly!";
  }

  if (bleeding >= 2) {
    return "Losing blood";
  }

  if (bleeding > 0) {
    return "Losing blood slowly";
  }

  return "None";
}

function reduceBleeding(p, amount) {
  const reduced = Math.min(
    p.bleeding,
    amount
  );

  p.bleeding -= reduced;
  amount -= reduced;

  p.incisionBleeding = Math.max(
    0,
    p.incisionBleeding - amount
  );
}

// ==========================================
// PATIENT STATUS
// ==========================================

function pulse(p) {
  if (
    p.heartStopped ||
    p.blood <= 0
  ) {
    return "No pulse";
  }

  if (p.blood >= 80) return "Strong";
  if (p.blood >= 55) return "Steady";
  if (p.blood >= 25) return "Weak";

  return "Extremely weak";
}

function consciousness(p) {
  if (p.heartStopped) {
    return "Heart stopped!";
  }

  if (p.sleep <= 0) {
    return "Awake";
  }

  const hyper =
    p.condition === "Hyperactive";

  if (p.sleep >= (hyper ? 7 : 14)) {
    return "Near coma";
  }

  if (p.sleep <= (hyper ? 1 : 2)) {
    return "Coming to";
  }

  return "Unconscious";
}

function sanitation(p) {
  if (p.dirt >= 3) return "Unsanitary";
  if (p.dirt >= 2) return "Unclean";
  if (p.dirt >= 1) return "Not sanitized";

  return "Clean";
}

function visibilityStatus(p) {
  if (p.visibility <= 0) {
    return "You can't see what you are doing!";
  }

  if (p.visibility <= 50) {
    return "It is becoming hard to see your work.";
  }

  return "Clear";
}

function feverStatus(p) {
  if (p.fever >= 0.8) {
    return "Patient's fever is climbing rapidly!";
  }

  if (p.fever >= 0.4) {
    return "Patient's fever is climbing.";
  }

  if (p.fever > 0) {
    return "Patient's fever is slowly rising.";
  }

  if (p.temp > 100.4) {
    return "Patient still has a fever.";
  }

  return "Patient's temperature is stable.";
}

// ==========================================
// STATUS COLORS
// ==========================================

function pulseColor(p) {
  if (
    p.heartStopped ||
    p.blood < 25
  ) {
    return COLORS.red;
  }

  if (p.blood < 80) {
    return COLORS.yellow;
  }

  return COLORS.green;
}

function temperatureColor(p) {
  if (p.temp > 106) {
    return COLORS.red;
  }

  if (p.temp > 100.4) {
    return COLORS.yellow;
  }

  return COLORS.blue;
}

function consciousnessColor(p) {
  const status = consciousness(p);

  if (
    status === "Heart stopped!" ||
    status === "Near coma" ||
    (
      status === "Awake" &&
      p.incisions > 0
    )
  ) {
    return COLORS.red;
  }

  if (status === "Unconscious") {
    return COLORS.green;
  }

  return COLORS.yellow;
}

function sanitationColor(p) {
  if (p.dirt >= 2) return COLORS.red;
  if (p.dirt >= 1) return COLORS.yellow;

  return COLORS.green;
}

function bleedingColor(p) {
  const bleeding = totalBleeding(p);

  if (bleeding >= 3) return COLORS.red;
  if (bleeding > 0) return COLORS.yellow;

  return COLORS.green;
}

function visibilityColor(p) {
  if (p.visibility <= 0) {
    return COLORS.red;
  }

  if (p.visibility <= 50) {
    return COLORS.yellow;
  }

  return COLORS.green;
}

function bonesColor(p) {
  if (!p.ultrasound) {
    return COLORS.blue;
  }

  if (
    p.broken > 0 ||
    p.shattered > 0
  ) {
    return COLORS.red;
  }

  return COLORS.green;
}

function feverColor(p) {
  if (
    p.temp > 106 ||
    p.fever >= 0.8
  ) {
    return COLORS.red;
  }

  if (
    p.fever > 0 ||
    p.temp > 100.4
  ) {
    return COLORS.yellow;
  }

  return COLORS.green;
}

function statusEmoji(color) {
  if (color === COLORS.red) {
    return STATUS.red;
  }

  if (color === COLORS.yellow) {
    return STATUS.yellow;
  }

  return STATUS.green;
}

// ==========================================
// SKILL FAILURES
// ==========================================

function skillFailRate(p) {
  const base =
    CONFIG.baseSkillFail +
    (100 - CONFIG.surgeonSkill) * 0.0015;

  const multiplier =
    1 + (100 - p.visibility) / 25;

  return limit(
    base * multiplier,
    0,
    1
  );
}

// ==========================================
// TOOL AVAILABILITY
// ==========================================

function canUse(p, tool) {
  if (p.finished) return false;

  if (tool === "cancel") return true;

  if (tool === "defibrillator") {
    return p.heartStopped;
  }

  if (p.visibility <= 0) {
    return tool === "sponge";
  }

  const tough =
    p.condition === "Tough Skin";

  switch (tool) {
    case "ultrasound":
      return (
        !p.ultrasound &&
        p.type !== "flu" &&
        p.diagnosis !== "Nose Job"
      );

    case "labkit":
      return !p.lab;

    case "antibiotics":
      return p.lab;

    case "pins":
      return (
        p.ultrasound &&
        p.shattered > 0 &&
        p.incisions >= 1
      );

    case "splint":
      return (
        p.ultrasound &&
        p.broken > 0 &&
        (!tough || p.incisions >= 2)
      );

    case "clamp":
      return (
        p.incisions >= (tough ? 2 : 1)
      );

    case "fix":
      return (
        p.fixUnlocked &&
        !p.fixed &&
        p.incisions >= (
          tough
            ? Math.max(2, p.requiredCuts)
            : p.requiredCuts
        )
      );

    case "sponge":
    case "anesthetic":
    case "stitches":
    case "scalpel":
    case "antiseptic":
    case "transfusion":
      return true;

    default:
      return false;
  }
}

// ==========================================
// SURGERY RESULTS
// ==========================================

function finish(p, success, reason) {
  p.finished = true;
  p.success = success;
  p.feedback = reason;
}

function checkResult(p) {
  if (p.finished) return;

  if (p.blood <= 0) {
    return finish(
      p,
      false,
      "The patient has bled out!"
    );
  }

  if (p.temp > 110) {
    return finish(
      p,
      false,
      "The patient has succumbed to infection."
    );
  }

  if (
    p.heartStopped &&
    p.heartTurns >= 2
  ) {
    return finish(
      p,
      false,
      "The patient was not resuscitated in time."
    );
  }

  const maxSleep =
    p.condition === "Hyperactive"
      ? 7
      : 15;

  if (p.sleep > maxSleep) {
    return finish(
      p,
      false,
      "You put the patient to sleep. Permanently."
    );
  }

    // Broken bones do not require Fix It.
  if (
    p.type === "bones" &&
    p.ultrasound &&
    p.broken === 0 &&
    p.shattered === 0
  ) {
    p.fixed = true;
  }

  // Flu does not require Fix It.
  if (p.type === "flu") {
    p.fixed =
      p.lab &&
      p.temp <= 100.4;
  }

  // Automatically complete surgery.
  if (
    p.fixed &&
    p.incisions === 0 &&
    p.broken === 0 &&
    p.shattered === 0 &&
    totalBleeding(p) === 0 &&
    p.temp <= 100.4 &&
    !p.heartStopped
  ) {
    return finish(
      p,
      true,
      p.isMalady
        ? `You successfully cured ${p.diagnosis}!`
        : "You successfully completed the surgery!"
    );
  }
}

function unlockFix(p) {
  if (
    !p.diagnosed ||
    p.type !== "operation" ||
    p.fixed
  ) {
    return;
  }

  const required =
    p.condition === "Tough Skin"
      ? Math.max(2, p.requiredCuts)
      : p.requiredCuts;

  p.fixUnlocked =
    p.incisions >= required;
}

// ==========================================
// MALADY COMPLICATIONS
// ==========================================

function maladyEvents(p) {
  if (p.fixed || p.finished) return;

  if (
    p.diagnosis === "Lupus" &&
    chance(0.10)
  ) {
    p.incisions++;
    p.bleeding++;

    p.feedback +=
      "\nAn incision has reopened!";
  }

  if (
    p.diagnosis === "Moldy Guts" &&
    chance(0.07)
  ) {
    p.visibility = 0;

    p.feedback +=
      "\nThe operation site is obscured.";
  }

  if (
    p.diagnosis === "Chaos Infection" &&
    chance(0.12)
  ) {
    const event = pick([
      "fever",
      "awake",
      "heart"
    ]);

    if (event === "fever") {
      p.temp += 0.8;
    }

    if (event === "awake") {
      p.sleep = 0;
    }

    if (
      event === "heart" &&
      !p.heartStopped
    ) {
      p.heartStopped = true;
      p.heartTurns = 0;
    }

    p.feedback +=
      "\nChaos infection altered the patient.";
  }
}

// ==========================================
// ADVANCE SURGERY TURN
// ==========================================

function advanceTurn(
  p,
  tool,
  heartWasStopped,
  worked
) {
  if (p.finished) return;

  if (
    !(tool === "anesthetic" && worked)
  ) {
    p.sleep = Math.max(
      0,
      p.sleep - 1
    );
  }

  if (
    p.incisions > 0 &&
    p.sleep === 0
  ) {
    p.bleeding++;
    p.visibility -= 15;

    p.feedback +=
      "\nThe patient is screaming and flailing!";
  }

  p.bleeding = limit(
    p.bleeding,
    0,
    6
  );

  const bleeding = totalBleeding(p);

  if (bleeding > 0) {
    const multiplier =
      p.condition === "Hemophiliac"
        ? 1.5
        : 1;

    p.blood -=
      bleeding * 1.8 * multiplier;

    if (
      tool !== "sponge" ||
      !worked
    ) {
      p.visibility -= bleeding * 3;
    }
  }

  if (
    p.incisions > 0 &&
    (tool !== "sponge" || !worked)
  ) {
    p.visibility -=
      p.incisions * 2;
  }

  if (
    bleeding > 0 ||
    p.incisions > 0
  ) {
    if (
      tool !== "antiseptic" ||
      !worked
    ) {
      p.dirt +=
        p.condition === "Absolutely Filthy"
          ? 0.45
          : 0.15;
    }

    if (p.dirt >= 3) {
      p.fever = Math.max(
        p.fever,
        0.3
      );
    }
  }

  if (p.fever > 0) {
    p.temp += p.fever;
  }

  if (
    p.heartStopped &&
    heartWasStopped
  ) {
    p.heartTurns++;
  }

  p.blood = limit(p.blood, 0, 100);

  p.visibility = limit(
    p.visibility,
    0,
    100
  );

  p.dirt = limit(p.dirt, 0, 3);

  checkResult(p);

  if (p.finished) return;

  maladyEvents(p);

  if (
    !p.heartStopped &&
    tool !== "defibrillator" &&
    chance(p.heartRisk)
  ) {
    p.heartStopped = true;
    p.heartTurns = 0;

    p.feedback +=
      "\nThe patient's heart has stopped!";
  }

  unlockFix(p);
  checkResult(p);
}

// ==========================================
// SKILL FAILURE MESSAGES
// ==========================================

function applySkillFail(p, tool, rate) {
  p.skillFails++;

  const messages = {
    defibrillator:
      "You accidentally shocked yourself.",
    sponge:
      "You failed to clear the operation site.",
    anesthetic:
      "The anesthetic was administered incorrectly.",
    stitches:
      "You tangled the surgical stitches.",
    scalpel:
      "Your incision went wrong.",
    ultrasound:
      "The ultrasound examination failed.",
    antiseptic:
      "You failed to disinfect the operation site.",
    labkit:
      "The lab work failed.",
    antibiotics:
      "The antibiotics were administered incorrectly.",
    transfusion:
      "The blood transfusion failed.",
    pins:
      "You failed to repair the shattered bone.",
    splint:
      "The splint was applied incorrectly.",
    clamp:
      "You failed to clamp the blood vessels.",
    fix:
      "You failed to resolve the diagnosis."
  };

  p.feedback =
    `Skill Fail! (${Math.round(rate * 100)}%)\n` +
    (messages[tool] || "The tool failed.");

  if (tool === "scalpel") {
    p.bleeding++;
  }

  if (
    tool === "pins" &&
    p.diagnosis === "Ecto-Bones"
  ) {
    p.shattered++;
  }
}

// ==========================================
// SURGERY ENGINE
// ==========================================

function applyTool(p, tool) {
  if (!canUse(p, tool)) return;

  if (tool === "cancel") {
    return finish(
      p,
      false,
      "You couldn't save them!"
    );
  }

  p.turns++;
  p.updatedAt = Date.now();

  const heartWasStopped =
    p.heartStopped;

  if (
    tool === "scalpel" &&
    p.sleep <= 0
  ) {
    return finish(
      p,
      false,
      "You used a scalpel on an awake patient!"
    );
  }

  const rate = skillFailRate(p);

  if (chance(rate)) {
    applySkillFail(p, tool, rate);

    return advanceTurn(
      p,
      tool,
      heartWasStopped,
      false
    );
  }

  switch (tool) {

    // SPONGE

    case "sponge":
      p.visibility = 100;

      p.feedback =
        "You cleared the operation site.";

      break;

    // ANESTHETIC

    case "anesthetic":
      p.sleep +=
        p.condition === "Hyperactive"
          ? 4
          : 9;

      p.feedback =
        "You administered anesthetic.";

      break;

    // SCALPEL

    case "scalpel": {
      const previousLevel =
        incisionBleedingLevel(
          p.incisions
        );

      p.incisions++;

      const newLevel =
        incisionBleedingLevel(
          p.incisions
        );

      // No bleeding caused by the first
      // two successful incisions.

      p.incisionBleeding +=
        Math.max(
          0,
          newLevel - previousLevel
        );

      if (
        p.diagnosis ===
        "Swallowed a World Lock"
      ) {
        p.visibility -= 15;
        p.dirt += 1;
      }

      p.feedback =
        "You made an incision.";

      break;
    }

    // STITCHES

    case "stitches":
      if (p.incisions > 0) {
        p.incisions--;

        p.incisionBleeding = Math.min(
          p.incisionBleeding,
          incisionBleedingLevel(
            p.incisions
          )
        );

        if (p.incisions === 0) {
          p.incisionBleeding = 0;
          p.bleeding = 0;
        } else {
          reduceBleeding(p, 1);
        }

        p.feedback =
          "You stitched up an incision.";

      } else {
        reduceBleeding(p, 1.5);

        p.feedback =
          "You applied surgical stitches.";
      }

      break;

    // ULTRASOUND

    case "ultrasound":
      p.ultrasound = true;
      p.diagnosed = true;
      p.conditionRevealed = true;

      p.feedback =
        `Diagnosis: ${p.diagnosis}`;

      break;

    // LAB KIT

    case "labkit":
      p.lab = true;
      p.conditionRevealed = true;

      if (p.type === "flu") {
        p.diagnosed = true;

        p.feedback =
          `Diagnosis: ${p.diagnosis}`;
      } else {
        p.feedback =
          "Lab work completed.";
      }

      break;

    // ANTISEPTIC

    case "antiseptic":
      p.dirt = Math.max(
        0,
        p.dirt -
          (
            p.condition === "Absolutely Filthy"
              ? 1
              : 2
          )
      );

      p.feedback =
        "You disinfected the operation site.";

      break;

    // ANTIBIOTICS

    case "antibiotics": {
      const resistant =
        p.condition ===
        "Antibiotic Resistant";

      p.fever = Math.max(
        0,
        p.fever -
          (resistant ? 0.2 : 0.5)
      );

      p.temp = Math.max(
        98.6,
        p.temp -
          (resistant ? 0.8 : 1.8)
      );

      p.feedback =
        "You administered antibiotics.";

      break;
    }

    // TRANSFUSION

    case "transfusion":
      p.blood = Math.min(
        100,
        p.blood + 35
      );

      p.feedback =
        "You performed a blood transfusion.";

      break;

    // DEFIBRILLATOR

    case "defibrillator":
      p.heartStopped = false;
      p.heartTurns = 0;

      p.feedback =
        "You restarted the patient's heart.";

      break;

    // PINS

    case "pins":
      p.shattered--;
      p.broken++;

      p.feedback =
        "You repaired a shattered bone.";

      break;

    // SPLINT

    case "splint":
      p.broken--;

      p.feedback =
        "You repaired a broken bone.";

      break;

    // CLAMP

    case "clamp":
      reduceBleeding(p, 1);

      p.feedback =
        "You reduced blood loss.";

      break;

    // FIX IT

    case "fix":
  if (
    p.diagnosis === "Brainworms" &&
    chance(0.25)
  ) {
    p.feedback = "The brainworms escaped!";
  } else {
    p.fixed = true;

    const remaining = [];

    if (p.incisions > 0) {
      remaining.push("Close remaining incisions.");
    }

    if (p.broken > 0 || p.shattered > 0) {
      remaining.push("Repair remaining bones.");
    }

    if (totalBleeding(p) > 0) {
      remaining.push("Stop the bleeding.");
    }

    if (p.temp > 100.4) {
      remaining.push("Reduce the patient's fever.");
    }

    if (p.heartStopped) {
      remaining.push("Restart the patient's heart.");
    }

    p.feedback = "You resolved the diagnosis!";

    if (remaining.length > 0) {
      p.feedback += "\n" + remaining.join("\n");
    }
  }

  break;
  }

  unlockFix(p);
  checkResult(p);

  if (!p.finished) {
    advanceTurn(
      p,
      tool,
      heartWasStopped,
      true
    );
  }
}

// ==========================================
// DIAGNOSIS DESCRIPTIONS
// ==========================================

function diagnosisText(p) {
  if (
    !p.diagnosed &&
    !p.finished
  ) {
    return "You haven't diagnosed the patient yet.";
  }

  const descriptions = {
    "Broken Everything":
      "Patient was run over by a truck.",

    "Broken Arm":
      "Patient has a broken arm.",

    "Broken Leg":
      "Patient has a broken leg.",

    "Brain Tumor":
      "Patient has a brain tumor.",

    "Lung Tumor":
      "Patient has a lung tumor.",

    "Heart Attack":
      "Patient suffered a heart attack.",

    "Nose Job":
      "Patient wants a nose job.",

    "Swallowed a World Lock":
      "Patient swallowed a World Lock.",

    "Herniated Disc":
      "Patient has a damaged spine.",

    "Serious Head Injury":
      "Patient has a serious head injury.",

    "Serious Trauma":
      "Patient has suffered serious trauma.",

    "Massive Trauma":
      "Patient has suffered massive trauma."
  };

  return (
    descriptions[p.diagnosis] ||
    `Patient has ${p.diagnosis}.`
  );
}

// ==========================================
// ORIGINAL GROWTopia FIST PNG
// ==========================================

function fistSVG(x, y, size = 64) {
  if (!fistBase64) {
    try {
      fistBase64 = fs
        .readFileSync(FIST_FILE)
        .toString("base64");

    } catch (error) {
      console.error(
        "[SURGERY] Fist image:",
        error.message
      );

      return "";
    }
  }

  return `
    <image
      x="${x}"
      y="${y}"
      width="${size}"
      height="${size}"
      xlink:href="data:image/png;base64,${fistBase64}"
      preserveAspectRatio="xMidYMid meet"
    />
  `;
}

// ==========================================
// GROWTopia IMAGE PANEL
// ==========================================

function surgerySVG(p) {
  const width = 960;
  const elements = [];

  let y = 120;

  function drawText(
    text,
    x,
    baseline,
    color = COLORS.white,
    size = 27,
    weight = 600
  ) {
    elements.push(`
      <text
        x="${x}"
        y="${baseline}"
        fill="${color}"
        font-size="${size}"
        font-weight="${weight}"
        font-family="DejaVu Sans, sans-serif"
      >${escapeXML(text)}</text>
    `);
  }

  function status(
    label,
    value,
    color,
    x = 28
  ) {
    elements.push(`
      <text
        x="${x}"
        y="${y}"
        font-size="26"
        font-weight="600"
        font-family="DejaVu Sans, sans-serif"
      ><tspan fill="${COLORS.white}">${escapeXML(label)}: </tspan><tspan fill="${color}">${escapeXML(value)}</tspan></text>
    `);
  }

  function paragraph(
    text,
    color,
    size = 26
  ) {
    for (
      const line of wrapText(
        text,
        60
      )
    ) {
      drawText(
        line,
        28,
        y,
        color,
        size
      );

      y += 35;
    }
  }

  // FIST + PATIENT NAME

  elements.push(
    fistSVG(26, 18, 64)
  );

  drawText(
    (p.targetName || "Surg-E").slice(0, 25),
    110,
    68,
    COLORS.white,
    44,
    700
  );

  // DIAGNOSIS

  paragraph(
    diagnosisText(p),
    COLORS.white,
    28
  );

  y += 4;

  // PULSE AND CONSCIOUSNESS

  status(
    "Pulse",
    pulse(p),
    pulseColor(p),
    28
  );

  status(
    "Status",
    consciousness(p),
    consciousnessColor(p),
    450
  );

  y += 40;

  // TEMPERATURE AND SANITATION

  status(
    "Temp",
    p.temp.toFixed(2),
    temperatureColor(p),
    28
  );

  status(
    "Operation site",
    sanitation(p),
    sanitationColor(p),
    450
  );

  y += 40;

  // INCISIONS AND BONES

  status(
    "Incisions",
    String(p.incisions),
    p.incisions > 0
      ? COLORS.yellow
      : COLORS.blue,
    28
  );

  y += 40;

  if (p.ultrasound) {
  status(
    "Bones",
    `${p.broken} broken, ${p.shattered} shattered`,
    bonesColor(p)
  );

  y += 40;
}

  // ONLY DISPLAY BLEEDING IF BLEEDING EXISTS

  if (totalBleeding(p) > 0) {
    paragraph(
      bleedingStatus(p),
      bleedingColor(p)
    );
  }

  // VISIBILITY WARNINGS

  if (p.visibility <= 50) {
    paragraph(
      visibilityStatus(p),
      visibilityColor(p)
    );
  }

  // FEVER WARNINGS

  if (
    p.fever > 0 ||
    p.temp > 100.4
  ) {
    paragraph(
      feverStatus(p),
      feverColor(p)
    );
  }

  if (
    canUse(p, "fix") &&
    !p.finished
  ) {
    paragraph(
      "The underlying problem has been located.",
      COLORS.green
    );
  }

  if (
    p.fixed &&
    !p.finished
  ) {
    paragraph(
      "The underlying condition has been treated.",
      COLORS.green
    );
  }

  // DIVIDER

  y += 5;

  elements.push(`
    <line
      x1="28"
      y1="${y}"
      x2="${width - 28}"
      y2="${y}"
      stroke="#A4CDDC"
      stroke-opacity="0.35"
      stroke-width="2"
    />
  `);

  y += 40;

  // LAST ACTION

  let feedbackColor = COLORS.blue;

  if (p.finished) {
    feedbackColor = p.success
      ? COLORS.green
      : COLORS.red;

  } else if (
    p.feedback.includes("Skill Fail!") ||
    p.feedback.includes("heart has stopped")
  ) {
    feedbackColor = COLORS.red;
  }

  paragraph(
    plainText(p.feedback),
    feedbackColor
  );

  // FINAL RESULT

  if (p.finished) {
    y += 8;

    paragraph(
      p.success
        ? "Surgery Successful!"
        : "Surgery Failed!",
      p.success
        ? COLORS.green
        : COLORS.red,
      31
    );

    const seconds = Math.floor(
      (Date.now() - p.createdAt) / 1000
    );

    paragraph(
      `Time Taken: ${seconds}s`,
      COLORS.blue,
      22
    );
  }

  // FOOTER

  y += 5;

  drawText(
    `Surgeon Skill: ${CONFIG.surgeonSkill}  |  Turns: ${p.turns}  |  Skill Fails: ${p.skillFails}`,
    28,
    y,
    COLORS.blue,
    20
  );

  const height = y + 28;

  return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink"
      width="${width}"
      height="${height}"
      viewBox="0 0 ${width} ${height}"
    >
      <defs>
        <linearGradient
          id="background"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0%"
            stop-color="#32758E"
          />
          <stop
            offset="100%"
            stop-color="#20546F"
          />
        </linearGradient>

        <pattern
          id="robots"
          width="105"
          height="105"
          patternUnits="userSpaceOnUse"
        >
          <g
            fill="#B7D8E5"
            opacity="0.075"
          >
            <rect
              x="35" y="9"
              width="35" height="29"
              rx="3"
            />
            <rect
              x="26" y="42"
              width="53" height="38"
              rx="3"
            />
            <rect
              x="12" y="44"
              width="10" height="30"
            />
            <rect
              x="83" y="44"
              width="10" height="30"
            />
            <rect
              x="31" y="84"
              width="15" height="15"
            />
            <rect
              x="59" y="84"
              width="15" height="15"
            />
          </g>
        </pattern>
      </defs>

      <rect
        x="3"
        y="3"
        width="${width - 6}"
        height="${height - 6}"
        rx="5"
        fill="url(#background)"
        stroke="${COLORS.border}"
        stroke-width="4"
      />

      <rect
        x="8"
        y="8"
        width="${width - 16}"
        height="${height - 16}"
        fill="url(#robots)"
      />

      ${elements.join("")}

    </svg>
  `;
}

// ==========================================
// RENDER IMAGE WITH SHARP
// ==========================================

async function renderSurgeryImage(p) {
  const sharp = require("sharp");

  return sharp(
    Buffer.from(surgerySVG(p))
  )
    .png({
      compressionLevel: 6
    })
    .toBuffer();
}

// ==========================================
// EMBED FALLBACK
// ==========================================

function buildEmbed(p) {
  const rows = [
    `${statusEmoji(pulseColor(p))} **Pulse:** ${pulse(p)}`,

    `${statusEmoji(consciousnessColor(p))} **Status:** ${consciousness(p)}`,

    `${statusEmoji(temperatureColor(p))} **Temp:** ${p.temp.toFixed(2)}`,

    `${statusEmoji(sanitationColor(p))} **Operation site:** ${sanitation(p)}`,

    `**Incisions:** ${p.incisions}`
  ];

  if (p.ultrasound) {
    rows.push(
      `${statusEmoji(bonesColor(p))} **Bones:** ${p.broken} broken, ${p.shattered} shattered`
    );
  }
  if (totalBleeding(p) > 0) {
    rows.push(
      `${statusEmoji(bleedingColor(p))} ${bleedingStatus(p)}`
    );
  }

  if (p.visibility <= 50) {
    rows.push(
      `${statusEmoji(visibilityColor(p))} ${visibilityStatus(p)}`
    );
  }

  if (
    p.fever > 0 ||
    p.temp > 100.4
  ) {
    rows.push(
      `${statusEmoji(feverColor(p))} ${feverStatus(p)}`
    );
  }

  if (canUse(p, "fix")) {
    rows.push(
      `${STATUS.green} The underlying problem has been located.`
    );
  }

  if (p.fixed && !p.finished) {
    rows.push(
      `${STATUS.green} The underlying condition has been treated.`
    );
  }

  return new EmbedBuilder()
    .setColor(
      p.finished
        ? p.success
          ? 0x80EF48
          : 0xFF7777
        : 0x32758E
    )
    .setTitle(
      p.finished
        ? p.success
          ? "Surgery Successful!"
          : "Surgery Failed!"
        : p.targetName || "Surg-E"
    )
    .setDescription(
      `${diagnosisText(p)}\n\n` +
      rows.join("\n") +
      `\n\n${p.feedback}`
    )
    .setFooter({
      text:
        `Surgeon Skill: ${CONFIG.surgeonSkill} | ` +
        `Turns: ${p.turns} | ` +
        `Skill Fails: ${p.skillFails}`
    });
}

// ==========================================
// SURGERY BUTTONS
// ==========================================

const TOOL_ROWS = [
  [
    ["defibrillator", "Defibrillator"],
    ["sponge", "Sponge"],
    ["anesthetic", "Anesthetic"]
  ],
  [
    ["stitches", "Stitches"],
    ["scalpel", "Scalpel"],
    ["ultrasound", "Ultrasound"]
  ],
  [
    ["pins", "Pins"],
    ["splint", "Splint"],
    ["antiseptic", "Antiseptic"]
  ],
  [
    ["fix", "Fix It"],
    ["labkit", "Lab Kit"],
    ["antibiotics", "Antibiotics"]
  ],
  [
    ["transfusion", "Transfusion"],
    ["clamp", "Clamp"],
    ["cancel", "Cancel"]
  ]
];

function buildButtons(p) {
  if (p.finished) {
    return [
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `surg:${p.id}:restart`
            )
            .setLabel(
              "Perform Surgery Again"
            )
            .setStyle(
              ButtonStyle.Success
            )
        )
    ];
  }

  return TOOL_ROWS.map(row =>
    new ActionRowBuilder()
      .addComponents(
        row.map(([tool, label]) => {
          const button =
            new ButtonBuilder()
              .setCustomId(
                `surg:${p.id}:${p.turns}:${tool}`
              )
              .setLabel(label)
              .setStyle(
                tool === "fix"
                  ? ButtonStyle.Success
                  : tool === "cancel"
                    ? ButtonStyle.Danger
                    : ButtonStyle.Secondary
              )
              .setDisabled(
                !canUse(p, tool)
              );

          if (EMOJIS[tool]) {
            button.setEmoji({
              id: EMOJIS[tool]
            });
          }

          return button;
        })
      )
  );
}

// ==========================================
// UPDATE PUBLIC SURGERY PANEL
// ==========================================

async function updatePanel(interaction, p) {
  const content = p.targetId
    ? `**Surgeon:** <@${p.userId}>\n` +
      `**Patient:** <@${p.targetId}>\n` +
      "**Mode:** Malady simulation"
    : `**Surgeon:** <@${p.userId}>\n` +
      "**Patient:** Surg-E";

  const common = {
    content,
    components: buildButtons(p),
    allowedMentions: {
      parse: []
    }
  };

  if (!p.imageFallback) {
    try {
      const buffer =
        await renderSurgeryImage(p);

      const attachment =
        new AttachmentBuilder(buffer, {
          name:
            `surgery-${p.id}-${p.turns}.png`
        });

      return await interaction.editReply({
        ...common,
        embeds: [],
        attachments: [],
        files: [attachment]
      });

    } catch (error) {
      console.error(
        "[SURGERY] Image error:",
        error.message
      );

      p.imageFallback = true;
    }
  }

  return interaction.editReply({
    ...common,
    attachments: [],
    embeds: [buildEmbed(p)]
  });
}

// ==========================================
// /SURGERY COMMAND
// ==========================================

async function execute(interaction) {
  const userId = interaction.user.id;

  const target =
    interaction.options.getUser("user");

  const guildId = interaction.guildId;

  if (!guildId) {
    return interaction.reply({
      content:
        "This command is only available in a server.",
      ephemeral: true
    });
  }

  if (target?.bot) {
    return interaction.reply({
      content:
        "You cannot perform surgery on bots.",
      ephemeral: true
    });
  }

  const existing = sessions.get(userId);

  if (
    existing &&
    (
      existing.busy ||
      (
        !existing.finished &&
        Date.now() - existing.updatedAt <
          CONFIG.sessionTimeout
      )
    )
  ) {
    return interaction.reply({
      content:
        "You already have an active surgery.",
      ephemeral: true
    });
  }

  let record = null;

  if (target) {
    const treating = activePatient(
      guildId,
      target.id
    );

    if (treating) {
      return interaction.reply({
        content:
          "This patient is already undergoing surgery.",
        ephemeral: true
      });
    }

    record = getMalady(
      guildId,
      target.id
    );

    if (!record) {
      return interaction.reply({
        content:
          "Scan this patient using `/malady user:` first.",
        ephemeral: true
      });
    }

    if (record.cured) {
      return interaction.reply({
        content:
          "This patient has no active malady.",
        ephemeral: true
      });
    }
  }

  let patient;

  try {
    patient = createPatient(
      userId,
      interaction.user.username,
      guildId,
      target,
      record
    );

    patient.busy = true;

    sessions.set(userId, patient);

    // PUBLIC SURGERY MESSAGE

    await interaction.deferReply();

    await updatePanel(
      interaction,
      patient
    );

  } catch (error) {
    sessions.delete(userId);

    console.error(
      "[SURGERY] Execute error:",
      error
    );

    if (
      interaction.deferred ||
      interaction.replied
    ) {
      await interaction.editReply({
        content:
          "Unable to start surgery.",
        attachments: [],
        embeds: [],
        components: []
      }).catch(() => {});

    } else {
      await interaction.reply({
        content:
          "Unable to start surgery.",
        ephemeral: true
      }).catch(() => {});
    }

  } finally {
    if (patient) {
      patient.busy = false;
    }
  }
}

// ==========================================
// BUTTON INTERACTIONS
// ==========================================

async function handleButton(interaction) {
  if (!interaction.isButton()) {
    return;
  }

  if (
    !interaction.customId.startsWith("surg:")
  ) {
    return;
  }

  const parts =
    interaction.customId.split(":");

  const sessionId = parts[1];

  const restarting =
    parts[2] === "restart";

  const turn = restarting
    ? null
    : Number(parts[2]);

  const tool = restarting
    ? "restart"
    : parts[3];

  const userId = interaction.user.id;

  const patient = Array.from(
    sessions.values()
  ).find(p =>
    p.id === sessionId &&
    p.guildId === interaction.guildId
  );

  if (
    !patient ||
    Date.now() - patient.updatedAt >
      CONFIG.sessionTimeout
  ) {
    return interaction.reply({
      content:
        "This surgery session has expired. Use /surgery again.",
      ephemeral: true
    });
  }

  // OWNER-ONLY PROTECTION

  if (patient.userId !== userId) {
    return interaction.reply({
      content:
        `Only <@${patient.userId}> can use these surgical tools.`,
      allowedMentions: {
        parse: []
      },
      ephemeral: true
    });
  }

  // DOUBLE CLICK PROTECTION

  if (
    patient.busy ||
    (
      !restarting &&
      turn !== patient.turns
    )
  ) {
    return interaction.reply({
      content:
        "Please use the updated surgery buttons.",
      ephemeral: true
    });
  }

  patient.busy = true;

  let previousState = null;
  let cureCommitted = false;

  try {
    await interaction.deferUpdate();

    // RESTART WITH RANDOM SURG-E

    if (
      restarting &&
      patient.finished
    ) {
      const next = createPatient(
        userId,
        interaction.user.username,
        patient.guildId
      );

      next.busy = true;

      sessions.set(userId, next);

      try {
        await updatePanel(
          interaction,
          next
        );

      } catch (error) {
        sessions.set(userId, patient);
        throw error;

      } finally {
        next.busy = false;
      }

      return;
    }

    // UNAVAILABLE TOOL

    if (!canUse(patient, tool)) {
      await updatePanel(
        interaction,
        patient
      );

      return;
    }

    previousState = {
      ...patient
    };

    // APPLY TOOL

    applyTool(patient, tool);

    patient.updatedAt = Date.now();

    // CURE SAVED MALADY

    if (
      patient.finished &&
      patient.success &&
      patient.targetId
    ) {
      cureCommitted = cureMalady(patient);
    }

    // UPDATE SAME PUBLIC MESSAGE

    await updatePanel(
      interaction,
      patient
    );

  } catch (error) {
    // Roll back the game action unless the cure
    // has already been saved to the database.

    if (
      previousState &&
      !cureCommitted
    ) {
      Object.assign(
        patient,
        previousState
      );
    }

    console.error(
      "[SURGERY] Button error:",
      error
    );

    const payload = {
      content: cureCommitted
        ? "The patient was cured, but the panel failed to update."
        : "An error occurred during surgery. Please try again.",
      ephemeral: true
    };

    if (
      interaction.deferred ||
      interaction.replied
    ) {
      await interaction.followUp(
        payload
      ).catch(() => {});

    } else {
      await interaction.reply(
        payload
      ).catch(() => {});
    }

  } finally {
    patient.busy = false;
  }
}

// ==========================================
// CLEAN UP EXPIRED SESSIONS
// ==========================================

const cleanupTimer = setInterval(() => {
  const now = Date.now();

  for (
    const [userId, patient] of sessions
  ) {
    if (
      !patient.busy &&
      now - patient.updatedAt >
        CONFIG.sessionTimeout
    ) {
      sessions.delete(userId);
    }
  }
}, 60 * 1000);

cleanupTimer.unref();

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  start,
  execute,
  scan,
  handleButton,
  syncWiki
};
