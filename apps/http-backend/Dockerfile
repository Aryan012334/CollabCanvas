# ============================================================
# Dockerfile — HTTP Backend (Express REST API)
# Port: 3001
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
COPY apps/http-backend/package.json ./apps/http-backend/

# Install all dependencies
# postinstall in packages/db runs "prisma generate" — schema.prisma
# is already present because we copied packages/ above.
RUN pnpm install --frozen-lockfile

# Copy app source code
COPY apps/http-backend/ ./apps/http-backend/
COPY turbo.json ./

# Compile TypeScript → JavaScript
RUN pnpm build:api

# ── Stage 2: Run ────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/apps/http-backend/dist          ./apps/http-backend/dist
COPY --from=builder /app/node_modules                    ./node_modules
COPY --from=builder /app/apps/http-backend/node_modules  ./apps/http-backend/node_modules
COPY --from=builder /app/packages                        ./packages
COPY --from=builder /app/package.json                    ./package.json
COPY --from=builder /app/pnpm-workspace.yaml             ./pnpm-workspace.yaml

EXPOSE 3001

# Run Prisma migrations then start the server.
# "migrate deploy" is safe to run on every startup — it only applies
# migrations that haven't been applied yet. If the DB is already up
# to date, it exits immediately with no changes.
CMD ["sh", "-c", "packages/db/node_modules/.bin/prisma migrate deploy --schema=packages/db/prisma/schema.prisma && node apps/http-backend/dist/index.js"]
