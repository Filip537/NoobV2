const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    AttachmentBuilder
} = require("discord.js");

const { createCanvas } = require("@napi-rs/canvas");
const { Chess } = require("chess.js");
const { randomUUID, randomInt } = require("crypto");

// ==========================================
// CONFIGURATION
// ==========================================

const games = new Map();

const PREFIX = "nv2chess:";
const TIMEOUT = 30 * 60 * 1000;
const LOBBY_TIMEOUT = 5 * 60 * 1000;

const NO_MENTIONS = {
    parse: [],
    repliedUser: false
};

const WIDTH = 900;
const HEIGHT = 1080;

const BOARD_X = 50;
const BOARD_Y = 120;
const CELL = 100;

const FILES = "abcdefgh";

const PIECES = {
    p: "Pawn",
    n: "Knight",
    b: "Bishop",
    r: "Rook",
    q: "Queen",
    k: "King"
};

const SYMBOLS = {
    p: "♟",
    n: "♞",
    b: "♝",
    r: "♜",
    q: "♛",
    k: "♚"
};

const COLORS = {
    light: "#D7E9B0",
    dark: "#75A657",
    white: "#FFF9E8",
    black: "#26352C",
    gold: "#FFE28A",
    panel: "#294C34",
    wood: "#523B27"
};

let cachedBoard = null;

// ==========================================
// DRAWING UTILITIES
// ==========================================

function box(ctx, x, y, w, h, radius, color) {
    ctx.beginPath();

    ctx.roundRect(
        x, y, w, h,
        Math.min(radius, w / 2, h / 2)
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

    const chars = Array.from(original);

    while (
        chars.length &&
        ctx.measureText(chars.join("") + "…").width > width
    ) {
        chars.pop();
    }

    return chars.join("") + "…";
}

// ==========================================
// BOARD COORDINATES
// ==========================================

function squarePosition(square) {
    const column = FILES.indexOf(square[0]);
    const row = 8 - Number(square[1]);

    return {
        x: BOARD_X + column * CELL,
        y: BOARD_Y + row * CELL
    };
}

function squareCenter(square) {
    const { x, y } = squarePosition(square);

    return {
        x: x + CELL / 2,
        y: y + CELL / 2
    };
}

// ==========================================
// STATIC GROWTOPIA BOARD
// ==========================================

function getStaticBoard() {
    if (cachedBoard) return cachedBoard;

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // Sky background

    const gradient = ctx.createLinearGradient(
        0, 0, 0, HEIGHT
    );

    gradient.addColorStop(0, "#50BCEB");
    gradient.addColorStop(1, "#D8F4FF");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Pixel clouds

    ctx.fillStyle = "#FFFFFFAA";

    for (const [x, y] of [
        [10, 25],
        [730, 50],
        [350, 90]
    ]) {
        ctx.fillRect(x, y, 130, 24);
        ctx.fillRect(x + 25, y - 18, 75, 20);
    }

    // Header

    box(ctx, 35, 15, 830, 80, 12, "#294C34");
    box(ctx, 43, 23, 814, 64, 9, "#417D38");

    text(
        ctx,
        "NOOBV2 CHESS",
        450, 44, 39,
        COLORS.gold,
        "center"
    );

    text(
        ctx,
        "GROWTOPIA BOARD GAMES",
        450, 74, 17,
        "#FFFFFF",
        "center"
    );

    // Wooden board frame

    box(
        ctx,
        28, 98,
        844, 844,
        10,
        COLORS.wood
    );

    // 64 chess squares

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const x = BOARD_X + col * CELL;
            const y = BOARD_Y + row * CELL;

            ctx.fillStyle =
                (row + col) % 2 === 0
                    ? COLORS.light
                    : COLORS.dark;

            ctx.fillRect(x, y, CELL, CELL);

            ctx.strokeStyle = "#00000015";
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, CELL, CELL);
        }
    }

    // Board coordinates

    for (let i = 0; i < 8; i++) {
        text(
            ctx,
            FILES[i],
            BOARD_X + i * CELL + CELL / 2,
            931,
            15,
            "#FFFFFF",
            "center"
        );

        text(
            ctx,
            8 - i,
            39,
            BOARD_Y + i * CELL + CELL / 2,
            15,
            "#FFFFFF",
            "center"
        );
    }

    // Player information panel

    box(
        ctx,
        35, 951,
        830, 92,
        12,
        COLORS.panel
    );

    // Grass and dirt blocks

    for (let x = 0; x < WIDTH; x += 45) {
        ctx.fillStyle = "#805437";
        ctx.fillRect(x, 1060, 45, 20);

        ctx.fillStyle = "#B27C49";
        ctx.fillRect(x + 7, 1068, 12, 7);

        ctx.fillStyle = "#68BA43";
        ctx.fillRect(x, 1055, 45, 11);
    }

    cachedBoard = canvas;

    return cachedBoard;
}

// ==========================================
// CHESS PIECES
// ==========================================

function drawPiece(ctx, piece, square) {
    const { x, y } = squareCenter(square);

    ctx.save();

    ctx.font = '76px "DejaVu Sans", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.shadowColor = "#00000040";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 3;

    ctx.lineJoin = "round";
    ctx.lineWidth = 3;

    ctx.strokeStyle =
        piece.color === "w"
            ? "#354438"
            : "#F2E9D0";

    ctx.fillStyle =
        piece.color === "w"
            ? COLORS.white
            : COLORS.black;

    ctx.strokeText(
        SYMBOLS[piece.type],
        x, y + 3
    );

    ctx.fillText(
        SYMBOLS[piece.type],
        x, y + 3
    );

    ctx.restore();
}

// ==========================================
// PLAYER HELPERS
// ==========================================

function currentPlayer(game) {
    return game.engine.turn() === "w"
        ? game.white
        : game.black;
}

function isParticipant(game, userId) {
    return (
        game.white?.id === userId ||
        game.black?.id === userId
    );
}

function playerName(interaction) {
    return (
        interaction.member?.displayName ||
        interaction.user.globalName ||
        interaction.user.username
    );
}

function capturedPieces(game, color) {
    return game.engine
        .history({ verbose: true })
        .filter(move =>
            move.color === color &&
            move.captured
        )
        .map(move => SYMBOLS[move.captured])
        .join(" ");
}

// ==========================================
// RENDER LIVE BOARD
// ==========================================

async function renderBoard(game) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // Reuse the cached background.

    ctx.drawImage(getStaticBoard(), 0, 0);

    const engine = game.engine;
    const board = engine.board();

    const history = engine.history({
        verbose: true
    });

    const latest = history.at(-1);

    // Highlight the previous move.

    if (latest) {
        for (const square of [
            latest.from,
            latest.to
        ]) {
            const { x, y } = squarePosition(square);

            ctx.fillStyle = "#EFD34C90";
            ctx.fillRect(x, y, CELL, CELL);
        }
    }

    // Highlight selected chess piece.

    if (game.selected) {
        const { x, y } = squarePosition(game.selected);

        ctx.fillStyle = "#FFD94DBB";
        ctx.fillRect(x, y, CELL, CELL);

        ctx.strokeStyle = "#C59C22";
        ctx.lineWidth = 4;

        ctx.strokeRect(
            x + 3, y + 3,
            CELL - 6, CELL - 6
        );
    }

    // Highlight king when in check.

    if (engine.isCheck()) {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];

                if (
                    piece &&
                    piece.type === "k" &&
                    piece.color === engine.turn()
                ) {
                    ctx.fillStyle = "#E7474788";

                    ctx.fillRect(
                        BOARD_X + col * CELL,
                        BOARD_Y + row * CELL,
                        CELL,
                        CELL
                    );
                }
            }
        }
    }

    // Draw every chess piece.

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];

            if (!piece) continue;

            drawPiece(
                ctx,
                piece,
                FILES[col] + (8 - row)
            );
        }
    }

    // Highlight legal destinations.

    if (
        game.selected &&
        game.status === "playing"
    ) {
        const moves = engine.moves({
            square: game.selected,
            verbose: true
        });

        const destinations = [
            ...new Set(
                moves.map(move => move.to)
            )
        ];

        for (const square of destinations) {
            const { x, y } = squareCenter(square);

            ctx.beginPath();

            if (engine.get(square)) {
                ctx.arc(x, y, 43, 0, Math.PI * 2);

                ctx.lineWidth = 6;
                ctx.strokeStyle = "#E3B830CC";
                ctx.stroke();

            } else {
                ctx.arc(x, y, 11, 0, Math.PI * 2);

                ctx.fillStyle = "#214D3999";
                ctx.fill();
            }
        }
    }

    // Player information.

    const players = [
        {
            player: game.white,
            color: "w",
            label: "WHITE",
            x: 48
        },
        {
            player: game.black,
            color: "b",
            label: "BLACK",
            x: 455
        }
    ];

    for (const { player, color, label, x } of players) {
        const active =
            game.status === "playing" &&
            engine.turn() === color;

        box(
            ctx,
            x, 962,
            397, 70,
            8,
            active ? "#598D45" : "#365B35"
        );

        box(
            ctx,
            x + 12, 974,
            27, 27, 5,
            color === "w"
                ? COLORS.white
                : COLORS.black
        );

        text(
            ctx,
            active ? `${label} • CURRENT TURN` : label,
            x + 50,
            980,
            15,
            COLORS.gold
        );

        text(
            ctx,
            fitText(ctx, player.name, 320, 23),
            x + 50,
            1010,
            23
        );
    }

    // JPEG compression for faster uploads.

    return await canvas.encode("jpeg", 88);
}

// ==========================================
// CUSTOM IDS
// ==========================================

function customId(game, action) {
    return `${PREFIX}${game.id}:${action}:${game.version}`;
}

function makeButton(game, action, label, style) {
    return new ButtonBuilder()
        .setCustomId(customId(game, action))
        .setLabel(label)
        .setStyle(style);
}

// ==========================================
// LOBBY EMBED
// ==========================================

function lobbyPayload(game) {
    const participants = game.players.map(
        (player, index) =>
            `**${index + 1}.** <@${player.id}>`
    );

    const embed = new EmbedBuilder()
        .setTitle("NoobV2 Chess")
        .setColor("#75C64D")
        .setDescription(
            "A new chess game is starting!\n\n" +
            "Press **Join Game** to participate."
        )
        .addFields(
            {
                name: "Players",
                value: `${game.players.length}/2`,
                inline: true
            },
            {
                name: "Game Mode",
                value: "Classic Chess",
                inline: true
            },
            {
                name: "Participants",
                value:
                    participants.join("\n") ||
                    "Waiting for players..."
            }
        )
        .setFooter({
            text: "The game starts automatically when 2 players join."
        });

    const buttons = new ActionRowBuilder()
        .addComponents(
            makeButton(
                game,
                "join",
                "Join Game",
                ButtonStyle.Success
            ),

            makeButton(
                game,
                "leave",
                "Leave",
                ButtonStyle.Secondary
            ),

            makeButton(
                game,
                "cancel",
                "Cancel",
                ButtonStyle.Danger
            )
        );

    return {
        embeds: [embed],
        components: [buttons],
        allowedMentions: NO_MENTIONS
    };
}

// ==========================================
// LIVE GAME EMBED
// ==========================================

function gameEmbed(game) {
    const engine = game.engine;

    const finished =
        game.status === "finished";

    const embed = new EmbedBuilder()
        .setTitle(
            finished
                ? "Chess • Game Finished"
                : "NoobV2 Chess"
        )
        .setColor(
            finished
                ? "#FFD54A"
                : engine.isCheck()
                    ? "#E15D51"
                    : "#75C64D"
        )
        .setDescription(
            "**Latest Action**\n" +
            game.lastAction
        )
        .addFields(
            {
                name: "White",
                value: `<@${game.white.id}>`,
                inline: true
            },
            {
                name: "Black",
                value: `<@${game.black.id}>`,
                inline: true
            }
        );

    if (!finished) {
        embed.addFields({
            name: "Current Turn",
            value:
                `<@${currentPlayer(game).id}> — ` +
                `${engine.turn() === "w" ? "White" : "Black"}` +
                (engine.isCheck() ? " • CHECK!" : "")
        });
    }

    embed.addFields(
        {
            name: "White Captures",
            value: capturedPieces(game, "w") || "None",
            inline: true
        },
        {
            name: "Black Captures",
            value: capturedPieces(game, "b") || "None",
            inline: true
        }
    );

    if (game.selected && !finished) {
        const piece = engine.get(game.selected);

        if (piece) {
            embed.addFields({
                name: "Selected Piece",
                value:
                    `${PIECES[piece.type]} — ` +
                    game.selected.toUpperCase()
            });
        }
    }

    if (game.pendingPromotion && !finished) {
        embed.addFields({
            name: "Pawn Promotion",
            value: "Choose a promotion piece below."
        });
    }

    if (game.drawOffer && !finished) {
        embed.addFields({
            name: "Draw Offer",
            value: `<@${game.drawOffer}> has offered a draw.`
        });
    }

    return embed
        .setImage("attachment://chess.jpg")
        .setFooter({
            text:
                `NoobV2 • ${engine.history().length} moves played`
        });
}

// ==========================================
// GAME COMPONENTS
// ==========================================

function gameComponents(game) {
    if (game.status !== "playing") {
        return [];
    }

    const rows = [];

    const legalMoves = game.engine.moves({
        verbose: true
    });

    // Pawn promotion dropdown.

    if (game.pendingPromotion) {
        rows.push(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(
                        customId(game, "promotion")
                    )
                    .setPlaceholder(
                        "Choose promotion piece"
                    )
                    .addOptions(
                        {
                            label: "Queen",
                            value: "q"
                        },
                        {
                            label: "Rook",
                            value: "r"
                        },
                        {
                            label: "Bishop",
                            value: "b"
                        },
                        {
                            label: "Knight",
                            value: "n"
                        }
                    )
            )
        );

    } else {

        // Select a movable chess piece.

        const movableSquares = [
            ...new Set(
                legalMoves.map(move => move.from)
            )
        ];

        if (movableSquares.length) {
            const options = movableSquares.map(
                square => {
                    const piece =
                        game.engine.get(square);

                    return {
                        label:
                            `${PIECES[piece.type]} — ` +
                            square.toUpperCase(),

                        value: square,

                        default:
                            game.selected === square
                    };
                }
            );

            rows.push(
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(
                            customId(game, "piece")
                        )
                        .setPlaceholder(
                            "Select a chess piece"
                        )
                        .addOptions(options)
                )
            );
        }

        // Select legal destination.

        if (game.selected) {
            const unique = new Map();

            for (const move of legalMoves) {
                if (
                    move.from === game.selected &&
                    !unique.has(move.to)
                ) {
                    unique.set(move.to, move);
                }
            }

            const destinations = [
                ...unique.values()
            ];

            // Maximum 25 options per Discord menu.

            for (
                let offset = 0;
                offset < destinations.length;
                offset += 25
            ) {
                const chunk = destinations.slice(
                    offset,
                    offset + 25
                );

                rows.push(
                    new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(
                                customId(
                                    game,
                                    `move${offset}`
                                )
                            )
                            .setPlaceholder(
                                offset === 0
                                    ? "Select destination"
                                    : "More destinations"
                            )
                            .addOptions(
                                chunk.map(move => ({
                                    label:
                                        `Move to ${move.to.toUpperCase()}`,

                                    value: move.to,

                                    description:
                                        move.promotion
                                            ? "Pawn promotion"
                                            : move.captured
                                                ? `Capture ${PIECES[move.captured]}`
                                                : move.san
                                }))
                            )
                    )
                );
            }
        }
    }

    // Game control buttons.

    rows.push(
        new ActionRowBuilder().addComponents(
            makeButton(
                game,
                "clear",
                "Clear",
                ButtonStyle.Secondary
            ).setDisabled(
                !game.selected &&
                !game.pendingPromotion
            ),

            makeButton(
                game,
                "draw",
                "Offer Draw",
                ButtonStyle.Secondary
            ).setDisabled(
                !!game.drawOffer
            ),

            makeButton(
                game,
                "resign",
                "Resign",
                ButtonStyle.Danger
            )
        )
    );

    // Draw offer controls.

    if (game.drawOffer) {
        rows.push(
            new ActionRowBuilder().addComponents(
                makeButton(
                    game,
                    "acceptdraw",
                    "Accept Draw",
                    ButtonStyle.Success
                ),

                makeButton(
                    game,
                    "declinedraw",
                    "Decline Draw",
                    ButtonStyle.Danger
                )
            )
        );
    }

    return rows;
}

// ==========================================
// GAME MESSAGE PAYLOAD
// ==========================================

async function gamePayload(game) {
    const image = await renderBoard(game);

    return {
        embeds: [gameEmbed(game)],

        files: [
            new AttachmentBuilder(image, {
                name: "chess.jpg"
            })
        ],

        components: gameComponents(game),

        allowedMentions: NO_MENTIONS
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
        if (
            interaction.deferred ||
            interaction.replied
        ) {
            await interaction.followUp(payload);
        } else {
            await interaction.reply(payload);
        }
    } catch {
        // Ignore expired interactions.
    }
}

async function acknowledge(interaction) {
    try {
        await interaction.deferUpdate();
        return true;
    } catch {
        return false;
    }
}

// ==========================================
// DELETE PREVIOUS PANEL
// ==========================================

async function removeOldPanel(message) {
    if (!message) return;

    try {
        await message.delete();

    } catch (error) {
        if (Number(error.code) === 10008) {
            return;
        }

        console.error(
            "[CHESS DELETE]",
            error.message
        );

        // Disable old controls if deletion fails.

        await message.edit({
            components: []
        }).catch(() => {});
    }
}

// ==========================================
// ROLLING GAME PANEL
// ==========================================

async function updatePanel(
    interaction,
    game,
    repost = false
) {
    const payload =
        game.status === "waiting"
            ? lobbyPayload(game)
            : await gamePayload(game);

    const oldMessage = game.message;

    // Lobby and piece selection:
    // edit the existing message.

    if (!repost) {
        game.message = await oldMessage.edit({
            ...payload,
            attachments: []
        });

        return;
    }

    // Completed move:
    // send updated board at bottom of chat.

    let newMessage;

    try {
        newMessage = await interaction.channel.send(
            payload
        );

    } catch (error) {
        console.error(
            "[CHESS UPLOAD FALLBACK]",
            error.message
        );

        // If repost fails, keep the game alive
        // by editing the existing board.

        game.message = await oldMessage.edit({
            ...payload,
            attachments: []
        });

        return;
    }

    // Register the new board.

    game.message = newMessage;

    // Delete previous board only after upload.

    if (
        oldMessage &&
        oldMessage.id !== newMessage.id
    ) {
        await removeOldPanel(oldMessage);
    }
}

// ==========================================
// FINISH GAME
// ==========================================

function finishGame(game, result) {
    game.status = "finished";
    game.lastAction = result;

    game.selected = null;
    game.pendingPromotion = null;
    game.drawOffer = null;
}

// ==========================================
// CHECKMATE AND DRAW DETECTION
// ==========================================

function checkResult(game) {
    const engine = game.engine;

    // Checkmate.

    if (engine.isCheckmate()) {
        const winner =
            engine.turn() === "w"
                ? game.black
                : game.white;

        finishGame(
            game,
            game.lastAction +
            "\n\n**CHECKMATE!**\n" +
            `<@${winner.id}> wins the game!`
        );

        return;
    }

    // Draw conditions.

    let reason = null;

    if (engine.isStalemate()) {
        reason = "Stalemate";

    } else if (
        engine.isInsufficientMaterial()
    ) {
        reason = "Insufficient material";

    } else if (
        engine.isThreefoldRepetition()
    ) {
        reason = "Threefold repetition";

    } else if (engine.isDraw()) {
        reason = "Fifty-move rule";
    }

    if (reason) {
        finishGame(
            game,
            game.lastAction +
            `\n\n**DRAW — ${reason}.**`
        );

        return;
    }

    if (engine.isCheck()) {
        game.lastAction += "\n\n**Check!**";
    }
}

// ==========================================
// APPLY CHESS MOVE
// ==========================================

function applyMove(game, from, to, promotion) {
    const player = currentPlayer(game);

    const options = { from, to };

    if (promotion) {
        options.promotion = promotion;
    }

    const move = game.engine.move(options);

    game.lastAction =
        `<@${player.id}> moved **${PIECES[move.piece]}**\n` +
        `**${from.toUpperCase()} → ${to.toUpperCase()}**\n` +
        `Notation: \`${move.san}\``;

    if (move.captured) {
        game.lastAction +=
            `\nCaptured **${PIECES[move.captured]}**.`;
    }

    if (move.promotion) {
        game.lastAction +=
            `\nPromoted to **${PIECES[move.promotion]}**.`;
    }

    if (
        move.flags.includes("k") ||
        move.flags.includes("q")
    ) {
        game.lastAction +=
            "\nCastling performed.";
    }

    game.selected = null;
    game.pendingPromotion = null;
    game.drawOffer = null;

    checkResult(game);
}

// ==========================================
// STATE BACKUP
// ==========================================

function snapshot(game) {
    return {
        historyLength: game.engine.history().length,

        players: game.players.map(
            player => ({ ...player })
        ),

        white: game.white,
        black: game.black,

        selected: game.selected,

        pendingPromotion:
            game.pendingPromotion
                ? { ...game.pendingPromotion }
                : null,

        drawOffer: game.drawOffer,

        resignRequests: new Map(game.resignRequests),

        status: game.status,
        lastAction: game.lastAction,

        version: game.version,
        expires: game.expires,

        message: game.message
    };
}

function restore(game, saved) {
    // Undo failed moves while preserving history.

    while (
        game.engine.history().length >
        saved.historyLength
    ) {
        game.engine.undo();
    }

    const {
        historyLength,
        ...state
    } = saved;

    Object.assign(game, state);
}

// ==========================================
// /CHESS COMMAND
// ==========================================

async function execute(interaction) {
    if (!interaction.guild) {
        return privateReply(
            interaction,
            "Use this command inside a server."
        );
    }

    // Prevent multiple chess games in one channel.

    const existing = [...games.values()].find(
        game =>
            game.channelId === interaction.channelId &&
            game.expires > Date.now() &&
            game.status !== "finished"
    );

    if (existing) {
        return privateReply(
            interaction,
            existing.message?.url
                ? `A chess game is already running. [Open game](${existing.message.url})`
                : "A chess game is already running."
        );
    }

    const game = {
        id: randomUUID().slice(0, 12),

        hostId: interaction.user.id,
        channelId: interaction.channelId,

        players: [],

        white: null,
        black: null,

        engine: new Chess(),

        status: "waiting",

        selected: null,
        pendingPromotion: null,
        drawOffer: null,

        resignRequests: new Map(),

        version: 0,
        busy: false,

        lastAction: "",
        message: null,

        expires: Date.now() + LOBBY_TIMEOUT,

        lobbyQueue: Promise.resolve()
    };

    games.set(game.id, game);

    try {
        await interaction.reply(
            lobbyPayload(game)
        );

        const message =
            await interaction.fetchReply();

        if (!game.message) {
            game.message = message;
        }

    } catch (error) {
        games.delete(game.id);

        console.error(
            "[CHESS EXECUTE]",
            error
        );

        await privateReply(
            interaction,
            "Unable to create the chess lobby."
        );
    }
}

// ==========================================
// PROCESS LOBBY ACTION
// ==========================================

async function processLobby(
    interaction,
    game,
    action
) {
    if (games.get(game.id) !== game) return;
    if (game.status !== "waiting") return;
    if (game.expires < Date.now()) return;

    const userId = interaction.user.id;

    const saved = snapshot(game);

    game.busy = true;

    try {
        // Host cancels lobby.

        if (action === "cancel") {
            if (userId !== game.hostId) return;

            await game.message.edit({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Chess Game Cancelled")
                        .setColor("#D65543")
                        .setDescription(
                            "The host has cancelled the game."
                        )
                ],

                components: [],
                attachments: [],
                allowedMentions: NO_MENTIONS
            });

            games.delete(game.id);

            return;
        }

        const index = game.players.findIndex(
            player => player.id === userId
        );

        // Join game.

        if (action === "join") {
            if (index !== -1) return;
            if (game.players.length >= 2) return;

            game.players.push({
                id: userId,
                name: playerName(interaction)
            });

        // Leave game.

        } else if (action === "leave") {
            if (index === -1) return;

            game.players.splice(index, 1);

        } else {
            return;
        }

        game.expires =
            Date.now() + LOBBY_TIMEOUT;

        // Wait until two players join.

        if (game.players.length < 2) {
            await updatePanel(
                interaction,
                game,
                false
            );

            return;
        }

        // Randomly assign White and Black.

        const firstIsWhite =
            randomInt(0, 2) === 0;

        game.white = firstIsWhite
            ? game.players[0]
            : game.players[1];

        game.black = firstIsWhite
            ? game.players[1]
            : game.players[0];

        // Automatically start game.

        game.status = "playing";
        game.version++;

        game.expires =
            Date.now() + TIMEOUT;

        game.lastAction =
            "**The chess game has started!**\n\n" +
            `<@${game.white.id}> plays White.\n` +
            `<@${game.black.id}> plays Black.\n\n` +
            "White moves first.";

        // Generate board and remove lobby.

        await updatePanel(
            interaction,
            game,
            true
        );

    } catch (error) {
        restore(game, saved);

        console.error(
            "[CHESS LOBBY]",
            error
        );

        await privateReply(
            interaction,
            "Unable to update the lobby. Try again."
        );

    } finally {
        game.busy = false;
    }
}

// ==========================================
// RESIGNATION CONFIRMATION
// ==========================================

async function handleResignation(
    interaction,
    game,
    action,
    version,
    token
) {
    const userId = interaction.user.id;

    const request = game.resignRequests.get(userId);

    if (
        game.status !== "playing" ||
        Number(version) !== game.version ||
        !isParticipant(game, userId) ||
        !request ||
        request.token !== token ||
        request.expires < Date.now()
    ) {
        await interaction.update({
            content: "This resignation request has expired.",
            components: []
        }).catch(() => {});

        return true;
    }

    if (action === "cancelresign") {
        game.resignRequests.delete(userId);

        await interaction.update({
            content: "Resignation cancelled.",
            components: []
        }).catch(() => {});

        return true;
    }

    if (game.busy) {
        await privateReply(
            interaction,
            "A move is processing. Please try again."
        );

        return true;
    }

    game.busy = true;

    const saved = snapshot(game);

    let committed = false;

    try {
        if (!await acknowledge(interaction)) {
            return true;
        }

        const winner =
            userId === game.white.id
                ? game.black
                : game.white;

        game.resignRequests.delete(userId);

        finishGame(
            game,
            `<@${userId}> resigned.\n\n` +
            `**Winner:** <@${winner.id}>`
        );

        game.version++;

        await updatePanel(
            interaction,
            game,
            true
        );

        committed = true;

        games.delete(game.id);

        await interaction.editReply({
            content: "You have resigned.",
            components: []
        }).catch(() => {});

    } catch (error) {
        if (!committed) {
            restore(game, saved);
        }

        console.error(
            "[CHESS RESIGN]",
            error
        );

        await privateReply(
            interaction,
            "Unable to resign. Try again."
        );

    } finally {
        game.busy = false;
    }

    return true;
}

// ==========================================
// MAIN INTERACTION HANDLER
// ==========================================

async function handleInteraction(interaction) {
    if (
        !interaction.isButton() &&
        !interaction.isStringSelectMenu()
    ) {
        return false;
    }

    if (!interaction.customId.startsWith(PREFIX)) {
        return false;
    }

    const [
        id,
        action,
        version,
        token
    ] = interaction.customId
        .slice(PREFIX.length)
        .split(":");

    const game = games.get(id);

    // Expired game.

    if (
        !game ||
        game.expires < Date.now()
    ) {
        await privateReply(
            interaction,
            "This chess game has expired."
        );

        return true;
    }

    if (game.channelId !== interaction.channelId) {
        await acknowledge(interaction);

        return true;
    }

    const userId = interaction.user.id;

    // Resignation confirmation is private.

    if (
        action === "confirmresign" ||
        action === "cancelresign"
    ) {
        return handleResignation(
            interaction,
            game,
            action,
            version,
            token
        );
    }

    // Ignore buttons from previous panels.

    if (
        (
            game.message &&
            game.message.id !== interaction.message.id
        ) ||
        Number(version) !== game.version
    ) {
        await acknowledge(interaction);

        return true;
    }

    // ======================================
    // WAITING LOBBY
    // ======================================

    if (game.status === "waiting") {
        if (
            action === "cancel" &&
            userId !== game.hostId
        ) {
            await privateReply(
                interaction,
                "Only the host can cancel the lobby."
            );

            return true;
        }

        if (
            !["join", "leave", "cancel"].includes(action)
        ) {
            await acknowledge(interaction);

            return true;
        }

        if (!await acknowledge(interaction)) {
            return true;
        }

        if (!game.message) {
            game.message = interaction.message;
        }

        // Queue simultaneous joins.

        game.lobbyQueue = game.lobbyQueue
            .catch(() => {})
            .then(() =>
                processLobby(
                    interaction,
                    game,
                    action
                )
            );

        await game.lobbyQueue;

        return true;
    }

    // ======================================
    // VALIDATE PLAYER
    // ======================================

    if (
        game.status !== "playing" ||
        !isParticipant(game, userId)
    ) {
        await acknowledge(interaction);

        return true;
    }

    // Prevent overlapping moves.

    if (game.busy) {
        await acknowledge(interaction);

        return true;
    }

    game.busy = true;

    let saved = null;
    let committed = false;

    try {
        const isCurrent =
            currentPlayer(game).id === userId;

        // ==================================
        // RESIGN BUTTON
        // ==================================

        if (action === "resign") {
            const token =
                randomUUID().slice(0, 12);

            game.resignRequests.set(userId, {
                token,
                expires: Date.now() + 60_000
            });

            await interaction.reply({
                content: "Are you sure you want to resign?",

                ephemeral: true,

                allowedMentions: NO_MENTIONS,

                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                customId(
                                    game,
                                    "confirmresign"
                                ) + `:${token}`
                            )
                            .setLabel("Confirm Resignation")
                            .setStyle(ButtonStyle.Danger),

                        new ButtonBuilder()
                            .setCustomId(
                                customId(
                                    game,
                                    "cancelresign"
                                ) + `:${token}`
                            )
                            .setLabel("Cancel")
                            .setStyle(ButtonStyle.Secondary)
                    )
                ]
            });

            return true;
        }

        // ==================================
        // OFFER DRAW
        // ==================================

        if (action === "draw") {
            if (game.drawOffer) {
                await acknowledge(interaction);

                return true;
            }

            if (!await acknowledge(interaction)) {
                return true;
            }

            saved = snapshot(game);

            game.drawOffer = userId;

            game.version++;

            game.expires =
                Date.now() + TIMEOUT;

            await updatePanel(
                interaction,
                game,
                false
            );

            committed = true;

            return true;
        }

        // ==================================
        // ACCEPT OR DECLINE DRAW
        // ==================================

        if (
            action === "acceptdraw" ||
            action === "declinedraw"
        ) {
            if (
                !game.drawOffer ||
                game.drawOffer === userId
            ) {
                await acknowledge(interaction);

                return true;
            }

            if (!await acknowledge(interaction)) {
                return true;
            }

            saved = snapshot(game);

            if (action === "acceptdraw") {
                finishGame(
                    game,
                    "**DRAW — Mutual agreement.**"
                );

            } else {
                game.drawOffer = null;

                game.lastAction =
                    "The draw offer was declined.";
            }

            game.version++;

            game.expires =
                Date.now() + TIMEOUT;

            await updatePanel(
                interaction,
                game,
                action === "acceptdraw"
            );

            committed = true;

            if (game.status === "finished") {
                games.delete(id);
            }

            return true;
        }

        // Only the current player can move.

        if (!isCurrent) {
            await acknowledge(interaction);

            return true;
        }

        // ==================================
        // SELECT CHESS PIECE
        // ==================================

        if (
            action === "piece" &&
            interaction.isStringSelectMenu()
        ) {
            const square =
                interaction.values[0];

            const piece =
                game.engine.get(square);

            const moves =
                game.engine.moves({
                    square,
                    verbose: true
                });

            if (
                !piece ||
                piece.color !== game.engine.turn() ||
                !moves.length
            ) {
                await privateReply(
                    interaction,
                    "This piece has no legal moves."
                );

                return true;
            }

            if (!await acknowledge(interaction)) {
                return true;
            }

            saved = snapshot(game);

            game.selected = square;
            game.pendingPromotion = null;

            game.version++;

            game.expires =
                Date.now() + TIMEOUT;

            // Edit existing board.

            await updatePanel(
                interaction,
                game,
                false
            );

            committed = true;

            return true;
        }

        // ==================================
        // CLEAR SELECTION
        // ==================================

        if (action === "clear") {
            if (!await acknowledge(interaction)) {
                return true;
            }

            saved = snapshot(game);

            game.selected = null;
            game.pendingPromotion = null;

            game.version++;

            game.expires =
                Date.now() + TIMEOUT;

            await updatePanel(
                interaction,
                game,
                false
            );

            committed = true;

            return true;
        }

        // ==================================
        // SELECT DESTINATION
        // ==================================

        if (
            action.startsWith("move") &&
            interaction.isStringSelectMenu()
        ) {
            if (
                !game.selected ||
                game.pendingPromotion
            ) {
                await acknowledge(interaction);

                return true;
            }

            const destination =
                interaction.values[0];

            const moves = game.engine.moves({
                square: game.selected,
                verbose: true
            }).filter(
                move => move.to === destination
            );

            if (!moves.length) {
                await privateReply(
                    interaction,
                    "That move is not legal."
                );

                return true;
            }

            if (!await acknowledge(interaction)) {
                return true;
            }

            saved = snapshot(game);

            // Pawn promotion.

            if (
                moves.some(move => move.promotion)
            ) {
                game.pendingPromotion = {
                    from: game.selected,
                    to: destination
                };

                game.version++;

                game.expires =
                    Date.now() + TIMEOUT;

                await updatePanel(
                    interaction,
                    game,
                    false
                );

                committed = true;

                return true;
            }

            // Complete the legal move.

            applyMove(
                game,
                game.selected,
                destination
            );

            game.version++;

            game.expires =
                Date.now() + TIMEOUT;

            game.resignRequests.clear();

            // Repost updated board and
            // automatically delete old board.

            await updatePanel(
                interaction,
                game,
                true
            );

            committed = true;

            if (game.status === "finished") {
                games.delete(id);
            }

            return true;
        }

        // ==================================
        // PAWN PROMOTION
        // ==================================

        if (
            action === "promotion" &&
            game.pendingPromotion &&
            interaction.isStringSelectMenu()
        ) {
            const promotion =
                interaction.values[0];

            if (
                !["q", "r", "b", "n"].includes(promotion)
            ) {
                await acknowledge(interaction);

                return true;
            }

            if (!await acknowledge(interaction)) {
                return true;
            }

            saved = snapshot(game);

            const { from, to } =
                game.pendingPromotion;

            applyMove(
                game,
                from,
                to,
                promotion
            );

            game.version++;

            game.expires =
                Date.now() + TIMEOUT;

            game.resignRequests.clear();

            await updatePanel(
                interaction,
                game,
                true
            );

            committed = true;

            if (game.status === "finished") {
                games.delete(id);
            }

            return true;
        }

        await acknowledge(interaction);

    } catch (error) {

        // Restore previous state if upload fails.

        if (saved && !committed) {
            restore(game, saved);
        }

        console.error(
            "[CHESS INTERACTION]",
            error
        );

        await privateReply(
            interaction,
            "Unable to update the chess game. Try again."
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
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Chess Game Expired")
                        .setColor("#808080")
                        .setDescription(
                            "The game ended due to inactivity."
                        )
                ],

                attachments: [],
                components: [],
                allowedMentions: NO_MENTIONS

            }).catch(() => {});
        }
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
        "[CHESS BOARD CACHE]",
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
