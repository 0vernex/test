'use strict';

// The slash commands this bot provides. Shared by the startup auto-registration
// (src/index.js) and the manual `npm run deploy` script (src/deploy-commands.js).
const { SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Open a "looking to play" lobby that others can join.')
    .toJSON(),
];

module.exports = { commands };
