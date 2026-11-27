
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder
} = require("discord.js");

const {
    createCanvas,
    loadImage
} = require("@napi-rs/canvas");

const { randomUUID, randomInt } = require("crypto");

const DICE_EMOJI = "1575805377524670605";

const games = new Map();
const avatarCache = new Map();

const TIMEOUT = 15 * 60 * 1000;

const COLORS = [
    "#FF5555",
    "#55AFFF",
    "#F5D547",
    "#B878FF"
];

// ==========================================
// SNAKES AND LADDERS
// ==========================================

const LADDERS = {
    3: 22,
    8: 30,
    15: 44,
    28: 55,
    36: 57,
    51: 72,
    63: 84,
    79: 96
};

const SNAKES = {
    17: 4,
    34: 12,
    48: 25,
    62: 39,
    74: 43,
    87: 66,
    95: 75,
    99: 70
};

// ==========================================
// CANVAS SETTINGS
// ==========================================

const WIDTH = 1000;
const HEIGHT = 1280;

const BOARD_X = 50;
const BOARD_Y = 155;
const CELL = 90;

function box(ctx, x, y, w, h, r, color) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = color;
    ctx.fill();
}

function text(
    ctx, value, x, y,
    size = 24,
    color = "#FFFFFF",
    align = "left"
) {
    ctx.font = `bold ${size}px sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";

    ctx.fillText(String(value), x, y);
}

function fitText(ctx, value, width, size) {
    ctx.font = `bold ${size}px sans-serif`;

    let label = String(value);

    while (
        label.length > 1 &&
        ctx.measureText(label).width > width
    ) {
        label = label.slice(0, -1);
    }

    return label === String(value)
        ? label
        : label.slice(0, -1) + "…";
}

// ==========================================
// BOARD COORDINATES
// ==========================================

function getCell(position) {
    position = Math.max(1, Math.min(100, position));

    const index = position - 1;
    const row = Math.floor(index / 10);

    let column = index % 10;

    if (row % 2 === 1) {
        column = 9 - column;
    }

    return {
        x: BOARD_X + column * CELL,
        y: BOARD_Y + (9 - row) * CELL
    };
}

function getCenter(position) {
    const cell = getCell(position);

    return {
        x: cell.x + CELL / 2,
        y: cell.y + CELL / 2
    };
}

// ==========================================
// AVATAR LOADER
// ==========================================

async function getAvatar(player) {
    if (!avatarCache.has(player.avatar)) {
        const request = (async () => {
            try {
                const response = await fetch(
                    player.avatar,
                    {
                        signal: AbortSignal.timeout(2000)
                    }
                );

                if (!response.ok) return null;

                return await loadImage(
                    Buffer.from(
                        await response.arrayBuffer()
                    )
                );
            } catch {
                return null;
            }
        })();

        avatarCache.set(player.avatar, request);
    }

    const image = await avatarCache.get(player.avatar);

    if (!image) {
        avatarCache.delete(player.avatar);
    }

    return image;
}

// ==========================================
// GROWTOPIA BACKGROUND
// ==========================================

function drawBackground(ctx) {
    const gradient = ctx.createLinearGradient(
        0, 0, 0, HEIGHT
    );

    gradient.addColorStop(0, "#55C5F2");
    gradient.addColorStop(0.8, "#B8EDFF");
    gradient.addColorStop(1, "#73C745");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Pixel clouds
    ctx.fillStyle = "#E8F9FF";

    for (const [x, y] of [
        [30, 30],
        [760, 60],
        [350, 100]
    ]) {
        ctx.fillRect(x, y, 150, 25);
        ctx.fillRect(x + 25, y - 20, 95, 20);
    }

    // Dirt blocks
    for (let x = 0; x < WIDTH; x += 50) {
        ctx.fillStyle = "#795033";
        ctx.fillRect(x, HEIGHT - 45, 50, 45);

        ctx.fillStyle = "#A87543";
        ctx.fillRect(x + 8, HEIGHT - 25, 14, 9);

        ctx.fillStyle = "#70C83D";
        ctx.fillRect(x, HEIGHT - 50, 50, 13);
    }
}

// ==========================================
// DRAW LADDER
// ==========================================

function drawLadder(ctx, start, end) {
    const a = getCenter(start);
    const b = getCenter(end);

    const dx = b.x - a.x;
    const dy = b.y - a.y;

    const length = Math.hypot(dx, dy);

    ctx.save();

    ctx.translate(a.x, a.y);
    ctx.rotate(Math.atan2(dy, dx));

    // Dark wooden outlines
    ctx.fillStyle = "#57351D";
    ctx.fillRect(0, -18, length, 10);
    ctx.fillRect(0, 8, length, 10);

    // Wooden rails
    ctx.fillStyle = "#C48B48";
    ctx.fillRect(0, -16, length, 6);
    ctx.fillRect(0, 10, length, 6);

    // Ladder steps
    for (let x = 10; x < length; x += 25) {
        ctx.fillStyle = "#57351D";
        ctx.fillRect(x, -15, 10, 30);

        ctx.fillStyle = "#F2C078";
        ctx.fillRect(x + 2, -13, 6, 26);
    }

    ctx.restore();
}

// ==========================================
// DRAW SNAKE
// ==========================================

function drawSnake(ctx, start, end, index) {
    const a = getCenter(start);
    const b = getCenter(end);

    const colors = [
        "#4DAE38",
        "#D65543",
        "#A553CF",
        "#E6A537"
    ];

    const color = colors[index % colors.length];

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);

    const nx = -dy / length;
    const ny = dx / length;

    const points = [];

    for (let i = 0; i <= 60; i++) {
        const t = i / 60;

        const wave =
            Math.sin(t * Math.PI * 6) *
            Math.sin(t * Math.PI) * 28;

        points.push({
            x: a.x + dx * t + nx * wave,
            y: a.y + dy * t + ny * wave
        });
    }

    function drawPath(width, stroke) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (const point of points.slice(1)) {
            ctx.lineTo(point.x, point.y);
        }

        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = width;
        ctx.strokeStyle = stroke;
        ctx.stroke();
    }

    drawPath(24, "#30402B");
    drawPath(18, color);
    drawPath(5, "#FFFFFF35");

    // Snake head
    box(ctx, a.x - 18, a.y - 15, 36, 30, 9, "#30402B");
    box(ctx, a.x - 15, a.y - 12, 30, 24, 7, color);

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(a.x - 10, a.y - 8, 8, 8);
    ctx.fillRect(a.x + 3, a.y - 8, 8, 8);

    ctx.fillStyle = "#162216";
    ctx.fillRect(a.x - 6, a.y - 7, 4, 5);
    ctx.fillRect(a.x + 7, a.y - 7, 4, 5);
}

// ==========================================
// PLAYER TOKEN
// ==========================================

function drawToken(ctx, player, avatar, index) {
    const cell = getCell(player.position);

    const offsets = [
        [23, 28],
        [66, 28],
        [23, 67],
        [66, 67]
    ];

    const [ox, oy] = offsets[index];

    const x = cell.x + ox;
    const y = cell.y + oy;

    ctx.save();

    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fillStyle = "#24382B";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, 17, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.clip();

    if (avatar) {
        ctx.drawImage(
            avatar,
            x - 13,
            y - 13,
            26,
            26
        );
    } else {
        text(ctx, index + 1, x, y, 17, "#FFFFFF", "center");
    }

    ctx.restore();
}

// ==========================================
// RENDER GAME BOARD
// ==========================================

async function renderBoard(game) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    drawBackground(ctx);

    box(ctx, 40, 25, 920, 110, 15, "#294C34");
    box(ctx, 48, 33, 904, 94, 12, "#417D38");

    text(
        ctx,
        "SNAKES & LADDERS",
        500, 65, 43,
        "#FFE68A", "center"
    );

    text(
        ctx,
        "NOOBV2 • GROWTOPIA",
        500, 106, 22,
        "#FFFFFF", "center"
    );

    // Board outline
    box(ctx, 39, 144, 922, 922, 8, "#563C28");

    // Draw 100 squares
    for (let position = 1; position <= 100; position++) {
        const { x, y } = getCell(position);

        const row = Math.floor((position - 1) / 10);

        const color =
            (position + row) % 2 === 0
                ? "#D0E99D"
                : "#A7D66F";

        ctx.fillStyle = color;
        ctx.fillRect(x, y, CELL, CELL);

        ctx.strokeStyle = "#648E47";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, CELL, CELL);

        // Grass block detail
        ctx.fillStyle = "#FFFFFF25";
        ctx.fillRect(x + 3, y + 3, CELL - 6, 5);

        if (position === 1) {
            ctx.fillStyle = "#72C95A";
            ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
        }

        if (position === 100) {
            ctx.fillStyle = "#FFDE66";
            ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
        }
    }

    // Ladders
    Object.entries(LADDERS).forEach(([start, end]) => {
        drawLadder(ctx, Number(start), end);
    });

    // Snakes
    Object.entries(SNAKES).forEach(([start, end], i) => {
        drawSnake(ctx, Number(start), end, i);
    });

    // Numbers drawn above scenery
    for (let position = 1; position <= 100; position++) {
        const { x, y } = getCell(position);

        box(ctx, x + 3, y + 3, 37, 22, 4, "#FFFFFFD9");

        text(
            ctx,
            position,
            x + 21,
            y + 14,
            18,
            "#29482A",
            "center"
        );

        if (position === 100) {
            text(
                ctx, "FINISH",
                x + 45, y + 47,
                19, "#6B4C17", "center"
            );
        }

        if (position === 1) {
            text(
                ctx, "START",
                x + 45, y + 47,
                19, "#29482A", "center"
            );
        }
    }

    // Player avatars
    const avatars = await Promise.all(
        game.players.map(getAvatar)
    );

    game.players.forEach((player, i) => {
        if (player.position > 0) {
            drawToken(ctx, player, avatars[i], i);
        }
    });

    // Player information
    box(ctx, 40, 1080, 920, 140, 12, "#294C34");

    game.players.forEach((player, i) => {
        const x = 55 + (i % 2) * 455;
        const y = 1093 + Math.floor(i / 2) * 56;

        const active =
            game.status === "playing" &&
            game.turn === i;

        box(
            ctx, x, y, 435, 48, 7,
            active ? "#568D42" : "#365B35"
        );

        box(ctx, x + 9, y + 9, 30, 30, 6, player.color);

        text(
            ctx,
            fitText(ctx, player.name, 245, 21),
            x + 50, y + 24, 21
        );

        text(
            ctx,
            player.finished
                ? `#${player.place}`
                : `Tile ${player.position}`,
            x + 420, y + 24, 19,
            "#FFE68A", "right"
        );
    });

    return await canvas.encode("png");
}

// ==========================================
// GAME EMBEDS
// ==========================================

function lobbyEmbed(game) {
    const players = game.players.map(
        (player, i) =>
            `**${i + 1}.** <@${player.id}>`
    );

    return new EmbedBuilder()
        .setTitle("Snakes & Ladders")
        .setColor("#75C64D")
        .setDescription(
            "A new Growtopia board game is starting!\n\n" +
            "Press **Join Game** to participate."
        )
        .addFields(
            {
                name: "Players",
                value: `${game.players.length}/${game.maxPlayers}`,
                inline: true
            },
            {
                name: "Winners",
                value: String(game.winnerCount),
                inline: true
            },
            {
                name: "Participants",
                value: players.join("\n") || "Waiting for players..."
            }
        )
        .setThumbnail(
            `https://cdn.discordapp.com/emojis/${DICE_EMOJI}.png`
        )
        .setFooter({
            text: "The game starts automatically when full."
        });
}

function gameEmbed(game) {
    const embed = new EmbedBuilder()
        .setTitle(
            game.status === "finished"
                ? "Game Finished!"
                : "Snakes & Ladders"
        )
        .setColor("#75C64D")
        .setDescription(game.lastAction)
        .addFields({
            name: "Winners",
            value: game.winners.length
                ? game.winners.map(
                    (player, i) =>
                        `**#${i + 1}** — <@${player.id}>`
                ).join("\n")
                : "No winners yet."
        });

    if (game.status === "playing") {
        embed.addFields({
            name: "Current Turn",
            value: `<@${game.players[game.turn].id}>`
        });
    }

    return embed.setImage("attachment://snake.png");
}

// ==========================================
// BUTTONS
// ==========================================

function buildButtons(game) {
    const row = new ActionRowBuilder();

    if (game.status === "waiting") {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`snake:${game.id}:join`)
                .setLabel("Join Game")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId(`snake:${game.id}:leave`)
                .setLabel("Leave")
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setCustomId(`snake:${game.id}:cancel`)
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Danger)
        );
    }

    if (game.status === "playing") {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `snake:${game.id}:roll:${game.round}`
                )
                .setEmoji({ id: DICE_EMOJI })
                .setLabel("Roll Dice")
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId(`snake:${game.id}:cancel`)
                .setLabel("End Game")
                .setStyle(ButtonStyle.Danger)
        );
    }

    return row.components.length ? [row] : [];
}

// ==========================================
// GAME PAYLOAD
// ==========================================

async function gamePayload(game) {
    const image = await renderBoard(game);

    return {
        embeds: [gameEmbed(game)],
        attachments: [],
        files: [
            new AttachmentBuilder(image, {
                name: "snake.png"
            })
        ],
        components: buildButtons(game),
        allowedMentions: { parse: [] }
    };
}

// ==========================================
// NEXT TURN
// ==========================================

function nextTurn(game) {
    for (let i = 0; i < game.players.length; i++) {
        game.turn =
            (game.turn + 1) % game.players.length;

        if (!game.players[game.turn].finished) {
            return;
        }
    }
}

// ==========================================
// /PLAYSNAKE
// ==========================================

async function execute(interaction) {
    if (!interaction.guild) {
        return interaction.reply({
            content: "Use this command in a server.",
            ephemeral: true
        });
    }

    const maxPlayers =
        interaction.options.getInteger("players", true);

    const winnerCount =
        interaction.options.getInteger("winners", true);

    if (winnerCount > maxPlayers) {
        return interaction.reply({
            content: "Winners cannot exceed the number of players.",
            ephemeral: true
        });
    }

    const existing = [...games.values()].find(
        game =>
            game.channelId === interaction.channelId &&
            ["waiting", "playing"].includes(game.status)
    );

    if (existing) {
        return interaction.reply({
            content: "There is already an active game in this channel.",
            ephemeral: true
        });
    }

    const game = {
        id: randomUUID().slice(0, 12),
        hostId: interaction.user.id,
        channelId: interaction.channelId,
        maxPlayers,
        winnerCount,
        players: [],
        winners: [],
        turn: 0,
        round: 0,
        status: "waiting",
        busy: false,
        lastAction: "The game has started!",
        expires: Date.now() + TIMEOUT
    };

    games.set(game.id, game);

    try {
        await interaction.reply({
            embeds: [lobbyEmbed(game)],
            components: buildButtons(game),
            allowedMentions: { parse: [] }
        });

        game.message = await interaction.fetchReply();

    } catch (error) {
        games.delete(game.id);
        throw error;
    }
}

// ==========================================
// GAME INTERACTIONS
// ==========================================

async function handleInteraction(interaction) {
    if (
        !interaction.isButton() ||
        !interaction.customId.startsWith("snake:")
    ) {
        return false;
    }

    const [, id, action, round] =
        interaction.customId.split(":");

    const game = games.get(id);

    const respond = content =>
        interaction.reply({
            content,
            ephemeral: true
        });

    if (!game || game.expires < Date.now()) {
        await respond("This game has expired.");
        return true;
    }

    if (game.busy) {
        await respond("The previous action is still processing.");
        return true;
    }

    game.busy = true;

    let previous = null;
    let committed = false;

    try {
        // Cancel game
        if (action === "cancel") {
            if (interaction.user.id !== game.hostId) {
                await respond("Only the host can end the game.");
                return true;
            }

            await interaction.update({
                content: "The Snakes & Ladders game was cancelled.",
                embeds: [],
                attachments: [],
                components: []
            });

            games.delete(id);
            return true;
        }

        // Lobby
        if (game.status === "waiting") {
            if (!["join", "leave"].includes(action)) {
                await respond("Invalid lobby action.");
                return true;
            }

            const existing = game.players.findIndex(
                player => player.id === interaction.user.id
            );

            if (action === "join" && existing !== -1) {
                await respond("You have already joined.");
                return true;
            }

            if (action === "leave" && existing === -1) {
                await respond("You have not joined this game.");
                return true;
            }

            if (action === "join" &&
                game.players.length >= game.maxPlayers) {
                await respond("The lobby is full.");
                return true;
            }

            await interaction.deferUpdate();

            previous = {
                players: game.players.map(p => ({ ...p })),
                status: game.status,
                turn: game.turn,
                round: game.round,
                lastAction: game.lastAction,
                expires: game.expires
            };

            if (action === "join") {
                game.players.push({
                    id: interaction.user.id,
                    name:
                        interaction.member?.displayName ||
                        interaction.user.username,
                    avatar: interaction.user.displayAvatarURL({
                        extension: "png",
                        size: 128
                    }),
                    position: 0,
                    finished: false,
                    place: null
                });
            } else {
                game.players.splice(existing, 1);
            }

            game.players.forEach((p, i) => {
                p.color = COLORS[i];
            });

            game.expires = Date.now() + TIMEOUT;

            if (game.players.length === game.maxPlayers) {
                game.status = "playing";

                game.turn = randomInt(game.players.length);

                game.lastAction =
                    `The game has started!\n\n` +
                    `<@${game.players[game.turn].id}> goes first.`;

                await interaction.editReply(
                    await gamePayload(game)
                );

                committed = true;

            } else {
                await interaction.editReply({
                    embeds: [lobbyEmbed(game)],
                    components: buildButtons(game),
                    allowedMentions: { parse: [] }
                });

                committed = true;
            }

            return true;
        }

        // Dice roll
        if (game.status !== "playing" || action !== "roll") {
            await respond("This game is not active.");
            return true;
        }

        if (Number(round) !== game.round) {
            await respond("Please use the updated dice button.");
            return true;
        }

        const player = game.players[game.turn];

        if (player.id !== interaction.user.id) {
            await respond("It is not your turn.");
            return true;
        }

        await interaction.deferUpdate();

        previous = {
            players: game.players.map(p => ({ ...p })),
            winners: [...game.winners],
            turn: game.turn,
            round: game.round,
            status: game.status,
            lastAction: game.lastAction,
            expires: game.expires
        };

        // Random roll: 0–6 inclusive
        const roll = randomInt(0, 7);

        let destination = player.position + roll;

        let result =
            `<@${player.id}> rolled **${roll}**!`;

        if (roll === 0) {
            result += "\nNo movement this turn.";

        } else if (destination > 100) {
            result += "\nYou need an exact roll to reach Tile 100.";

        } else {
            player.position = destination;

            result += `\nMoved to **Tile ${destination}**.`;

            if (LADDERS[player.position]) {
                player.position = LADDERS[player.position];

                result +=
                    `\nClimbed a ladder to **Tile ${player.position}**!`;

            } else if (SNAKES[player.position]) {
                player.position = SNAKES[player.position];

                result +=
                    `\nSlid down a snake to **Tile ${player.position}**!`;
            }
        }

        // Winner
        if (player.position === 100 && !player.finished) {
            player.finished = true;
            player.place = game.winners.length + 1;

            game.winners.push({
                ...player
            });

            result +=
                `\n\n🏆 Finished in **#${player.place} place**!`;
        }

        game.round++;
        game.expires = Date.now() + TIMEOUT;

        if (game.winners.length >= game.winnerCount) {
            game.status = "finished";
            result += "\n\nThe game is over!";

        } else {
            nextTurn(game);
        }

        game.lastAction = result;

        // Update existing canvas
        await interaction.editReply(
            await gamePayload(game)
        );

        committed = true;

        // Public dice announcement
        await interaction.channel.send({
            content:
                `<:diceblock192x192:${DICE_EMOJI}> ` + result,
            allowedMentions: { parse: [] }
        }).catch(error => {
            console.error("[SNAKE ANNOUNCEMENT]", error);
        });

        if (game.status === "finished") {
            games.delete(id);
        }

    } catch (error) {
        if (previous && !committed) {
            Object.assign(game, previous);
        }

        console.error("[SNAKE]", error);

        const payload = {
            content: "Unable to process the game action. Try again.",
            ephemeral: true
        };

        if (interaction.deferred || interaction.replied) {
            await interaction.followUp(payload).catch(() => {});
        } else {
            await interaction.reply(payload).catch(() => {});
        }

    } finally {
        game.busy = false;
    }

    return true;
}

// ==========================================
// EXPIRED GAME CLEANUP
// ==========================================

const cleanup = setInterval(async () => {
    for (const [id, game] of games) {
        if (!game.busy && game.expires < Date.now()) {
            games.delete(id);

            await game.message?.edit({
                content: "This Snakes & Ladders game has expired.",
                components: []
            }).catch(() => {});
        }
    }

    if (avatarCache.size > 500) {
        avatarCache.clear();
    }
}, 60_000);

cleanup.unref();

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    execute,
    handleInteraction
};
