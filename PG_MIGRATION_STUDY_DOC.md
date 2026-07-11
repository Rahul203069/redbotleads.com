# PostgreSQL and pgvector Migration Study Guide

This document explains the engineering concepts behind moving this application
from Neon to a self-hosted PostgreSQL and pgvector deployment on AWS Lightsail.
It is a study guide, not only a list of commands. Each section explains what was
changed, why it was changed, what tradeoff was accepted, and what a senior
engineer should verify before calling the system production-ready.

The implementation discussed here is primarily in:

- [`compose.vm.yaml`](compose.vm.yaml)
- [`deploy/postgres/init/10-create-app-role.sh`](deploy/postgres/init/10-create-app-role.sh)
- [`lib/prisma.ts`](lib/prisma.ts)
- [`worker-rss/src/prisma.ts`](worker-rss/src/prisma.ts)
- [`scripts/verify-pgvector.mjs`](scripts/verify-pgvector.mjs)
- [`scripts/backup-postgres.sh`](scripts/backup-postgres.sh)
- [`scripts/sync-pgbouncer-tls.sh`](scripts/sync-pgbouncer-tls.sh)
- [`.env.vm.example`](.env.vm.example)
- [`.dockerignore`](.dockerignore)
- [`DEPLOYMENT.md`](DEPLOYMENT.md)

## 1. The Goal and the Constraints

The application originally used Neon as an externally hosted PostgreSQL
database. Neon provided database storage, PostgreSQL compute, remote
connectivity, and pgvector support. The database stopped accepting work after
the project exceeded its compute-time quota.

The new goal is to run these components on one 4 GB RAM, 2 vCPU Lightsail VM:

- PostgreSQL with pgvector
- PgBouncer
- Redis
- Main BullMQ workers
- Database-maintenance worker

The Next.js web application remains on Vercel. This creates an important
networking constraint: the web application is outside the VM and still needs a
secure way to query the database.

The migration intentionally starts with a fresh database. Existing Neon users,
campaigns, posts, embeddings, and semantic results are not copied. Search
behavior is preserved for new data, but historical search results cannot exist
without historical data.

### Senior engineering lesson

Infrastructure decisions are always constrained by workload, budget, failure
tolerance, and network topology. "Run PostgreSQL locally" is not a complete
design until you answer:

1. Which processes connect to it?
2. From which networks?
3. Who owns backups and upgrades?
4. What happens when the VM or disk fails?
5. How much memory and how many connections can the machine support?
6. Which behaviors must remain exactly compatible?

## 2. Architecture Before and After

### Previous architecture

```text
Vercel web app -----------+
                          +---- Neon PostgreSQL + pgvector
Lightsail workers --------+

Lightsail workers ------------ Redis on Lightsail
Vercel web app ---------------- Redis on Lightsail, when queue access is needed
```

Neon was responsible for PostgreSQL operations. The application only supplied
a `DATABASE_URL`.

### New architecture

```text
                    Internet, TLS on port 6432
Vercel web app ------------------------------------+
                                                    |
                                                    v
                                            +---------------+
                                            |   PgBouncer   |
                                            +-------+-------+
                                                    |
                                           private Docker network
                                                    |
                                                    v
+-----------------------------------------------------------------------+
| Lightsail VM                                                         |
|                                                                       |
|  +-------------+       +-------------+       +--------------------+  |
|  | PostgreSQL  |<------| PgBouncer   |       | Redis              |  |
|  | + pgvector  |       +-------------+       +--------------------+  |
|  +------+------+                                  ^                   |
|         ^                                         |                   |
|         | private Docker network                  |                   |
|         +-------------------+---------------------+                   |
|                             |                                         |
|                     +-------+--------+                                |
|                     | Node workers   |                                |
|                     +----------------+                                |
+-----------------------------------------------------------------------+
```

PostgreSQL does not publish port `5432`. Worker connections stay inside the
Docker network. Only PgBouncer publishes port `6432` for Vercel.

### Why a diagram matters

Architecture diagrams reveal trust boundaries. Every line crossing from the
internet into the VM requires authentication, encryption, monitoring, and a
reason to exist. A senior engineer should be able to point to every published
port and explain who needs it.

## 3. PostgreSQL and pgvector

### PostgreSQL is the database engine

PostgreSQL stores the application's relational data:

- Users and authentication records
- Campaigns and semantic queries
- Reddit items and leads
- Worker runs and analytics
- Embedding metadata

PostgreSQL provides transactions, constraints, foreign keys, indexes,
concurrency control, and crash recovery. These are not features Docker provides;
Docker only packages and runs the PostgreSQL process.

### pgvector is a PostgreSQL extension

pgvector adds vector column types and vector-distance operators to PostgreSQL.
The project declares columns such as:

```prisma
embedding Unsupported("vector(1536)")?
```

Prisma marks the type as `Unsupported` because Prisma does not natively map the
pgvector value to an ordinary JavaScript type. The application therefore uses
raw SQL when reading or writing vectors.

The first vector migration runs:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Installing pgvector software in the image makes the extension available, while
`CREATE EXTENSION` enables it inside a particular database. Both steps are
required.

### Why the image is version-pinned

The Compose stack uses:

```yaml
image: pgvector/pgvector:0.8.5-pg17
```

This pins PostgreSQL to major version 17 and pgvector to version 0.8.5.

Using an unpinned `latest` image could change behavior during an ordinary
redeployment. Database upgrades require more care than stateless application
updates because the on-disk data format, extension compatibility, SQL planner,
and rollback process matter.

### Senior engineering lesson

Pin infrastructure versions. Upgrade intentionally with:

1. A compatible backup
2. Release-note review
3. A staging restore
4. Application and query tests
5. A rollback strategy

## 4. Persistent Storage and Container Lifecycles

The PostgreSQL service mounts a named Docker volume:

```yaml
volumes:
  - postgres-data:/var/lib/postgresql/data
```

A container is disposable. Its writable filesystem disappears when the
container is removed. A named volume has a separate lifecycle and preserves the
database cluster across container replacement.

This protects against container recreation, but it does not protect against:

- Lightsail disk failure
- Accidental volume deletion
- Filesystem corruption
- Operator error
- Account compromise
- Region failure

That is why a persistent volume and backups are both required.

### Initialization runs only once

Files under `/docker-entrypoint-initdb.d` run only when PostgreSQL initializes an
empty data directory. The application-role script therefore runs on the first
creation of `postgres-data`, not on every restart.

Changing `POSTGRES_APP_PASSWORD` in `.env.vm` later does not update the existing
database role. It requires an explicit command such as:

```sql
ALTER ROLE reddit_leads_app PASSWORD 'new-password';
```

### Senior engineering lesson

Separate these concepts:

- Container lifecycle: temporary process packaging
- Volume lifecycle: persistent local state
- Backup lifecycle: recoverable copies outside the failure domain
- Schema lifecycle: controlled through migrations

## 5. Database Roles and Least Privilege

The deployment uses two PostgreSQL roles:

### Owner role

The owner role:

- Owns the database and schema objects
- Enables extensions
- Applies Prisma migrations
- Performs administrative restores

It is not given to Vercel or normal workers.

### Application role

The application role:

- Connects to the application database
- Reads and changes application rows
- Uses tables created by future owner migrations
- Cannot administer the schema

The initialization script grants current schema access and configures default
privileges for tables and sequences created later by the owner.

### Why default privileges matter

A grant applies only to objects that exist when the grant runs. A fresh database
has no Prisma tables yet, because migrations run afterward. `ALTER DEFAULT
PRIVILEGES` tells PostgreSQL which grants to apply to future objects created by
the owner.

Default privileges are associated with the role that creates the future object.
If migrations later run as a different owner, the expected grants may not be
applied. This is a subtle PostgreSQL ownership rule worth remembering.

### Why not use the owner everywhere?

If an application bug allows SQL injection or credentials leak, owner access
could let an attacker drop tables, modify schema, create privileged functions,
or interfere with migrations. Least privilege limits the blast radius.

### Senior engineering lesson

Credentials should represent responsibilities:

- Migration identity owns schema changes.
- Runtime identity reads and writes business data.
- Backup identity needs only backup-related privileges.
- Human administrators use separately audited access.

Do not solve a permissions problem by giving every process superuser access.

## 6. Prisma Migrations and Dependency Ordering

The repository's historical migration chain starts with incremental vector
changes and does not contain the original core-schema migration. The Compose
stack therefore has an explicit fresh-database bootstrap mode:

```text
FRESH_DATABASE_BOOTSTRAP=true node scripts/deploy-database.mjs
```

Bootstrap mode resets only the new database's `public` schema, enables pgvector,
pushes the current Prisma schema, and records the legacy migrations as an
applied baseline. It must never be enabled for a database containing data.
After the baseline exists, the same service runs ordinary `prisma migrate
deploy`, which applies only future committed production migrations.

Workers use this dependency:

```yaml
depends_on:
  migrate:
    condition: service_completed_successfully
```

This establishes an ordering rule:

1. PostgreSQL becomes healthy.
2. Migrations complete successfully.
3. Workers start.

Without this rule, a fresh worker could try to query a table that does not yet
exist. This is called a startup race.

### Migration history

Prisma records applied migrations in `_prisma_migrations`. The migration files
and this table together describe schema state. Never manually mark a migration
successful without understanding what SQL actually ran.

### Backward-compatible deployment thinking

For a single-VM fresh database, stopping workers during migrations is simple. In
a larger zero-downtime system, old and new application versions may run at the
same time. Schema changes then need an expand-and-contract approach:

1. Add backward-compatible schema.
2. Deploy code that can use both forms.
3. Backfill data.
4. Switch reads and writes.
5. Remove old schema in a later deployment.

## 7. Vector Embeddings and Semantic Search

### What an embedding is

An embedding converts text into an ordered list of numbers. Texts with similar
meaning tend to occupy nearby positions in the model's vector space.

This project uses:

```text
Model: text-embedding-3-small
Dimensions: 1536
```

Model and dimension are part of the data contract. A vector produced by another
model or with another dimension should not be compared as though it came from
the same space.

### Cosine similarity

The application uses pgvector's cosine-distance operator:

```sql
embedding_a <=> embedding_b
```

Cosine distance is:

```text
distance = 1 - cosine_similarity
```

Therefore the application calculates similarity with:

```sql
1 - (embedding_a <=> embedding_b)
```

Higher similarity is better. Ordering by distance ascending is equivalent to
ordering by similarity descending.

### Why the semantic behavior was not rewritten

Search parity depends on preserving all of these together:

- Embedding provider and model
- Embedding dimensions
- Source-text construction
- Distance metric
- Query ordering
- Candidate filters
- Top-K behavior
- Similarity threshold
- Tie handling

Changing the database host does not require changing the semantic algorithm.
The migration therefore keeps the current 1536-dimensional vectors, cosine
distance, and threshold of `0.5`.

### Exact search versus approximate search

The current migrations contain commented examples for HNSW indexes, but no
HNSW or IVFFlat index is enabled.

An exact scan calculates distance for every eligible candidate. It maximizes
recall but consumes more CPU as the candidate set grows.

Approximate nearest-neighbor indexes trade some recall for speed:

- HNSW builds a navigable graph. It usually gives strong query performance and
  recall, but consumes memory and has slower index construction and writes.
- IVFFlat divides vectors into lists. It requires training-like index creation
  after representative data exists and depends heavily on probe settings.

The worker currently limits semantic candidate batches to around 1,000 items.
Exact comparisons are a reasonable first choice at that scale and avoid a
ranking change during infrastructure migration.

### What "same accuracy" actually means

Semantic accuracy is not guaranteed merely because pgvector is installed. A
good parity test compares:

1. The same source text
2. The same embedding vectors
3. The same campaign queries
4. The same candidate population
5. The same scores and ordering
6. The same threshold decisions

Because this deployment starts fresh, it can verify algorithmic parity, not
historical-result parity.

## 8. The pgvector Verification Script

`scripts/verify-pgvector.mjs` performs four checks.

### Extension check

It queries `pg_extension` and fails if pgvector is not enabled.

### Schema contract check

It inspects PostgreSQL catalogs and requires these columns to be exactly
`vector(1536)`:

- `RedditItemEmbedding.embedding`
- `CampaignSemanticQuery.embedding`
- `CampaignSemanticPlaygroundQuery.embedding`

This catches missing migrations or accidental dimension changes.

### Approximate-index check

It fails if a public-schema index uses HNSW or IVFFlat. This makes the current
exact-search requirement executable rather than relying only on documentation.

### Known cosine-ranking check

It creates a temporary three-dimensional table and compares these vectors to
`[1,0,0]`:

```text
exact:    [ 1, 0, 0]
near:     [ 1, 1, 0]
opposite: [-1, 0, 0]
```

Expected similarity order:

```text
exact > near > opposite
```

Expected scores are approximately:

```text
1.0, 0.70710678, -1.0
```

Temporary tables disappear when the verification session ends, so the test
does not add application data.

### Senior engineering lesson

Critical assumptions should become automated checks. Documentation explains
intent; executable verification detects drift.

## 9. Why PgBouncer Exists

### PostgreSQL connections are not free

Each PostgreSQL backend connection consumes memory and server resources.
Serverless platforms can create many application instances, and each instance
can create its own connection pool. A small VM can be overwhelmed even when the
query rate is modest.

### PgBouncer multiplexes connections

PgBouncer accepts many client connections but reuses a smaller set of backend
PostgreSQL connections.

```text
Many Vercel client connections
             |
             v
       PgBouncer pool
             |
             v
Few PostgreSQL server connections
```

### Transaction pooling

The stack uses transaction-pooling mode. A backend connection is assigned for
the duration of one transaction and then returned to the pool.

This is efficient, but applications must not assume session state survives
between transactions. Features that need care include:

- Temporary tables used across separate transactions
- Session-level `SET` values
- Advisory locks tied to one session
- `LISTEN` and `NOTIFY` listeners
- Session-scoped prepared statements on older poolers

The configured PgBouncer version supports tracking prepared statements, and
`MAX_PREPARED_STATEMENTS` is bounded.

### Connection budgeting

PostgreSQL is configured with 30 maximum connections. The deployment reserves a
budget rather than letting every component use 30:

```text
Main worker pool                 5
Maintenance worker pool          2
PgBouncer backend maximum       12
Administration and migrations   remaining headroom
```

The exact number of active connections varies, but the configured ceilings are
designed to remain below PostgreSQL's maximum.

### Prisma pool bounds

`lib/prisma.ts` passes these values to the underlying `pg` pool:

```text
max
connectionTimeoutMillis
idleTimeoutMillis
```

Vercel should use `DATABASE_POOL_MAX=2`. A smaller per-instance pool is
important because Vercel may create multiple instances. The worker gets a
larger local pool because it is a known, bounded process.

### Senior engineering lesson

Capacity planning is multiplication, not intuition:

```text
possible connections = process instances * pool size
```

Always calculate the worst plausible total across web servers, workers,
scheduled jobs, migrations, monitoring, and administrators.

## 10. TLS, DNS, and Remote Database Access

### Why TLS is required

Vercel reaches PgBouncer over the public internet. Without TLS, database
credentials and query data could be read in transit.

PgBouncer uses a certificate for `db.redbotleads.com`. Vercel connects with:

```text
sslmode=verify-full
```

`verify-full` requires encryption, validates the certificate chain, and checks
that the certificate hostname matches the connection hostname.

This is stronger than encryption without identity verification. Encryption
alone can still connect securely to the wrong server during a man-in-the-middle
attack.

### Why DNS is part of security

The certificate proves control of a hostname, not a raw IP address. DNS points
`db.redbotleads.com` to the Lightsail static IP. The static IP prevents the
address from changing when the VM is stopped or replaced.

### Certificate renewal

Let's Encrypt certificates expire. `sync-pgbouncer-tls.sh` copies renewed files
into the Docker-mounted TLS directory with restricted permissions and restarts
PgBouncer so it loads the new certificate.

An expired certificate is an availability failure: Vercel should reject it.
Certificate renewal therefore needs automation and monitoring.

### Security limitation of this topology

Standard Vercel deployments do not provide a stable outbound IP suitable for a
simple firewall allowlist. PgBouncer port `6432` must therefore be reachable
more broadly than ideal. TLS and strong credentials protect authentication, but
the public endpoint is still exposed to scans and denial-of-service attempts.

Safer future options include:

- Vercel Secure Compute with fixed egress IPs and a firewall allowlist
- Moving the web application into the VM/private network
- Using a managed PostgreSQL service with private integration
- Adding a properly designed application data API instead of raw remote SQL

### Senior engineering lesson

TLS is necessary but not sufficient. A complete remote-access design includes:

- Encryption
- Server identity verification
- Strong authentication
- Least-privileged roles
- Network restrictions where possible
- Connection and request limits
- Logging and alerting
- Credential and certificate rotation

## 11. PostgreSQL Memory Tuning

The VM has only 4 GB RAM, shared by the operating system and all containers.
The deployment starts with conservative settings.

### `shared_buffers=512MB`

PostgreSQL uses shared buffers as its internal page cache. Larger is not always
better because Linux also caches filesystem pages and other services need RAM.

### `effective_cache_size=1536MB`

This is a planner estimate, not allocated memory. It tells PostgreSQL roughly
how much data may be cached across PostgreSQL and the operating system, which
can influence index-versus-sequential-scan decisions.

### `work_mem=8MB`

Work memory can be used by each sort or hash operation, not once per server.
One query can use multiple work-memory allocations, and many concurrent queries
multiply that amount. Setting it too high is a common cause of memory pressure.

### `maintenance_work_mem=256MB`

Maintenance operations such as index creation and vacuum can use this memory.
It is larger than `work_mem` because maintenance concurrency is usually lower.

### `max_connections=30`

This limits the number of PostgreSQL backend processes and forces the
application to use PgBouncer and bounded pools rather than consuming memory
through uncontrolled connections.

### Container memory limits

Compose also sets upper bounds for PostgreSQL, Redis, PgBouncer, and workers.
These are safety rails, not performance targets. If a process exceeds its
container memory limit, the kernel may terminate it. Monitor actual memory and
leave capacity for the host OS and Docker.

### Senior engineering lesson

Tune from measurements:

- Resident memory by container
- Database connection count
- Slow-query logs
- Cache-hit ratio
- Temporary bytes written by queries
- CPU saturation and load average
- Disk latency and free space

Configuration copied from a larger server can make a small VM less reliable.

## 12. Worker Concurrency as Backpressure

Workers were reduced to conservative starting values:

```text
Ingestion concurrency       1
Embedding concurrency       2
Semantic concurrency        2
Classification concurrency  4
Notification concurrency    1
```

Concurrency is not automatically throughput. More concurrent jobs can increase:

- Database connections
- CPU contention
- Memory usage
- API rate-limit failures
- Lock contention
- Queue retries

Backpressure means limiting how fast work enters a constrained component. On a
2 vCPU machine, high concurrency can increase latency and failure rate because
jobs spend more time competing for the same CPU and database.

Increase one workload at a time after observing queue depth, completion rate,
CPU, memory, query latency, and external API limits.

## 13. Redis Memory and BullMQ Reliability

Redis stores BullMQ queue metadata and job state. The deployment uses:

```text
maxmemory 256mb
maxmemory-policy noeviction
appendonly yes
```

### Why `noeviction`

An eviction policy may silently remove queue keys when memory is full. BullMQ
expects its internal keys to remain consistent. `noeviction` rejects writes
instead of deleting queue data behind the application's back.

Rejected writes are visible failures that can be alerted on. Silent queue-key
loss is harder to diagnose and can produce inconsistent processing.

### Why append-only persistence

Redis AOF records changes so Redis can reconstruct state after restart. It
improves durability but adds disk writes and is not a replacement for designing
idempotent jobs.

### Idempotency

A durable queue still provides at-least-once behavior in many failure cases. A
worker can finish its database write and crash before acknowledging the job,
causing a retry. Job handlers should use unique constraints, upserts, or
idempotency keys so repeating a job does not duplicate business effects.

## 14. Backups, Restore, RPO, and RTO

### The backup format

`backup-postgres.sh` uses `pg_dump --format=custom`.

The custom format is compressed and works with `pg_restore`, which supports
selective and parallel restoration better than a plain SQL file.

### Partial-file safety

The script first writes a `.partial` file, renames it only after `pg_dump`
succeeds, and removes partial output on failure. A backup file's existence must
not be mistaken for a successful backup.

### Local and S3 copies

Local backups provide fast restores but share the VM's failure domain. S3
copies survive loss of the VM disk. The script uploads:

- Every backup under `daily/`
- Sunday backups under `weekly/`

Lifecycle rules can expire daily objects after 8 days and weekly objects after
29 days.

### RPO and RTO

Recovery Point Objective, or RPO, is the maximum acceptable data loss measured
in time. A daily backup implies an RPO of up to approximately 24 hours unless
additional continuous archiving exists.

Recovery Time Objective, or RTO, is how long restoration and service recovery
may take. It depends on dump size, download speed, restore speed, migration
time, validation, and operator readiness.

### Backups are unproven until restored

A successful upload is not enough. Regularly restore into a temporary database
and verify:

- The dump is readable.
- Required roles and extensions exist.
- Migrations report a valid state.
- Vector columns have the correct dimensions.
- Application smoke tests pass.
- Row counts are plausible.

### Better future durability

For a stricter RPO, study PostgreSQL Write-Ahead Log archiving and point-in-time
recovery. Logical dumps are simple and portable, but they do not provide
second-by-second recovery.

## 15. Docker Build Context and Secret Leakage

The Dockerfile contains:

```dockerfile
COPY . .
```

Docker sends the build context to the builder before processing `COPY`.
Without correct `.dockerignore` rules, the context could include:

- `.env.vm` database and API credentials
- TLS private keys
- PostgreSQL dumps
- Local screenshots and unrelated files

Even if the final running container does not visibly expose a secret, the
secret may remain in an image layer, build cache, or remote registry.

The updated `.dockerignore` excludes `.env*`, backups, TLS key material, and
clipboard images.

### Runtime secrets versus build secrets

Runtime secrets should be injected when a container starts. They should not be
copied into the image. Environment variables are convenient but can appear in
process inspection and Docker metadata, so production systems may eventually
use a secrets manager or mounted secret files.

### Senior engineering lesson

Treat the Docker build context as data leaving your workstation. Review it like
an artifact boundary, not merely as a performance optimization.

## 16. Environment Variables as a Public Interface

Environment variables form a deployment contract between code and
infrastructure.

Important variables include:

```text
POSTGRES_DB
POSTGRES_OWNER_USER
POSTGRES_OWNER_PASSWORD
POSTGRES_APP_USER
POSTGRES_APP_PASSWORD
DATABASE_URL
DATABASE_POOL_MAX
OPENAI_EMBEDDING_MODEL
OPENAI_EMBEDDING_DIMENSIONS
SEMANTIC_MATCH_THRESHOLD
```

### Why URL-safe passwords were requested

A PostgreSQL connection URL uses reserved characters such as `:`, `@`, `/`,
`?`, and `#`. Passwords containing these characters must be percent-encoded.
Long random hexadecimal passwords provide strong entropy while avoiding URL
parsing mistakes.

This is a deployment convenience, not a reason to use short or predictable
passwords.

### VM URL versus Vercel URL

VM containers connect privately:

```text
postgresql://APP_USER:PASSWORD@postgres:5432/reddit_leads
```

Vercel connects remotely through PgBouncer:

```text
postgresql://APP_USER:PASSWORD@db.redbotleads.com:6432/reddit_leads?sslmode=verify-full
```

The hostname and TLS policy differ because the network path differs.

## 17. Health Checks and Readiness

Compose health checks use `pg_isready` for PostgreSQL and PgBouncer and `PING`
for Redis.

A health check answers a narrow question: "Is this service responding enough
for another service to attempt startup?" It does not prove the whole
application is correct.

Useful levels of health include:

1. Process health: is the process running?
2. Dependency health: can it reach PostgreSQL and Redis?
3. Schema readiness: are migrations complete?
4. Functional readiness: can it perform a representative operation?
5. Business health: are jobs completing and leads being generated?

The migration service provides schema readiness. The vector verification script
provides a deeper functional check for the semantic subsystem.

## 18. Slow Queries and Observability

PostgreSQL logs statements taking at least one second:

```text
log_min_duration_statement=1000
```

This creates an initial signal for expensive queries without logging every
statement and potentially exposing excessive data.

Monitor at least:

- VM CPU and burst capacity
- Free memory and swap activity
- Disk usage and disk latency
- PostgreSQL connections
- Slow-query frequency
- Database size and table growth
- PgBouncer client, server, and waiting connections
- Redis memory and rejected writes
- BullMQ waiting, active, failed, and delayed jobs
- Backup age and backup size
- TLS certificate expiry

Disk warnings are recommended at 70% and critical alerts at 85%. PostgreSQL
needs free disk for table growth, indexes, temporary files, and Write-Ahead Log.
Running completely out of disk can stop the database and complicate recovery.

## 19. Failure Modes to Understand

### PostgreSQL container restarts

Expected result: data returns from the named volume, health checks recover, and
workers reconnect.

### VM is destroyed

Expected result: the local volume is lost. Recovery requires a new VM and an S3
backup. This is why off-VM backups matter.

### PgBouncer certificate expires

Expected result: Vercel rejects the connection because of `verify-full`.
Workers using the private PostgreSQL service can continue, but web requests that
need the database fail.

### PgBouncer is down

Expected result: Vercel database traffic fails. Local workers can continue
because they connect directly to PostgreSQL.

### PostgreSQL is down

Expected result: both Vercel database traffic and workers fail. BullMQ may keep
jobs in Redis, but handlers must retry with backoff rather than create a tight
failure loop.

### Redis reaches its memory limit

Expected result: writes fail because of `noeviction`. Alert and reduce queue
retention or workload; do not change to silent eviction without understanding
BullMQ consistency risks.

### Migration fails

Expected result: workers do not start because they depend on successful
migration completion. Inspect the migration error before resolving or retrying.

### Connection limit is reached

Expected result: new PostgreSQL clients fail or wait. Inspect process counts,
pool configuration, long-running transactions, PgBouncer stats, and leaked
connections before increasing `max_connections`.

## 20. Deployment Reasoning Sequence

A safe fresh deployment follows this order:

1. Create the VM and attach a static IP.
2. Point `db.redbotleads.com` to the IP.
3. Configure the firewall.
4. Install Docker, Certbot, and AWS CLI.
5. Create `.env.vm` with unique secrets.
6. Issue the TLS certificate.
7. Start PostgreSQL and Redis.
8. Apply Prisma migrations as the owner.
9. Run vector verification.
10. Start PgBouncer and workers.
11. Test PgBouncer TLS from outside the VM.
12. Update Vercel's `DATABASE_URL` and pool size.
13. Redeploy Vercel.
14. Test authentication, campaigns, embedding, semantic search, and queues.
15. Create and restore-test the first backup.
16. Enable scheduled jobs and monitor resource usage.

The order reduces ambiguity. If vector verification fails before Vercel is
changed, the current production path has not yet been affected.

## 21. What Was Deliberately Not Done

### No historical Neon export

The chosen strategy was a fresh database. If historical data becomes necessary,
the migration must be redesigned around a consistent `pg_dump`, paused writes,
restore validation, sequence validation, and a controlled cutover.

### No approximate vector index

Exact search was retained to avoid changing recall during the infrastructure
migration. Indexing should be a separate measured optimization.

### No high-availability database

One Lightsail VM is a single point of failure. Backups make recovery possible
but do not provide automatic failover. High availability would require replicas,
failover management, and a different cost and operational model.

### No point-in-time recovery

Daily logical dumps provide coarse recovery. WAL archiving is needed for a much
smaller RPO.

### No private Vercel network path

The selected Vercel plan/topology requires a public PgBouncer endpoint. This is
a cost-driven compromise that should be revisited as the application grows.

## 22. Senior Engineer Review Checklist

Before production cutover, a senior engineer should be able to answer yes to
these questions.

### Correctness

- Are all Prisma migrations applied?
- Is pgvector enabled?
- Are all vector columns exactly 1536 dimensions?
- Is the same embedding model used everywhere?
- Does the exact cosine parity test pass?
- Are threshold and candidate filters unchanged?

### Security

- Is PostgreSQL port `5432` private?
- Does Vercel use `sslmode=verify-full`?
- Are owner credentials absent from Vercel and worker environments?
- Are passwords unique, random, and stored outside Git?
- Are TLS keys, backups, and `.env` files excluded from Docker builds?
- Is SSH restricted?

### Reliability

- Does the database survive container replacement?
- Has an S3 backup completed?
- Has a backup been restored successfully?
- Is certificate renewal automated?
- Are failed backups and old backups detectable?
- Are jobs idempotent under retries?

### Capacity

- Is the combined connection budget below PostgreSQL's limit?
- Is memory usage below the VM's capacity with OS headroom?
- Are worker concurrency values measured rather than guessed upward?
- Is disk growth monitored?
- Are slow semantic queries observable?

### Operations

- Can another engineer follow the runbook?
- Are recovery commands documented and tested?
- Is there a rollback or rebuild path?
- Are alerts actionable rather than merely informational?

## 23. Practical Study Exercises

Do these on a disposable database, not production.

### Exercise 1: Inspect the schema

Use `psql` to list extensions, tables, roles, privileges, and vector column
types. Explain which objects are owned by the owner role and which operations
the application role can perform.

### Exercise 2: Calculate cosine similarity manually

Calculate cosine similarity for `[1,0,0]` and `[1,1,0]`, then compare your
answer to pgvector's result.

### Exercise 3: Observe pooling

Open several clients through PgBouncer and inspect `SHOW CLIENTS`, `SHOW
SERVERS`, and `SHOW POOLS`. Explain why client count and server count differ.

### Exercise 4: Prove persistence

Insert test data, remove and recreate the PostgreSQL container without deleting
the volume, and verify the row remains. Then explain why this is not a backup.

### Exercise 5: Perform a restore drill

Create a custom-format dump, restore it into a new empty database, run migration
status, run vector verification, and compare important row counts.

### Exercise 6: Test least privilege

Connect as the application role. Confirm ordinary CRUD succeeds and a schema
administration operation fails. Explain why that failure is desirable.

### Exercise 7: Test a dependency failure

Stop PostgreSQL and observe worker retry behavior, PgBouncer health, logs, and
queue state. Confirm there is no one-second retry storm.

### Exercise 8: Profile semantic queries

Use `EXPLAIN (ANALYZE, BUFFERS)` on a representative semantic query. Learn to
identify row estimates, actual rows, scan type, execution time, and buffer hits.

### Exercise 9: Model connection capacity

Calculate possible connections for 1, 10, and 50 concurrent Vercel instances.
Repeat with pool sizes 2, 5, and 10. Explain why PgBouncer's backend ceiling is
still necessary.

### Exercise 10: Design the next scale step

Assume the vector candidate set grows from 1,000 to 1,000,000. Propose a
benchmark comparing exact scan, HNSW, and IVFFlat. Define latency and recall
acceptance criteria before selecting an index.

## 24. Glossary

**ANN**: Approximate nearest-neighbor search. Faster vector retrieval that may
not return every exact nearest result.

**Backpressure**: Limiting incoming work so a constrained dependency remains
stable.

**Connection pool**: A reusable set of database connections managed by an
application or proxy.

**Cosine similarity**: A measure of the angle between two vectors, commonly
used to compare embedding direction.

**Docker volume**: Persistent storage managed separately from a container's
writable filesystem.

**Embedding**: A numeric representation of content in a model-specific vector
space.

**Failure domain**: A set of components that can fail together, such as a VM and
its local disk.

**HNSW**: A graph-based approximate vector index.

**Idempotency**: The property that repeating an operation does not create an
incorrect additional effect.

**IVFFlat**: A list-based approximate vector index.

**Least privilege**: Giving an identity only the permissions needed for its
responsibility.

**PgBouncer**: A lightweight PostgreSQL connection pooler and proxy.

**pgvector**: A PostgreSQL extension providing vector types, distance operators,
and vector indexes.

**RPO**: Recovery Point Objective, the maximum acceptable amount of data loss
measured in time.

**RTO**: Recovery Time Objective, the target time to restore service.

**SCRAM-SHA-256**: A password authentication method used by PostgreSQL and
PgBouncer.

**TLS**: Transport Layer Security, used to encrypt network traffic and verify
server identity.

**Transaction pooling**: A pooling mode where a backend database connection is
assigned only for one transaction.

**WAL**: PostgreSQL Write-Ahead Log, the durability log used for crash recovery,
replication, and point-in-time recovery.

## 25. Recommended Learning Order

Study the topics in this sequence:

1. PostgreSQL roles, databases, schemas, and privileges
2. Transactions, constraints, indexes, and migrations
3. Docker networking, volumes, and build contexts
4. PostgreSQL connections and PgBouncer pooling modes
5. TLS certificates, DNS, and firewall rules
6. Embeddings, cosine similarity, and pgvector operators
7. Exact versus approximate nearest-neighbor search
8. PostgreSQL query plans and memory settings
9. Backups, RPO, RTO, WAL, and restore drills
10. Observability, capacity planning, and failure testing

The important senior-level habit is not memorizing configuration values. It is
learning to identify constraints, make tradeoffs explicit, convert assumptions
into tests, and design a recovery path before a failure occurs.
