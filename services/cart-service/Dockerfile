# Cart Service — Node 24 / Express 5 / ioredis 6 (Phase 4 tracer)
# Multi-stage build, non-root runtime user.
FROM node:24-alpine AS deps
WORKDIR /app
# Copy lockfile + manifest first for layer caching.
COPY package.json package-lock.json ./
# Production deps only (--omit=dev). The dev-peer of ioredis-mock never affects
# the runtime image, so this install is clean.
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24-alpine AS runtime
WORKDIR /app

# Non-root runtime user (mirrors auth-service / catalog-service conventions).
RUN addgroup -S app && adduser -r -S -G app app

# Bring in production node_modules + manifest + source.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY src ./src

USER app
EXPOSE 3001
# Fail-fast Redis check runs inside index.js before listening.
CMD ["node", "src/index.js"]
