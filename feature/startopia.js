
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    AttachmentBuilder,
    EmbedBuilder
} = require("discord.js");

const { createCanvas, loadImage } = require("canvas");

// ==========================================
// CONFIGURATION
// ==========================================

const SESSION_TIMEOUT = 15 * 60 * 1000;
const STARTING_TOOLS = 10;

const sessions = new Map();
const progress = new Map();
const imageCache = new Map();

// ==========================================
// STARTOPIA EMOJIS
// ==========================================

const TOOLS = {
    drone: {
        name: "Tactical Drone",
        id: "1575760158989090986"
    },
    tele: {
        name: "Teleporter Charge",
        id: "1575760176382746664"
    },
    scan: {
        name: "Quadriscanner",
        id: "1575760161270931489"
    },
    ai: {
        name: "AI Brain",
        id: "1575760156107743303"
    },
    diplomat: {
        name: "Cyborg Diplomat",
        id: "1575760191599808542"
    },
    documents: {
        name: "Stellar Documents",
        id: "1575760170993057913"
    },
    bolt: {
        name: "Galactibolt",
        id: "1575760179041931294"
    },
    blaster: {
        name: "Gigablaster",
        id: "1575760186461651064"
    },
    torpedo: {
        name: "Growton Torpedo",
        id: "1575760181709508718"
    },
    shield: {
        name: "HyperShields",
        id: "1575760163619741726"
    },
    meds: {
        name: "Space Meds",
        id: "1575760168342261780"
    },
    supplies: {
        name: "Star Supplies",
        id: "1575760184054382613"
    }
};

const FUEL_ID = "1575760193977847918";
const BACKGROUND_ID = "1575760173925011548";

// ==========================================
// SECTORS
// ==========================================

const SECTORS = [
    { name: "Alpha Sector", required: 0, damage: 5 },
    { name: "Beta Sector", required: 5, damage: 7 },
    { name: "Delta Sector", required: 15, damage: 9 },
    { name: "Epsilon Sector", required: 30, damage: 12 },
    { name: "Galactic Nexus", required: 50, damage: 15 },
    { name: "Growlactus", required: 75, damage: 20 }
];

// ==========================================
// MISSION DATABASE
// ==========================================

const MISSIONS = [
    {
        name: "Set a Course",
        min: 0,
        steps: ["drone", "documents"]
    },
    {
        name: "Salvage Run",
        min: 0,
        steps: ["drone", "tele", "scan", "tele"]
    },
    {
        name: "Ship Rescue",
        min: 0,
        steps: ["drone", "tele", "scan", "meds", "tele"]
    },
    {
        name: "Parasite Hunt",
        min: 0,
        steps: ["drone", "tele", "scan", "blaster", "tele"]
    },
    {
        name: "Pirate Attack",
        min: 0,
        steps: ["drone", "shield", "torpedo", "torpedo"]
    },
    {
        name: "Data Recovery",
        min: 0,
        steps: ["drone", "tele", "scan", "tele", "documents"]
    },
    {
        name: "Taking Aim",
        min: 1,
        steps: ["drone", "tele", "blaster", "tele"]
    },
    {
        name: "Windy Days",
        min: 1,
        steps: ["drone", "tele", "scan", "tele"]
    },
    {
        name: "Solar Impact",
        min: 1,
        steps: ["shield", "bolt", "meds", "ai", "drone"]
    },
    {
        name: "Ancient Temple",
        min: 1,
        steps: ["drone", "diplomat", "supplies", "documents"]
    },
    {
        name: "Miner Rescue",
        min: 1,
        steps: ["bolt", "drone", "tele", "scan", "tele", "tele"]
    },
    {
        name: "A Strange One",
        min: 2,
        steps: ["drone", "diplomat", "bolt", "ai", "documents"]
    },
    {
        name: "Dark Ship",
        min: 2,
        steps: ["drone", "tele", "ai", "torpedo", "torpedo"]
    },
    {
        name: "Giant Skeleton",
        min: 2,
        steps: ["drone", "ai", "shield", "supplies"]
    },
    {
        name: "Ghost Ship",
        min: 2,
        steps: ["drone", "tele", "scan", "diplomat", "documents", "tele"]
    },
    {
        name: "Junk Punks",
        min: 2,
        steps: ["ai", "drone", "torpedo", "ai"]
    },
    {
        name: "Secret Stash",
        min: 3,
        steps: ["drone", "shield", "tele", "blaster", "scan", "tele"]
    },
    {
        name: "Life Pod",
        min: 3,
        steps: ["drone", "ai", "torpedo", "tele", "scan", "meds", "supplies"]
    },
    {
        name: "Prevent War",
        min: 3,
        steps: ["shield", "drone", "diplomat", "tele", "documents", "bolt", "supplies"]
    },
    {
        name: "Cryonite Crisis",
        min: 4,
        steps: ["tele", "scan", "blaster", "scan", "ai", "ai", "documents", "tele"]
    },
    {
        name: "Shadow Stalkers",
        min: 4,
        steps: ["drone", "tele", "scan", "ai", "blaster", "tele", "scan", "tele", "torpedo"]
    },
    {
        name: "Growlactus!",
        min: 5,
        steps: [
            "drone",
            "shield",
            "torpedo",
            "diplomat",
            "blaster",
            "ai",
            "tele",
            "scan",
            "blaster",
            "tele"
        ]
    }
];

// ==========================================
// ENCOUNTER DESCRIPTIONS
// ==========================================

const DESCRIPTIONS = {
    drone: "Something unfamiliar has appeared near your starship. You need to investigate the surrounding area.",

    tele: "Your crew is standing by. They must be transported to their destination to continue the mission.",

    scan: "An unidentified object has been discovered. Further examination is required.",

    ai: "Your ship's computer is struggling to process unusual signals. Advanced technological assistance is needed.",

    diplomat: "An alien civilization has contacted your crew. A peaceful resolution may be possible.",

    documents: "The situation requires official authorization before your crew can proceed.",

    bolt: "Warning! Your starship has sustained damage. Immediate repairs are required.",

    blaster: "Hostile creatures are attacking your crew! Defend them before it is too late.",

    torpedo: "A hostile target is threatening your starship. Prepare to engage!",

    shield: "Incoming attack detected! Your ship requires additional protection.",

    meds: "Several crew members are injured and require medical treatment.",

    supplies: "Your crew needs additional resources to resolve the current situation."
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function clamp(value) {
    return Math.max(0, Math.min(100, value));
}

function random(min, max) {
    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;
}

function getProgress(userId) {
    if (!progress.has(userId)) {
        progress.set(userId, {
            completed: 0,
            failed: 0
        });
    }

    return progress.get(userId);
}

function getMission(sector) {
    if (sector === 5) {
        return MISSIONS.find(m => m.min === 5);
    }

    const available = MISSIONS.filter(
        m => m.min <= sector && m.min < 5
    );

    return available[random(0, available.length - 1)];
}

// ==========================================
// CREATE GAME SESSION
// ==========================================

function createSession(userId, sector) {
    const mission = getMission(sector);

    const inventory = Object.fromEntries(
        Object.keys(TOOLS).map(key => [
            key,
            STARTING_TOOLS
        ])
    );

    return {
        userId,
        sector,
        mission,
        inventory,

        ship: 100,
        crew: 100,
        reputation: 100,

        scanner: "(No target right now)",

        step: 0,
        turns: 0,
        fuel: 5,

        status: "active",
        busy: false,

        message: sector === 5
            ? "The starry brilliance of the Galactic Nexus splits and wavers. A cold dread grips your heart as darkness pounds in your mind. Something is here, and it craves your ruin."
            : DESCRIPTIONS[mission.steps[0]],

        feedback: "",

        expires: Date.now() + SESSION_TIMEOUT
    };
}

// ==========================================
// EMOJI IMAGE LOADER
// ==========================================

async function getEmojiImage(id) {
    if (!imageCache.has(id)) {
        const request = (async () => {
            const controller = new AbortController();

            const timeout = setTimeout(
                () => controller.abort(),
                3500
            );

            try {
                const response = await fetch(
                    `https://cdn.discordapp.com/emojis/${id}.png?size=128`,
                    {
                        signal: controller.signal
                    }
                );

                if (!response.ok) {
                    return null;
                }

                const buffer = Buffer.from(
                    await response.arrayBuffer()
                );

                return await loadImage(buffer);

            } catch {
                return null;

            } finally {
                clearTimeout(timeout);
            }
        })();

        imageCache.set(id, request);
    }

    const image = await imageCache.get(id);

    if (!image) {
        imageCache.delete(id);
    }

    return image;
}

// ==========================================
// CANVAS HELPERS
// ==========================================

function text(
    ctx,
    value,
    x,
    y,
    size = 26,
    color = "#fffbdc"
) {
    ctx.font = `bold ${size}px Arial`;
    ctx.textAlign = "left";

    ctx.fillStyle = color;
    ctx.strokeStyle = "rgba(0, 25, 45, 0.50)";
    ctx.lineWidth = 2;

    ctx.strokeText(String(value), x, y);
    ctx.fillText(String(value), x, y);
}

function wrapText(
    ctx,
    value,
    x,
    y,
    maxWidth,
    size = 25,
    color = "#fffbdc"
) {
    ctx.font = `bold ${size}px Arial`;

    const words = String(value).split(" ");
    let line = "";

    for (const word of words) {
        const test = line + word + " ";

        if (
            ctx.measureText(test).width > maxWidth &&
            line
        ) {
            text(
                ctx,
                line.trim(),
                x,
                y,
                size,
                color
            );

            line = word + " ";
            y += size + 9;

        } else {
            line = test;
        }
    }

    if (line) {
        text(
            ctx,
            line.trim(),
            x,
            y,
            size,
            color
        );
    }

    return y;
}

function statColor(value) {
    if (value >= 65) return "#79e344";
    if (value >= 30) return "#ffdc55";

    return "#ff5555";
}

function drawStat(ctx, label, value, x, y) {
    text(ctx, label, x, y, 26);

    const width = ctx.measureText(label).width;

    text(
        ctx,
        `${value}%`,
        x + width + 10,
        y,
        26,
        statColor(value)
    );
}

// ==========================================
// GROWTOPIA STARTOPIA CANVAS
// ==========================================

async function renderCanvas(game) {
    const canvas = createCanvas(1000, 720);
    const ctx = canvas.getContext("2d");

    ctx.imageSmoothingEnabled = false;

    // Background

    const gradient = ctx.createLinearGradient(
        0, 0, 0, 720
    );

    gradient.addColorStop(0, "#267797");
    gradient.addColorStop(1, "#103d56");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1000, 720);

    // Outer border

    ctx.strokeStyle = "#0b3549";
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, 988, 708);

    ctx.strokeStyle = "#519bb0";
    ctx.lineWidth = 3;
    ctx.strokeRect(15, 15, 970, 690);

    // Header

    ctx.fillStyle = "rgba(0, 30, 48, 0.35)";
    ctx.fillRect(20, 20, 960, 65);

    let title = game.mission.name;
    let titleColor = "#fff1ab";

    if (game.sector === 5) {
        titleColor = "#ff5757";
    }

    if (game.status === "success") {
        title = "Star Voyage Successful!";
        titleColor = "#82ee57";
    }

    if (game.status === "failed") {
        title = "Star Voyage Failed!";
        titleColor = "#ff5757";
    }

    if (game.status === "warped") {
        title = "Emergency Warp";
        titleColor = "#ffcc55";
    }

    text(
        ctx,
        title,
        40,
        65,
        37,
        titleColor
    );

    // Health statistics

    drawStat(
        ctx,
        "Ship Health:",
        game.ship,
        35,
        125
    );

    drawStat(
        ctx,
        "Crew Health:",
        game.crew,
        35,
        165
    );

    drawStat(
        ctx,
        "Reputation:",
        game.reputation,
        560,
        125
    );

    // Scanner

    text(
        ctx,
        `Scanners: ${game.scanner}`,
        35,
        205,
        25,
        "#e9dfab"
    );

    ctx.fillStyle = "#68a1b4";
    ctx.fillRect(35, 225, 930, 2);

    // Mission description

    wrapText(
        ctx,
        game.message,
        35,
        267,
        930,
        26
    );

    // Feedback

    if (game.feedback) {
        wrapText(
            ctx,
            game.feedback,
            35,
            390,
            930,
            21,
            "#f7e6a8"
        );
    }

    // Star tools background

    ctx.fillStyle = "rgba(0, 23, 38, 0.40)";
    ctx.fillRect(25, 440, 950, 215);

    text(
        ctx,
        "Star Tools:",
        40,
        470,
        25
    );

    const entries = Object.entries(TOOLS);

    const loadedImages = await Promise.all([
        getEmojiImage(BACKGROUND_ID),

        getEmojiImage(FUEL_ID),

        ...entries.map(([, tool]) =>
            getEmojiImage(tool.id)
        )
    ]);

    const background = loadedImages[0];
    const fuelImage = loadedImages[1];

    // Draw tool inventory

    for (let i = 0; i < entries.length; i++) {
        const [key, tool] = entries[i];

        const col = i % 6;
        const row = Math.floor(i / 6);

        const x = 45 + col * 155;
        const y = 482 + row * 83;

        if (background) {
            ctx.drawImage(
                background,
                x,
                y,
                73,
                73
            );

        } else {
            ctx.fillStyle = "#0c3446";
            ctx.fillRect(x, y, 73, 73);

            ctx.strokeStyle = "#92afb7";
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, 73, 73);
        }

        const image = loadedImages[i + 2];

        ctx.globalAlpha =
            game.inventory[key] > 0 ? 1 : 0.30;

        if (image) {
            ctx.drawImage(
                image,
                x,
                y,
                73,
                73
            );

        } else {
            text(
                ctx,
                tool.name.slice(0, 3),
                x + 8,
                y + 40,
                20
            );
        }

        ctx.globalAlpha = 1;

        // Tool quantity

        text(
            ctx,
            String(game.inventory[key]),
            x + 49,
            y + 66,
            20,
            "#ffffff"
        );
    }

    // Footer

    if (fuelImage) {
        ctx.drawImage(
            fuelImage,
            35,
            666,
            35,
            35
        );
    }

    text(
        ctx,
        `Star Fuel: ${game.fuel}`,
        80,
        693,
        23
    );

    text(
        ctx,
        SECTORS[game.sector].name,
        565,
        693,
        23,
        "#cceaff"
    );

    return new AttachmentBuilder(
        canvas.toBuffer("image/png"),
        {
            name: "startopia.png"
        }
    );
}

// ==========================================
// TOOL BUTTONS
// ==========================================

function buildButtons(game) {
    const keys = Object.keys(TOOLS);
    const rows = [];

    for (let i = 0; i < keys.length; i += 5) {
        const row = new ActionRowBuilder();

        for (const key of keys.slice(i, i + 5)) {
            const button = new ButtonBuilder()

                .setCustomId(
                    `startopia:tool:${game.userId}:${key}`
                )

                .setEmoji({
                    id: TOOLS[key].id
                })

                .setStyle(ButtonStyle.Secondary)

                .setDisabled(
                    game.status !== "active" ||
                    game.inventory[key] <= 0
                );

            row.addComponents(button);
        }

        rows.push(row);
    }

    // Emergency warp button

    const controls = new ActionRowBuilder();

    if (game.status === "active") {
        controls.addComponents(
            new ButtonBuilder()

                .setCustomId(
                    `startopia:warp:${game.userId}`
                )

                .setLabel("Emergency Warp")

                .setStyle(ButtonStyle.Danger)

                .setEmoji({
                    id: FUEL_ID
                })
        );

    } else {
        controls.addComponents(
            new ButtonBuilder()

                .setCustomId(
                    `startopia:menu:${game.userId}`
                )

                .setLabel("New Star Voyage")

                .setStyle(ButtonStyle.Success)
        );
    }

    rows.push(controls);

    return rows;
}

// ==========================================
// MISSION LOGIC
// ==========================================

function useTool(game, key) {
    if (!TOOLS[key]) return;

    if (game.inventory[key] <= 0) {
        game.feedback =
            "You have run out of this tool!";

        return;
    }

    game.inventory[key]--;
    game.turns++;

    const expected =
        game.mission.steps[game.step];

    const difficulty =
        SECTORS[game.sector].damage;

    // Correct tool

    if (key === expected) {
        game.step++;

        game.feedback =
            `${TOOLS[key].name} was used successfully!`;

        if (key === "drone") {
            game.scanner = "Target located";
        }

        if (key === "scan") {
            game.scanner = "Analysis complete";
        }

        if (key === "bolt") {
            game.ship = clamp(game.ship + 30);
        }

        if (key === "meds") {
            game.crew = clamp(game.crew + 30);
        }

        if (key === "supplies") {
            game.reputation = clamp(
                game.reputation + 25
            );
        }

        // Mission completed

        if (
            game.step >= game.mission.steps.length
        ) {
            game.status = "success";

            getProgress(game.userId).completed++;

            game.scanner = "Mission complete";

            game.message =
                "Your crew has successfully completed the star voyage and returned safely. Well done, Captain!";

            return;
        }

        game.message =
            DESCRIPTIONS[
                game.mission.steps[game.step]
            ];

        if (
            game.sector >= 2 &&
            random(1, 100) <= 35
        ) {
            game.ship -= random(1, difficulty);
        }

    // Repair ship

    } else if (
        key === "bolt" &&
        game.ship < 100
    ) {
        game.ship = clamp(game.ship + 30);

        game.feedback =
            "Your starship has been repaired.";

    // Heal crew

    } else if (
        key === "meds" &&
        game.crew < 100
    ) {
        game.crew = clamp(game.crew + 30);

        game.feedback =
            "Your injured crew has recovered.";

    // Recover reputation

    } else if (
        key === "supplies" &&
        game.reputation < 100
    ) {
        game.reputation = clamp(
            game.reputation + 25
        );

        game.feedback =
            "Your reputation has improved.";

    // Incorrect tool

    } else {
        const damage = random(
            difficulty,
            difficulty + 7
        );

        const affected = random(1, 3);

        if (affected === 1) {
            game.ship -= damage;

            game.feedback =
                `Tool failed! Ship Health -${damage}%.`;

        } else if (affected === 2) {
            game.crew -= damage;

            game.feedback =
                `Tool failed! Crew Health -${damage}%.`;

        } else {
            game.reputation -= damage;

            game.feedback =
                `Tool failed! Reputation -${damage}%.`;
        }
    }

    game.ship = clamp(game.ship);
    game.crew = clamp(game.crew);
    game.reputation = clamp(game.reputation);

    // Mission failure

    if (
        game.ship === 0 ||
        game.crew === 0 ||
        game.reputation === 0
    ) {
        game.status = "failed";

        game.fuel = Math.max(
            0,
            game.fuel - 1
        );

        getProgress(game.userId).failed++;

        game.message =
            "Your starship can no longer continue the voyage. Your crew has been forced to retreat.";
    }

    game.expires =
        Date.now() + SESSION_TIMEOUT;
}

// ==========================================
// SECTOR SELECTION MENU
// ==========================================

function sectorMenu(userId) {
    const stats = getProgress(userId);

    const embed = new EmbedBuilder()

        .setColor("#246b91")

        .setTitle("Startopia — Star Voyage")

        .setDescription(
            "Welcome aboard, Captain!\n\n" +
            "Select a sector to begin your star voyage."
        )

        .addFields(
            {
                name: "Successful Voyages",
                value: String(stats.completed),
                inline: true
            },
            {
                name: "Failed Voyages",
                value: String(stats.failed),
                inline: true
            },
            {
                name: "Available Tools",
                value: "10 of each Star Tool",
                inline: false
            }
        )

        .setThumbnail(
            `https://cdn.discordapp.com/emojis/${FUEL_ID}.png`
        )

        .setFooter({
            text: "Explore the galaxy and complete your missions."
        });

    const menu = new StringSelectMenuBuilder()

        .setCustomId(
            `startopia:sector:${userId}`
        )

        .setPlaceholder(
            "Select a Star Sector"
        )

        .addOptions(
            SECTORS.map((sector, index) => ({
                label: sector.name,

                value: String(index),

                description:
                    stats.completed >= sector.required

                        ? "Available — Begin a Star Voyage"

                        : `Locked — Requires ${sector.required} voyages`,

                emoji: {
                    id: FUEL_ID
                }
            }))
        );

    return {
        embeds: [embed],

        components: [
            new ActionRowBuilder()
                .addComponents(menu)
        ]
    };
}

// ==========================================
// GAME MESSAGE
// ==========================================

async function gamePayload(game) {
    const attachment = await renderCanvas(game);

    return {
        content: null,

        embeds: [],

        attachments: [],

        files: [attachment],

        components: buildButtons(game)
    };
}

// ==========================================
// /STARTOPIA COMMAND
// ==========================================

async function execute(interaction) {
    const active = sessions.get(
        interaction.user.id
    );

    if (
        active &&
        active.status === "active" &&
        active.expires > Date.now()
    ) {
        return interaction.reply({
            content:
                "You already have an active Star Voyage. Finish it or use Emergency Warp first.",

            ephemeral: true
        });
    }

    sessions.delete(interaction.user.id);

    return interaction.reply(
        sectorMenu(interaction.user.id)
    );
}

// ==========================================
// INTERACTION HANDLER
// ==========================================

async function handleInteraction(interaction) {
    if (
        !interaction.isButton() &&
        !interaction.isStringSelectMenu()
    ) {
        return false;
    }

    if (
        !interaction.customId.startsWith("startopia:")
    ) {
        return false;
    }

    const [, action, ownerId, key] =
        interaction.customId.split(":");

    // Prevent other users from playing

    if (interaction.user.id !== ownerId) {
        await interaction.reply({
            content:
                "This Star Voyage belongs to another player!",

            ephemeral: true
        });

        return true;
    }

    let lockedGame = null;

    try {
        // Sector selection

        if (action === "sector") {
            const sector = Number(
                interaction.values[0]
            );

            const stats = getProgress(ownerId);

            if (
                !Number.isInteger(sector) ||
                !SECTORS[sector]
            ) {
                await interaction.reply({
                    content: "Invalid sector.",
                    ephemeral: true
                });

                return true;
            }

            if (
                stats.completed <
                SECTORS[sector].required
            ) {
                await interaction.reply({
                    content:
                        `Complete ${SECTORS[sector].required} Star Voyages to unlock this sector.`,

                    ephemeral: true
                });

                return true;
            }

            const existing = sessions.get(ownerId);

            if (
                existing &&
                existing.status === "active" &&
                existing.expires > Date.now()
            ) {
                await interaction.reply({
                    content:
                        "You already have an active voyage.",

                    ephemeral: true
                });

                return true;
            }

            const game = createSession(
                ownerId,
                sector
            );

            game.busy = true;

            game.messageId =
                interaction.message.id;

            sessions.set(ownerId, game);

            lockedGame = game;

            await interaction.deferUpdate();

            await interaction.editReply(
                await gamePayload(game)
            );

            return true;
        }

        // Find active session

        const game = sessions.get(ownerId);

        if (
            !game ||
            game.expires < Date.now() ||
            game.messageId !== interaction.message.id
        ) {
            await interaction.reply({
                content:
                    "This Star Voyage has expired. Use /startopia again.",

                ephemeral: true
            });

            return true;
        }

        // Prevent button spamming

        if (game.busy) {
            await interaction.reply({
                content:
                    "Your previous action is still processing.",

                ephemeral: true
            });

            return true;
        }

        // Start another mission

        if (action === "menu") {
            if (game.status === "active") {
                await interaction.reply({
                    content:
                        "Finish your current voyage first.",

                    ephemeral: true
                });

                return true;
            }

            sessions.delete(ownerId);

            await interaction.update({
                ...sectorMenu(ownerId),

                content: null,

                attachments: []
            });

            return true;
        }

        if (game.status !== "active") {
            await interaction.reply({
                content:
                    "This voyage has already ended.",

                ephemeral: true
            });

            return true;
        }

        game.busy = true;
        lockedGame = game;

        await interaction.deferUpdate();

        // Tool selection

        if (action === "tool") {
            useTool(game, key);
        }

        // Emergency warp

        if (action === "warp") {
            game.status = "warped";

            game.fuel = Math.max(
                0,
                game.fuel - 1
            );

            game.feedback =
                "One Star Fuel was consumed.";

            game.message =
                "Your starship has safely warped away from the encounter.";

            getProgress(ownerId).failed++;
        }

        // Refresh canvas

        await interaction.editReply(
            await gamePayload(game)
        );

        return true;

    } catch (error) {
        console.error("[STARTOPIA]", error);

        const response = {
            content:
                "An error occurred while processing your Star Voyage.",

            ephemeral: true
        };

        try {
            if (
                interaction.deferred ||
                interaction.replied
            ) {
                await interaction.followUp(response);

            } else {
                await interaction.reply(response);
            }

        } catch {}

        return true;

    } finally {
        if (lockedGame) {
            lockedGame.busy = false;
        }
    }
}

// ==========================================
// SESSION CLEANUP
// ==========================================

const cleanup = setInterval(() => {
    for (const [userId, game] of sessions) {
        if (
            !game.busy &&
            game.expires < Date.now()
        ) {
            sessions.delete(userId);
        }
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
