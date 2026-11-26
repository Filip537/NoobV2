const fs = require("fs");
const path = require("path");

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

// ==========================================
// CONFIGURATION
// ==========================================

const CHANNEL_ID = "1575351200809754674";
const GUILD_ID = "1411983843442823272";
const OWNER_ID = "1108921222030426172";

const PANEL_TITLE = "Bot Customization";

const PANEL_FILE = path.join(
    __dirname,
    "..",
    "customizationPanel.json"
);

const PREFIX = "botcustom:";

let updating = false;
let starting = false;

// ==========================================
// CUSTOMIZATION OPTIONS
// ==========================================

const OPTIONS = {
    avatar: {
        label: "Bot Avatar",
        description: "Change the global bot avatar",
        image: true,
        global: true
    },

    banner: {
        label: "Bot Banner",
        description: "Change the global bot banner",
        image: true,
        global: true
    },

    username: {
        label: "Bot Username",
        description: "Change the global bot username",
        maxLength: 32,
        global: true
    },

    nickname: {
        label: "Server Nickname",
        description: "Change the bot nickname in this server",
        maxLength: 32
    },

    description: {
        label: "Description",
        description: "Change the application description",
        maxLength: 400,
        paragraph: true,
        global: true
    },

    guildavatar: {
        label: "Server Avatar",
        description: "Change the avatar for this server only",
        image: true
    },

    guildbanner: {
        label: "Server Banner",
        description: "Change the banner for this server only",
        image: true
    },

    guildbio: {
        label: "Server Biography",
        description: "Change the biography for this server",
        maxLength: 190,
        paragraph: true
    },

    icon: {
        label: "Application Icon",
        description: "Change the Discord application icon",
        image: true,
        global: true
    }
};

// ==========================================
// PERMISSION CHECK
// ==========================================

function canAccess(interaction) {
    if (interaction.guildId !== GUILD_ID) {
        return false;
    }

    if (interaction.channelId !== CHANNEL_ID) {
        return false;
    }

    return (
        interaction.user.id === OWNER_ID ||
        interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
        )
    );
}

function isOwner(interaction) {
    return interaction.user.id === OWNER_ID;
}

// ==========================================
// PANEL DATA
// ==========================================

function loadPanelData() {
    try {
        if (!fs.existsSync(PANEL_FILE)) {
            return {};
        }

        return JSON.parse(
            fs.readFileSync(PANEL_FILE, "utf8")
        );

    } catch (error) {
        console.error(
            "[BOT CUSTOMIZATION] Panel data error:",
            error.message
        );

        return {};
    }
}

function savePanelData(data) {
    fs.writeFileSync(
        PANEL_FILE,
        JSON.stringify(data, null, 2)
    );
}

// ==========================================
// BUILD PANEL
// ==========================================

function buildPanel(guild) {
    const embed = new EmbedBuilder()
        .setTitle(PANEL_TITLE)
        .setColor(0xF1C40F)
        .setDescription(
            "Manage the appearance and identity of NoobV2.\n\n" +

            "**Bot Avatar**\n" +
            "Change the bot's global profile picture.\n\n" +

            "**Bot Banner**\n" +
            "Change the bot's global profile banner.\n\n" +

            "**Bot Username**\n" +
            "Modify the bot's global username.\n\n" +

            "**Server Nickname**\n" +
            "Modify the bot's nickname in this server.\n\n" +

            "**Description**\n" +
            "Update the application's description.\n\n" +

            "**Server Avatar and Banner**\n" +
            "Customize the bot's appearance in this server only.\n\n" +

            "**Server Biography**\n" +
            "Update the server-specific biography.\n\n" +

            "**Application Icon**\n" +
            "Change the application's icon.\n\n" +

            "Global settings are restricted to the bot owner."
        )
        .setFooter({
            text: "NoobV2 • Customization Dashboard"
        });

    const thumbnail = guild.iconURL({
        extension: "png",
        size: 256
    });

    if (thumbnail) {
        embed.setThumbnail(thumbnail);
    }

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`${PREFIX}select`)
        .setPlaceholder(
            "Select a customization option"
        )
        .addOptions(
            Object.entries(OPTIONS).map(
                ([key, option]) => ({
                    label: option.label,
                    description: option.description,
                    value: key
                })
            )
        );

    const selectRow = new ActionRowBuilder()
        .addComponents(menu);

    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`${PREFIX}view`)
                .setLabel("View Profile")
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setCustomId(`${PREFIX}refresh`)
                .setLabel("Refresh Panel")
                .setStyle(ButtonStyle.Secondary)
        );

    return {
        embeds: [embed],
        components: [selectRow, buttonRow],
        allowedMentions: {
            parse: []
        }
    };
}

// ==========================================
// AUTOMATIC PANEL ON STARTUP
// ==========================================

async function start(client) {
    if (starting) return;

    starting = true;

    try {
        const channel = await client.channels.fetch(
            CHANNEL_ID
        );

        if (
            !channel ||
            !channel.isTextBased() ||
            channel.guildId !== GUILD_ID
        ) {
            throw new Error(
                "Customization channel not found."
            );
        }

        const panel = buildPanel(channel.guild);
        const saved = loadPanelData();

        let existing = null;

        if (saved.messageId) {
            existing = await channel.messages
                .fetch(saved.messageId)
                .catch(() => null);
        }

        if (
            existing &&
            existing.author.id !== client.user.id
        ) {
            existing = null;
        }

        if (!existing) {
            const messages = await channel.messages.fetch({
                limit: 100
            });

            existing = messages.find(message =>
                message.author.id === client.user.id &&
                message.embeds[0]?.title === PANEL_TITLE
            );
        }

        if (existing) {
            await existing.edit(panel);

            savePanelData({
                messageId: existing.id,
                channelId: CHANNEL_ID
            });

            console.log(
                "[BOT CUSTOMIZATION] Existing panel updated."
            );

        } else {
            const message = await channel.send(panel);

            savePanelData({
                messageId: message.id,
                channelId: CHANNEL_ID
            });

            console.log(
                "[BOT CUSTOMIZATION] New panel created."
            );
        }

    } catch (error) {
        console.error(
            "[BOT CUSTOMIZATION] Startup failed:",
            error.message
        );

    } finally {
        starting = false;
    }
}

// ==========================================
// BUILD CUSTOMIZATION MODAL
// ==========================================

function buildModal(key) {
    const option = OPTIONS[key];

    const modal = new ModalBuilder()
        .setCustomId(`${PREFIX}modal:${key}`)
        .setTitle(option.label);

    const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel(
            option.image
                ? "Discord image URL"
                : "Enter new value"
        )
        .setStyle(
            option.paragraph
                ? TextInputStyle.Paragraph
                : TextInputStyle.Short
        )
        .setRequired(true)
        .setMaxLength(
            option.image
                ? 2000
                : option.maxLength || 400
        );

    if (option.image) {
        input.setPlaceholder(
            "Paste a Discord image link or type reset"
        );

    } else if (key === "nickname") {
        input.setPlaceholder(
            "Enter nickname or type reset"
        );

    } else {
        input.setPlaceholder(
            `Enter new ${option.label.toLowerCase()}`
        );
    }

    modal.addComponents(
        new ActionRowBuilder().addComponents(input)
    );

    return modal;
}

// ==========================================
// DOWNLOAD AND VALIDATE IMAGE
// ==========================================

async function downloadImage(value) {
    let url;

    try {
        url = new URL(value);

    } catch {
        throw new Error("Invalid image URL.");
    }

    const allowedHosts = [
        "cdn.discordapp.com",
        "media.discordapp.net"
    ];

    if (
        url.protocol !== "https:" ||
        !allowedHosts.includes(url.hostname) ||
        url.username ||
        url.password ||
        (url.port && url.port !== "443")
    ) {
        throw new Error(
            "Please use a valid Discord CDN image link."
        );
    }

    const response = await fetch(url.href, {
        signal: AbortSignal.timeout(10000),
        redirect: "error"
    });

    if (!response.ok) {
        throw new Error(
            `Image download failed: HTTP ${response.status}`
        );
    }

    const MAX_SIZE = 8 * 1024 * 1024;

    const length = Number(
        response.headers.get("content-length") || 0
    );

    if (length > MAX_SIZE) {
        throw new Error(
            "Image must be smaller than 8 MB."
        );
    }

    if (!response.body) {
        throw new Error("Image response was empty.");
    }

    const reader = response.body.getReader();

    const chunks = [];
    let total = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            total += value.length;

            if (total > MAX_SIZE) {
                await reader.cancel();

                throw new Error(
                    "Image must be smaller than 8 MB."
                );
            }

            chunks.push(Buffer.from(value));
        }

    } finally {
        reader.releaseLock();
    }

    const buffer = Buffer.concat(chunks);

    // Validate and convert static images to PNG.
    // Sharp is already used by your index.js.

    const sharp = require("sharp");

    const image = sharp(buffer, {
        limitInputPixels: 20000000
    });

    const metadata = await image.metadata();

    if (
        !["png", "jpeg", "webp", "gif"]
            .includes(metadata.format)
    ) {
        throw new Error(
            "Unsupported image format."
        );
    }

    const processed = await image
        .resize({
            width: 1024,
            height: 1024,
            fit: "inside",
            withoutEnlargement: true
        })
        .png()
        .toBuffer();

    if (processed.length > MAX_SIZE) {
        throw new Error(
            "Processed image exceeds the size limit."
        );
    }

    return `data:image/png;base64,${processed.toString("base64")}`;
}

// ==========================================
// APPLY CUSTOMIZATION
// ==========================================

async function applyCustomization(
    interaction,
    key,
    value
) {
    const client = interaction.client;
    const guild = interaction.guild;
    const option = OPTIONS[key];

    if (!option) {
        throw new Error(
            "Unknown customization option."
        );
    }

    if (option.global && !isOwner(interaction)) {
        throw new Error(
            "Only the bot owner can change global settings."
        );
    }

    const reset = value.toLowerCase() === "reset";

    let image = null;

    if (option.image && !reset) {
        image = await downloadImage(value);
    }

    const globalUserRoute = "/users/@me";

    const applicationRoute = "/applications/@me";

    const memberRoute =
        `/guilds/${guild.id}/members/@me`;

    switch (key) {
        // ==================================
        // GLOBAL AVATAR
        // ==================================

        case "avatar":

            await client.rest.patch(
                globalUserRoute,
                {
                    body: {
                        avatar: image
                    }
                }
            );

            break;

        // ==================================
        // GLOBAL BANNER
        // ==================================

        case "banner":

            await client.rest.patch(
                globalUserRoute,
                {
                    body: {
                        banner: image
                    }
                }
            );

            break;

        // ==================================
        // GLOBAL USERNAME
        // ==================================

        case "username":

            if (value.length < 2) {
                throw new Error(
                    "Username must contain at least 2 characters."
                );
            }

            await client.user.setUsername(value);

            break;

        // ==================================
        // SERVER NICKNAME
        // ==================================

        case "nickname":

            await client.rest.patch(
                memberRoute,
                {
                    body: {
                        nick: reset ? null : value
                    }
                }
            );

            break;

        // ==================================
        // APPLICATION DESCRIPTION
        // ==================================

        case "description":

            await client.rest.patch(
                applicationRoute,
                {
                    body: {
                        description: reset ? "" : value
                    }
                }
            );

            break;

        // ==================================
        // SERVER AVATAR
        // ==================================

        case "guildavatar":

            await client.rest.patch(
                memberRoute,
                {
                    body: {
                        avatar: image
                    }
                }
            );

            break;

        // ==================================
        // SERVER BANNER
        // ==================================

        case "guildbanner":

            await client.rest.patch(
                memberRoute,
                {
                    body: {
                        banner: image
                    }
                }
            );

            break;

        // ==================================
        // SERVER BIOGRAPHY
        // ==================================

        case "guildbio":

            await client.rest.patch(
                memberRoute,
                {
                    body: {
                        bio: reset ? "" : value
                    }
                }
            );

            break;

        // ==================================
        // APPLICATION ICON
        // ==================================

        case "icon":

            await client.rest.patch(
                applicationRoute,
                {
                    body: {
                        icon: image
                    }
                }
            );

            break;

        default:

            throw new Error(
                "Unsupported customization option."
            );
    }
}

// ==========================================
// VIEW CURRENT BOT PROFILE
// ==========================================

async function viewProfile(interaction) {
    await interaction.deferReply({
        flags: MessageFlags.Ephemeral
    });

    const client = interaction.client;

    const [user, application, member] =
        await Promise.all([
            client.rest.get("/users/@me"),

            client.rest.get("/applications/@me"),

            interaction.guild.members.fetchMe({
                force: true
            })
        ]);

    const embed = new EmbedBuilder()
        .setTitle("Current Bot Profile")
        .setColor(0xF1C40F)
        .addFields(
            {
                name: "Username",
                value: user.username,
                inline: true
            },
            {
                name: "Server Nickname",
                value:
                    member.nickname || "Not set",
                inline: true
            },
            {
                name: "Bot ID",
                value: client.user.id,
                inline: false
            },
            {
                name: "Description",
                value:
                    application.description?.slice(0, 1024) ||
                    "Not set"
            }
        )
        .setFooter({
            text: "NoobV2 • Customization Dashboard"
        });

    if (member.displayAvatarURL()) {
        embed.setThumbnail(
            member.displayAvatarURL({
                size: 256
            })
        );
    }

    const banner =
        member.bannerURL?.({
            size: 1024
        }) ||
        (
            user.banner
                ? `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.png?size=1024`
                : null
        );

    if (banner) {
        embed.setImage(banner);
    }

    await interaction.editReply({
        embeds: [embed],
        allowedMentions: {
            parse: []
        }
    });
}

// ==========================================
// ERROR RESPONSE
// ==========================================

async function sendError(interaction, error) {
    console.error(
        "[BOT CUSTOMIZATION]",
        error.name,
        error.code || "",
        error.message
    );

    const message = String(
        error.message || "Unknown error"
    ).slice(0, 1000);

    const payload = {
        embeds: [
            new EmbedBuilder()
                .setTitle("Customization Failed")
                .setColor(0xED4245)
                .setDescription(message)
                .setFooter({
                    text: "NoobV2"
                })
        ],
        allowedMentions: {
            parse: []
        }
    };

    try {
        if (interaction.deferred) {
            await interaction.editReply(payload);

        } else if (interaction.replied) {
            await interaction.followUp({
                ...payload,
                flags: MessageFlags.Ephemeral
            });

        } else {
            await interaction.reply({
                ...payload,
                flags: MessageFlags.Ephemeral
            });
        }

    } catch (replyError) {
        console.error(
            "[BOT CUSTOMIZATION] Reply failed:",
            replyError.message
        );
    }
}

// ==========================================
// INTERACTION HANDLER
// ==========================================

async function handle(interaction) {
    if (
        !interaction.customId?.startsWith(PREFIX)
    ) {
        return false;
    }

    try {
        if (!canAccess(interaction)) {
            await interaction.reply({
                content:
                    "You do not have permission to use this dashboard.",
                flags: MessageFlags.Ephemeral
            });

            return true;
        }

        // ==================================
        // DROPDOWN
        // ==================================

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId === `${PREFIX}select`
        ) {
            const key = interaction.values[0];

            const option = OPTIONS[key];

            if (!option) {
                throw new Error(
                    "Invalid customization option."
                );
            }

            if (
                option.global &&
                !isOwner(interaction)
            ) {
                await interaction.reply({
                    content:
                        "Only the bot owner can modify global bot settings.",
                    flags: MessageFlags.Ephemeral
                });

                return true;
            }

            await interaction.showModal(
                buildModal(key)
            );

            return true;
        }

        // ==================================
        // MODAL SUBMISSION
        // ==================================

        if (
            interaction.isModalSubmit() &&
            interaction.customId.startsWith(
                `${PREFIX}modal:`
            )
        ) {
            const key =
                interaction.customId.split(":")[2];

            const option = OPTIONS[key];

            if (!option) {
                throw new Error(
                    "Invalid customization option."
                );
            }

            if (
                option.global &&
                !isOwner(interaction)
            ) {
                throw new Error(
                    "Only the bot owner can change this setting."
                );
            }

            if (updating) {
                await interaction.reply({
                    content:
                        "Another customization is currently being processed.",
                    flags: MessageFlags.Ephemeral
                });

                return true;
            }

            const value = interaction.fields
                .getTextInputValue("value")
                .trim();

            if (!value) {
                throw new Error(
                    "The value cannot be empty."
                );
            }

            updating = true;

            try {
                await interaction.deferReply({
                    flags: MessageFlags.Ephemeral
                });

                await applyCustomization(
                    interaction,
                    key,
                    value
                );

                const embed = new EmbedBuilder()
                    .setTitle("Customization Updated")
                    .setColor(0x57F287)
                    .setDescription(
                        `**${option.label}** has been successfully updated.`
                    )
                    .setFooter({
                        text: "NoobV2"
                    })
                    .setTimestamp();

                await interaction.editReply({
                    embeds: [embed],
                    allowedMentions: {
                        parse: []
                    }
                });

                console.log(
                    `[BOT CUSTOMIZATION] ${interaction.user.id} updated ${key}`
                );

            } finally {
                updating = false;
            }

            return true;
        }

        // ==================================
        // VIEW PROFILE BUTTON
        // ==================================

        if (
            interaction.isButton() &&
            interaction.customId === `${PREFIX}view`
        ) {
            await viewProfile(interaction);

            return true;
        }

        // ==================================
        // REFRESH PANEL BUTTON
        // ==================================

        if (
            interaction.isButton() &&
            interaction.customId === `${PREFIX}refresh`
        ) {
            await interaction.update(
                buildPanel(interaction.guild)
            );

            return true;
        }

        await interaction.reply({
            content: "Unknown dashboard action.",
            flags: MessageFlags.Ephemeral
        });

        return true;

    } catch (error) {
        await sendError(interaction, error);

        return true;
    }
}

// ==========================================
// ORIGINAL LEVEL CARD FUNCTION
// PRESERVED FOR COMPATIBILITY
// ==========================================

async function createLevelCard(user, level, reward) {
    const {
        createCanvas,
        loadImage
    } = require("canvas");

    const canvas = createCanvas(900, 360);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#165d74";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.strokeStyle = "#7fd3f7";
    ctx.lineWidth = 8;

    ctx.strokeRect(
        8,
        8,
        canvas.width - 16,
        canvas.height - 16
    );

    ctx.beginPath();
    ctx.arc(140, 180, 95, 0, Math.PI * 2);
    ctx.fillStyle = "#8fd8ef";
    ctx.fill();
    ctx.closePath();

    const arrow = await loadImage(
        path.join(
            __dirname,
            "../assets/level-arrow.png"
        )
    );

    ctx.drawImage(
        arrow,
        55,
        95,
        170,
        170
    );

    const avatar = await loadImage(
        user.displayAvatarURL({
            extension: "png",
            size: 256
        })
    );

    ctx.save();
    ctx.beginPath();
    ctx.arc(760, 75, 45, 0, Math.PI * 2);
    ctx.clip();

    ctx.drawImage(
        avatar,
        715,
        30,
        90,
        90
    );

    ctx.restore();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 44px Arial";

    ctx.fillText(
        `${user.username.toUpperCase()} HAS`,
        280,
        90
    );

    ctx.fillText(
        `REACHED LEVEL ${level}`,
        280,
        150
    );

    ctx.fillText(
        `AND RECEIVED ${reward}`,
        280,
        210
    );

    ctx.fillText(
        "WORLD LOCKS",
        280,
        270
    );

    return canvas.toBuffer("image/png");
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    start,
    handle,
    createLevelCard
};
