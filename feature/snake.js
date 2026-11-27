
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

const {
    randomUUID,
    randomInt
} = require("crypto");

// ==========================================
// CONFIGURATION
// ==========================================

const DICE_EMOJI = "1575805377524670605";

const games = new Map();
const avatarCache = new Map();

const TIMEOUT = 15 * 60 * 1000;

const NO_MENTIONS = {
    parse: [],
    repliedUser: false
};

const COLORS = [
    "#FF5555",
    "#55AFFF",
    "#F5D547",
    "#B878FF"
];

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

let cachedBoard = null;

// ==========================================
// DRAWING UTILITIES
// ==========================================

function box(ctx, x, y, w, h, r, color) {
    ctx.beginPath();

    ctx.roundRect(
        x, y, w, h,
        Math.min(r, w / 2, h / 2)
    );

    ctx.fillStyle = color;
    ctx.fill();
}

function text(
    ctx,
    value,
    x,
    y,
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

    const original = String(value);

    if (ctx.measureText(original).width <= width) {
        return original;
    }

    const characters = Array.from(original);

    while (
        characters.length &&
        ctx.measureText(
            characters.join("") + "…"
        ).width > width
    ) {
        characters.pop();
    }

    return characters.join("") + "…";
}

// ==========================================
// BOARD COORDINATES
// ==========================================

function getCell(position) {
    position = Math.max(
        1,
        Math.min(100, position)
    );

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
// AVATAR CACHE
// ==========================================

async function getAvatar(player) {
    if (!avatarCache.has(player.avatar)) {
        const request = (async () => {
            try {
                const response = await fetch(
                    player.avatar,
                    {
                        signal: AbortSignal.timeout(1800)
                    }
                );

                if (!response.ok) {
                    return null;
                }

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

    return await avatarCache.get(player.avatar);
}

// ==========================================
// BACKGROUND
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

    // Growtopia dirt blocks

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
// DRAW LADDERS
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

    // Wooden outline

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
// DRAW SNAKES
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

        ctx.moveTo(
            points[0].x,
            points[0].y
        );

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

    box(
        ctx,
        a.x - 18,
        a.y - 15,
        36, 30, 9,
        "#30402B"
    );

    box(
        ctx,
        a.x - 15,
        a.y - 12,
        30, 24, 7,
        color
    );

    // Eyes

    ctx.fillStyle = "#FFFFFF";

    ctx.fillRect(a.x - 10, a.y - 8, 8, 8);
    ctx.fillRect(a.x + 3, a.y - 8, 8, 8);

    ctx.fillStyle = "#162216";

    ctx.fillRect(a.x - 6, a.y - 7, 4, 5);
    ctx.fillRect(a.x + 7, a.y - 7, 4, 5);
}

// ==========================================
// STATIC BOARD CACHE
// ==========================================

// The background, numbers, snakes and ladders
// are drawn only once.
// Each turn only renders the changing players.

function getStaticBoard() {
    if (cachedBoard) {
        return cachedBoard;
    }

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    drawBackground(ctx);

    // Header

    box(ctx, 40, 25, 920, 110, 15, "#294C34");
    box(ctx, 48, 33, 904, 94, 12, "#417D38");

    text(
        ctx,
        "SNAKES & LADDERS",
        500, 65, 43,
        "#FFE68A",
        "center"
    );

    text(
        ctx,
        "NOOBV2 • GROWTOPIA",
        500, 106, 22,
        "#FFFFFF",
        "center"
    );

    // Board frame

    box(
        ctx,
        39, 144,
        922, 922,
        8,
        "#563C28"
    );

    // Draw all 100 tiles

    for (let position = 1; position <= 100; position++) {
        const { x, y } = getCell(position);

        const row = Math.floor(
            (position - 1) / 10
        );

        ctx.fillStyle =
            (position + row) % 2 === 0
                ? "#D0E99D"
                : "#A7D66F";

        ctx.fillRect(x, y, CELL, CELL);

        ctx.strokeStyle = "#648E47";
        ctx.lineWidth = 2;

        ctx.strokeRect(x, y, CELL, CELL);

        ctx.fillStyle = "#FFFFFF25";

        ctx.fillRect(
            x + 3,
            y + 3,
            CELL - 6,
            5
        );

        if (position === 1) {
            ctx.fillStyle = "#72C95A";

            ctx.fillRect(
                x + 3,
                y + 3,
                CELL - 6,
                CELL - 6
            );
        }

        if (position === 100) {
            ctx.fillStyle = "#FFDE66";

            ctx.fillRect(
                x + 3,
                y + 3,
                CELL - 6,
                CELL - 6
            );
        }
    }

    // Ladders

    Object.entries(LADDERS).forEach(
        ([start, end]) => {
            drawLadder(
                ctx,
                Number(start),
                end
            );
        }
    );

    // Snakes

    Object.entries(SNAKES).forEach(
        ([start, end], i) => {
            drawSnake(
                ctx,
                Number(start),
                end,
                i
            );
        }
    );

    // Numbers

    for (let position = 1; position <= 100; position++) {
        const { x, y } = getCell(position);

        box(
            ctx,
            x + 3,
            y + 3,
            37,
            22,
            4,
            "#FFFFFFD9"
        );

        text(
            ctx,
            position,
            x + 21,
            y + 14,
            18,
            "#29482A",
            "center"
        );

        if (position === 1) {
            text(
                ctx,
                "START",
                x + 45,
                y + 47,
                19,
                "#29482A",
                "center"
            );
        }

        if (position === 100) {
            text(
                ctx,
                "FINISH",
                x + 45,
                y + 47,
                19,
                "#6B4C17",
                "center"
            );
        }
    }

    box(
        ctx,
        40, 1080,
        920, 140,
        12,
        "#294C34"
    );

    cachedBoard = canvas;

    return cachedBoard;
}

// ==========================================
// PLAYER TOKENS
// ==========================================

function drawToken(ctx, player, avatar, index) {
    const cell = getCell(player.position);

    const offsets = [
        [23, 34],
        [66, 34],
        [23, 70],
        [66, 70]
    ];

    const [ox, oy] = offsets[index];

    const x = cell.x + ox;
    const y = cell.y + oy;

    ctx.save();

    // Outer border

    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);

    ctx.fillStyle = "#24382B";
    ctx.fill();

    // Player color

    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);

    ctx.fillStyle = player.color;
    ctx.fill();

    // Avatar

    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.clip();

    if (avatar) {
        ctx.drawImage(
            avatar,
            x - 11,
            y - 11,
            22,
            22
        );

    } else {
        text(
            ctx,
            index + 1,
            x,
            y,
            16,
            "#FFFFFF",
            "center"
        );
    }

    ctx.restore();
}

// ==========================================
// RENDER BOARD
// ==========================================

async function renderBoard(game) {
    const canvas = createCanvas(
        WIDTH,
        HEIGHT
    );

    const ctx = canvas.getContext("2d");

    // Reuse cached background

    ctx.drawImage(
        getStaticBoard(),
        0,
        0
    );

    const avatars = await Promise.all(
        game.players.map(getAvatar)
    );

    // Player positions

    game.players.forEach((player, i) => {
        if (player.position > 0) {
            drawToken(
                ctx,
                player,
                avatars[i],
                i
            );
        }
    });

    // Player information

    game.players.forEach((player, i) => {
        const x = 55 + (i % 2) * 455;
        const y = 1093 + Math.floor(i / 2) * 56;

        const active =
            game.status === "playing" &&
            game.turn === i;

        box(
            ctx,
            x, y,
            435, 48,
            7,
            active
                ? "#568D42"
                : "#365B35"
        );

        box(
            ctx,
            x + 9,
            y + 9,
            30, 30, 6,
            player.color
        );

        text(
            ctx,
            fitText(ctx, player.name, 245, 21),
            x + 50,
            y + 24,
            21
        );

        const positionText =
            player.finished
                ? `#${player.place}`
                : player.position === 0
                    ? "Start"
                    : `Tile ${player.position}`;

        text(
            ctx,
            positionText,
            x + 420,
            y + 24,
            19,
            "#FFE68A",
            "right"
        );
    });

    // JPEG reduces upload size.

    return await canvas.encode("jpeg", 90);
}

// ==========================================
// LOBBY EMBED
// ==========================================

function lobbyEmbed(game) {
    const participants = game.players.map(
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
                value:
                    `${game.players.length}/${game.maxPlayers}`,
                inline: true
            },
            {
                name: "Winners",
                value: String(game.winnerCount),
                inline: true
            },
            {
                name: "Participants",
                value:
                    participants.join("\n") ||
                    "Waiting for players..."
            }
        )

        .setThumbnail(
            `https://cdn.discordapp.com/emojis/${DICE_EMOJI}.png`
        )

        .setFooter({
            text: "The game starts automatically when full."
        });
}

// ==========================================
// GAME EMBED
// ==========================================

function gameEmbed(game) {
    const finished =
        game.status === "finished";

    const embed = new EmbedBuilder()

        .setTitle(
            finished
                ? "Game Finished!"
                : "Snakes & Ladders"
        )

        .setColor(
            finished
                ? "#F5D547"
                : "#75C64D"
        )

        .setDescription(
            "**Latest Action**\n" +
            game.lastAction
        );

    if (game.status === "playing") {
        const current =
            game.players[game.turn];

        embed.addFields({
            name: "Current Turn",
            value: `<@${current.id}>`,
            inline: true
        });
    }

    embed.addFields({
        name: "Winners",
        value:
            `${game.winners.length}/${game.winnerCount}`,
        inline: true
    });

    if (game.winners.length) {
        embed.addFields({
            name: "Final Rankings",
            value: game.winners.map(
                (player, i) =>
                    `**#${i + 1}** — <@${player.id}>`
            ).join("\n")
        });
    }

    return embed

        .setFooter({
            text: finished
                ? "NoobV2 • Game completed"
                : `NoobV2 • Turn ${game.round + 1}`
        })

        .setImage("attachment://snake.jpg");
}

// ==========================================
// BUTTONS
// ==========================================

function buildButtons(game) {
    const row = new ActionRowBuilder();

    if (game.status === "waiting") {
        row.addComponents(

            new ButtonBuilder()

                .setCustomId(
                    `snake:${game.id}:join`
                )

                .setLabel("Join Game")

                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()

                .setCustomId(
                    `snake:${game.id}:leave`
                )

                .setLabel("Leave")

                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()

                .setCustomId(
                    `snake:${game.id}:cancel`
                )

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

                .setEmoji({
                    id: DICE_EMOJI
                })

                .setLabel("Roll Dice")

                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()

                .setCustomId(
                    `snake:${game.id}:cancel`
                )

                .setLabel("End Game")

                .setStyle(ButtonStyle.Danger)
        );
    }

    return row.components.length
        ? [row]
        : [];
}

// ==========================================
// GAME PAYLOAD
// ==========================================

async function gamePayload(game) {
    const image = await renderBoard(game);

    return {
        embeds: [gameEmbed(game)],

        files: [
            new AttachmentBuilder(image, {
                name: "snake.jpg"
            })
        ],

        components: buildButtons(game),

        allowedMentions: NO_MENTIONS
    };
}

// ==========================================
// REMOVE PREVIOUS PANEL
// ==========================================

async function removeOldPanel(message) {
    if (!message) return;

    try {
        await message.delete();

    } catch (error) {
        // Unknown message: already deleted.

        if (Number(error.code) === 10008) {
            return;
        }

        console.error(
            "[SNAKE DELETE]",
            error.message
        );

        // Prevent an old panel from remaining
        // interactive if deletion fails.

        await message.edit({
            components: []
        }).catch(() => {});
    }
}

// ==========================================
// ROLLING GAME PANEL
// ==========================================

async function updateGameMessage(interaction, game) {

    // Lobby updates stay in the same message.

    if (game.status === "waiting") {
        const updated = await interaction.editReply({
            embeds: [lobbyEmbed(game)],
            components: buildButtons(game),
            allowedMentions: NO_MENTIONS
        });

        game.message = updated;

        return updated;
    }

    // Generate the new board first.

    const payload = await gamePayload(game);

    const oldMessage =
        game.message || interaction.message;

    // Upload the updated board at the bottom
    // of the channel.

    let newMessage;

    try {
        newMessage = await interaction.channel.send(
            payload
        );

    } catch (error) {

        console.error(
            "[SNAKE REPOST FALLBACK]",
            error.message
        );

        // If sending a new board fails,
        // update the existing board instead.

        const updated = await interaction.editReply({
            ...payload,
            attachments: []
        });

        game.message = updated;

        return updated;
    }

    // Register the latest panel immediately.

    game.message = newMessage;

    // Remove the old board after the new board
    // has been successfully uploaded.

    if (
        oldMessage &&
        oldMessage.id !== newMessage.id
    ) {
        await removeOldPanel(oldMessage);
    }

    return newMessage;
}

// ==========================================
// NEXT TURN
// ==========================================

function nextTurn(game) {
    for (let i = 0; i < game.players.length; i++) {
        game.turn =
            (game.turn + 1) %
            game.players.length;

        if (!game.players[game.turn].finished) {
            return;
        }
    }
}

// ==========================================
// STATE BACKUP
// ==========================================

function snapshot(game) {
    return {
        players: game.players.map(
            player => ({ ...player })
        ),

        winners: game.winners.map(
            player => ({ ...player })
        ),

        turn: game.turn,
        round: game.round,
        status: game.status,
        lastAction: game.lastAction,
        expires: game.expires,
        message: game.message
    };
}

// ==========================================
// PRIVATE RESPONSE
// ==========================================

async function privateReply(interaction, content) {
    const payload = {
        content,
        ephemeral: true,
        allowedMentions: NO_MENTIONS
    };

    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp(payload);
        } else {
            await interaction.reply(payload);
        }

    } catch {
        // Ignore expired interaction responses.
    }
}

// ==========================================
// /PLAYSNAKE
// ==========================================

async function execute(interaction) {
    if (!interaction.guild) {
        return privateReply(
            interaction,
            "Use this command in a server."
        );
    }

    const maxPlayers =
        interaction.options.getInteger(
            "players",
            true
        );

    const winnerCount =
        interaction.options.getInteger(
            "winners",
            true
        );

    if (
        !Number.isInteger(maxPlayers) ||
        maxPlayers < 2 ||
        maxPlayers > 4
    ) {
        return privateReply(
            interaction,
            "Choose between 2 and 4 players."
        );
    }

    if (
        !Number.isInteger(winnerCount) ||
        winnerCount < 1 ||
        winnerCount > maxPlayers
    ) {
        return privateReply(
            interaction,
            "Invalid number of winners."
        );
    }

    // Prevent duplicate games in one channel.

    const existing = [...games.values()].find(
        game =>
            game.channelId === interaction.channelId &&
            game.expires > Date.now() &&
            ["waiting", "playing"].includes(game.status)
    );

    if (existing) {
        return privateReply(
            interaction,

            existing.message?.url

                ? `A game is already running. [Open game](${existing.message.url})`

                : "A game is already running in this channel."
        );
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

        expires: Date.now() + TIMEOUT,

        message: null
    };

    games.set(game.id, game);

    try {
        await interaction.reply({
            embeds: [lobbyEmbed(game)],
            components: buildButtons(game),
            allowedMentions: NO_MENTIONS
        });

        const lobbyMessage =
            await interaction.fetchReply();

        if (!game.message) {
            game.message = lobbyMessage;
        }

    } catch (error) {
        games.delete(game.id);

        console.error(
            "[SNAKE EXECUTE]",
            error
        );

        await privateReply(
            interaction,
            "Unable to create the game."
        );
    }
}

// ==========================================
// INTERACTIONS
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

    if (
        !game ||
        game.expires < Date.now()
    ) {
        await privateReply(
            interaction,
            "This game has expired."
        );

        return true;
    }

    // Reject buttons from old boards.

    if (
        game.channelId !== interaction.channelId ||
        (
            game.message &&
            game.message.id !== interaction.message.id
        )
    ) {
        await interaction.deferUpdate()
            .catch(() => {});

        return true;
    }

    // Prevent simultaneous actions.

    if (game.busy) {
        await interaction.deferUpdate()
            .catch(() => {});

        return true;
    }

    game.busy = true;

    let previous = null;
    let committed = false;

    try {

        // ==================================
        // CANCEL GAME
        // ==================================

        if (action === "cancel") {
            if (
                interaction.user.id !== game.hostId
            ) {
                await privateReply(
                    interaction,
                    "Only the host can end the game."
                );

                return true;
            }

            await interaction.update({
                content: null,

                embeds: [
                    new EmbedBuilder()

                        .setTitle("Game Cancelled")

                        .setColor("#D65543")

                        .setDescription(
                            "The host has ended the game."
                        )
                ],

                attachments: [],
                components: [],
                allowedMentions: NO_MENTIONS
            });

            games.delete(id);

            return true;
        }

        // ==================================
        // LOBBY
        // ==================================

        if (game.status === "waiting") {
            if (
                !["join", "leave"].includes(action)
            ) {
                await interaction.deferUpdate();

                return true;
            }

            const existing =
                game.players.findIndex(
                    player =>
                        player.id === interaction.user.id
                );

            if (
                action === "join" &&
                existing !== -1
            ) {
                await interaction.deferUpdate();

                return true;
            }

            if (
                action === "leave" &&
                existing === -1
            ) {
                await interaction.deferUpdate();

                return true;
            }

            if (
                action === "join" &&
                game.players.length >= game.maxPlayers
            ) {
                await privateReply(
                    interaction,
                    "The lobby is full."
                );

                return true;
            }

            await interaction.deferUpdate();

            previous = snapshot(game);

            if (action === "join") {
                const player = {
                    id: interaction.user.id,

                    name:
                        interaction.member?.displayName ||
                        interaction.user.username,

                    avatar:
                        interaction.user.displayAvatarURL({
                            extension: "png",
                            size: 128
                        }),

                    position: 0,

                    finished: false,

                    place: null
                };

                game.players.push(player);

                // Preload the avatar while
                // the lobby is still waiting.

                getAvatar(player).catch(() => {});

            } else {
                game.players.splice(existing, 1);
            }

            game.players.forEach(
                (player, i) => {
                    player.color = COLORS[i];
                }
            );

            game.expires =
                Date.now() + TIMEOUT;

            // Automatically start when full.

            if (
                game.players.length === game.maxPlayers
            ) {
                game.status = "playing";

                game.turn = randomInt(
                    game.players.length
                );

                game.lastAction =
                    "The game has started!\n\n" +

                    `<@${game.players[game.turn].id}> goes first.`;
            }

            await updateGameMessage(
                interaction,
                game
            );

            committed = true;

            return true;
        }

        // ==================================
        // VALIDATE DICE
        // ==================================

        if (
            game.status !== "playing" ||
            action !== "roll"
        ) {
            await interaction.deferUpdate();

            return true;
        }

        // Block outdated buttons.

        if (Number(round) !== game.round) {
            await interaction.deferUpdate();

            return true;
        }

        const player =
            game.players[game.turn];

        // Only current player can roll.

        if (
            player.id !== interaction.user.id
        ) {
            await interaction.deferUpdate();

            return true;
        }

        // Immediately acknowledge the click.

        await interaction.deferUpdate();

        previous = snapshot(game);

        // ==================================
        // RANDOM DICE
        // ==================================

        const roll = randomInt(0, 7);

        const destination =
            player.position + roll;

        let result =

            `<:diceblock192x192:${DICE_EMOJI}> ` +

            `<@${player.id}> rolled **${roll}**!`;

        // ==================================
        // MOVEMENT
        // ==================================

        if (roll === 0) {

            result +=
                "\nNo movement this turn.";

        } else if (destination > 100) {

            result +=
                "\nAn exact roll is required to reach Tile 100.";

        } else {

            player.position = destination;

            result +=
                `\nMoved to **Tile ${destination}**.`;

            // Ladder

            if (LADDERS[player.position]) {

                player.position =
                    LADDERS[player.position];

                result +=

                    `\nClimbed a ladder to **Tile ${player.position}**!`;

            // Snake

            } else if (SNAKES[player.position]) {

                player.position =
                    SNAKES[player.position];

                result +=

                    `\nSlid down a snake to **Tile ${player.position}**!`;
            }
        }

        // ==================================
        // WINNER
        // ==================================

        if (
            player.position === 100 &&
            !player.finished
        ) {
            player.finished = true;

            player.place =
                game.winners.length + 1;

            game.winners.push({
                ...player
            });

            result +=

                `\n\n🏆 Finished in **#${player.place} place**!`;
        }

        game.round++;

        game.expires =
            Date.now() + TIMEOUT;

        if (
            game.winners.length >= game.winnerCount
        ) {
            game.status = "finished";

            result +=
                "\n\nThe game is over!";

        } else {
            nextTurn(game);
        }

        game.lastAction = result;

        // ==================================
        // REFRESH GAME PANEL
        // ==================================

        await updateGameMessage(
            interaction,
            game
        );

        committed = true;

        // No separate dice announcements.
        // No separate winner announcements.
        // No notification pings.

        if (game.status === "finished") {
            games.delete(id);
        }

    } catch (error) {

        // Restore the previous game state if
        // the updated board could not be sent.

        if (previous && !committed) {
            Object.assign(game, previous);
        }

        console.error(
            "[SNAKE INTERACTION]",
            error
        );

        await privateReply(
            interaction,
            "Unable to update the game. Please try again."
        );

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
        if (game.busy) continue;

        if (game.expires >= Date.now()) {
            continue;
        }

        games.delete(id);

        if (game.message) {

            await game.message.edit({

                content: null,

                embeds: [
                    new EmbedBuilder()

                        .setTitle("Game Expired")

                        .setColor("#808080")

                        .setDescription(
                            "This game ended due to inactivity."
                        )
                ],

                attachments: [],
                components: [],
                allowedMentions: NO_MENTIONS

            }).catch(() => {});
        }
    }

    if (avatarCache.size > 500) {
        avatarCache.clear();
    }

}, 60_000);

cleanup.unref();

// ==========================================
// PRELOAD STATIC BOARD
// ==========================================

try {
    getStaticBoard();
} catch (error) {
    console.error(
        "[SNAKE BOARD CACHE]",
        error
    );
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    execute,
    handleInteraction
};
