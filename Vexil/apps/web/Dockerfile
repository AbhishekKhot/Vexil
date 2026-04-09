FROM node:20-alpine AS base
WORKDIR /app

COPY package.json ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN npm install --workspaces --if-present

COPY packages/types ./packages/types
COPY apps/web ./apps/web

WORKDIR /app/packages/types
RUN npm run build 2>/dev/null || true

WORKDIR /app/apps/web
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=base /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
