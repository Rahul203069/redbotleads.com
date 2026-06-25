# Worker

This folder contains the background worker runtime for the app.

Current stack:

- Node.js
- TypeScript
- BullMQ
- Redis
- Prisma-ready environment setup
- Zod for env validation
- Pino for logging

Available queues:

- `ingestion`
- `embedding`
- `semantic`
- `classification`
- `notifications`
- `rss-polling`

Available scripts:

```bash
npm run worker:dev
npm run worker:ingestion
npm run worker:daily-ingestion
npm run worker:rss-polling
npm run worker:embedding
npm run worker:semantic
npm run worker:classification
npm run worker:notifications
```

Required environment variables:

```env
DATABASE_URL=
REDIS_URL=
RESEND_API_KEY=
EMAIL_FROM=
TELEGRAM_BOT_TOKEN=
TELEGRAM_NOTIFICATION_INTERVAL_MS=2000
```

Current status:

- queue and worker scaffolding is initialized
- actual job logic is still to be implemented
- workers run as a separate Node process from the Next.js app

Reference docs:

- [INGESTION.md](C:\Users\rs329\goal\my-app\worker\INGESTION.md) - ingestion worker behavior, heuristics, and first-sync flow
