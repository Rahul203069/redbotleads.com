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

## Docker

This app should run as a small Docker stack, not as one container with multiple long-running processes.

Recommended local stack:

- `web`: Next.js app
- `worker`: BullMQ workers
- `redis`: local Redis instance

Setup:

```bash
cp .env.docker.example .env.docker
```

Fill in the real values in `.env.docker`, especially:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OPENAI_API_KEY`

Start the stack:

```bash
docker compose up --build
```

The app will be available at `http://localhost:3000`.

Notes:

- `REDIS_URL` is forced to `redis://redis:6379` inside Compose so the app and worker use the local Redis container.
- This setup assumes you keep PostgreSQL hosted externally. That matches the current project better than trying to stand up local Postgres with pgvector by default.
- If you need schema updates, run Prisma separately against the same database before or during deployment.

## Vercel + VM Deployment

If you keep the web app on Vercel, do not run the web container on the VM. The VM should only run:

- `worker`
- `redis`

Use the VM-specific stack:

```bash
docker compose --env-file .env.vm -f compose.vm.yaml up --build -d
```

VM files:

- [compose.vm.yaml](C:\Users\rs329\goal\my-app\compose.vm.yaml)
- [\.env.vm.example](C:\Users\rs329\goal\my-app\.env.vm.example)

What goes where:

- `Vercel`
  - `DATABASE_URL=<your Neon URL>`
  - `REDIS_URL=redis://:<REDIS_PASSWORD>@<your-vm-ip-or-domain>:6379`
  - `NEXTAUTH_URL=<your production URL>`
  - `NEXTAUTH_SECRET=...`
  - `GOOGLE_CLIENT_ID=...`
  - `GOOGLE_CLIENT_SECRET=...`
  - `SLACK_CLIENT_ID=...`
  - `SLACK_CLIENT_SECRET=...`
  - `SLACK_REDIRECT_URI=<your production URL>/api/slack/callback`
  - `TELEGRAM_BOT_TOKEN=...`
  - `TELEGRAM_BOT_USERNAME=<your bot username>`
  - `TELEGRAM_WEBHOOK_SECRET=...`
  - `TELEGRAM_NOTIFICATION_INTERVAL_MS=2000`
  - `OPENAI_API_KEY=...`

- `VM worker stack`
  - `DATABASE_URL=<same Neon URL>`
  - `REDIS_PASSWORD=<strong password>`
  - `OPENAI_API_KEY=...`
  - other OpenAI and RSS envs from `.env.vm`

Important:

- Redis is password-protected in the VM compose stack.
- Vercel talks to Redis over the VM public endpoint.
- The worker talks to Redis over the internal Docker network.
- Keep the VM firewall tight. Open `6379` only if Vercel must reach Redis directly.
- Do not expose Redis publicly without a password.

## Environment Variables

Frontend auth and database:

```env
DATABASE_URL=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_NOTIFICATION_INTERVAL_MS=2000
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
CRON_SECRET=
RESEND_API_KEY=
EMAIL_FROM=
TELEGRAM_BOT_TOKEN=
TELEGRAM_NOTIFICATION_INTERVAL_MS=2000
```

Telegram webhook setup:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=$NEXTAUTH_URL/api/telegram/webhook&secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

## RSS Poll Scheduler

The repo includes a Vercel Cron job at `/api/cron/rss-poll`.

- Route: [app/api/cron/rss-poll/route.ts](C:\Users\rs329\goal\my-app\app\api\cron\rss-poll\route.ts)
- Schedule: [vercel.json](C:\Users\rs329\goal\my-app\vercel.json) currently runs at `*/30 * * * *` (every 30 minutes)

What it does:

- finds unique subreddits used by active campaigns
- skips subreddits currently in RSS backoff
- staggers `POLL_SUBREDDIT_RSS` jobs through BullMQ over the 30-minute window
- stores brand-new Reddit posts in `RedditItem`
- enqueues `EMBED_REDDIT_ITEM` for newly stored posts
- enqueues campaign match jobs after each campaign's tracked subreddits have been polled
- creates `Lead` records only when a new post passes semantic matching
- classifies semantic-passed leads and sends notifications when classification crosses the campaign threshold

This scheduler is separate from the campaign-created initial sync. It does not update `CampaignSync`.

Required env on Vercel:

```env
CRON_SECRET=
```

Set the same secret in the Vercel Cron configuration so the scheduler route only accepts authorized calls.

## Notes

- Google OAuth is the active sign-in method in the current app.
- Credentials auth is represented in the schema for future expansion but is not active in the UI.
- Route protection currently uses JWT-backed NextAuth sessions.
- The backend plan is `Next.js + workers`, not `Next.js + NestJS`.
- Reddit ingestion is being revised to use subreddit RSS feeds for post-only discovery.

## License

Private project.

All rights reserved.
