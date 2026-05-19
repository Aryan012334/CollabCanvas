FROM node:20-alpine

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc* ./
COPY packages/ ./packages/
COPY apps/ws-server/ ./apps/ws-server/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm db:generate

# Build the ws server
RUN pnpm build:ws

EXPOSE 4000

CMD ["node", "apps/ws-server/dist/index.js"]
