function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pattern(r, c) {
  return (r * 3 + Math.floor(r / 3) + c) % 9;
}

function generateFullSolution() {
  const nums = shuffle([1,2,3,4,5,6,7,8,9]);
  const rows = shuffle([0,1,2]).flatMap(g => shuffle([0,1,2]).map(r => g * 3 + r));
  const cols = shuffle([0,1,2]).flatMap(g => shuffle([0,1,2]).map(c => g * 3 + c));
  return rows.map(r => cols.map(c => nums[pattern(r, c)]));
}

function makePuzzle(solution, difficulty) {
  const puzzle = solution.map(row => [...row]);
  let removeCount = 36;
  if (difficulty === "medium") removeCount = 46;
  if (difficulty === "hard") removeCount = 56;
  const cells = shuffle([...Array(81).keys()]);
  for (let i = 0; i < removeCount; i++) {
    const cell = cells[i];
    puzzle[Math.floor(cell / 9)][cell % 9] = 0;
  }
  return puzzle;
}

function generateSudoku(difficulty = "easy") {
  const solution = generateFullSolution();
  return { puzzle: makePuzzle(solution, difficulty), solution };
}

const HANGMAN_WORDS = {
  easy: [
    { word: "planet", hint: "A large object in space" },
    { word: "bridge", hint: "Something used to cross water" },
    { word: "castle", hint: "A large old building" },
    { word: "forest", hint: "A place with many trees" },
    { word: "garden", hint: "A place where plants grow" },
    { word: "island", hint: "Land surrounded by water" },
    { word: "market", hint: "A place to buy things" },
    { word: "orange", hint: "A fruit and a color" },
    { word: "stream", hint: "Small flowing water" },
    { word: "window", hint: "You look through it" },
    { word: "thunder", hint: "Sound during a storm" },
    { word: "diamond", hint: "A precious stone" },
    { word: "journey", hint: "A long trip" },
    { word: "library", hint: "A place with books" },
    { word: "weather", hint: "Rain, sun, wind" }
  ],

  medium: [
    { word: "abstract", hint: "Not physical or concrete" },
    { word: "benevolent", hint: "Kind and helpful" },
    { word: "chronicle", hint: "A record of events" },
    { word: "diligence", hint: "Careful steady effort" },
    { word: "empathy", hint: "Understanding others' feelings" },
    { word: "formidable", hint: "Impressive or difficult" },
    { word: "harmonious", hint: "Peaceful and balanced" },
    { word: "integrity", hint: "Being honest and fair" },
    { word: "judicious", hint: "Showing good judgment" },
    { word: "luminous", hint: "Bright or glowing" },
    { word: "meticulous", hint: "Very careful and detailed" },
    { word: "resilient", hint: "Able to recover quickly" },
    { word: "ambiguous", hint: "Having more than one meaning" },
    { word: "eloquence", hint: "Clear and persuasive speaking" },
    { word: "pragmatic", hint: "Practical and realistic" },
    { word: "tenacious", hint: "Not giving up easily" },
    { word: "versatile", hint: "Able to do many things" },
    { word: "authentic", hint: "Real or genuine" },
    { word: "coherent", hint: "Clear and logical" },
    { word: "profound", hint: "Very deep or meaningful" }
  ],

  hard: [
    { word: "aberration", hint: "Something unusual or abnormal" },
    { word: "cacophony", hint: "A harsh mixture of sounds" },
    { word: "deleterious", hint: "Harmful or damaging" },
    { word: "ephemeral", hint: "Lasting for a short time" },
    { word: "fastidious", hint: "Very hard to please" },
    { word: "grandiloquent", hint: "Using fancy or exaggerated language" },
    { word: "heterogeneous", hint: "Made of different kinds" },
    { word: "intransigent", hint: "Refusing to change opinions" },
    { word: "juxtaposition", hint: "Placing things side by side for contrast" },
    { word: "kaleidoscopic", hint: "Constantly changing patterns" },
    { word: "labyrinthine", hint: "Complicated like a maze" },
    { word: "mellifluous", hint: "Smooth and pleasant sounding" },
    { word: "nefarious", hint: "Very wicked or evil" },
    { word: "obfuscation", hint: "Making something unclear" },
    { word: "perspicacious", hint: "Having sharp understanding" },
    { word: "quintessential", hint: "The perfect example" },
    { word: "recalcitrant", hint: "Stubbornly disobedient" },
    { word: "serendipity", hint: "Finding something good by chance" },
    { word: "ubiquitous", hint: "Found everywhere" },
    { word: "vicissitude", hint: "A sudden change in life" },
    { word: "circumlocution", hint: "Using too many words indirectly" },
    { word: "idiosyncrasy", hint: "A unique habit or feature" },
    { word: "magnanimous", hint: "Generous and forgiving" },
    { word: "sesquipedalian", hint: "Using very long words" },
    { word: "antediluvian", hint: "Extremely old-fashioned" },
    { word: "lugubrious", hint: "Very sad or gloomy" },
    { word: "pulchritude", hint: "Physical beauty" },
    { word: "verisimilitude", hint: "Appearing to be true" },
    { word: "ineffable", hint: "Too great to describe" },
    { word: "perspicuity", hint: "Clarity of expression" }
  ]
};

const CROSSWORD_WORDS = {
  easy: [
    "ANIMAL", "BRIDGE", "CASTLE", "FOREST", "GARDEN", "ISLAND", "MARKET", "ORANGE", "PLANET", "STREAM",
    "THUNDER", "WINDOW", "DIAMOND", "JOURNEY", "LIBRARY", "WEATHER", "MOUNTAIN", "RIVER", "FLOWER", "SUNLIGHT",
    "VILLAGE", "OCEAN", "CANDLE", "BOTTLE", "PICTURE", "SCHOOL", "FRIEND", "FAMILY", "BUTTON", "CAMERA"
  ],

  medium: [
    "ABSTRACT", "BENEVOLENT", "CHRONICLE", "DILIGENCE", "EMPATHETIC", "FORMIDABLE", "HARMONIOUS", "INTEGRITY", "JUDICIOUS", "LUMINOUS",
    "METICULOUS", "RESILIENT", "AMBIGUOUS", "ELOQUENCE", "PRAGMATIC", "TENACIOUS", "VERSATILE", "AUTHENTIC", "COHERENT", "PROFOUND",
    "STRATEGIC", "CREATIVE", "ANALYTICAL", "DISCIPLINE", "INNOVATION", "PERSISTENT", "RESOURCEFUL", "OPTIMISTIC", "SYMMETRICAL", "CONSTRUCT"
  ],

  hard: [
    "ABERRATION", "CACOPHONY", "DELETERIOUS", "EPHEMERAL", "FASTIDIOUS", "GRANDILOQUENT", "HETEROGENEOUS", "INTRANSIGENT", "JUXTAPOSITION", "KALEIDOSCOPIC",
    "LABYRINTHINE", "MELLIFLUOUS", "NEFARIOUS", "OBFUSCATION", "PERSPICACIOUS", "QUINTESSENTIAL", "RECALCITRANT", "SERENDIPITY", "UBIQUITOUS", "VICISSITUDE",
    "CIRCUMLOCUTION", "IDIOSYNCRASY", "MAGNANIMOUS", "SESQUIPEDALIAN", "ANTEDILUVIAN", "LUGUBRIOUS", "PULCHRITUDE", "VERISIMILITUDE", "INEFFABLE", "PERSPICUITY",
    "EXACERBATE", "OBSTREPEROUS", "PARADIGMATIC", "TRANSCENDENT", "UNASSAILABLE", "DISCOMBOBULATE", "INSCRUTABLE", "MULTIFARIOUS", "PANDEMONIUM", "PHANTASMAGORIA"
  ]
};