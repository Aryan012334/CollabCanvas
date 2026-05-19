FROM node:20-alpine

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc* ./
COPY packages/ ./packages/
COPY apps/http-backend/ ./apps/http-backend/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm db:generate

# Build the backend
RUN pnpm build:api

EXPOSE 3001

# Run migrations then start
CMD ["sh", "-c", "pnpm db:migrate && node apps/http-backend/dist/index.js"]
