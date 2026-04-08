# Previously at: services/admin-api/Dockerfile (new file)
# Multi-stage build for @vexil/api — Fastify backend

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Copy root workspace manifest first (for dependency hoisting)
COPY package.json package-lock.json ./

# Copy only this service's package.json so Docker can cache the install layer
COPY apps/api/package.json ./apps/api/

RUN npm install --workspace=apps/api

# Copy source
COPY apps/api/ ./apps/api/

WORKDIR /app/apps/api
RUN npm run build

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:18-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# Copy compiled output and production deps only
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./

RUN npm install --omit=dev

EXPOSE 3000

CMD ["node", "dist/server.js"]
