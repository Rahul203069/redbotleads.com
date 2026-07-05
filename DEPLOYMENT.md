# Deployment Notes

## OG VM: RSS poll refiller

The main worker container gets Redis through `compose.vm.yaml`, which builds `REDIS_URL` from `REDIS_PASSWORD`.
When starting the refiller manually with `docker run`, pass `REDIS_URL` explicitly.

Run from the app directory:

```bash
cd ~/my-app

NET=$(docker inspect reddit-leads-redis --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}')
IMAGE=$(docker inspect reddit-leads-worker --format '{{.Config.Image}}')
REDIS_PASSWORD=$(grep '^REDIS_PASSWORD=' .env.vm | cut -d= -f2-)

docker rm -f reddit-leads-rss-poll-refiller

docker run -d \
  --name reddit-leads-rss-poll-refiller \
  --restart unless-stopped \
  --network "$NET" \
  --env-file .env.vm \
  -e REDIS_URL="redis://:${REDIS_PASSWORD}@redis:6379" \
  "$IMAGE" \
  npm run worker:rss-poll-refiller
```

Verify:

```bash
docker exec reddit-leads-rss-poll-refiller printenv REDIS_URL
docker logs -f --tail 100 reddit-leads-rss-poll-refiller
```

Expected log:

```txt
RSS poll refiller started
```

## Small VM: lightweight RSS polling worker

Build only the lightweight RSS worker package:

```bash
cd ~/my-app
git pull
docker build -t reddit-leads-rss-polling ./worker-rss
```

Create or update `.env.rss-poll-worker`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
REDIS_URL=redis://:PASSWORD@OG_REDIS_PRIVATE_IP:6379

REDDIT_RSS_USER_AGENT=reddit-leads-rss-poll-worker-new-vm/1.0
REDDIT_RSS_REQUEST_INTERVAL_MS=30000
REDDIT_RSS_REQUEST_JITTER_MS=30000
REDDIT_RSS_MAX_RETRIES=1
REDDIT_RSS_RETRY_BACKOFF_MS=60000

WORKER_INGESTION_CONCURRENCY=1
```

Recreate the container after env or code changes:

```bash
docker rm -f reddit-leads-rss-polling

docker run -d \
  --name reddit-leads-rss-polling \
  --restart unless-stopped \
  --env-file .env.rss-poll-worker \
  reddit-leads-rss-polling \
  npm run rss-polling
```

Verify:

```bash
docker exec reddit-leads-rss-polling printenv REDIS_URL
docker logs -f --tail 100 reddit-leads-rss-polling
```

Expected log:

```txt
RSS polling worker started
```

## Common checks

List RSS containers:

```bash
docker ps | grep rss
```

Check recent logs:

```bash
docker logs --tail 200 reddit-leads-rss-poll-refiller
docker logs --tail 200 reddit-leads-rss-polling
```

If logs show `ECONNREFUSED 127.0.0.1:6379`, the container did not receive the correct `REDIS_URL`.
Recreate the container with the correct env; `docker restart` alone does not reload env file changes.
