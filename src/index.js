'use strict';

require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');

const { renderLobby } = require('./render-lobby');

const {
  DISCORD_TOKEN,
  REQUIRED_ROLE_NAME,
  LFG_CHANNEL_ID,
} = process.env;

if (!DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN in your .env file.');
  process.exit(1);
}

// We only need the Guilds intent: slash commands and buttons work without
// any privileged intents, so there's nothing to toggle in the dev portal.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// In-memory store of active lobbies, keyed by the lobby message ID.
// Each lobby: { ownerId, players: Map<userId, {username, avatarURL}> }
// NOTE: this resets if the bot restarts. For persistence you'd use a database.
const lobbies = new Map();

const JOIN_ID = 'lfg_join';
const LEAVE_ID = 'lfg_leave';

function buildButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(JOIN_ID)
      .setLabel('Play')
      .setEmoji('🎮')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(LEAVE_ID)
      .setLabel('Leave')
      .setEmoji('🚪')
      .setStyle(ButtonStyle.Danger),
  );
}

// Turn a lobby's players into the image + embed payload we send/edit.
async function buildLobbyPayload(lobby) {
  const players = [...lobby.players.values()];
  const png = await renderLobby({ title: 'Looking to Play', players });
  const file = new AttachmentBuilder(png, { name: 'lobby.png' });

  const names = players.map((p) => `• ${p.username}`).join('\n') || '*No one yet*';
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎮 Looking to Play')
    .setDescription(`**Players (${players.length}):**\n${names}`)
    .setImage('attachment://lobby.png')
    .setFooter({ text: 'Press Play to join • Press Leave to drop out' });

  return { embeds: [embed], files: [file], components: [buildButtons()] };
}

function userToPlayer(user) {
  return {
    id: user.id,
    username: user.displayName || user.globalName || user.username,
    avatarURL: user.displayAvatarURL({ extension: 'png', size: 256 }),
  };
}

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}. Ready!`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'play') {
      await handlePlayCommand(interaction);
    } else if (interaction.isButton()) {
      if (interaction.customId === JOIN_ID) await handleJoin(interaction);
      else if (interaction.customId === LEAVE_ID) await handleLeave(interaction);
    }
  } catch (err) {
    console.error('Interaction error:', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: 'Something went wrong. Try again.', flags: MessageFlags.Ephemeral })
        .catch(() => {});
    }
  }
});

async function handlePlayCommand(interaction) {
  // Optional: restrict to one channel.
  if (LFG_CHANNEL_ID && interaction.channelId !== LFG_CHANNEL_ID) {
    return interaction.reply({
      content: 'You can only use `/play` in the Looking-2-Play channel.',
      flags: MessageFlags.Ephemeral,
    });
  }

  // Optional: require a role.
  if (REQUIRED_ROLE_NAME) {
    const hasRole = interaction.member?.roles?.cache?.some(
      (r) => r.name === REQUIRED_ROLE_NAME,
    );
    if (!hasRole) {
      return interaction.reply({
        content: `You need the **@${REQUIRED_ROLE_NAME}** role to start a lobby.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  // Building the image can take a moment, so defer first.
  await interaction.deferReply();

  const owner = userToPlayer(interaction.user);
  const lobby = { ownerId: owner.id, players: new Map([[owner.id, owner]]) };

  const payload = await buildLobbyPayload(lobby);
  const message = await interaction.editReply(payload);

  // Now that we know the message ID, store the lobby under it.
  lobbies.set(message.id, lobby);
}

async function handleJoin(interaction) {
  const lobby = lobbies.get(interaction.message.id);
  if (!lobby) {
    return interaction.reply({
      content: 'This lobby is no longer active. Start a new one with `/play`.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (lobby.players.has(interaction.user.id)) {
    return interaction.reply({
      content: 'You are already in this lobby! Press **Leave** to drop out.',
      flags: MessageFlags.Ephemeral,
    });
  }

  lobby.players.set(interaction.user.id, userToPlayer(interaction.user));

  // Re-render the image with everyone and update the same message in place.
  const payload = await buildLobbyPayload(lobby);
  await interaction.update(payload);
}

async function handleLeave(interaction) {
  const lobby = lobbies.get(interaction.message.id);
  if (!lobby) {
    return interaction.reply({
      content: 'This lobby is no longer active.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!lobby.players.has(interaction.user.id)) {
    return interaction.reply({
      content: "You're not in this lobby. Press **Play** to join.",
      flags: MessageFlags.Ephemeral,
    });
  }

  lobby.players.delete(interaction.user.id);

  // If everyone left, close the lobby instead of showing an empty box.
  if (lobby.players.size === 0) {
    lobbies.delete(interaction.message.id);
    return interaction.update({
      content: '*This lobby was closed — everyone left.*',
      embeds: [],
      files: [],
      components: [],
    });
  }

  const payload = await buildLobbyPayload(lobby);
  await interaction.update(payload);
}

client.login(DISCORD_TOKEN);
