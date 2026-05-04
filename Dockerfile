FROM node:20-bookworm-slim AS base

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY generated ./generated
RUN npx prisma generate

COPY . .

ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app
ENV REDIS_URL=redis://localhost:6379
ENV NEXTAUTH_URL=http://localhost:3000
ENV NEXTAUTH_SECRET=docker-build-secret
ENV GOOGLE_CLIENT_ID=docker-build-google-client
ENV GOOGLE_CLIENT_SECRET=docker-build-google-secret
ENV OPENAI_API_KEY=docker-build-openai-key

FROM base AS web-builder

RUN npm run build

FROM node:20-bookworm-slim AS web-runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=base /app/package.json ./package.json
COPY --from=base /app/package-lock.json ./package-lock.json
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/generated ./generated
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/public ./public
COPY --from=web-builder /app/.next ./.next
COPY --from=base /app/next.config.ts ./next.config.ts

EXPOSE 3000

CMD ["npm", "run", "start"]

FROM base AS worker-runner

WORKDIR /app

ENV NODE_ENV=production

CMD ["npm", "run", "worker:dev"]
