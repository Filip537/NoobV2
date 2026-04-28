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

require("./index.js");