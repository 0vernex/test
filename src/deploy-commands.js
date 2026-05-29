'use strict';

// Run this once (and again whenever you change the command definition):
//   npm run deploy
// It tells Discord that the /play command exists in your server.

require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in your .env file.');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Open a "looking to play" lobby that others can join.')
    .toJSON(),
];

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
