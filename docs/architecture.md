# Architecture Reference

## System Summary

The platform is split into:

- Next.js frontend
- Next.js APIs and server actions
- PostgreSQL database
- Prisma ORM
- Redis
- BullMQ workers
- AI provider integrations

## High-Level Flow

```text
             Reddit API
                 |
                 v
        Ingestion Workers
                 |
                 v
            PostgreSQL
                 |
      -------------------------
      |                       |
      v                       v
 Lead Matching           AI Classification
      |                       |
      -----------Queue---------
                 |
                 v
               Leads
                 |
                 v
             Next.js App
                 |
                 v
          Email / Slack Alerts
```

## Current Repo State

Implemented:

- Next.js app
- Prisma schema
- PostgreSQL connection
- NextAuth Google login
- JWT sessions
- login and signup UI
- protected app shell

Planned:

- Next.js APIs for campaigns, leads, settings, and suggestions
- ingestion workers
- BullMQ queues
- Redis integration
- AI scoring pipeline
- notification workers

## Frontend Responsibilities

- authentication
- dashboard UI
- campaign management UI
- lead feed and lead detail UI
- notification settings UI

## Backend Responsibilities

- authenticated route handlers
- server actions for product workflows
- Reddit ingestion
- keyword matching
- lead scoring orchestration
- subreddit recommendation logic
- API endpoints for campaigns and leads
- alert delivery

## Recommended Next.js Structure

```text
app/(app)/
  campaigns/
  leads/
  settings/

app/api/
  leads/
  subreddits/
  worker/

actions/
  campaigns.ts
  leads.ts
  settings.ts

lib/
  auth/
  db/
  campaigns/
  leads/
  reddit/
  ai/
  notifications/
  ingestion/
  subreddits/

workers/
  ingestion/
  classification/
  notifications/
```

## Server Actions vs Route Handlers

### Server Actions

Use for UI-triggered writes:

- create campaign
- update campaign
- delete campaign
- update lead status
- save or ignore lead
- update notification settings

### Route Handlers

Use for API-style reads and worker-facing endpoints:

- leads list
- lead detail
- subreddit suggestions
- worker ingest hooks
- worker classify hooks

## Service Layer Rule

Do not put business logic directly in pages, route handlers, or server actions.

Put it in `lib/` and share it across those entry points.

## Database Responsibilities

- users
- auth accounts and sessions
- campaigns
- Reddit items
- leads
- AI analysis
- notifications
- subreddit intelligence
- ingestion cursors

## Queue Responsibilities

### Ingestion Queue

- `FETCH_POSTS`
- `FETCH_COMMENTS`
- `FETCH_THREAD_COMMENTS`

### Classification Queue

- `CLASSIFY_LEAD`
- `GENERATE_REPLIES`

### Notification Queue

- `SEND_EMAIL`
- `SEND_SLACK`

## Authentication Architecture

Handled in Next.js using NextAuth.

Current implementation:

- Google OAuth
- Prisma adapter
- JWT sessions

Future support:

- credentials login
- account linking

Workers and internal APIs should rely on the authenticated user context established by NextAuth.

## Security Rules

- never expose provider secrets in the frontend
- validate auth context in protected APIs
- verify resource ownership on all APIs
- encrypt sensitive OAuth tokens if persisted
- apply rate limits and queue retry caps

## Deployment Split

- Next.js -> Vercel
- workers -> Railway / Render / VPS
- PostgreSQL -> Neon / Supabase
- Redis -> Upstash / Redis Cloud
