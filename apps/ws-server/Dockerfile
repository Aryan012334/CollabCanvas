# ============================================================
# Dockerfile — WebSocket Server
# Port: 4000
# ============================================================

# Same two-stage pattern as http-backend:
#   Stage 1: install + compile TypeScript
#   Stage 2: run the compiled output

# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Workspace manifests first (for Docker layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/backend-common/package.json    ./packages/backend-common/
COPY packages/db/package.json                ./packages/db/
COPY apps/ws-server/package.json             ./apps/ws-server/

RUN pnpm install --frozen-lockfile

# Source code
COPY packages/    ./packages/
COPY apps/ws-server/ ./apps/ws-server/
COPY turbo.json ./

# Generate Prisma client (ws-server writes shapes to DB)
RUN pnpm db:generate

# Compile TypeScript → JavaScript
RUN pnpm build:ws

# ── Stage 2: Run ────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/apps/ws-server/dist      ./apps/ws-server/dist
COPY --from=builder /app/node_modules             ./node_modules
COPY --from=builder /app/apps/ws-server/node_modules ./apps/ws-server/node_modules
COPY --from=builder /app/packages                 ./packages
COPY --from=builder /app/package.json             ./package.json
COPY --from=builder /app/pnpm-workspace.yaml      ./pnpm-workspace.yaml

EXPOSE 4000

CMD ["node", "apps/ws-server/dist/index.js"]
