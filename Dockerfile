# Container image for the Looking-2-Play Discord bot.
# Uses Debian-based Node (glibc) so the @napi-rs/canvas prebuilt binary works.
FROM node:20-slim

WORKDIR /app

# Install dependencies first (better build caching).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the rest of the app (source, font, etc.).
COPY . .

# The bot is a long-running worker (no web server / port to expose).
CMD ["npm", "start"]
