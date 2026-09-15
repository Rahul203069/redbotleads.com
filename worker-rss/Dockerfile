FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app
ENV REDIS_URL=redis://localhost:6379

RUN npx prisma generate

CMD ["npm", "run", "rss-polling"]
