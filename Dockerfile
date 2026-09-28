# syntax=docker/dockerfile:1

# Gaple: satu image berisi server Colyseus (TypeScript lewat tsx) dan build aplikasi web
# yang disajikannya dari origin yang sama.

ARG NODE_VERSION=24-alpine
ARG PNPM_VERSION=12.5.1

# ─── Build: pasang semua dependensi, build aplikasi web ────────────────────
FROM node:${NODE_VERSION} AS build
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app

# Manifest dulu, supaya layer dependensi di-cache selama lockfile tidak berubah.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/aturan/package.json packages/aturan/
COPY packages/ruang/package.json packages/ruang/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

COPY packages packages
COPY apps/web apps/web
# Klien produksi tersambung ke origin halaman (VITE_SERVER_URL sengaja tidak diisi).
RUN pnpm --filter @gaple/web build

# ─── Runtime: hanya dependensi produksi server ─────────────────────────────
FROM node:${NODE_VERSION} AS runtime
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app
ENV NODE_ENV=production \
    PORT=2567 \
    WEB_DIR=/app/web

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/aturan/package.json packages/aturan/
COPY packages/ruang/package.json packages/ruang/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --prod --filter @gaple/server... \
 && npm uninstall -g pnpm \
 && npm cache clean --force

COPY packages/aturan/src packages/aturan/src
COPY packages/ruang/src packages/ruang/src
COPY apps/server/src apps/server/src
COPY --from=build /app/apps/web/dist /app/web

USER node
WORKDIR /app/apps/server
EXPOSE 2567
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/kesehatan').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# Node langsung sebagai proses utama, supaya SIGTERM sampai ke shutdown Colyseus (snapshot terakhir disimpan).
CMD ["node", "--import", "tsx", "src/main.ts"]
