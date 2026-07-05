const { createCanvas, loadImage } = require("canvas");
const path = require("path");

async function createLevelCard(user, level, reward) {
    const canvas = createCanvas(900, 360);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#165d74";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = "#7fd3f7";
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    // Circle
    ctx.beginPath();
    ctx.arc(140, 180, 95, 0, Math.PI * 2);
    ctx.fillStyle = "#8fd8ef";
    ctx.fill();
    ctx.closePath();

    // Arrow image
    const arrow = await loadImage(
        path.join(__dirname, "../assets/level-arrow.png")
    );

    ctx.drawImage(arrow, 55, 95, 170, 170);

    // Avatar
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
    ctx.drawImage(avatar, 715, 30, 90, 90);
    ctx.restore();

    // Text
    ctx.fillStyle = "#FFFFFF";

    ctx.font = "bold 44px Arial";
    ctx.fillText(`${user.username.toUpperCase()} HAS`, 280, 90);

    ctx.fillText(`REACHED LEVEL ${level}`, 280, 150);

    ctx.fillText(`AND RECEIVED ${reward}`, 280, 210);

    ctx.fillText(`WORLD LOCKS`, 280, 270);

    return canvas.toBuffer("image/png");
}

module.exports = {
    createLevelCard
};