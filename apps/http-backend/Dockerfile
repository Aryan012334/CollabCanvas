# ============================================================
# Dockerfile — HTTP Backend (Express REST API)
# Port: 3001
# ============================================================

# We use a two-stage build:
#   Stage 1 (builder): install deps + compile TypeScript → JavaScript
#   Stage 2 (runner):  copy only the compiled output, run it

# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Enable pnpm (comes bundled with Node via corepack)
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace config files first.
# Docker caches each layer — putting package files before source code
# means "pnpm install" only re-runs when dependencies actually change.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy every package.json in the monorepo so pnpm knows the workspace shape
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/backend-common/package.json    ./packages/backend-common/
COPY packages/common/package.json            ./packages/common/
COPY packages/db/package.json                ./packages/db/
COPY apps/http-backend/package.json          ./apps/http-backend/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Now copy the actual source code
COPY packages/ ./packages/
COPY apps/http-backend/ ./apps/http-backend/
COPY turbo.json ./

# Generate the Prisma client (creates the DB query helpers from schema.prisma)
RUN pnpm db:generate

# Compile TypeScript → JavaScript (output goes to apps/http-backend/dist/)
RUN pnpm build:api

# ── Stage 2: Run ────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy compiled JS and all node_modules from the builder stage
COPY --from=builder /app/apps/http-backend/dist  ./apps/http-backend/dist
COPY --from=builder /app/node_modules            ./node_modules
COPY --from=builder /app/apps/http-backend/node_modules ./apps/http-backend/node_modules
COPY --from=builder /app/packages                ./packages
COPY --from=builder /app/package.json            ./package.json
COPY --from=builder /app/pnpm-workspace.yaml     ./pnpm-workspace.yaml

# Expose the port this service listens on
EXPOSE 3001

# Start the compiled server
CMD ["node", "apps/http-backend/dist/index.js"]
