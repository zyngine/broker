require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { readdirSync } = require('fs');
const path = require('path');
const { token, clientId, guildId } = require('./config');

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');

for (const file of readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command) {
    commands.push(command.data.toJSON());
    console.log(`Queued: /${command.data.name}`);
  }
}

const rest = new REST().setToken(token);

(async () => {
  try {
    // If GUILD_ID is set → deploy to that guild instantly (dev/testing)
    // If GUILD_ID is not set → deploy globally to all servers (~1hr propagation)
    const isGlobal = !guildId;
    const route = isGlobal
      ? Routes.applicationCommands(clientId)
      : Routes.applicationGuildCommands(clientId, guildId);

    const scope = isGlobal ? 'GLOBALLY (all servers)' : `guild ${guildId}`;
    console.log(`\nDeploying ${commands.length} slash commands ${scope}...`);

    await rest.put(route, { body: commands });

    console.log(`Successfully deployed ${commands.length} commands.`);
    if (isGlobal) console.log('Note: Global commands can take up to 1 hour to appear in all servers.');
    console.log('\nCommands registered:');
    commands.forEach((c) => console.log(`  /${c.name} — ${c.description}`));
  } catch (err) {
    console.error('Failed to deploy commands:', err);
    process.exit(1);
  }
})();
