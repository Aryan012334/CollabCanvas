FROM node:20-alpine

WORKDIR /app

COPY . .

RUN corepack enable
RUN pnpm install --frozen-lockfile

RUN pnpm build:api

WORKDIR /app/apps/http-backend

EXPOSE 3000

CMD ["pnpm", "start"]