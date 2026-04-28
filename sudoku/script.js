const params = new URLSearchParams(window.location.search);
const userId = params.get("user");
const channelId = params.get("channel");

let difficulty = "easy";
let mode = "normal";
let puzzle = [];
let solution = [];
let board = [];
let selected = null;
let mistakes = 0;
let startTime = Date.now();
let submitted = false;

const boardDiv = document.getElementById("board");
const info = document.getElementById("info");
const statusText = document.getElementById("status");
const timerText = document.getElementById("timer");
const mistakesText = document.getElementById("mistakesText");
const difficultyText = document.getElementById("difficultyText");
const modeText = document.getElementById("modeText");
const difficultySelect = document.getElementById("difficulty");

function cloneGrid(grid) {
  return grid.map(row => [...row]);
}

function getDailyIndex(length) {
  const today = new Date();
  const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  let total = 0;

  for (let i = 0; i < key.length; i++) {
    total += key.charCodeAt(i);
  }

  return total % length;
}

function pickPuzzle() {
  const list = PUZZLES[difficulty] || PUZZLES.easy;

  if (!list || list.length === 0) {
    return PUZZLES.easy[0];
  }

  if (mode === "daily") {
    return list[getDailyIndex(list.length)];
  }

  return list[Math.floor(Math.random() * list.length)];
}

function startGame() {
  const picked = pickPuzzle();

  puzzle = cloneGrid(picked.puzzle);
  solution = cloneGrid(picked.solution);
  board = cloneGrid(puzzle);

  selected = null;
  mistakes = 0;
  startTime = Date.now();
  submitted = false;

  info.textContent = mode === "daily"
    ? "Daily Sudoku: everyone gets the same board today."
    : "Random Sudoku: each game gives a shuffled puzzle.";

  statusText.textContent = "";
  mistakesText.textContent = "0";
  difficultyText.textContent = difficulty[0].toUpperCase() + difficulty.slice(1);
  modeText.textContent = mode === "daily" ? "Daily" : "Random";

  renderBoard();
}

function renderBoard() {
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
        if (puzzle[r][c] !== 0) return;
        selected = { r, c };
        renderBoard();
      };

      boardDiv.appendChild(cell);
    }
  }
}

document.querySelectorAll(".numbers button").forEach(btn => {
  btn.onclick = () => {
    if (!selected || submitted) return;

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
    renderBoard();

    if (isCompleted()) {
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

document.getElementById("newGame").onclick = () => {
  startGame();
};

difficultySelect.onchange = () => {
  difficulty = difficultySelect.value;
  startGame();
};

document.querySelectorAll(".mode").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".mode").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    mode = btn.dataset.mode;
    startGame();
  };
});

function isCompleted() {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== solution[r][c]) return false;
    }
  }

  return true;
}

function formatTime(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const left = sec % 60;
  return `${min}m ${left}s`;
}

function getWordleResult() {
  if (mistakes === 0) return "🟩🟩🟩🟩🟩 Perfect!";
  if (mistakes <= 2) return "🟩🟩🟩🟨⬛ Great!";
  if (mistakes <= 5) return "🟩🟩🟨⬛⬛ Completed!";
  return "🟨🟨⬛⬛⬛ Completed!";
}

document.getElementById("submit").onclick = async () => {
  if (submitted) {
    statusText.textContent = "You already submitted this result.";
    return;
  }

  if (!isCompleted()) {
    statusText.textContent = "Sudoku is not completed correctly yet.";
    return;
  }

  const time = formatTime(Date.now() - startTime);
  submitted = true;
  statusText.textContent = "Submitting result...";

  const res = await fetch("/api/sudoku-result", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      userId,
      channelId,
      time,
      mistakes,
      difficulty,
      mode,
      result: getWordleResult()
    })
  });

  statusText.textContent = res.ok
    ? "Result submitted to Discord!"
    : "Failed to submit result.";
};

setInterval(() => {
  timerText.textContent = formatTime(Date.now() - startTime);
}, 1000);

startGame();