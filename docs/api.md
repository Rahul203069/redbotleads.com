# API Reference

This document describes the intended Next.js API surface for the Reddit Lead Generation SaaS.

## API Boundary

This project uses:

- server actions for UI-triggered mutations
- route handlers for API-style reads and machine-facing endpoints

Business logic should be shared through `lib/` services.

## Auth

Authentication UI and OAuth are handled in Next.js.

Protected API routes should:

- validate the NextAuth session
- derive the authenticated user context

### Endpoint

```http
GET /me
```

Returns the current authenticated user.

## Campaigns

Create and manage campaign definitions.

### Mutation entry points

Recommended through server actions:

- `createCampaign`
- `updateCampaign`
- `deleteCampaign`

Route handlers can be added later if external or machine-facing access is needed.

## Leads

Retrieve and update detected leads.

### Read endpoints

```http
GET /api/leads
GET /api/leads/:id
```

### Mutation entry points

Recommended through server actions:

- `updateLeadStatus`
- `saveLead`
- `ignoreLead`

### Query Params

- `campaignId`
- `status`
- `minScore`
- `cursor`
- `limit`

## Subreddit Suggestions

Used during campaign creation.

### Endpoint

```http
POST /api/subreddits/suggest
```

### Input

- `description`
- `keywords`

### Response

- recommended subreddits

## Notification Settings

### Endpoints

```http
GET /api/settings/notifications
PATCH /api/settings/notifications
```

## Auth Token Contract

Server-side handlers should:

- resolve the session
- extract the user ID
- use that user ID for ownership checks

## API Design Rules

- all campaign and lead routes must be user-scoped
- use cursor pagination for lead feeds
- keep filters explicit and composable
- validate all inputs at the module boundary
- do not expose internal ingestion fields unless needed by UI
- prefer server actions for app-owned writes before adding extra route handlers
