# Derleme bağlamı depo kökü olmalı (npm workspaces): docker build -f server/Dockerfile .
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci -w server

COPY server server
RUN npm run build -w server

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci -w server --omit=dev && npm cache clean --force

COPY --from=build /app/server/dist server/dist
COPY server/prisma server/prisma
COPY server/prisma.config.ts server/

USER node
WORKDIR /app/server
EXPOSE 3000
# Önce bekleyen migrasyonları uygula, sonra sunucuyu başlat
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
