'use strict';

const path = require('path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

// Register your custom font once at startup so we can draw text with it.
// If the font file is missing we just fall back to a system sans-serif.
const FONT_FAMILY = 'Acha';
try {
  GlobalFonts.registerFromPath(
    path.join(__dirname, '..', 'Achafont.ttf'),
    FONT_FAMILY,
  );
} catch (err) {
  console.warn('Could not load Achafont.ttf, falling back to sans-serif:', err.message);
}

const AVATAR_SIZE = 88; // diameter of each circular avatar
const GAP = 16; // horizontal space between avatars
const PADDING = 22; // padding around the whole box
const HEADER_HEIGHT = 44; // space reserved for the title at the top
const NAME_HEIGHT = 26; // space reserved for the username under each avatar

/**
 * Draws a single image cropped into a circle at (cx, cy) center.
 */
function drawCircularAvatar(ctx, image, cx, cy, size) {
  const radius = size / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, cx - radius, cy - radius, size, size);
  ctx.restore();

  // White ring around the avatar so it pops against the background.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.restore();
}

/**
 * Renders the lobby as a PNG buffer.
 * @param {{title?: string, players: Array<{username: string, avatarURL: string}>}} opts
 * @returns {Promise<Buffer>}
 */
async function renderLobby({ title = 'Looking to Play', players }) {
  const count = Math.max(players.length, 1);

  const width = PADDING * 2 + count * AVATAR_SIZE + (count - 1) * GAP;
  const height = PADDING * 2 + HEADER_HEIGHT + AVATAR_SIZE + NAME_HEIGHT;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Rounded dark background "box".
  const radius = 24;
  ctx.fillStyle = '#2b2d31';
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.arcTo(width, 0, width, height, radius);
  ctx.arcTo(width, height, 0, height, radius);
  ctx.arcTo(0, height, 0, 0, radius);
  ctx.arcTo(0, 0, width, 0, radius);
  ctx.closePath();
  ctx.fill();

  // Title text, centered.
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `26px "${FONT_FAMILY}", sans-serif`;
  ctx.fillText(title, width / 2, PADDING + HEADER_HEIGHT / 2);

  // Draw each player's avatar in a row.
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const x = PADDING + i * (AVATAR_SIZE + GAP);
    const cx = x + AVATAR_SIZE / 2;
    const cy = PADDING + HEADER_HEIGHT + AVATAR_SIZE / 2;

    try {
      const image = await loadImage(player.avatarURL);
      drawCircularAvatar(ctx, image, cx, cy, AVATAR_SIZE);
    } catch (err) {
      // If an avatar fails to load, draw a plain circle placeholder.
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, AVATAR_SIZE / 2, 0, Math.PI * 2, true);
      ctx.fillStyle = '#5865f2';
      ctx.fill();
      ctx.restore();
    }

    // Username under the avatar (trimmed so it doesn't overflow).
    ctx.fillStyle = '#dbdee1';
    ctx.font = `16px "${FONT_FAMILY}", sans-serif`;
    let name = player.username;
    if (name.length > 12) name = name.slice(0, 11) + '…';
    ctx.fillText(name, cx, cy + AVATAR_SIZE / 2 + NAME_HEIGHT / 2 + 4);
  }

  return canvas.encode('png');
}

module.exports = { renderLobby };
