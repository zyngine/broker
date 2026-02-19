require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { token } = require('./config');
const { initDatabase } = require('./src/database/init');
const { loadCommands }  = require('./src/handlers/commandHandler');
const { handleInteraction } = require('./src/handlers/interactionHandler');
const { startWebServer } = require('./web');

console.log('[Broker] v2-web-dashboard starting up');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

(async () => {
  try {
    await initDatabase();

    await loadCommands(client);

    client.on('interactionCreate', (interaction) =>
      handleInteraction(client, interaction)
    );

    client.once('ready', () => {
      console.log(`[Broker] Online as ${client.user.tag}`);
      console.log(`[Broker] Serving ${client.guilds.cache.size} guild(s)`);
    });

    startWebServer();
    await client.login(token);
  } catch (err) {
    console.error('[Broker] Fatal startup error:', err);
    process.exit(1);
  }
})();

// Graceful shutdown for Railway / Docker SIGTERM
process.on('SIGTERM', () => {
  console.log('[Broker] SIGTERM received — shutting down gracefully');
  client.destroy();
  process.exit(0);
});
