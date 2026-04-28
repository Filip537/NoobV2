const params = new URLSearchParams(window.location.search);
const userId = params.get("user");
const selectedGame = params.get("game");

let difficulty = "easy";
let currentGame = null;
let mistakes = 0;
let submitted = false;
let startTime = Date.now();

let puzzle = [];
let solution = [];
let board = [];
let selected = null;

let hangmanAnswer = "";
let hangmanHint = "";
let guessedLetters = new Set();
let wrongLetters = [];

let crosswordWords = [];
let foundWords = new Set();

const homePage = document.getElementById("homePage");
const gamePage = document.getElementById("gamePage");

const sudokuUI = document.getElementById("sudokuUI");
const hangmanUI = document.getElementById("hangmanUI");
const crosswordUI = document.getElementById("crosswordUI");

const title = document.getElementById("title");
const info = document.getElementById("info");
const timerText = document.getElementById("timer");
const statusText = document.getElementById("status");
const mistakesText = document.getElementById("mistakesText");
const difficultyText = document.getElementById("difficultyText");
const gameText = document.getElementById("gameText");
const difficultySelect = document.getElementById("difficulty");

document.getElementById("sudokuLink").href = `?game=sudoku&user=${userId || ""}`;
document.getElementById("hangmanLink").href = `?game=hangman&user=${userId || ""}`;
document.getElementById("crosswordLink").href = `?game=crossword&user=${userId || ""}`;

document.getElementById("homeBtn").onclick = () => {
  window.location.href = `/?user=${userId || ""}`;
};

document.getElementById("newGame").onclick = () => {
  startSelectedGame();
};

difficultySelect.onchange = () => {
  difficulty = difficultySelect.value;
  startSelectedGame();
};

function showHome() {
  homePage.classList.remove("hidden");
  gamePage.classList.add("hidden");

  title.textContent = "Choose a minigame";
  info.textContent = "Pick one game to play.";
}

function showGamePage() {
  homePage.classList.add("hidden");
  gamePage.classList.remove("hidden");
}

function hideAllGames() {
  sudokuUI.classList.add("hidden");
  hangmanUI.classList.add("hidden");
  crosswordUI.classList.add("hidden");
}

function resetBase(game) {
  currentGame = game;
  mistakes = 0;
  submitted = false;
  startTime = Date.now();
  statusText.textContent = "";
  mistakesText.textContent = "0";
  difficultyText.textContent = difficulty[0].toUpperCase() + difficulty.slice(1);
  gameText.textContent = game[0].toUpperCase() + game.slice(1);
  hideAllGames();
  showGamePage();
}

function cloneGrid(grid) {
  return grid.map(row => [...row]);
}

function startSelectedGame() {
  if (selectedGame === "sudoku") startSudoku();
  else if (selectedGame === "hangman") startHangman();
  else if (selectedGame === "crossword") startCrossword();
  else showHome();
}

/* ================= SUDOKU ================= */

function startSudoku() {
  resetBase("sudoku");
  sudokuUI.classList.remove("hidden");

  title.textContent = "Sudoku";
  info.textContent = "Complete the board and submit your result.";

  const picked = generateSudoku(difficulty);
  puzzle = cloneGrid(picked.puzzle);
  solution = cloneGrid(picked.solution);
  board = cloneGrid(puzzle);
  selected = null;

  renderBoard();
}

function renderBoard() {
  const boardDiv = document.getElementById("board");
  boardDiv.innerHTML = "";

  const selectedValue = selected ? board[selected.r][selected.c] : 0;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement("button");
      const value = board[r][c];

      cell.className = "cell";
      cell.textContent = value === 0 ? "" : value;

      if (puzzle[r][c] !== 0) cell.classList.add("fixed");
      if (selected && selected.r === r && selected.c === c) cell.classList.add("selected");
      if (selectedValue !== 0 && value === selectedValue && !(selected && selected.r === r && selected.c === c)) {
        cell.classList.add("same");
      }
      if (value !== 0 && value !== solution[r][c]) cell.classList.add("wrong");

      cell.onclick = () => {
        if (puzzle[r][c] !== 0 || submitted) return;
        selected = { r, c };
        renderBoard();
      };

      boardDiv.appendChild(cell);
    }
  }
}

document.querySelectorAll(".numbers button").forEach(btn => {
  btn.onclick = () => {
    if (!selected || submitted || currentGame !== "sudoku") return;

    const num = Number(btn.textContent);
    const { r, c } = selected;

    if (board[r][c] !== num && num !== solution[r][c]) {
      mistakes++;
      mistakesText.textContent = mistakes;
    }

    board[r][c] = num;
    renderBoard();

    if (isSudokuCompleted()) {
      statusText.textContent = "Board completed! Submit your result.";
    }
  };
});

document.getElementById("erase").onclick = () => {
  if (!selected || submitted) return;
  const { r, c } = selected;
  if (puzzle[r][c] !== 0) return;

  board[r][c] = 0;
  renderBoard();
};

document.getElementById("submitSudoku").onclick = () => {
  if (!isSudokuCompleted()) {
    statusText.textContent = "Sudoku is not completed correctly yet.";
    return;
  }

  sendResult({
    game: "sudoku",
    result: "Completed",
    extra: "Sudoku board completed."
  });
};

function isSudokuCompleted() {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== solution[r][c]) return false;
    }
  }
  return true;
}

/* ================= HANGMAN ================= */

function startHangman() {
  resetBase("hangman");
  hangmanUI.classList.remove("hidden");

  title.textContent = "Hangman";
  info.textContent = "Guess the word before too many mistakes.";

  const list = HANGMAN_WORDS[difficulty] || HANGMAN_WORDS.hard;
  const pick = list[Math.floor(Math.random() * list.length)];

  hangmanAnswer = pick.word.toUpperCase();
  hangmanHint = pick.hint;
  guessedLetters = new Set();
  wrongLetters = [];

  renderHangman();
}

function renderHangman() {
  document.getElementById("hangmanWord").textContent = hangmanAnswer
    .split("")
    .map(letter => guessedLetters.has(letter) ? letter : "_")
    .join(" ");

  document.getElementById("hangmanHint").textContent = `Hint: ${hangmanHint}`;
  document.getElementById("wrongLetters").textContent = `Wrong: ${wrongLetters.join(", ") || "None"}`;

  const buttons = document.getElementById("letterButtons");
  buttons.innerHTML = "";

  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(letter => {
    const btn = document.createElement("button");
    btn.textContent = letter;
    btn.disabled = guessedLetters.has(letter) || wrongLetters.includes(letter) || submitted;

    btn.onclick = () => guessLetter(letter);

    buttons.appendChild(btn);
  });
}

function guessLetter(letter) {
  if (submitted) return;

  if (hangmanAnswer.includes(letter)) {
    guessedLetters.add(letter);
  } else {
    wrongLetters.push(letter);
    mistakes++;
    mistakesText.textContent = mistakes;
  }

  renderHangman();

  const won = hangmanAnswer.split("").every(letter => guessedLetters.has(letter));
  const lost = mistakes >= 7;

  if (won) {
    sendResult({
      game: "hangman",
      result: "Won",
      word: hangmanAnswer,
      extra: `Guessed the word with ${mistakes} mistakes.`
    });
  }

  if (lost) {
    sendResult({
      game: "hangman",
      result: "Lost",
      word: hangmanAnswer,
      extra: `Failed to guess the word.`
    });
  }
}

/* ================= CROSSWORD / WORD SEARCH ================= */

function startCrossword() {
  resetBase("crossword");
  crosswordUI.classList.remove("hidden");

  title.textContent = "Crossword";
  info.textContent = "Find 10 hidden words.";

  const list = CROSSWORD_WORDS[difficulty] || CROSSWORD_WORDS.hard;
  const pickedWords = [...list]
    .sort(() => Math.random() - 0.5)
    .slice(0, 10)
    .map(word => word.toUpperCase());

  foundWords = new Set();
  crosswordWords = buildWordSearchGrid(pickedWords);
  renderWordList();
}

function buildWordSearchGrid(words) {
  const size = 18;
  const grid = Array.from({ length: size }, () => Array(size).fill(""));
  const directions = [[1, 0], [0, 1], [1, 1]];
  const placedWords = [];

  function canPlace(word, r, c, dr, dc) {
    for (let i = 0; i < word.length; i++) {
      const nr = r + dr * i;
      const nc = c + dc * i;

      if (nr < 0 || nr >= size || nc < 0 || nc >= size) return false;
      if (grid[nr][nc] && grid[nr][nc] !== word[i]) return false;
    }

    return true;
  }

  function place(word) {
    for (let tries = 0; tries < 500; tries++) {
      const [dr, dc] = directions[Math.floor(Math.random() * directions.length)];
      const r = Math.floor(Math.random() * size);
      const c = Math.floor(Math.random() * size);

      if (!canPlace(word, r, c, dr, dc)) continue;

      for (let i = 0; i < word.length; i++) {
        grid[r + dr * i][c + dc * i] = word[i];
      }

      placedWords.push(word);
      return;
    }
  }

  words.forEach(place);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!grid[r][c]) {
        grid[r][c] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      }
    }
  }

  const gridDiv = document.getElementById("crosswordGrid");
  gridDiv.innerHTML = "";
  gridDiv.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

  grid.flat().forEach(letter => {
    const cell = document.createElement("div");
    cell.className = "word-cell";
    cell.textContent = letter;
    gridDiv.appendChild(cell);
  });

  return placedWords;
}

function renderWordList() {
  const wordList = document.getElementById("wordList");
  wordList.innerHTML = "";

  crosswordWords.forEach(word => {
    const label = document.createElement("label");
    const input = document.createElement("input");

    input.type = "checkbox";

    input.onchange = () => {
      if (input.checked) foundWords.add(word);
      else foundWords.delete(word);

      if (foundWords.size === crosswordWords.length) {
        submitCrossword();
      }
    };

    label.appendChild(input);
    label.append(" " + word);
    wordList.appendChild(label);
  });
}

document.getElementById("checkCrossword").onclick = submitCrossword;

function submitCrossword() {
  if (submitted) return;

  if (foundWords.size < crosswordWords.length) {
    statusText.textContent = `You found ${foundWords.size}/${crosswordWords.length} words. Find all words first.`;
    return;
  }

  sendResult({
    game: "crossword",
    result: "Completed",
    word: crosswordWords.join(", "),
    extra: `Found all ${crosswordWords.length} words.`
  });
}

/* ================= RESULT ================= */

async function sendResult(data) {
  if (submitted) return;

  submitted = true;
  statusText.textContent = "Submitting result...";

  const time = formatTime(Date.now() - startTime);

  try {
    const res = await fetch("/api/minigame-result", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId,
        game: data.game || currentGame,
        difficulty,
        time,
        mistakes,
        result: data.result,
        word: data.word || "",
        extra: data.extra || ""
      })
    });

    statusText.textContent = res.ok
      ? "Result sent to Discord!"
      : "Failed to send result.";
  } catch (err) {
    statusText.textContent = "Failed to send result.";
  }
}

function formatTime(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const left = sec % 60;
  return `${min}m ${left}s`;
}

setInterval(() => {
  timerText.textContent = formatTime(Date.now() - startTime);
}, 1000);

startSelectedGame();