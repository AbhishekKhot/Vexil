FROM node:20-alpine AS base
WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/api/package.json ./apps/api/package.json

RUN npm install --workspaces --if-present

# Copy source trees
COPY packages/types ./packages/types
COPY apps/api ./apps/api

# Build shared types (best-effort — package may have no build step)
WORKDIR /app/packages/types
RUN npm run build 2>/dev/null || true

# Compile the API (tsc → dist/)
WORKDIR /app/apps/api
RUN npm run build

# ---------------------------------------------------------------------------
# Runner — lean production image
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=base /app/node_modules          ./node_modules
COPY --from=base /app/packages              ./packages
COPY --from=base /app/apps/api/dist         ./apps/api/dist
COPY --from=base /app/apps/api/package.json ./apps/api/package.json

WORKDIR /app/apps/api

# Startup script: runs migrations then hands off to node
COPY apps/api/run_start.sh ./run_start.sh
RUN chmod +x ./run_start.sh

EXPOSE 3000

# run_start.sh:
#   1. Runs pending migrations via dist/data-source.js
#   2. exec's node dist/server.js (replaces shell PID)
CMD ["sh", "run_start.sh"]
