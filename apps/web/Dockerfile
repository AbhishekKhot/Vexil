# Previously at: services/admin-ui/Dockerfile (new file)
# Multi-stage build for @vexil/web — React + Vite frontend

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Copy root workspace manifest
COPY package.json package-lock.json ./

# Copy only this service's package.json for layer caching
COPY apps/web/package.json ./apps/web/

RUN npm install --workspace=apps/web

# Copy source
COPY apps/web/ ./apps/web/

WORKDIR /app/apps/web

# VITE_API_BASE_URL must be provided at build time
# e.g. --build-arg VITE_API_BASE_URL=https://api.vexil.example.com
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ── Stage 2: Serve with nginx ─────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
