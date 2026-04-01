const fs = require("fs");

const FILE = "./wordbans.json";

// load
function load() {
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(FILE));
}

// save
function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// add word
function addWord(word) {
  const words = load();
  if (!words.includes(word.toLowerCase())) {
    words.push(word.toLowerCase());
    save(words);
  }
  return words;
}

function getWords() {
  return load();
}

function containsBadWord(content) {
  const words = load();

  const messageWords = content
    .toLowerCase()
    .split(/\s+/) // split by spaces

  return words.find(w => messageWords.includes(w));
}

function removeWord(word) {
  const words = load();
  const updated = words.filter(w => w !== word.toLowerCase());
  save(updated);
  return updated;
}
module.exports = {
  addWord,
  getWords,
  containsBadWord,
  removeWord
};