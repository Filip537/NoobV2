require("dotenv").config();

const express = require("express");
const app = express();
const { AttachmentBuilder } = require("discord.js");
app.use(express.json({ limit: "10mb" }));
app.use(express.static("sudoku"));

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Sudoku Server Running");
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

app.post("/api/sudoku-result", async (req, res) => {
  const {
    userId,
    time,
    mistakes,
    difficulty,
    mode,
    result,
    boardImage
  } = req.body;

  const channelId = "1485089713265049620";

  try {
    const client = require("./index.js");
    const channel = await client.channels.fetch(channelId);

    let files = [];

    if (boardImage) {
      const base64Data = boardImage.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const attachment = new AttachmentBuilder(buffer, {
        name: "sudoku-result.png"
      });

      files.push(attachment);
    }

    const resultText =
`**Sudoku ${mode === "daily" ? "Daily" : "Game"} Result**

Player: <@${userId}>
Difficulty: **${difficulty || "Easy"}**
Time: **${time}**
Mistakes: **${mistakes}**

${result || "Completed!"}`;

    await channel.send({
      content: resultText,
      files,
      allowedMentions: { parse: [] }
    });

    res.json({ success: true });
  } catch (err) {
    console.log("Sudoku result error:", err);
    res.status(500).json({ success: false });
  }
});
require("./index.js");