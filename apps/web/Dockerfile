# ============================================================
# Dockerfile — Next.js Frontend
# Port: 3000
#
# IMPORTANT: next.config.js must have output: "standalone"
# That setting makes Next.js produce a self-contained build
# folder we can copy into the final slim image.
# ============================================================

# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Workspace manifests (layer cache trick)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json     ./packages/eslint-config/
COPY packages/ui/package.json                ./packages/ui/
COPY packages/db/package.json                ./packages/db/
COPY packages/common/package.json            ./packages/common/
COPY packages/backend-common/package.json    ./packages/backend-common/
COPY apps/web/package.json                   ./apps/web/

RUN pnpm install --frozen-lockfile

# Source code
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
COPY turbo.json ./

# NEXT_PUBLIC_* variables are baked into the JavaScript bundle at build time.
# They must be passed as build arguments — they cannot be changed at runtime.
# In docker-compose these come from your .env file.
# In Kubernetes they come from the ConfigMap.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_SITE_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NODE_ENV=production

# Generate Prisma client (web imports @repo/db for TypeScript types)
RUN pnpm db:generate

# Build Next.js — output goes to apps/web/.next/standalone/
RUN pnpm build:web

# ── Stage 2: Run ────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# The standalone output is a minimal Node.js server.
# We only need three things from the build:
#   1. The standalone server itself
#   2. The compiled static assets (.next/static)
#   3. The public folder (images, icons, etc.)
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static     ./apps/web/.next/static
COPY --from=builder /app/apps/web/public           ./apps/web/public

EXPOSE 3000

# Next.js standalone produces a server.js at the root
CMD ["node", "apps/web/server.js"]
