# Backend Flow README

This document describes the current backend flow for campaign creation, AI-assisted setup, semantic filtering, and lead classification in this repo.

It is written from the actual implementation in the codebase, not from the aspirational architecture notes. Where something is planned but not fully wired, that is called out explicitly.

## 1. High-Level Flow

The current backend flow is:

1. User opens the campaign wizard.
2. User enters:
   - campaign name
   - lead type
   - optional description
   - optional keywords
   - optional negative keywords
   - required subreddits
   - recent-days window
   - minimum alert score
   - active or paused state
3. User may optionally ask AI to generate:
   - positive keywords
   - negative keywords
   - subreddit suggestions
4. On save, the server creates the `Campaign` row.
5. If description exists, the server generates 30 semantic queries and embeds them into `CampaignSemanticQuery`.
6. If the campaign is active, the server enqueues the initial ingestion job.
7. Ingestion worker fetches recent Reddit RSS posts from the selected subreddits.
8. Ingestion applies basic keyword and negative-keyword filtering.
9. Matching posts become `Lead` rows.
10. Each created lead is queued for embedding.
11. Embedding worker generates a vector for the Reddit item text.
12. Semantic worker compares the post embedding to campaign semantic-query embeddings.
13. If similarity passes threshold, the lead is queued for GPT classification.
14. Classification worker scores the lead, labels intent, and stores `LeadAI`.
15. Notification worker exists but is currently only scaffolded and logs jobs.

## 2. Current Source of Truth

Key files:

- `actions/campaigns.ts`
- `app/api/campaigns/suggest-terms/route.ts`
- `app/api/subreddits/suggest/route.ts`
- `worker/index.ts`
- `worker/ingestion.ts`
- `worker/embedding.ts`
- `worker/semantic.ts`
- `worker/classification.ts`
- `worker/classification-ai.ts`
- `worker/queues.ts`
- `worker/campaign-sync.ts`
- `lib/openai.ts`

## 3. Campaign Creation Flow

Implemented in `actions/campaigns.ts`.

### 3.1 Input Validation

The create payload validates:

- `name`: required, min 2 chars
- `leadType`: `PRODUCT` or `SERVICE`
- `description`: optional
- `keywords`: optional array, but each keyword must be a single word
- `negativeKeywords`: optional array
- `subreddits`: required, at least one
- `recentDays`: integer 1 to 10
- `minScoreToAlert`: integer 1 to 100
- `isActive`: boolean

Normalization behavior:

- list inputs accept newline or comma-separated values
- keywords are lowercased
- subreddits are lowercased and `r/` is stripped
- empty description becomes undefined or `null`

### 3.2 Campaign Row Creation

The server first creates the `Campaign` record in Prisma.

Stored fields include:

- name
- lead type
- description
- keywords
- negative keywords
- subreddits
- recent-days window
- minimum alert score
- active flag

### 3.3 Semantic Query Generation

This happens only if `description` is present.

If the user leaves description empty:

- no semantic queries are generated
- no semantic embeddings are created
- later semantic filtering is bypassed

If description exists:

1. Generate 30 semantic queries with AI.
2. Deduplicate them by normalized text.
3. Generate embeddings for the deduped query texts.
4. Delete any prior `CampaignSemanticQuery` rows for that campaign.
5. Insert fresh rows with:
   - query text
   - category
   - embedding vector
   - vector dimensions

### 3.4 Initial Queueing

If `isActive` is true:

- the server enqueues `INITIAL_INGEST`
- campaign sync status becomes `QUEUED`

If queueing fails:

- the campaign is rolled back and deleted

If semantic setup fails after campaign creation:

- the campaign is rolled back and deleted

This means campaign creation is treated as atomic from the user's point of view.

## 4. Optional AI Setup Helpers

These helpers are used during wizard setup and are optional. The user can enter values manually instead.

### 4.1 Keyword Suggestions

Endpoint:

- `POST /api/campaigns/suggest-terms`

Modes:

- `keywords`
- `negativeKeywords`

Requirements:

- authenticated user
- `OPENAI_API_KEY`
- description must be at least 10 chars

#### Positive Keyword Behavior

The endpoint asks AI for single-word high-signal keywords.

Post-processing then:

- trims
- lowercases
- removes duplicates
- filters out multi-word items
- excludes already-selected keywords
- caps results to 14

Important product behavior:

- keywords are optional
- if the user does not use them, ingestion can still proceed
- if no keywords exist, ingestion uses subreddits plus negative-keyword exclusion only

#### Negative Keyword Behavior

The endpoint asks AI for negative keyword phrases.

Post-processing:

- trims
- lowercases
- removes duplicates
- excludes already-selected items
- caps results to 14

Important product behavior:

- negative keywords are optional
- if present, ingestion rejects posts whose normalized content contains any negative keyword phrase

### 4.2 Subreddit Suggestions

Endpoint:

- `POST /api/subreddits/suggest`

Requirements:

- authenticated user
- `OPENAI_API_KEY`
- description at least 10 chars

Post-processing:

- trims
- lowercases
- strips `r/`
- removes duplicates
- excludes already-selected subreddits
- caps results to 14

Important product behavior:

- AI-generated subreddits are optional
- user still must end up with at least one subreddit before saving the campaign

## 5. Prompts Used During Campaign Setup

This section captures the actual prompts currently used in code.

## 5.1 Semantic Query Generation Prompt

Used in `actions/campaigns.ts`.

Model:

- `gpt-4o-mini`

Temperature:

- `0.7`

System prompt:

```text
Generate high-intent semantic search queries for product-led lead discovery. Return only JSON matching the schema.
```

User prompt:

```text
Generate 30 semantic search queries representing
high-intent product discovery signals in online
communities such as Reddit.

The goal is to detect users who are actively
looking for a solution or struggling with an
existing workflow.

The queries must represent REAL BUYING INTENT.

Include only situations where a user:
- is asking for a tool
- is looking for recommendations
- is frustrated with their current solution
- is considering switching tools
- is struggling with a manual process

Do NOT generate queries where the user is:
- sharing a tool they built
- explaining their workflow
- discussing tools in general
- promoting products
- writing case studies

Queries should resemble natural Reddit posts
or comments.

Examples of correct style:

"looking for a better way to track leads"
"any good CRM for small teams"
"what tool do you use for managing prospects"
"our lead tracking process is a mess"
"alternatives to hubspot for startups"

Return 30 queries.

Return JSON with:
{
  "queries": [
    {
      "text": "",
      "category": "",
    }
  ]
}

Product description:
"""
<campaign description>
"""
```

Output schema:

- object with `queries`
- exactly 30 items requested before dedupe
- each item contains:
  - `text`
  - `category`

## 5.2 Positive Keyword Suggestion Prompt

Used in `app/api/campaigns/suggest-terms/route.ts` when `kind = keywords`.

Model:

- `gpt-5.1`

Temperature:

- `0.3`

System prompt:

```text
You generate high-signal Reddit lead generation keywords. Return only a JSON array matching the schema.
```

User prompt:

```text
You are helping a Reddit lead generation app produce campaign keywords.

Return a JSON array of single-word keywords only.
Rules:
- no explanation
- no markdown
- no duplicates
- return between 8 and 14 items
- every item must be exactly one word
- no spaces
- no multi-word phrases
- prioritize phrases that indicate buying intent, active evaluation, recommendation-seeking, or category search
- include both category terms and intent signals when they can be expressed as one word
- keep words short and useful for Reddit matching

Campaign lead type: <PRODUCT|SERVICE>
Campaign description:
<campaign description>

Already selected:
<existing keywords or none>
```

## 5.3 Negative Keyword Suggestion Prompt

Used in `app/api/campaigns/suggest-terms/route.ts` when `kind = negativeKeywords`.

Model:

- `gpt-5.1`

Temperature:

- `0.3`

System prompt:

```text
You generate negative keywords for Reddit lead generation campaigns. Return only a JSON array matching the schema.
```

User prompt:

```text
You are helping a Reddit lead generation app produce negative keywords.

Return a JSON array of negative keyword phrases only.
Rules:
- no explanation
- no markdown
- no duplicates
- return between 6 and 12 items
- prioritize phrases that indicate low buyer intent, low fit, hobby usage, student usage, free-only intent, or irrelevant traffic
- keep phrases short and useful for filtering

Campaign lead type: <PRODUCT|SERVICE>
Campaign description:
<campaign description>

Already selected:
<existing negative keywords or none>
```

## 5.4 Subreddit Suggestion Prompt

Used in `app/api/subreddits/suggest/route.ts`.

Model:

- `gpt-5.1`

Temperature:

- `0.3`

System prompt:

```text
You recommend real, high-signal subreddits for Reddit lead generation. Infer likely buyer communities, operator communities, workflow communities, problem-aware communities, and tool-evaluation communities from the product description. Return only JSON matching the schema.
```

User prompt:

```text
You are helping a Reddit lead generation app recommend subreddits to monitor.

Return JSON with a "suggestions" array of subreddit names only.
Rules:
- no "r/" prefix
- no explanation
- no markdown
- no duplicates
- real subreddit names only
- prioritize subreddits likely to produce high-intent leads for the described offer
- include a mix of:
  - direct buyer-intent communities
  - operator or practitioner communities
  - adjacent workflow communities
  - communities where people ask for recommendations or tool alternatives
- infer relevant subreddits from the description even if the exact product category is not named
- avoid overly generic low-signal communities when more targeted ones exist
- avoid NSFW communities
- return between 10 and 14 subreddits

Campaign lead type: <PRODUCT|SERVICE>
Campaign description:
<campaign description>

Known keywords:
<keywords or none>

Already selected:
<existing subreddits or none>
```

## 6. Queue and Worker Pipeline

Queue names in `worker/queues.ts`:

- `ingestion`
- `embedding`
- `semantic`
- `classification`
- `notifications`

Single-process local dev mode:

- `npm run worker:dev`

This loads all workers through `worker/index.ts`.

## 7. Ingestion Flow

Implemented in `worker/ingestion.ts`.

### 7.1 Trigger

The ingestion worker consumes `INITIAL_INGEST`.

Current triggers:

- campaign created
- manual resync

### 7.2 Data Loaded

The worker loads the campaign:

- user ID
- keywords
- negative keywords
- subreddits
- recent-days window
- active state

### 7.3 Source

Current ingestion source:

- subreddit RSS feeds

Not the Reddit API.

### 7.4 Matching Logic

For each selected subreddit:

1. Fetch recent posts from RSS.
2. Skip posts older than `recentDays`.
3. Build text from title + description + body.
4. Normalize to lowercase and collapse whitespace.
5. Reject if any negative keyword is contained in the text.
6. If no positive keywords exist, treat the post as a match.
7. If positive keywords exist, require at least one keyword match.

This is the current first-pass filter.

Important consequence:

- keywords are optional
- semantic filtering happens only after a lead has already passed this keyword layer and has been embedded

### 7.5 Lead Creation

On a match:

1. Upsert `RedditItem`
2. Create `Lead`
3. If lead is new, enqueue `EMBED_LEAD`

Duplicate protection:

- `Lead` has a unique constraint across user, Reddit item, and campaign
- duplicate lead creates are ignored via Prisma `P2002`

## 8. Embedding Flow

Implemented in `worker/embedding.ts`.

### 8.1 Input

The worker loads the matched `RedditItem`.

Embedding source text is built from:

- `Title: ...`
- `Content: ...`

The content field prefers the longer of body or description when both exist.

### 8.2 Model

From `lib/openai.ts` defaults:

- default embedding model: `text-embedding-3-small`
- default dimensions: `1536`

### 8.3 Storage

The vector is stored in `RedditItemEmbedding` with:

- provider
- model
- source text
- dimensions
- pgvector embedding

### 8.4 Next Step

For lead-linked jobs, embedding completion enqueues:

- `SEMANTIC_MATCH_LEAD`

## 9. Semantic Filtering Flow

Implemented in `worker/semantic.ts`.

This is the semantic filtering stage you asked for.

### 9.1 Purpose

Keyword matching is broad and substring-based.

Semantic filtering narrows those candidates by checking whether the Reddit post embedding is actually close to the campaign's AI-generated semantic intent queries.

### 9.2 Threshold

Current threshold:

- `0.5`

The worker computes:

- `similarity = 1 - (distance)`

using pgvector cosine-distance style comparison in SQL.

### 9.3 Matching Logic

For each lead:

1. Confirm the lead exists.
2. Count semantic queries for the campaign.
3. If no semantic queries exist, bypass semantic filtering entirely.
4. Otherwise, compute the best campaign-query match against the Reddit item embedding.
5. If best similarity is at least `0.5`, the lead passes.
6. If best similarity is below `0.5`, the lead is filtered out before GPT classification.

### 9.4 Bypass Logic

If campaign has zero semantic queries:

- semantic worker does not block the lead
- it directly enqueues classification

This happens when:

- campaign description was omitted
- semantic query creation failed and campaign was not stored
- or the campaign intentionally has no semantic query rows

### 9.5 Filtered Lead Handling

If a lead fails semantic threshold:

- `LeadAI` is upserted with:
  - `model = semantic-threshold-filter`
  - `promptVersion = semantic-threshold-v1`
  - category from matched query category or `semantic_filtered`
  - summary like `Filtered out by semantic threshold (x.xxx < 0.50).`
  - empty pain points

This is not an LLM prompt. It is deterministic metadata written by the semantic worker.

### 9.6 Passed Lead Handling

If lead passes threshold:

- enqueue `CLASSIFY_LEAD`

## 10. Lead Classification Flow

Implemented in:

- `worker/classification.ts`
- `worker/classification-ai.ts`

### 10.1 Purpose

This is the strict commercial-intent scoring stage.

The model does not just ask:

- "Is this post relevant?"

It asks:

- "Is this a commercially meaningful lead for this specific campaign?"

### 10.2 Model and Runtime

Model:

- `OPENAI_MODEL` if set
- otherwise `gpt-4o-mini`

Rate limit guard:

- one request at least every 1000 ms in this worker process

Worker concurrency:

- `1`

### 10.3 Prompt Version

Current prompt version:

- `lead-classifier-v2`

### 10.4 Classification Prompt

System prompt:

```text
You classify Reddit posts for a B2B lead discovery SaaS.
Your job is to detect product-specific commercial intent, not just general topical relevance.
Judge the Reddit item against the actual campaign description first.
A lead is only valuable if the author appears likely to buy, adopt, switch to, evaluate, or request a solution that fits the described product or service.
Topical relevance alone is NOT enough.
Generic buyer intent alone is also NOT enough if the described campaign offer is not a strong fit.
Be strict and conservative.
If the author is not clearly seeking help, evaluating options, frustrated with an unsolved problem, or considering switching, the score should usually be LOW.
If the author has real intent but the described campaign offer does not actually match the need, score LOW or MED and explain the mismatch in the disqualifier.
Do not invent facts.
Judge only from the supplied text.
Posts are usually LOW if they are mainly:
- sharing a workflow or process
- telling a story or case study
- explaining what worked for them
- promoting a product or service
- discussing tools in general
- describing an already solved problem
- giving advice to others
- asking broad discussion questions without solution-seeking intent
Pain points must be short phrases, not full sentences.
Summary must be concise and factual.
Return only data that matches the provided JSON schema.
```

User prompt shape:

```text
Task:
Classify whether this Reddit item is a real commercial lead for the campaign.
First decide whether the need matches the described product or service.
Then decide how strong the buying intent is.

Output fields:
1. score: integer from 0 to 100
2. label: HIGH, MED, or LOW
3. intentType: none, implicit, explicit, or switching
4. buyerStage: solved, problem_aware, solution_aware, or evaluating
5. category: short category label
6. summary: concise summary
7. painPoints: up to 5 short pain points or buying signals
8. disqualifier: short reason if this is not a strong lead

Scoring guidance:
- HIGH (80-100): clear buying, recommendation, evaluation, or switching intent, and the need strongly matches the campaign description.
- MED (45-79): real unsolved commercial pain is present and relevant to the campaign, but the author does not clearly ask for a solution yet, or the fit is only partial.
- LOW (0-44): broad discussion, education, storytelling, case study, workflow sharing, self-promotion, solved problem, unclear commercial intent, or weak fit to the campaign description.

Important rules:
- A post is NOT a lead just because it mentions the topic, tools, workflows, or pain points.
- A post is NOT a strong lead unless the need is a plausible fit for the campaign description.
- Posts about how someone currently does something are usually LOW unless they clearly express dissatisfaction or desire to switch.
- Posts about a tool they built, use, or recommend to others are usually LOW unless the author is clearly seeking an alternative.
- If the problem already seems solved, score LOW.
- If intent is ambiguous, score LOW rather than MED.
- If fit to the described product is ambiguous, score LOW rather than MED.
- Use the disqualifier field to explain why a post is low fit, low intent, already solved, or mismatched to the campaign description.

Intent definitions:
- none: no evidence the author wants a solution
- implicit: pain exists but request is indirect
- explicit: direct request for recommendation, tool, service, or help
- switching: clear dissatisfaction with current method or tool and desire to replace it

Buyer stage definitions:
- solved: they already have an approach or solution and are not looking
- problem_aware: they clearly feel pain but are not yet asking for solutions
- solution_aware: they are discussing tools or ways to solve it
- evaluating: they are actively comparing, requesting, or considering options

Fit guidance:
- Use the campaign description as the primary reference for what counts as a good lead.
- If the Reddit item describes a different problem, different buyer, or different workflow than the campaign description, lower the score.
- Only score HIGH when both fit and intent are strong.

Campaign name: <campaign name>
Lead type: <lead type>
Campaign description: <description or None>
Campaign keywords: <keywords>
Campaign negative keywords: <negative keywords>
Target subreddits: <subreddits>

Reddit item type: <POST|COMMENT>
Subreddit: r/<subreddit>
Title: <title>
Description: <description>
Body: <body>
Author: <author>
URL: <url>
```

### 10.5 Classification Output Schema

The classifier must return:

- `score`: 0 to 100 integer
- `label`: `HIGH | MED | LOW`
- `intentType`: `none | implicit | explicit | switching`
- `buyerStage`: `solved | problem_aware | solution_aware | evaluating`
- `category`
- `summary`
- `painPoints`
- `disqualifier`

### 10.6 Persistence

After successful classification:

- `Lead.score` is updated
- `Lead.label` is updated
- `LeadAI` is upserted with:
  - model
  - prompt version
  - intent type
  - buyer stage
  - category
  - summary
  - pain points
  - disqualifier

### 10.7 Alert Threshold

The code computes whether the score crossed `minScoreToAlert`, but the current worker does not yet send real notifications.

So right now:

- threshold is stored and checked
- notification delivery is not fully implemented

## 11. Notification Flow

Implemented only as scaffolding in `worker/notifications.ts`.

Current state:

- consumes notification jobs
- logs that a job was processed
- no actual email or Slack delivery logic in this file yet

## 12. Campaign Sync State Machine

Managed by `worker/campaign-sync.ts`.

Statuses:

- `IDLE`
- `QUEUED`
- `PROCESSING`
- `COMPLETED`
- `FAILED`

Stages:

- `NONE`
- `QUEUED`
- `FETCHING_POSTS`
- `FETCHING_COMMENTS`
- `CLASSIFYING`
- `NOTIFYING`
- `COMPLETED`
- `FAILED`

The workers update this sync row throughout the run to power UI progress.

Tracked stats currently include:

- fetched posts
- promising posts
- matched items
- created leads
- embedded leads
- semantic checked leads
- semantic passed leads
- semantic filtered leads
- classified leads
- duration

## 13. OpenAI Integration Notes

Implemented in `lib/openai.ts`.

Current behavior:

- chat completions use JSON schema mode
- embeddings use `/v1/embeddings`
- retries on 429 and 5xx
- exponential backoff with jitter
- schema output is strict

Defaults:

- text model default: `gpt-4o-mini`
- embedding model default: `text-embedding-3-small`
- embedding dimensions default: `1536`

## 14. What Is Optional vs Required

Required to create a campaign:

- name
- lead type
- at least one subreddit
- recent-days value
- minimum alert score

Optional:

- description
- keywords
- negative keywords
- AI-generated keyword suggestions
- AI-generated negative-keyword suggestions
- AI-generated subreddit suggestions

Behavioral consequence of optional description:

- no description means no semantic query generation
- no semantic queries means semantic filtering is bypassed
- classification still runs on matched leads

Behavioral consequence of optional keywords:

- if no positive keywords are set, any post from selected subreddits can pass the first-pass keyword gate, unless blocked by negative keywords

## 15. Current Backend Plan Summary

The practical backend plan in this repo is:

1. Use subreddit selection as the top-level source scoping layer.
2. Optionally use positive and negative keywords as a fast lexical first-pass filter.
3. Use campaign description to generate semantic-intent queries.
4. Embed those campaign queries once at campaign setup time.
5. Ingest subreddit RSS posts and create candidate leads.
6. Embed each matched Reddit post.
7. Perform semantic threshold filtering against the campaign query vectors.
8. Send only semantically plausible leads to GPT classification.
9. Persist strict commercial-intent scoring and reasoning into `Lead` and `LeadAI`.
10. Later, wire real notification delivery on top of alert thresholds.

That means the intended ranking/filtering stack is:

1. Community targeting via subreddits
2. Fast lexical filtering via keywords and negative keywords
3. Vector relevance filtering via semantic query embeddings
4. Strict final commercial-intent judgment via GPT classification

## 16. Gaps and Implementation Notes

Current important gaps:

- notification worker is not fully implemented
- ingestion currently processes RSS posts only
- comments are not actually fetched even though some sync stage names still reference comments
- semantic threshold is a fixed constant, not per-campaign configurable
- update campaign flow does not currently regenerate semantic queries after description changes

That last point is especially important:

- create campaign generates semantic queries if description exists
- update campaign currently updates the campaign row only
- it does not rebuild semantic queries or query embeddings

So semantic query setup is currently strongest on create, not on edit.
