# Architecture Reference

This document is the engineering reference for the Reddit Lead Generation SaaS.

Use it to align implementation decisions across the Next.js app, ingestion workers, AI processing, and notification systems.

## System Summary

The product is a Reddit lead discovery platform.

It continuously ingests Reddit post data from public subreddit RSS feeds, filters and scores candidate leads, stores structured lead records, and exposes those records to a dashboard used by end users.

The system is split into:

- Next.js for UI, authentication, APIs, and server actions
- PostgreSQL for application data
- Prisma ORM for schema and access
- Redis for caching, rate limiting, and queues
- BullMQ for background job processing
- AI provider integrations for lead scoring and reply generation

## High-Level Architecture

```text
          Reddit RSS Feeds
                 |
                 v
        Ingestion Workers (BullMQ)
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

## Responsibilities by Layer

### Next.js

Owns:

- authentication UI
- session handling
- dashboard UI
- campaign management UI
- lead feed UI
- lead detail UI
- settings UI

Should not own:

- Reddit ingestion
- heavy lead scoring logic
- queue processing
- notification dispatch

### PostgreSQL

Stores:

- users
- auth accounts and sessions
- campaigns
- Reddit items
- leads
- AI analysis
- notifications
- subreddit intelligence
- ingestion cursors

### Redis

Used for:

- BullMQ backing store
- ingestion job coordination
- short-lived caches
- adaptive polling state

## Current Repository State

Currently implemented in this repo:

- Next.js app
- Prisma schema
- Postgres connection
- NextAuth with Google login
- JWT session strategy
- login and signup frontend
- protected app route shell

Not yet fully implemented in this repo:

- lead dashboard
- lead detail workflow
- RSS-based ingestion worker implementation
- notification delivery workers
- final queue wiring from campaign creation into sync jobs

## Authentication Architecture

Authentication is handled in Next.js with NextAuth.

Current approach:

- Google OAuth provider
- Prisma adapter for user and account persistence
- JWT sessions for route protection and middleware compatibility

Flow:

1. User clicks Google sign-in in Next.js
2. NextAuth completes OAuth flow
3. User record is created or reused in PostgreSQL
4. JWT session is issued
5. Next.js protects app routes using the authenticated session
6. Future worker-triggered or internal API calls can use the authenticated user context where needed

### Why JWT sessions

JWT sessions were chosen because route protection and middleware behavior are more reliable in this setup than database sessions for the current app architecture.

### Planned future auth expansion

The schema already supports:

- credentials login
- password storage via `UserPassword`
- account linking

These are intentionally not active in the MVP UI yet.

## Frontend Architecture

### Routing

Current routes:

- `/`
- `/login`
- `/signup`
- `/app`
- `/api/auth/[...nextauth]`

Planned routes:

- `/campaigns`
- `/campaigns/new`
- `/campaigns/[id]`
- `/leads`
- `/leads/[id]`
- `/settings`

### UI System

Frontend UI is based on:

- Tailwind CSS
- `shadcn/ui`-style component primitives

Design rules are defined in:

- [UI-DESIGN-README.md](C:\Users\rs329\goal\my-app\UI-DESIGN-README.md)

### Frontend Data Flow

Recommended direction:

1. Next.js page loads
2. Session is validated server-side
3. Frontend requests Next.js route handlers or uses server actions
4. Next.js returns campaign or lead data
5. UI renders server state using React Query for caching and refresh

## Backend Architecture

Backend responsibilities should stay inside the Next.js app until complexity justifies extraction.

Recommended structure:

```text
app/api/
  worker/
    ingest/
    classify/
  campaigns/
  leads/
  settings/
  subreddits/

app/(app)/
  campaigns/
  leads/
  settings/

actions/
  campaigns.ts
  leads.ts
  settings.ts

lib/
  auth/
  db/
  campaigns/
  leads/
  notifications/
  ai/
  ingestion/
  reddit/
  subreddits/

workers/
  ingestion/
  classification/
  notifications/
```

### Auth layer

Responsibilities:

- validate the session
- expose current user context
- protect user-scoped operations

### Campaigns layer

Responsibilities:

- create campaigns
- update campaigns
- list campaigns
- validate campaign ownership

### Leads layer

Responsibilities:

- fetch lead lists
- fetch lead detail
- update lead status
- filter and paginate results

### Reddit ingestion layer

Responsibilities:

- fetch subreddit RSS feeds
- parse and normalize RSS entries into post records
- deduplicate feed items
- enforce bounded polling behavior

### Ingestion workers

Responsibilities:

- polling scheduler
- cursor advancement
- deduplication handoff
- job fanout into classification

### AI layer

Responsibilities:

- classify intent
- summarize content
- extract pain points
- generate suggested replies

### Notification workers

Responsibilities:

- email dispatch
- Slack webhook dispatch
- delivery retries
- delivery status persistence

## Server Actions vs Route Handlers

Use both, but with a clear split.

### Server Actions

Use server actions for UI-triggered mutations inside the Next.js app.

Recommended:

- `actions/campaigns.ts`
  - `createCampaign`
  - `updateCampaign`
  - `deleteCampaign`
- `actions/leads.ts`
  - `updateLeadStatus`
  - `saveLead`
  - `ignoreLead`
- `actions/settings.ts`
  - `updateNotificationSettings`

Best fit:

- forms
- button-triggered mutations
- authenticated user-owned writes

### Route Handlers

Use route handlers for API-style reads and machine-facing endpoints.

Recommended:

- `app/api/leads/route.ts`
- `app/api/leads/[id]/route.ts`
- `app/api/subreddits/suggest/route.ts`
- `app/api/worker/ingest/route.ts`
- `app/api/worker/classify/route.ts`

Best fit:

- filtered reads
- pagination
- React Query fetches
- worker callbacks
- cron-style triggers
- webhooks

### Service Layer Rule

Business logic should live in `lib/`, not in pages, server actions, or route handlers.

Example:

- `lib/campaigns/create-campaign.ts`
- `lib/campaigns/list-campaigns.ts`
- `lib/leads/list-leads.ts`
- `lib/leads/update-lead-status.ts`
- `lib/subreddits/suggest-subreddits.ts`

Pages, server actions, and route handlers should all call shared service functions.

## Database Architecture

Prisma is the source of truth for schema design.

Main data flow:

1. Users create campaigns
2. Reddit posts are ingested and stored
3. Campaign matching generates leads
4. AI analysis enriches leads
5. Notifications are created and sent

### Key models

#### `User`

Stores identity, plan, notification preferences, and top-level ownership.

#### `Campaign`

Defines targeting criteria:

- lead type
- keywords
- negative keywords
- subreddits
- score threshold

#### `RedditItem`

Canonical store for Reddit content ingested by the MVP.

Current MVP usage is post-only via RSS.

Unique fullname values prevent duplication.

#### `Lead`

Joins:

- user
- campaign
- Reddit item

Also stores:

- score
- label
- status

#### `LeadAI`

Stores AI-generated enrichment for a lead.

#### `Notification`

Stores delivery attempts and notification channel state.

#### `Subreddit`

Stores ranked or suggested subreddit intelligence.

#### `TrackedThread`

Stores threads that require aggressive short-term monitoring.

#### `IngestCursor`

Stores ingestion progress and backoff state by subreddit.

## Lead Detection Pipeline

### 1. Ingestion

Workers fetch:

- recent posts from tracked subreddit RSS feeds

### 2. Deduplication

Use Reddit fullname as the unique ingestion key:

- `t3_*` for posts when available from parsed feed data
- fallback to stable Reddit post identifiers derived from feed entries when needed

### 3. Campaign candidate filtering

Candidate items are matched against:

- keywords
- negative keywords
- subreddit rules

### 4. AI scoring

The AI layer determines:

- intent score
- category
- summary
- pain points
- optional reply suggestions

### 5. Lead creation

Matched posts are inserted as candidate leads and then enriched by AI scoring.

### 6. Notification dispatch

If the lead qualifies for alerting, jobs are added for:

- email
- Slack

## Queue Architecture

BullMQ queues should be separated by responsibility.

### Ingestion queue

Jobs:

- `INITIAL_INGEST`
- future bounded resync jobs when manual refresh is added

### Classification queue

Jobs:

- `CLASSIFY_LEAD`
- `GENERATE_REPLIES`

### Notification queue

Jobs:

- `SEND_EMAIL`
- `SEND_SLACK`

### Design rule

Keep workers idempotent.

Every job should be safe to retry.

## Reddit Source Strategy

Use public subreddit RSS feeds for discovery.

Capabilities:

- read recent subreddit posts
- monitor targeted communities without Reddit API auth
- support post-level discovery for campaign matching

Explicit MVP limits:

- no Reddit API dependency for ingestion
- no comment ingestion
- no automated posting
- no automated commenting

Reply suggestions are generated for manual use only.

## Ranking Strategy

Lead ranking should combine:

- AI intent score
- freshness bonus
- keyword strength
- subreddit quality

Example:

```text
score = intent_score
      + freshness_bonus
      + keyword_strength
      + subreddit_quality
```

Fresh high-intent opportunities should float to the top first.

## Notification Architecture

Notifications are triggered when:

- a lead meets the score threshold
- the user has the channel enabled

Supported channels:

- email
- Slack webhook

Each dispatch attempt should:

- create or update a `Notification` row
- capture status
- capture send time
- capture failure details when present

## Security Rules

- Never expose AI provider secrets to the frontend
- Encrypt sensitive OAuth tokens at rest if persisted
- Validate sessions and auth context before allowing API access
- Check resource ownership on all campaign and lead endpoints
- Apply API rate limits
- Apply queue retry caps
- Sanitize external payloads before storage when appropriate

## Suggested Environment Variables

### Frontend

```env
DATABASE_URL=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### App and workers

```env
DATABASE_URL=
REDIS_URL=

OPENAI_API_KEY=
OPENAI_MODEL=
```

## Deployment Reference

Recommended deployment split:

- Next.js on Vercel
- workers on Railway, Render, or VPS
- PostgreSQL on Neon or Supabase
- Redis on Upstash or Redis Cloud

## MVP Implementation Order

Recommended build sequence:

1. authentication
2. campaign creation
3. campaign listing
4. campaign API in Next.js
5. Reddit RSS ingestion worker
6. keyword candidate matching
7. AI scoring
8. lead dashboard
9. lead detail page
10. email and Slack alerts

## Roadmap Notes

Possible future expansions:

- direct engagement workflows
- social network expansion beyond Reddit
- CRM sync
- analytics and attribution
- collaboration features

Keep the MVP focused on discovery first.
