const WATCH_USER_ID = "1009567472577429515"; // niriel
const WATCH_SOURCE_CHANNEL_ID = "1411995708403486780";

const ALERT_USER_ID = "353926005204975616"; // basta
const ALERT_CHANNEL_ID = "1413401200728084550";

module.exports = (client) => {
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    if (
      message.author.id === WATCH_USER_ID &&
      message.channel.id === WATCH_SOURCE_CHANNEL_ID
    ) {
      const alertChannel = await client.channels.fetch(ALERT_CHANNEL_ID).catch(() => null);
      if (!alertChannel || !alertChannel.isTextBased()) return;

      let webhook = (await alertChannel.fetchWebhooks())
        .find(wh => wh.name === "Niriel Alert");

      if (!webhook) {
        webhook = await alertChannel.createWebhook({
          name: "Niriel Alert",
          reason: "Temporary alert system"
        });
      }

      const alertMsg = await webhook.send({
        content: `<@${ALERT_USER_ID}>`,
        wait: true
      });

      setTimeout(() => {
        webhook.deleteMessage(alertMsg.id).catch(() => {});
      }, 3000);
    }
  });
};