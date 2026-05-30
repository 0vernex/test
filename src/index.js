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
  ChannelType,
  PermissionFlagsBits,
  REST,
  Routes,
} = require('discord.js');

const { renderLobby } = require('./render-lobby');
const { commands } = require('./commands');

const {
  DISCORD_TOKEN,
  GUILD_ID,
  REQUIRED_ROLE_NAME,
  LFG_CHANNEL_ID,
} = process.env;

if (!DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN in your .env file.');
  process.exit(1);
}

// Slash commands, buttons and channel management all work with just the
// Guilds intent — no privileged intents to toggle in the dev portal.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// In-memory store of active lobbies, keyed by the lobby message ID.
// Each lobby: {
//   ownerId, players: Map<userId, {id, username, avatarURL}>,
//   guild, message, vcId, number, expiryTimer, expiryActive
// }
// NOTE: this resets if the bot restarts. For persistence you'd use a database.
const lobbies = new Map();

// Tracks which L2p-<n> numbers are currently in use so names don't collide.
const usedNumbers = new Set();

const JOIN_ID = 'lfg_join';
const LEAVE_ID = 'lfg_leave';
const DISBAND_ID = 'lfg_disband';

// Valorant 5-stack: a lobby can hold at most 5 players.
const MAX_PLAYERS = 5;

// Auto-expire a lobby after an hour IF no one ever joins the creator.
const EXPIRY_MS = 60 * 60 * 1000;

// Grab the smallest unused lobby number (so L2p-1, L2p-2, ... and freed
// numbers get reused instead of climbing forever).
function allocateNumber() {
  let n = 1;
  while (usedNumbers.has(n)) n++;
  usedNumbers.add(n);
  return n;
}

function buildButtons(isFull) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(JOIN_ID)
      .setLabel(isFull ? 'Full' : 'Join')
      .setEmoji('🎮')
      .setStyle(ButtonStyle.Success) // green background
      .setDisabled(isFull),
    new ButtonBuilder()
      .setCustomId(LEAVE_ID)
      .setLabel('Leave')
      .setEmoji('🚪')
      .setStyle(ButtonStyle.Danger), // red background
    new ButtonBuilder()
      .setCustomId(DISBAND_ID)
      .setLabel('Disband')
      .setEmoji('🛑')
      .setStyle(ButtonStyle.Secondary),
  );
}

// Turn a lobby's players into the image + embed payload we send/edit.
async function buildLobbyPayload(lobby) {
  const players = [...lobby.players.values()];
  const isFull = players.length >= MAX_PLAYERS;
  const png = await renderLobby({ title: 'Looking to Play', players });
  const file = new AttachmentBuilder(png, { name: 'lobby.png' });

  const names = players.map((p) => `• ${p.username}`).join('\n') || '*No one yet*';

  let description = `**Players (${players.length}/${MAX_PLAYERS}):**\n${names}`;
  if (lobby.vcId) description += `\n\n🔊 Voice: <#${lobby.vcId}>`;
  if (isFull) description += '\n\n**Stack is full! 🔒**';
  else if (lobby.expiryActive) {
    description += '\n\n⏳ *Expires in 1 hour unless someone joins.*';
  }

  const embed = new EmbedBuilder()
    .setColor(isFull ? 0x57f287 : 0x5865f2)
    .setTitle('🎮 Looking to Play')
    .setDescription(description)
    .setImage('attachment://lobby.png')
    .setFooter({ text: 'Join to hop in • Leave to drop out • Disband (creator only) to close' });

  return { embeds: [embed], files: [file], components: [buildButtons(isFull)] };
}

function userToPlayer(user) {
  return {
    id: user.id,
    username: user.displayName || user.globalName || user.username,
    avatarURL: user.displayAvatarURL({ extension: 'png', size: 256 }),
  };
}

// ---- Voice channel helpers --------------------------------------------------

async function grantVcAccess(lobby, userId) {
  if (!lobby.vcId) return;
  const ch = lobby.guild.channels.cache.get(lobby.vcId);
  if (!ch) return;
  await ch.permissionOverwrites
    .edit(userId, { ViewChannel: true, Connect: true })
    .catch((e) => console.warn('grantVcAccess failed:', e.message));
}

async function revokeVcAccess(lobby, userId) {
  if (!lobby.vcId) return;
  const ch = lobby.guild.channels.cache.get(lobby.vcId);
  if (!ch) return;
  await ch.permissionOverwrites
    .delete(userId)
    .catch((e) => console.warn('revokeVcAccess failed:', e.message));
}

// ---- Lobby lifecycle --------------------------------------------------------

// Fully tear down a lobby: cancel its timer, delete its VC, free its number,
// and drop it from the store. Safe to call more than once.
async function closeLobby(messageId) {
  const lobby = lobbies.get(messageId);
  if (!lobby) return;
  lobbies.delete(messageId);

  if (lobby.expiryTimer) clearTimeout(lobby.expiryTimer);
  if (lobby.number) usedNumbers.delete(lobby.number);

  if (lobby.vcId) {
    const ch = lobby.guild.channels.cache.get(lobby.vcId);
    if (ch) await ch.delete('Lobby closed').catch(() => {});
  }
}

async function expireLobby(messageId) {
  const lobby = lobbies.get(messageId);
  if (!lobby) return;
  const message = lobby.message;
  await closeLobby(messageId);
  if (message) {
    await message
      .edit({
        content: '*This lobby expired after an hour with no one joining.*',
        embeds: [],
        files: [],
        components: [],
      })
      .catch(() => {});
  }
}

// Register the /play command automatically on startup, so the bot is fully
// self-contained when hosted — no manual `npm run deploy` needed. If GUILD_ID
// is set we register to that one server (instant); otherwise globally (slower
// to propagate, up to ~1 hour, but works across every server the bot is in).
async function registerCommands(appId) {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(appId, GUILD_ID), { body: commands });
      console.log(`Registered /play in guild ${GUILD_ID}.`);
    } else {
      await rest.put(Routes.applicationCommands(appId), { body: commands });
      console.log('Registered /play globally (may take up to an hour to appear).');
    }
  } catch (err) {
    console.error('Command registration failed:', err);
  }
}

client.once(Events.ClientReady, async (c) => {
  await registerCommands(c.user.id);
  console.log(`Logged in as ${c.user.tag}. Ready!`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'play') {
      await handlePlayCommand(interaction);
    } else if (interaction.isButton()) {
      if (interaction.customId === JOIN_ID) await handleJoin(interaction);
      else if (interaction.customId === LEAVE_ID) await handleLeave(interaction);
      else if (interaction.customId === DISBAND_ID) await handleDisband(interaction);
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
  // Lobbies (and their voice channels) only make sense inside a server.
  if (!interaction.guild) {
    return interaction.reply({
      content: 'You can only use `/play` inside a server.',
      flags: MessageFlags.Ephemeral,
    });
  }

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

  // Create a private voice channel for this lobby, named L2p-<n>.
  // Best-effort: if the bot lacks "Manage Channels" we still open the lobby.
  let vcId = null;
  let number = null;
  try {
    number = allocateNumber();
    const vc = await interaction.guild.channels.create({
      name: `L2p-${number}`,
      type: ChannelType.GuildVoice,
      parent: interaction.channel?.parentId ?? undefined,
      userLimit: MAX_PLAYERS,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
        },
        {
          id: interaction.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
        },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ],
    });
    vcId = vc.id;
  } catch (err) {
    console.warn('Could not create voice channel (need Manage Channels?):', err.message);
    if (number) usedNumbers.delete(number);
    number = null;
  }

  const lobby = {
    ownerId: owner.id,
    players: new Map([[owner.id, owner]]),
    guild: interaction.guild,
    message: null,
    vcId,
    number,
    expiryTimer: null,
    expiryActive: true,
  };

  const payload = await buildLobbyPayload(lobby);
  const message = await interaction.editReply(payload);
  lobby.message = message;

  // Store the lobby and start the one-hour expiry countdown.
  lobbies.set(message.id, lobby);
  lobby.expiryTimer = setTimeout(() => {
    expireLobby(message.id).catch((e) => console.error('expireLobby error:', e));
  }, EXPIRY_MS);
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

  if (lobby.players.size >= MAX_PLAYERS) {
    return interaction.reply({
      content: `This stack is full (${MAX_PLAYERS}/${MAX_PLAYERS}). Wait for a spot to open up.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  lobby.players.set(interaction.user.id, userToPlayer(interaction.user));

  // Someone joined: cancel the auto-expiry for good and give VC access.
  if (lobby.expiryTimer) {
    clearTimeout(lobby.expiryTimer);
    lobby.expiryTimer = null;
  }
  lobby.expiryActive = false;
  await grantVcAccess(lobby, interaction.user.id);

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
      content: "You're not in this lobby. Press **Join** to hop in.",
      flags: MessageFlags.Ephemeral,
    });
  }

  lobby.players.delete(interaction.user.id);
  await revokeVcAccess(lobby, interaction.user.id);

  // If everyone left, close the lobby (and delete the VC) instead of an empty box.
  if (lobby.players.size === 0) {
    await closeLobby(interaction.message.id);
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

async function handleDisband(interaction) {
  const lobby = lobbies.get(interaction.message.id);
  if (!lobby) {
    return interaction.reply({
      content: 'This lobby is no longer active.',
      flags: MessageFlags.Ephemeral,
    });
  }

  // Workaround for Discord's shared buttons: the Disband button is visible to
  // everyone, but only the person who created the lobby is allowed to use it.
  if (interaction.user.id !== lobby.ownerId) {
    return interaction.reply({
      content: 'Only the lobby creator can disband this lobby.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await closeLobby(interaction.message.id);
  return interaction.update({
    content: '*This lobby was disbanded by the creator.*',
    embeds: [],
    files: [],
    components: [],
  });
}

client.login(DISCORD_TOKEN);
