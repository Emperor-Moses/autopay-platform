FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
# Prisma schema references runtime env vars; use build-time placeholders only for client generation.
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/autopay
ENV DIRECT_URL=postgresql://placeholder:placeholder@localhost:5432/autopay
RUN npx prisma generate

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/prisma ./prisma

EXPOSE 10000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
