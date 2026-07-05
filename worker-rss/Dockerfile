FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app
ENV REDIS_URL=redis://localhost:6379

RUN npx prisma generate

CMD ["npm", "run", "rss-polling"]
