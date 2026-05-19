# ============================================================
# Dockerfile — Next.js Frontend
# Port: 3000
#
# IMPORTANT: next.config.js must have output: "standalone"
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
COPY apps/web/package.json ./apps/web/

# Install all dependencies
# postinstall in packages/db runs "prisma generate" — schema.prisma
# is already present because we copied packages/ above.
RUN pnpm install --frozen-lockfile

# Copy app source code
COPY apps/web/ ./apps/web/
COPY turbo.json ./

# NEXT_PUBLIC_* variables are baked into the JS bundle at build time.
# They must be passed as --build-arg flags — cannot be changed at runtime.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_SITE_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NODE_ENV=production

# Build Next.js — output goes to apps/web/.next/standalone/
RUN pnpm build:web

# ── Stage 2: Run ────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static     ./apps/web/.next/static
COPY --from=builder /app/apps/web/public           ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
