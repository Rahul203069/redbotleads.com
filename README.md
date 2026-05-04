# Reddit Lead Generation SaaS

AI-powered social listening platform that detects high-intent Reddit posts and helps users discover strong opportunities quickly.

This repository contains the Next.js app, Prisma schema, PostgreSQL integration, Google authentication, and the early product workflows for campaign setup and worker-backed lead discovery.

## What This Product Does

The platform helps users:

- track Reddit posts relevant to their product or service
- detect high-intent buying signals from subreddit feeds
- review leads in a dashboard workflow
- receive alerts through email and Slack
- use AI-generated summaries and reply suggestions

The MVP is discovery-first. It focuses on finding and qualifying leads, not automating Reddit engagement.

## Ingestion Strategy

The ingestion plan has changed from Reddit API polling to public Reddit RSS ingestion.

Current direction:

- ingest subreddit RSS feeds instead of the Reddit API
- limit MVP ingestion to posts only
- parse and normalize RSS items into `RedditItem`
- filter posts by campaign keywords and negative keywords
- enqueue matched posts for AI classification

This keeps the MVP simpler and avoids dependence on commercial Reddit API access for post discovery.

## Current Repo Status

Implemented in this repo:

- Next.js app
- Prisma schema for product and auth models
- PostgreSQL connection
- NextAuth with Google login
- JWT session strategy
- login and signup frontend
- protected `/app` route shell
- campaign creation and management UI
- worker scaffolding for ingestion, classification, and notifications
- AI-backed suggestion endpoints for campaign setup

Planned next:

- wire campaign creation to enqueue first sync
- switch ingestion worker from Reddit API fetching to RSS parsing
- lead dashboard
- lead detail pages
- notification delivery workers

## Documentation

Project docs are split by concern:

- [docs/README.md](C:\Users\rs329\goal\my-app\docs\README.md)
- [docs/product.md](C:\Users\rs329\goal\my-app\docs\product.md)
- [docs/architecture.md](C:\Users\rs329\goal\my-app\docs\architecture.md)
- [docs/ui.md](C:\Users\rs329\goal\my-app\docs\ui.md)
- [docs/api.md](C:\Users\rs329\goal\my-app\docs\api.md)

Additional root references:

- [ARCHITECTURE.md](C:\Users\rs329\goal\my-app\ARCHITECTURE.md)
- [UI-DESIGN-README.md](C:\Users\rs329\goal\my-app\UI-DESIGN-README.md)

## Stack

- Next.js
- NextAuth
- Prisma
- PostgreSQL
- Tailwind CSS
- `shadcn/ui`-style components

Planned backend stack:

- Next.js route handlers and server actions
- Redis
- BullMQ
- RSS ingestion and parsing
- AI provider integration

## Local Setup

Install dependencies:

```bash
npm install
```

Run Prisma:

```bash
npx prisma generate
npx prisma migrate dev
```

Start the app:

```bash
npm run dev
```

Run workers:

```bash
npm run worker:dev
```

## Environment Variables

Frontend auth and database:

```env
DATABASE_URL=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

App and workers:

```env
REDIS_URL=
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_WEB_SEARCH_MODEL=
OPENAI_SUBREDDIT_MODEL=
OPENAI_SUBREDDIT_WEB_SEARCH_CONTEXT_SIZE=high
OPENAI_SUBREDDIT_VALIDATION_TIMEOUT_MS=8000
```

## Notes

- Google OAuth is the active sign-in method in the current app.
- Credentials auth is represented in the schema for future expansion but is not active in the UI.
- Route protection currently uses JWT-backed NextAuth sessions.
- The backend plan is `Next.js + workers`, not `Next.js + NestJS`.
- Reddit ingestion is being revised to use subreddit RSS feeds for post-only discovery.

## License

Private project.

All rights reserved.
