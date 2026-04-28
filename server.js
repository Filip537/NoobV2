require("dotenv").config();

const express = require("express");
const app = express();

app.use(express.json());
app.use(express.static("sudoku"));

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Sudoku Server Running");
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

app.post("/api/sudoku-result", async (req, res) => {
const { userId, channelId, time, mistakes, difficulty, mode, result } = req.body;
  try {
    const client = require("./index.js");
    const channel = await client.channels.fetch(channelId);

    const resultText =
`**Sudoku ${mode === "daily" ? "Daily" : "Game"} Result**

Player: <@${userId}>
Difficulty: **${difficulty || "Easy"}**
Time: **${time}**
Mistakes: **${mistakes}**

${result || (mistakes === 0 ? "🟩🟩🟩🟩🟩 Perfect!" : "🟩🟩🟨⬛⬛ Completed!")}`;
    await channel.send({
      content: resultText,
      allowedMentions: { parse: [] }
    });

    res.json({ success: true });
  } catch (err) {
    console.log("Sudoku result error:", err);
    res.status(500).json({ success: false });
  }
});
require("./index.js");