
const {
  EmbedBuilder,
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
  __dirname,
  "surgeryData.json"
);

const sessions = new Map();

let syncRunning = false;
let syncTimer = null;

// ==========================================
// GROWTopia STATUS BLOCK EMOJIS
// ==========================================

const STATUS = {
  green: "<:greenblock192x192:1575688199827759164>",
  yellow: "<:yellowblock192x192:1575688203254505482>",
  red: "<:redblock192x192:1575688206035320922>"
};

// ==========================================
// SURGICAL TOOL EMOJIS
// ==========================================

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

// ==========================================
// FALLBACK GROWTopia DIAGNOSES
// ==========================================

const FALLBACK = [
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
  },
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
];

let diagnoses = FALLBACK.map(d => ({
  ...d
}));

// ==========================================
// UTILITIES
// ==========================================

function chance(probability) {
  return Math.random() < probability;
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

// ==========================================
// LOAD CACHED DATA
// ==========================================

function loadCachedData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;

    const data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    if (!Array.isArray(data.diagnoses)) return;

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

// ==========================================
// EXTRACT INCISION REQUIREMENTS
// ==========================================

function extractCuts(description) {
  const text = description.toLowerCase();

  const patterns = [
    /\b(\d+)\s+incisions?\s+using\s+(?:a\s+)?surgical scalpel/i,
    /cut\s+(\d+)\s+incisions?/i,
    /using\s+(\d+)\s+surgical scalpels?/i,
    /make\s+(\d+)\s+incisions?/i,
    /\b(\d+)\s+surgical scalpels?/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

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
    /using a surgical scalpel/i.test(text) ||
    /cut one incision/i.test(text)
  ) {
    return 1;
  }

  return null;
}

// ==========================================
// AUTOMATIC WIKI SYNCHRONIZATION
// ==========================================

async function syncWiki() {
  if (syncRunning) return false;

  syncRunning = true;

  try {
    console.log(
      "[SURGERY] Synchronizing Growtopia Wiki..."
    );

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
        names.includes(
          normalize(item.name)
        )
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
        Math.abs(
          cuts - original.cuts
        ) > 2
      ) {
        console.warn(
          `[SURGERY] Skipped unusual requirement: ${base.name}`
        );

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
        "Insufficient documented surgery data found."
      );
    }

    const cache = {
      lastSync: Date.now(),
      source:
        "https://growtopiawiki.com/w/Guide:Surgery",
      matched,
      parsed,
      diagnoses: updated.map(d => ({
        name: d.name,
        cuts: d.cuts
      }))
    };

    const temporaryFile =
      DATA_FILE + ".tmp";

    fs.writeFileSync(
      temporaryFile,
      JSON.stringify(cache, null, 2)
    );

    fs.renameSync(
      temporaryFile,
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

    console.log(
      "[SURGERY] Using cached or fallback data."
    );

    return false;

  } finally {
    syncRunning = false;
  }
}

// ==========================================
// START AUTOMATIC SYNCHRONIZATION
// ==========================================

function start() {
  if (syncTimer) return;

  loadCachedData();

  syncWiki().catch(console.error);

  syncTimer = setInterval(() => {
    syncWiki().catch(console.error);
  }, CONFIG.syncInterval);

  syncTimer.unref();
}

// ==========================================
// SPECIAL CONDITIONS
// ==========================================

const CONDITIONS = [
  "Tough Skin",
  "Antibiotic Resistant",
  "Absolutely Filthy",
  "Hyperactive",
  "Hemophiliac"
];

// ==========================================
// CREATE RANDOM PATIENT
// ==========================================

function createPatient(userId) {
  const diagnosis = pick(diagnoses);

  const condition = chance(
    CONFIG.specialConditionChance
  )
    ? pick(CONDITIONS)
    : null;

  return {
    id: randomUUID().slice(0, 12),
    userId,

    diagnosis: diagnosis.name,
    type: diagnosis.type || "operation",

    diagnosed: diagnosis.known || false,
    conditionRevealed: false,

    ultrasound: false,
    lab: false,

    condition,

    requiredCuts: diagnosis.cuts,

    incisions: 0,
    broken: diagnosis.broken || 0,
    shattered: diagnosis.shattered || 0,

    blood: diagnosis.blood ?? 100,
    bleeding: diagnosis.bleeding || 0,

    temp: diagnosis.temp ?? 98.6,
    fever: diagnosis.fever || 0,

    dirt: diagnosis.dirt || 0,
    visibility: diagnosis.visibility ?? 100,

    sleep: 0,

    heartStopped: false,
    heartTurns: 0,
    heartRisk: diagnosis.heartRisk ?? 0.005,

    fixUnlocked: false,
    fixed: false,

    turns: 0,
    skillFails: 0,

    finished: false,
    success: false,
    busy: false,

    createdAt: Date.now(),
    updatedAt: Date.now(),

    feedback:
      "You begin examining the patient."
  };
}

// ==========================================
// PATIENT STATUS LABELS
// ==========================================

function pulse(p) {
  if (p.heartStopped || p.blood <= 0)
    return "No pulse";

  if (p.blood >= 80)
    return "Strong";

  if (p.blood >= 55)
    return "Steady";

  if (p.blood >= 25)
    return "Weak";

  return "Extremely weak";
}

function consciousness(p) {
  if (p.heartStopped)
    return "Heart stopped!";

  if (p.sleep <= 0)
    return "Awake";

  const hyper =
    p.condition === "Hyperactive";

  if (p.sleep >= (hyper ? 7 : 14))
    return "Near coma";

  if (p.sleep <= (hyper ? 1 : 2))
    return "Coming to";

  return "Unconscious";
}

function sanitation(p) {
  if (p.dirt >= 3)
    return "Unsanitary";

  if (p.dirt >= 2)
    return "Unclean";

  if (p.dirt >= 1)
    return "Not sanitized";

  return "Clean";
}

function visibilityStatus(p) {
  if (p.visibility <= 0)
    return "You can't see what you are doing!";

  if (p.visibility <= 50)
    return "It is becoming hard to see your work.";

  return "Clear";
}

function bleedingStatus(p) {
  if (p.bleeding >= 3)
    return "Losing blood quickly!";

  if (p.bleeding >= 2)
    return "Losing blood";

  if (p.bleeding > 0)
    return "Losing blood slowly";

  return "None";
}

function feverStatus(p) {
  if (p.fever >= 0.8)
    return "Climbing rapidly!";

  if (p.fever >= 0.4)
    return "Climbing";

  if (p.fever > 0)
    return "Slowly rising";

  return "Stable";
}

// ==========================================
// GROWTopia BLOCK STATUS ICONS
// ==========================================

function pulseIcon(p) {
  if (
    p.heartStopped ||
    p.blood < 25
  ) {
    return STATUS.red;
  }

  if (p.blood < 80) {
    return STATUS.yellow;
  }

  return STATUS.green;
}

function temperatureIcon(p) {
  if (p.temp > 106)
    return STATUS.red;

  if (p.temp > 100.4)
    return STATUS.yellow;

  return STATUS.green;
}

function consciousnessIcon(p) {
  const status = consciousness(p);

  if (
    status === "Heart stopped!" ||
    status === "Near coma" ||
    (
      status === "Awake" &&
      p.incisions > 0
    )
  ) {
    return STATUS.red;
  }

  if (
    status === "Coming to" ||
    status === "Awake"
  ) {
    return STATUS.yellow;
  }

  return STATUS.green;
}

function sanitationIcon(p) {
  if (p.dirt >= 3)
    return STATUS.red;

  if (p.dirt >= 1)
    return STATUS.yellow;

  return STATUS.green;
}

function visibilityIcon(p) {
  if (p.visibility <= 0)
    return STATUS.red;

  if (p.visibility <= 50)
    return STATUS.yellow;

  return STATUS.green;
}

function bleedingIcon(p) {
  if (p.bleeding >= 3)
    return STATUS.red;

  if (p.bleeding > 0)
    return STATUS.yellow;

  return STATUS.green;
}

function incisionIcon(p) {
  if (p.incisions >= 4)
    return STATUS.red;

  if (p.incisions > 0)
    return STATUS.yellow;

  return STATUS.green;
}

function bonesIcon(p) {
  if (!p.ultrasound)
    return STATUS.yellow;

  if (p.shattered > 0)
    return STATUS.red;

  if (p.broken > 0)
    return STATUS.yellow;

  return STATUS.green;
}

function feverIcon(p) {
  if (
    p.temp > 106 ||
    p.fever >= 0.8
  ) {
    return STATUS.red;
  }

  if (
    p.fever > 0 ||
    p.temp > 100.4
  ) {
    return STATUS.yellow;
  }

  return STATUS.green;
}

// ==========================================
// SKILL FAILURE PROBABILITY
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

  if (tool === "cancel")
    return true;

  // Emergency tool must remain accessible.
  if (tool === "defibrillator")
    return p.heartStopped;

  const tough =
    p.condition === "Tough Skin";

  if (p.visibility <= 0) {
    return tool === "sponge";
  }

  switch (tool) {

    case "ultrasound":
      return !p.ultrasound &&
        p.type !== "flu" &&
        p.diagnosis !== "Nose Job";

    case "labkit":
      return !p.lab;

    case "antibiotics":
      return p.lab;

    case "pins":
      return p.ultrasound &&
        p.shattered > 0 &&
        p.incisions >= 1;

    case "splint":
      return p.ultrasound &&
        p.broken > 0 &&
        (!tough || p.incisions >= 2);

    case "clamp":
      return p.incisions >=
        (tough ? 2 : 1);

    case "fix":
      return p.fixUnlocked &&
        !p.fixed &&
        (!tough || p.incisions >= 2);

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
// SURGERY RESULT
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

  if (
    p.type === "bones" &&
    p.diagnosed &&
    p.broken === 0 &&
    p.shattered === 0
  ) {
    p.fixed = true;
  }

  if (
    p.type === "flu" &&
    p.lab &&
    p.temp <= 100.4
  ) {
    p.fixed = true;
  }

  if (
    p.fixed &&
    p.incisions === 0 &&
    p.broken === 0 &&
    p.shattered === 0 &&
    p.bleeding === 0 &&
    p.temp <= 100.4 &&
    !p.heartStopped
  ) {
    return finish(
      p,
      true,
      "You successfully completed the surgery!"
    );
  }
}

// ==========================================
// FIX IT UNLOCK
// ==========================================

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

  if (p.incisions >= required) {
    p.fixUnlocked = true;
  }
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

  const anestheticWorked =
    tool === "anesthetic" && worked;

  if (!anestheticWorked) {
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

  if (p.bleeding > 0) {
    const multiplier =
      p.condition === "Hemophiliac"
        ? 1.5
        : 1;

    p.blood -=
      p.bleeding * 1.8 * multiplier;

    if (
      tool !== "sponge" ||
      !worked
    ) {
      p.visibility -=
        p.bleeding * 3;
    }
  }

  if (
    p.incisions > 0 &&
    (
      tool !== "sponge" ||
      !worked
    )
  ) {
    p.visibility -=
      p.incisions * 2;
  }

  if (
    p.bleeding > 0 ||
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

  p.blood = limit(
    p.blood,
    0,
    100
  );

  p.visibility = limit(
    p.visibility,
    0,
    100
  );

  p.dirt = limit(
    p.dirt,
    0,
    3
  );

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
// SKILL FAILURE EFFECTS
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
    `${STATUS.red} **Skill Fail!** ` +
    `(${Math.round(rate * 100)}%)\n` +
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
// SURGICAL TOOL ENGINE
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

    case "sponge":
      p.visibility = 100;

      p.feedback =
        "You cleared the operation site.";
      break;

    case "anesthetic":
      p.sleep +=
        p.condition === "Hyperactive"
          ? 4
          : 9;

      p.feedback =
        "You administered anesthetic.";
      break;

    case "scalpel":
      p.incisions++;
      p.bleeding += 0.7;

      if (
        p.diagnosis === "Swallowed a World Lock"
      ) {
        p.visibility -= 15;
        p.dirt += 1;
      }

      p.feedback =
        "You made an incision.";
      break;

    case "stitches":

      if (p.incisions > 0) {
        p.incisions--;

        if (p.incisions === 0) {
          p.bleeding = 0;

        } else {
          p.bleeding = Math.max(
            0,
            p.bleeding - 1.5
          );
        }

      } else {
        p.bleeding = Math.max(
          0,
          p.bleeding - 1.5
        );
      }

      p.feedback =
        "You applied surgical stitches.";
      break;

    case "ultrasound":
      p.ultrasound = true;
      p.diagnosed = true;
      p.conditionRevealed = true;

      p.feedback =
        `Diagnosis: **${p.diagnosis}**`;
      break;

    case "labkit":
      p.lab = true;
      p.conditionRevealed = true;

      if (p.type === "flu") {
        p.diagnosed = true;

        p.feedback =
          `Diagnosis: **${p.diagnosis}**`;

      } else {
        p.feedback =
          "Lab work completed.";
      }

      break;

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

    case "antibiotics": {
      const resistant =
        p.condition === "Antibiotic Resistant";

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

    case "transfusion":
      p.blood = Math.min(
        100,
        p.blood + 35
      );

      p.feedback =
        "You performed a blood transfusion.";
      break;

    case "defibrillator":
      p.heartStopped = false;
      p.heartTurns = 0;

      p.feedback =
        "You restarted the patient's heart.";
      break;

    case "pins":
      p.shattered--;
      p.broken++;

      p.feedback =
        "You repaired a shattered bone.";
      break;

    case "splint":
      p.broken--;

      p.feedback =
        "You repaired a broken bone.";
      break;

    case "clamp":
      p.bleeding = Math.max(
        0,
        p.bleeding - 1
      );

      p.feedback =
        "You reduced blood loss.";
      break;

    case "fix":

      if (
        p.diagnosis === "Brainworms" &&
        chance(0.25)
      ) {
        p.feedback =
          "The brainworms escaped!";

      } else {
        p.fixed = true;

        p.feedback =
          "You resolved the diagnosis!";
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
// GROWTopia THEMED EMBED
// ==========================================

function buildEmbed(p) {
  const resultIcon =
    p.finished
      ? p.success
        ? STATUS.green
        : STATUS.red
      : "";

  const embed = new EmbedBuilder()

    .setColor(
      p.finished
        ? p.success
          ? 0x70B900
          : 0xFF332B
        : 0x3498DB
    )

    .setTitle(
      p.finished
        ? p.success
          ? "Surgery Successful!"
          : "Surgery Failed!"
        : "Performing Surgery"
    )

    .setDescription(
      resultIcon
        ? `${resultIcon} ${p.feedback}`
        : p.feedback
    )

    .addFields({
      name: "Patient Information",

      value:

        `**Diagnosis:** ${
          p.diagnosed || p.finished
            ? p.diagnosis
            : "Unknown"
        }\n\n` +

        `${pulseIcon(p)} **Pulse:** ${
          pulse(p)
        }\n` +

        `${temperatureIcon(p)} **Temperature:** ${
          p.temp.toFixed(1)
        }°F\n` +

        `${consciousnessIcon(p)} **Status:** ${
          consciousness(p)
        }\n` +

        `${sanitationIcon(p)} **Operation Site:** ${
          sanitation(p)
        }\n` +

        `${incisionIcon(p)} **Incisions:** ${
          p.incisions
        }\n` +

        `${bleedingIcon(p)} **Bleeding:** ${
          bleedingStatus(p)
        }\n` +

        `${visibilityIcon(p)} **Visibility:** ${
          visibilityStatus(p)
        }\n` +

        `${bonesIcon(p)} **Bones:** ${
          p.ultrasound
            ? `${p.broken} broken, ${p.shattered} shattered`
            : "Unknown"
        }`
    })

    .setFooter({
      text:
        `Surgeon Skill: ${CONFIG.surgeonSkill} • ` +
        `Turns: ${p.turns} • ` +
        `Skill Fails: ${p.skillFails}`
    });

  if (
    p.fever > 0 ||
    p.temp > 100.4
  ) {
    embed.addFields({
      name: "Fever",

      value:
        `${feverIcon(p)} ${feverStatus(p)}`
    });
  }

  if (
    p.condition &&
    p.conditionRevealed
  ) {
    embed.addFields({
      name: "Additional Condition",

      value:
        `${STATUS.yellow} ${p.condition}`
    });
  }

  if (
    canUse(p, "fix") &&
    !p.finished
  ) {
    embed.addFields({
      name: "Surgical Progress",

      value:
        `${STATUS.green} The underlying problem has been located.`
    });
  }

  if (
    p.fixed &&
    !p.finished
  ) {
    embed.addFields({
      name: "Surgical Progress",

      value:
        `${STATUS.green} The underlying condition has been treated.`
    });
  }

  if (p.finished) {
    const seconds = Math.floor(
      (Date.now() - p.createdAt) / 1000
    );

    embed.addFields({
      name: "Surgery Results",

      value:
        `**Tools Used:** ${p.turns}\n` +
        `**Skill Failures:** ${p.skillFails}\n` +
        `**Time Taken:** ${seconds}s`
    });
  }

  return embed;
}

// ==========================================
// ORIGINAL SURGICAL TOOL BUTTONS
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
    new ActionRowBuilder().addComponents(
      row.map(([tool, label]) => {

        const button = new ButtonBuilder()

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
// START /SURGERY
// ==========================================

async function execute(interaction) {
  const userId = interaction.user.id;

  const existing = sessions.get(userId);

  if (existing?.busy) {
    return interaction.reply({
      content:
        "Your surgery is currently updating.",
      ephemeral: true
    });
  }

  if (
    existing &&
    !existing.finished &&
    Date.now() - existing.updatedAt <
      CONFIG.sessionTimeout
  ) {
    return interaction.reply({
      content:
        "You already have an active surgery. " +
        "Finish or cancel it first.",
      ephemeral: true
    });
  }

  const patient = createPatient(userId);

  patient.busy = true;

  sessions.set(
    userId,
    patient
  );

  try {
    await interaction.deferReply({
      ephemeral: true
    });

    await interaction.editReply({
      embeds: [
        buildEmbed(patient)
      ],
      components:
        buildButtons(patient)
    });

  } catch (error) {
    sessions.delete(userId);

    console.error(
      "[SURGERY] Execute error:",
      error
    );

    if (interaction.deferred) {
      await interaction.editReply({
        content:
          "Unable to start surgery.",
        embeds: [],
        components: []
      }).catch(() => {});
    }

  } finally {
    patient.busy = false;
  }
}

// ==========================================
// HANDLE BUTTON INTERACTIONS
// ==========================================

async function handleButton(interaction) {
  if (!interaction.isButton()) return;

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

  const userId =
    interaction.user.id;

  const patient =
    sessions.get(userId);

  if (
    !patient ||
    patient.id !== sessionId ||
    Date.now() - patient.updatedAt >
      CONFIG.sessionTimeout
  ) {
    return interaction.reply({
      content:
        "This surgery session has expired. " +
        "Use /surgery again.",
      ephemeral: true
    });
  }

  if (
    patient.busy ||
    (
      !restarting &&
      turn !== patient.turns
    )
  ) {
    return interaction.reply({
      content:
        "This action is outdated. Use the updated surgery buttons.",
      ephemeral: true
    });
  }

  patient.busy = true;

  let previousState = null;

  try {
    await interaction.deferUpdate();

    // RESTART SURGERY

    if (
      tool === "restart" &&
      patient.finished
    ) {
      const next = createPatient(userId);

      next.busy = true;

      sessions.set(
        userId,
        next
      );

      try {
        await interaction.editReply({
          embeds: [
            buildEmbed(next)
          ],
          components:
            buildButtons(next)
        });

      } catch (error) {
        sessions.set(
          userId,
          patient
        );

        throw error;

      } finally {
        next.busy = false;
      }

      return;
    }

    // VALIDATE SELECTED TOOL

    if (!canUse(patient, tool)) {
      return await interaction.editReply({
        embeds: [
          buildEmbed(patient)
        ],
        components:
          buildButtons(patient)
      });
    }

    previousState = {
      ...patient
    };

    applyTool(
      patient,
      tool
    );

    patient.updatedAt =
      Date.now();

    // UPDATE EXISTING MESSAGE

    await interaction.editReply({
      embeds: [
        buildEmbed(patient)
      ],
      components:
        buildButtons(patient)
    });

  } catch (error) {

    // Restore previous patient state
    // if the Discord message update fails.

    if (previousState) {
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
      content:
        "An error occurred during surgery.",
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
// SESSION CLEANUP
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
  handleButton,
  syncWiki
};
