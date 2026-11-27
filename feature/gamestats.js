const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(
    __dirname,
    "..",
    "gameStats.json"
);

function loadStats() {
    if (!fs.existsSync(DATA_FILE)) {
        return {};
    }

    return JSON.parse(
        fs.readFileSync(DATA_FILE, "utf8")
    );
}

function saveStats(data) {
    const temp = DATA_FILE + ".tmp";

    fs.writeFileSync(
        temp,
        JSON.stringify(data, null, 2),
        "utf8"
    );

    fs.renameSync(temp, DATA_FILE);
}

function addWin(userId, category) {
    try {
        if (!["surgery", "startopia", "crime"].includes(category)) {
            return false;
        }

        const data = loadStats();

        if (!data[userId]) {
            data[userId] = {
                surgery: 0,
                startopia: 0,
                crime: 0
            };
        }

        data[userId][category] =
            Number(data[userId][category] || 0) + 1;

        saveStats(data);

        return true;

    } catch (error) {
        console.error("[GAME STATS]", error);
        return false;
    }
}

function getRankings(category) {
    return Object.entries(loadStats())
        .map(([id, data]) => ({
            id,
            score: Number(data[category] || 0)
        }))
        .filter(player => player.score > 0)
        .sort((a, b) => b.score - a.score);
}

function getUserStats(userId) {
    return loadStats()[userId] || {
        surgery: 0,
        startopia: 0,
        crime: 0
    };
}

module.exports = {
    addWin,
    getRankings,
    getUserStats
};
