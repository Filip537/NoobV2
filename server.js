require("dotenv").config();

const express = require("express");
const app = express();
const client = require("./index.js");

app.use(express.json({ limit: "10mb" }));
app.use(express.static("sudoku"));

const PORT = process.env.PORT || 3000;
const RESULT_CHANNEL_ID = "1485089713265049620";

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/sudoku/index.html");
});

app.post("/api/hangman-result", async (req, res) => {
  const { userId, word, difficulty, mistakes, result } = req.body;
  const channelId = "1485089713265049620";

  try {
    const channel = await client.channels.fetch(channelId);

    await channel.send({
      content:
`**Hangman Result**

Player: <@${userId}>
Difficulty: **${difficulty}**
Word: **${word}**
Mistakes: **${mistakes}**

${result}`,
      allowedMentions: { parse: [] }
    });

    res.json({ success: true });
  } catch (err) {
    console.log("Hangman result error:", err);
    res.status(500).json({ success: false });
  }
});

app.post("/api/crossword-result", async (req, res) => {
  const { userId, difficulty, foundWords, totalWords, result } = req.body;
  const channelId = "1485089713265049620";

  try {
    const channel = await client.channels.fetch(channelId);

    await channel.send({
      content:
`**Crossword Result**

Player: <@${userId}>
Difficulty: **${difficulty}**
Words Found: **${foundWords}/${totalWords}**

${result}`,
      allowedMentions: { parse: [] }
    });

    res.json({ success: true });
  } catch (err) {
    console.log("Crossword result error:", err);
    res.status(500).json({ success: false });
  }
});

app.listen(PORT, () => {
  console.log("Mini Games server running on port " + PORT);
});

app.post("/api/minigame-result", async (req, res) => {
  const { userId, game, difficulty, time, mistakes, result, word, extra } = req.body;

  try {
    const channel = await client.channels.fetch(RESULT_CHANNEL_ID);

    const resultText =
`**${game ? game.toUpperCase() : "MINIGAME"} Result**

Player: <@${userId}>
Difficulty: **${difficulty || "Easy"}**
Time: **${time || "Unknown"}**
Mistakes: **${mistakes ?? 0}**
Result: **${result || "Completed"}**
${word ? `Word(s): **${word}**\n` : ""}${extra || ""}`;

    await channel.send({
      content: resultText,
      allowedMentions: { parse: [] }
    });

    res.json({ success: true });
  } catch (err) {
    console.log("Mini game result error:", err);
    res.status(500).json({ success: false });
  }
});
