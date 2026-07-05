const {
    SlashCommandBuilder,
    AttachmentBuilder,
    PermissionFlagsBits
} = require("discord.js");

const { createLevelCard } = require("../feature/levelcard");
module.exports = {
    data: new SlashCommandBuilder()
        .setName("testlevelup")
        .setDescription("Test the level up card")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("User")
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option
                .setName("level")
                .setDescription("Level")
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option
                .setName("reward")
                .setDescription("Reward")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {

        // Owner only
        if (interaction.user.id !== "1108921222030426172") {
            return interaction.reply({
                content: "❌ Only the bot owner can use this.",
                ephemeral: true
            });
        }

        const user =
            interaction.options.getUser("user") ||
            interaction.user;

        const level =
            interaction.options.getInteger("level") || 35;

        const reward =
            interaction.options.getInteger("reward") || 75;

        const image = await createLevelCard(
            user,
            level,
            reward
        );

        const attachment = new AttachmentBuilder(image, {
            name: "levelup.png"
        });

        await interaction.reply({
            content: `🎉 Test level up for ${user}`,
            files: [attachment]
        });
    }
};