# Server Operations Reference

This file records the current Lightsail server layout and the commands used to
connect, inspect, update, and restart worker services.

> Never commit the `.pem` private keys or server `.env` files. The SSH commands
> below reference keys stored locally on the Windows workstation.

## Server inventory

The inventory below was verified directly on July 16, 2026.

| Server | Public IP | Repository | Runtime |
| --- | --- | --- | --- |
| Main VM | `3.136.16.18` | `/home/ubuntu/redbotleads.com` | Docker Compose v5.3.1 |
| Small RSS VM | `3.22.139.5` | `/home/ubuntu/my-app` | Standalone Docker container; Compose is not installed |

## SSH from Windows PowerShell

Main VM:

```powershell
ssh -i "C:\Users\rs329\Downloads\lightsail-key.pem" ubuntu@3.136.16.18
```

Small RSS VM:

```powershell
ssh -i "C:\Users\rs329\Downloads\LightsailDefaultKey-us-east-2.pem" ubuntu@3.22.139.5
```

## Main VM services

The main VM uses `compose.vm.yaml` and `.env.vm`.

| Compose service | Container | Responsibility |
| --- | --- | --- |
| `postgres` | `reddit-leads-postgres` | PostgreSQL 17 and pgvector storage |
| `pgbouncer` | `reddit-leads-pgbouncer` | TLS database connection pooling on port `6432` |
| `redis` | `reddit-leads-redis` | BullMQ queues and worker coordination |
| `worker` | `reddit-leads-worker` | Combined RSS refiller, daily semantic, embedding, ingestion, semantic matching, classification, playground, and notification workers |
| `db-maintenance-worker` | `reddit-leads-db-maintenance-worker` | Retention cleanup and database maintenance |
| `migrate` | One-off container | Prisma deployment and database setup; it is not expected to remain running |

The combined worker starts with:

```text
npm run worker:dev
```

### Inspect the main VM

```bash
cd /home/ubuntu/redbotleads.com

docker compose --env-file .env.vm -f compose.vm.yaml ps
docker compose --env-file .env.vm -f compose.vm.yaml logs --tail 200 worker
git status --short
git log -1 --oneline
```

### Update and restart only the main worker

Use this when changes affect files under `worker/` or worker-used files under
`lib/`, including daily semantic matching, RSS refilling, embeddings, or
classification.

```bash
cd /home/ubuntu/redbotleads.com

# Inspect first. Preserve intentional server-only files such as vm.env.
git status --short
git pull --ff-only origin main

docker compose --env-file .env.vm -f compose.vm.yaml config --quiet
docker compose --env-file .env.vm -f compose.vm.yaml build worker
docker compose --env-file .env.vm -f compose.vm.yaml up -d \
  --no-deps --force-recreate worker

docker compose --env-file .env.vm -f compose.vm.yaml ps worker
docker compose --env-file .env.vm -f compose.vm.yaml logs --tail 200 -f worker
```

Press `Ctrl+C` to leave the log view. The container continues running.

Expected startup messages include:

```text
Daily semantic worker started
RSS poll refiller started
All worker processes started in single-process dev mode
```

Rebuilding the main worker does not require restarting PostgreSQL, PgBouncer,
Redis, or the DB-maintenance worker. Run database migrations only when a change
contains a new Prisma migration.

### Restart without rebuilding

Use this only when the image is already current and the process merely needs a
restart:

```bash
cd /home/ubuntu/redbotleads.com
docker compose --env-file .env.vm -f compose.vm.yaml restart worker
docker compose --env-file .env.vm -f compose.vm.yaml logs --tail 200 -f worker
```

## Small RSS VM service

The small VM currently runs one standalone container:

| Container | Image | Command | Responsibility |
| --- | --- | --- | --- |
| `reddit-leads-rss-polling` | `reddit-leads-rss-polling` | `npm run rss-polling` | Consumes `POLL_SUBREDDIT_RSS` jobs, fetches Reddit RSS posts, stores new Reddit items, and queues embeddings |

Verified container properties:

- Restart policy: `unless-stopped`
- Docker network: default `bridge`
- Bind mounts: none
- Runtime env file on host: `/home/ubuntu/my-app/.env.rss-poll-worker`
- Dockerfile: `/home/ubuntu/my-app/worker-rss/Dockerfile`
- The RSS refiller and daily semantic worker do **not** run on this VM.

### Inspect the small VM

```bash
cd /home/ubuntu/my-app

docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Command}}\t{{.Status}}"
docker logs --tail 200 reddit-leads-rss-polling
git status --short
git log -1 --oneline
```

### Update the standalone RSS polling worker

Only perform this when `worker-rss/src/rss-polling.ts` or one of its imported
modules changed. Daily-semantic or RSS-refiller-only changes do not require a
small-VM restart.

```bash
cd /home/ubuntu/my-app

git status --short
git pull --ff-only origin main

docker build \
  -t reddit-leads-rss-polling \
  -f worker-rss/Dockerfile \
  worker-rss

docker rm -f reddit-leads-rss-polling

docker run -d \
  --name reddit-leads-rss-polling \
  --restart unless-stopped \
  --env-file /home/ubuntu/my-app/.env.rss-poll-worker \
  reddit-leads-rss-polling

docker ps --filter name=reddit-leads-rss-polling
docker logs --tail 200 -f reddit-leads-rss-polling
```

Because this is a standalone container, do not use `docker compose` or
`docker-compose` on the small VM unless Compose is installed and the deployment
is deliberately migrated to a Compose-managed service.

## Which server should be updated?

| Code area | Main VM | Small RSS VM |
| --- | --- | --- |
| `worker/daily-semantic.ts` | Rebuild `worker` | No change |
| `worker/rss-poll-refiller.ts` | Rebuild `worker` | No change; refiller is not running there |
| `worker/embedding.ts`, classification, notifications | Rebuild `worker` | No change |
| `worker-rss/src/rss-polling.ts` or its imports | No change unless duplicated in the main worker | Rebuild standalone container |
| Prisma migration | Run main VM migration deployment and rebuild affected services | Rebuild only if generated client/schema use changed |
| Next.js UI/API/server actions | Redeploy the web application | No change |

## Safety and troubleshooting

- Always run `git status --short` before pulling. Do not discard unknown VM-only
  files or changes.
- Use `git pull --ff-only origin main` so Git stops instead of creating an
  accidental merge commit on a server.
- Never print `.env.vm`, `.env.rss-poll-worker`, or container environment values
  into logs or chat.
- Check the last image and container state before removing a standalone
  container:

```bash
docker inspect reddit-leads-rss-polling \
  --format 'Image={{.Image}} Restart={{.HostConfig.RestartPolicy.Name}} Command={{json .Config.Cmd}}'
```

- If the main worker fails after recreation:

```bash
cd /home/ubuntu/redbotleads.com
docker compose --env-file .env.vm -f compose.vm.yaml ps worker
docker compose --env-file .env.vm -f compose.vm.yaml logs --tail 300 worker
```

- If the standalone RSS worker fails:

```bash
docker ps -a --filter name=reddit-leads-rss-polling
docker logs --tail 300 reddit-leads-rss-polling
```
