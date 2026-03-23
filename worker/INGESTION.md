# Ingestion Worker Flow

This document defines the intended behavior of the Reddit ingestion worker for the MVP.

## Goal

The ingestion worker should:

- fetch recent Reddit posts for each active campaign
- keep the first sync bounded and fast
- avoid storing large amounts of low-signal content
- create candidate leads for later AI classification

The worker is intentionally split into two layers:

1. heuristic filtering
2. AI classification

Heuristics decide what is worth fetching and storing.
AI decides how strong the lead actually is.

## Trigger

The first ingestion run should happen when:

- a new campaign is created
- the campaign is active

The app should enqueue an initial ingestion job for that campaign.

Suggested job name:

- `INITIAL_INGEST`

Suggested job payload:

```tscco
{
  campaignId: string;
  trigger: "campaign_created" | "manual_resync";
}
```

## Campaign Inputs

The worker should load the campaign from the database and use:

- `id`
- `userId`
- `keywords`
- `negativeKeywords`
- `subreddits`
- `recentDays`
- `minScoreToAlert`
- `isActive`

If the campaign is inactive, the worker should skip ingestion.

## First Sync Scope

The first sync should be intentionally bounded.

Recommended limits:

- only ingest content inside `campaign.recentDays`
- cap posts per subreddit at `100`
- do not fetch all comments for all posts
- fetch comments only for promising posts

This keeps initial sync fast and avoids filling the database with stale or irrelevant content.

## High-Level Flow

1. Load campaign.
2. Skip if inactive.
3. Fetch recent posts from each target subreddit.
4. Ignore posts older than `recentDays`.
5. Run heuristic scoring on each post.
6. Save matching posts as `RedditItem`.
7. Fetch comments only for promising posts.
8. Run heuristic filtering on comments.
9. Save matching comments as `RedditItem`.
10. Create candidate `Lead` records for matched items.
11. Enqueue classification jobs for AI scoring.
12. Mark sync complete in logs or sync state.

## Why Comments Are Not Fetched Blindly

Comment ingestion is expensive and noisy.

The worker should not fetch comments for every post because:

- most posts are not actionable
- comment trees can be large
- AI cost grows quickly if noise enters the pipeline
- first-time sync should return results quickly

So comments should only be fetched for posts that pass a lightweight heuristic gate.

## Promising Post Heuristic

The current heuristic lives in:

- [worker/ingestion-heuristics.ts](C:\Users\rs329\goal\my-app\worker\ingestion-heuristics.ts)

`isPromisingPost()` returns:

- `shouldIngestComments`
- `score`
- `reasons`

### Heuristic Signals

Positive signals:

- keyword match in title
- keyword match in body
- intent phrase match in title
- intent phrase match in body
- some existing discussion
- some post engagement

Negative signals:

- negative keyword match
- low-information content
- outside recency window
- empty content

### Current Threshold

Comments should be fetched when:

- `heuristicScore >= 4`

That threshold can be tuned later.

## Heuristic vs AI

The worker should use both, but for different jobs.

### Heuristic stage

Used for:

- deciding whether a post is promising
- deciding whether comments should be fetched
- removing obvious low-signal noise

### AI stage

Used for:

- final intent scoring
- lead label assignment
- category extraction
- lead summary
- pain point extraction

Heuristic score is operational.
AI score is product-facing.

## Persistence Rules

### Reddit items

Posts and comments should be stored in `RedditItem`.

Deduplication should use:

- `fullname`

Examples:

- `t3_xxxxxx` for posts
- `t1_xxxxxx` for comments

If a `fullname` already exists:

- do not recreate it
- reuse the existing record

### Leads

A `Lead` should be created only when:

- the item matches the campaign
- the item is not already linked to the same campaign

Deduplication is already modeled by:

- `@@unique([userId, redditItemId, campaignId])`

## Comment Fetch Strategy

Comments should be fetched only for promising posts.

Suggested approach:

- fetch top-level comments first
- ignore comments outside the campaign recency window
- apply keyword and negative-keyword filtering before storing as lead candidates
- avoid deep recursive ingestion in the MVP

Good MVP rule:

- limit per post comment ingestion
- prefer recent comments over complete history

## Classification Queue Handoff

The ingestion worker should not do heavy AI work directly.

After candidate leads are created, enqueue a classification job.

Suggested job name:

- `CLASSIFY_LEAD`

Suggested payload:

```ts
{
  leadId: string;
  campaignId: string;
}
```

## Notifications

The ingestion worker should not notify users directly.

Notifications should happen only after AI classification confirms:

- score is valid
- label is valid
- threshold is met

So the ingestion worker only prepares candidates.

## Logging

The worker should log at least:

- campaign id
- subreddit
- fetched post count
- promising post count
- fetched comment count
- matched item count
- created lead count
- job duration
- error details

This is enough for MVP observability even before a full sync-state table exists.

## Failure Behavior

If one subreddit fails:

- log the error
- continue with the remaining subreddits when possible

If the whole job fails:

- BullMQ retry policy should handle it
- ingestion should remain idempotentsing

## Idempotency Rules

The ingestion worker must be safe to rerun.

That means:

- duplicate `RedditItem` rows must not be created
- duplicate `Lead` rows must not be created
- rerunning a campaign sync should only fill missing items

## MVP Non-Goals

The first ingestion worker should not try to do all of these:

- full historical backfills
- deep nested comment crawling
- direct Reddit posting
- engagement automation
- multi-platform ingestion
- analytics-heavy sync state

The first goal is simple:

Find recent Reddit content that is likely relevant, save it safely, and hand it off for AI classification.
