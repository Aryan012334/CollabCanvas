# ============================================================
# Dockerfile — WebSocket Server
# Port: 4000
# ============================================================

FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy ALL packages with full source BEFORE pnpm install.
# pnpm workspace symlinks point into these directories.
# If the source files aren't here when pnpm install runs,
# the symlinks resolve to empty directories and tsc fails.
COPY packages/ ./packages/

# Copy the app package.json (needed for workspace resolution)
COPY apps/ws-server/package.json ./apps/ws-server/

# Install all dependencies
# postinstall in packages/db runs "prisma generate" — schema.prisma
# is already present because we copied packages/ above.
RUN pnpm install --frozen-lockfile

# Copy app source code
COPY apps/ws-server/ ./apps/ws-server/
COPY turbo.json ./

# Compile TypeScript → JavaScript
RUN pnpm build:ws

# ── Stage 2: Run ────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/apps/ws-server/dist          ./apps/ws-server/dist
COPY --from=builder /app/node_modules                 ./node_modules
COPY --from=builder /app/apps/ws-server/node_modules  ./apps/ws-server/node_modules
COPY --from=builder /app/packages                     ./packages
COPY --from=builder /app/package.json                 ./package.json
COPY --from=builder /app/pnpm-workspace.yaml          ./pnpm-workspace.yaml

EXPOSE 4000

CMD ["node", "apps/ws-server/dist/index.js"]
