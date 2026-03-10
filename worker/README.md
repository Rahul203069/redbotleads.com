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
- `classification`
- `notifications`

Available scripts:

```bash
npm run worker:dev
npm run worker:ingestion
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
