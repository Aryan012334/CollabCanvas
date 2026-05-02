FROM node:20-alpine

WORKDIR /app

COPY . .

RUN corepack enable
RUN pnpm install --frozen-lockfile

RUN pnpm build:ws

WORKDIR /app/apps/ws-server

EXPOSE 4000

CMD ["pnpm", "start"]