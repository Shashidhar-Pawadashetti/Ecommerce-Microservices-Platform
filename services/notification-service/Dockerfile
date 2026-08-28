FROM node:24-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:24-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

# Set Node environment to production
ENV NODE_ENV=production

# Run as non-root user (node user is pre-created in the alpine image)
USER node

CMD ["node", "src/index.js"]
