'use strict';

// Optional manual command registration:
//   npm run deploy
// You normally DON'T need this — the bot auto-registers /play on startup
// (see src/index.js). This script is here for one-off manual registration.

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { commands } = require('./commands');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in your .env file.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registering /play command in your server...');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands },
    );
    console.log('Done! /play should appear in your server within a few seconds.');
  } catch (err) {
    console.error('Failed to register commands:', err);
    process.exit(1);
  }
})();
