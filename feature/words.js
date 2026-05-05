const fs = require("fs");

const FILE = "./wordbans.json";

function load() {
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function addWord(word) {
  const words = load();
  const clean = word.toLowerCase().trim();

  if (!words.includes(clean)) {
    words.push(clean);
    save(words);
  }

  return words;
}

function getWords() {
  return load();
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsBadWord(content) {
  const words = load();
  const text = content.toLowerCase();

  return words.find(word => {
    const safeWord = escapeRegex(word.toLowerCase());
    const regex = new RegExp(`(^|[^a-zA-Z0-9])${safeWord}([^a-zA-Z0-9]|$)`, "i");
    return regex.test(text);
  });
}

function removeWord(word) {
  const words = load();
  const updated = words.filter(w => w !== word.toLowerCase().trim());
  save(updated);
  return updated;
}

module.exports = {
  addWord,
  getWords,
  containsBadWord,
  removeWord
};