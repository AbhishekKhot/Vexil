FROM node:20-alpine AS base
WORKDIR /app

# Copy root workspace manifest
COPY package.json ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/api/package.json ./apps/api/package.json

RUN npm install --workspaces --if-present

# Copy source
COPY packages/types ./packages/types
COPY apps/api ./apps/api

# Build types
WORKDIR /app/packages/types
RUN npm run build 2>/dev/null || true

# Build API
WORKDIR /app/apps/api
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages ./packages
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/apps/api/package.json ./apps/api/package.json

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["node", "dist/server.js"]
