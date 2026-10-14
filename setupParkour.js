require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { installPanels } = require('./feature/parkour');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('ready', async () => {
  try {
    await installPanels(client);
    console.log('Parkour panels installed.');
  } catch (e) {
    console.error('Parkour setup failed:', e);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});
client.login(process.env.TOKEN).catch(e => { console.error(e); process.exitCode = 1; });
