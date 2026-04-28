const params = new URLSearchParams(window.location.search);
const userId = params.get("user");

let currentGame = null;
let difficulty = "easy";
let startTime = Date.now();
let submitted = false;
let mistakes = 0;

let puzzle = [];
let solution = [];
let board = [];
let selected = null;

let hangmanWord = "";
let hangmanHint = "";
let guessedLetters = [];
let wrongGuesses = 0;

let crosswordWords = [];
let foundWords = new Set();

const home = document.getElementById("home");
const gameArea = document.getElementById("gameArea");
const title = document.getElementById("title");
const info = document.getElementById("info");
const statusText = document.getElementById("status");
const timerText = document.getElementById("timer");
const difficultySelect = document.getElementById("difficulty");
const gameText = document.getElementById("gameText");
const difficultyText = document.getElementById("difficultyText");
const mistakesText = document.getElementById("mistakesText");

const sudokuUI = document.getElementById("sudokuUI");
const hangmanUI = document.getElementById("hangmanUI");
const crosswordUI = document.getElementById("crosswordUI");
const boardDiv = document.getElementById("board");

function cloneGrid(grid) {
  return grid.map(row => [...row]);
}

function formatTime(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  return `${min}m ${sec % 60}s`;
}

function showOnly(ui) {
  sudokuUI.classList.add("hidden");
  hangmanUI.classList.add("hidden");
  crosswordUI.classList.add("hidden");
  ui.classList.remove("hidden");
}

function resetGameBase(gameName) {
  startTime = Date.now();
  submitted = false;
  mistakes = 0;
  statusText.textContent = "";
  currentGame = gameName;
  gameText.textContent = gameName[0].toUpperCase() + gameName.slice(1);
  difficultyText.textContent = difficulty[0].toUpperCase() + difficulty.slice(1);
  mistakesText.textContent = "0";
  home.classList.add("hidden");
  gameArea.classList.remove("hidden");
}

async function sendResult(payload) {
  if (submitted) return;
  submitted = true;

  statusText.textContent = "Sending result to Discord...";

  const res = await fetch("/api/minigame-result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      game: currentGame,
      difficulty,
      time: formatTime(Date.now() - startTime),
      mistakes,
      ...payload
    })
  });

  statusText.textContent = res.ok
    ? "Result sent to Discord!"
    : "Failed to send result.";
}

function startSudoku() {
  resetGameBase("sudoku");
  showOnly(sudokuUI);
  title.textContent = "Sudoku";
  info.textContent = "Complete the Sudoku board, then submit your result.";

  const picked = generateSudoku(difficulty);
  puzzle = cloneGrid(picked.puzzle);
  solution = cloneGrid(picked.solution);
  board = cloneGrid(puzzle);
  selected = null;
  renderSudoku();
}

function renderSudoku() {
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
      if (selectedValue !== 0 && value === selectedValue && !(selected && selected.r === r && selected.c === c)) cell.classList.add("same");
      if (value !== 0 && value !== solution[r][c]) cell.classList.add("wrong");

      cell.onclick = () => {
        if (puzzle[r][c] !== 0 || submitted) return;
        selected = { r, c };
        renderSudoku();
      };

      boardDiv.appendChild(cell);
    }
  }
}

function isSudokuCompleted() {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== solution[r][c]) return false;
    }
  }
  return true;
}

function sudokuResultText() {
  if (mistakes === 0) return "🟩🟩🟩🟩🟩 Perfect!";
  if (mistakes <= 2) return "🟩🟩🟩🟨⬛ Great!";
  if (mistakes <= 5) return "🟩🟩🟨⬛⬛ Completed!";
  return "🟨🟨⬛⬛⬛ Completed!";
}

function startHangman() {
  resetGameBase("hangman");
  showOnly(hangmanUI);
  title.textContent = "Hangman";
  info.textContent = "Guess the word. Result sends automatically when you win or lose.";

  const list = HANGMAN_WORDS[difficulty] || HANGMAN_WORDS.hard;
  const picked = list[Math.floor(Math.random() * list.length)];
  hangmanWord = picked.word.toUpperCase();
  hangmanHint = picked.hint;
  guessedLetters = [];
  wrongGuesses = 0;
  renderHangman();
}

function renderHangman() {
  document.getElementById("hangmanWord").textContent = hangmanWord
    .split("")
    .map(ch => guessedLetters.includes(ch) ? ch : "_")
    .join(" ");

  document.getElementById("hangmanHint").textContent = `Hint: ${hangmanHint} | Wrong guesses: ${wrongGuesses}/7`;
  mistakes = wrongGuesses;
  mistakesText.textContent = mistakes;

  const lettersDiv = document.getElementById("hangmanLetters");
  lettersDiv.innerHTML = "";

  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(letter => {
    const btn = document.createElement("button");
    btn.textContent = letter;
    btn.disabled = guessedLetters.includes(letter) || submitted;
    btn.onclick = () => guessHangman(letter);
    lettersDiv.appendChild(btn);
  });
}

function guessHangman(letter) {
  if (submitted) return;
  guessedLetters.push(letter);
  if (!hangmanWord.includes(letter)) wrongGuesses++;
  renderHangman();

  const won = hangmanWord.split("").every(ch => guessedLetters.includes(ch));
  const lost = wrongGuesses >= 7;

  if (won || lost) {
    sendResult({
      result: won ? "Won" : "Lost",
      word: hangmanWord,
      extra: won ? "The word was guessed correctly." : "The player ran out of guesses."
    });
  }
}

function startCrossword() {
  resetGameBase("crossword");
  showOnly(crosswordUI);
  title.textContent = "Crossword";
  info.textContent = "Find 10 hidden words. Tick all words to auto-send result.";

  const list = CROSSWORD_WORDS[difficulty] || CROSSWORD_WORDS.hard;
  const pickedWords = [...list]
    .sort(() => Math.random() - 0.5)
    .slice(0, 10)
    .map(w => w.toUpperCase());

  foundWords = new Set();
  crosswordWords = buildWordSearchGrid(pickedWords);
  renderWordList();
}

function buildWordSearchGrid(words) {
  const size = 18;
  const grid = Array.from({ length: size }, () => Array(size).fill(""));
  const directions = [[1,0], [0,1], [1,1]];
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
      return true;
    }
    return false;
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
    label.append(word);
    wordList.appendChild(label);
  });
}

function submitCrossword() {
  if (submitted) return;

  if (foundWords.size < crosswordWords.length) {
    statusText.textContent = `You found ${foundWords.size}/${crosswordWords.length} words. Find all words first.`;
    return;
  }

  sendResult({
    result: "Completed",
    word: crosswordWords.join(", "),
    extra: `Found all ${crosswordWords.length} words.`
  });
}


document.querySelectorAll(".game-card").forEach(btn => {
  btn.onclick = () => {
    const game = btn.dataset.game;
    if (game === "sudoku") startSudoku();
    if (game === "hangman") startHangman();
    if (game === "crossword") startCrossword();
  };
});

document.getElementById("backHome").onclick = () => {
  currentGame = null;
  home.classList.remove("hidden");
  gameArea.classList.add("hidden");
  title.textContent = "Choose a minigame";
  info.textContent = "Pick a game, choose difficulty, and complete it to send your result.";
  statusText.textContent = "";
};

document.getElementById("newGame").onclick = () => {
  if (currentGame === "sudoku") startSudoku();
  if (currentGame === "hangman") startHangman();
  if (currentGame === "crossword") startCrossword();
};

difficultySelect.onchange = () => {
  difficulty = difficultySelect.value;
  if (currentGame === "sudoku") startSudoku();
  if (currentGame === "hangman") startHangman();
  if (currentGame === "crossword") startCrossword();
};

document.querySelectorAll(".numbers button").forEach(btn => {
  btn.onclick = () => {
    if (!selected || submitted || currentGame !== "sudoku") return;
    const num = Number(btn.textContent);
    const { r, c } = selected;

    if (board[r][c] !== num && num !== solution[r][c]) {
      mistakes++;
      mistakesText.textContent = mistakes;
      statusText.textContent = `Wrong number. Mistakes: ${mistakes}`;
    } else {
      statusText.textContent = "";
    }

    board[r][c] = num;
    renderSudoku();
    if (isSudokuCompleted()) statusText.textContent = "Board completed! Submit your result.";
  };
});

document.getElementById("erase").onclick = () => {
  if (!selected || submitted || currentGame !== "sudoku") return;
  const { r, c } = selected;
  if (puzzle[r][c] !== 0) return;
  board[r][c] = 0;
  renderSudoku();
};

document.getElementById("submitSudoku").onclick = () => {
  if (!isSudokuCompleted()) {
    statusText.textContent = "Sudoku is not completed correctly yet.";
    return;
  }
  sendResult({ result: sudokuResultText(), extra: "Sudoku board completed correctly." });
};

document.getElementById("submitCrossword").onclick = submitCrossword;

setInterval(() => {
  timerText.textContent = formatTime(Date.now() - startTime);
}, 1000);
