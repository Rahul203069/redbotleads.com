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

Available scripts:

```bash
npm run worker:dev
npm run worker:ingestion
npm run worker:embedding
npm run worker:semantic
npm run worker:classification
npm run worker:notifications
```

Required environment variables:

```env
DATABASE_URL=
REDIS_URL=
```

Current status:

- queue and worker scaffolding is initialized
- actual job logic is still to be implemented
- workers run as a separate Node process from the Next.js app

Reference docs:

- [INGESTION.md](C:\Users\rs329\goal\my-app\worker\INGESTION.md) - ingestion worker behavior, heuristics, and first-sync flow
