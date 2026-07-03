const fs = require("fs");
const { EmbedBuilder } = require("discord.js");

const LEVELS_FILE = "./levels.json";

function loadLevels() {
    if (!fs.existsSync(LEVELS_FILE)) {
        fs.writeFileSync(LEVELS_FILE, "{}");
    }

    try {
        return JSON.parse(fs.readFileSync(LEVELS_FILE, "utf8"));
    } catch {
        return {};
    }
}

function saveLevels(data) {
    fs.writeFileSync(LEVELS_FILE, JSON.stringify(data, null, 2));
}

function getUser(data, id) {
    if (!data[id]) {
        data[id] = {
            xp: 0,
            level: 1,
            wl: 0
        };
    }

    if (typeof data[id].wl !== "number")
        data[id].wl = 0;

    return data[id];
}

async function handleCommand(interaction) {

    if (!interaction.isChatInputCommand())
        return false;

    // ---------------- COINFLIP ----------------

    if (interaction.commandName === "coinflip") {

        const bet = interaction.options.getInteger("bet");
        const side = interaction.options.getString("side");

        const levels = loadLevels();
        const user = getUser(levels, interaction.user.id);

        if (bet <= 0) {
            await interaction.reply({
                content: "Bet must be above 0.",
                ephemeral: true
            });
            return true;
        }

        if (user.wl < bet) {
            await interaction.reply({
                content: `You only have **${user.wl} WL**.`,
                ephemeral: true
            });
            return true;
        }

        const result = Math.random() < 0.5 ? "heads" : "tails";

        let win = result === side;

        if (win) {
            user.wl += bet;
        } else {
            user.wl -= bet;
        }

        saveLevels(levels);

        const embed = new EmbedBuilder()
            .setColor(win ? "Green" : "Red")
            .setTitle("🪙 Coin Flip")
            .setDescription(
                `**Your Choice:** ${side}\n` +
                `**Result:** ${result}\n\n` +
                (win
                    ? `🎉 You won **${bet} WL**!`
                    : `💀 You lost **${bet} WL**.`) +
                `\n\nBalance: **${user.wl} WL**`
            );

        await interaction.reply({
            embeds: [embed]
        });

        return true;
    }

    // ---------------- BLACKJACK ----------------

    if (interaction.commandName === "blackjack") {

        await interaction.reply({
            content: "🃏 Blackjack is coming soon!"
        });

        return true;
    }

    return false;
}

module.exports = {
    handleCommand
};