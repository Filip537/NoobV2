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
  const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);

  const rows = shuffle([0, 1, 2]).flatMap(g =>
    shuffle([0, 1, 2]).map(r => g * 3 + r)
  );

  const cols = shuffle([0, 1, 2]).flatMap(g =>
    shuffle([0, 1, 2]).map(c => g * 3 + c)
  );

  return rows.map(r =>
    cols.map(c => nums[pattern(r, c)])
  );
}

function makePuzzle(solution, difficulty) {
  const puzzle = solution.map(row => [...row]);

  let removeCount = 40;

  if (difficulty === "easy") removeCount = 36;
  if (difficulty === "medium") removeCount = 46;
  if (difficulty === "hard") removeCount = 56;

  const cells = shuffle([...Array(81).keys()]);

  for (let i = 0; i < removeCount; i++) {
    const cell = cells[i];
    const r = Math.floor(cell / 9);
    const c = cell % 9;
    puzzle[r][c] = 0;
  }

  return puzzle;
}

function generateSudoku(difficulty = "easy") {
  const solution = generateFullSolution();
  const puzzle = makePuzzle(solution, difficulty);

  return {
    puzzle,
    solution
  };
}

const PUZZLES = {
  easy: [],
  medium: [],
  hard: []
};