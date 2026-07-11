# Deployment Notes

## VM topology

The Ubuntu 24.04 Lightsail VM runs PostgreSQL 17 with pgvector, PgBouncer,
Redis, the application worker, and the database-maintenance worker. PostgreSQL
port `5432` is private to Docker. Vercel connects to TLS PgBouncer at
`db.redbotleads.com:6432`.

The initial deployment creates a fresh database. It does not copy data from
Neon.

Recommended minimum VM: 2 vCPU, 4 GB RAM, 60 GB SSD, and a Lightsail static IP.

## 1. DNS and firewall

1. Attach a Lightsail static IP to the VM.
2. Create an `A` record for `db.redbotleads.com` pointing to that IP.
3. Allow TCP `80` for Let's Encrypt renewal and TCP `6432` for Vercel.
4. Restrict TCP `22` to the administrator IP.
5. Do not open PostgreSQL port `5432`.
6. Keep Redis port `6379` closed unless Vercel still needs the BullMQ endpoint;
   if it does, retain the password and restrict access as tightly as possible.

## 2. Install the host tools

```bash
sudo apt update
sudo apt install -y ca-certificates certbot awscli
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

Sign out and back in after adding the Docker group.

## 3. Configure secrets

```bash
cd ~/redbotleads.com
cp .env.vm.example .env.vm
chmod 600 .env.vm
```

Fill every placeholder in `.env.vm`. Generate URL-safe database passwords:

```bash
openssl rand -hex 32
```

Do not reuse the owner password for the application role.

## 4. Issue the PgBouncer certificate

Stop anything using port 80, then issue and copy the certificate:

```bash
sudo certbot certonly --standalone -d db.redbotleads.com
sudo env CERT_DIR=/etc/letsencrypt/live/db.redbotleads.com sh ./scripts/sync-pgbouncer-tls.sh
```

The first certificate sync can report that PgBouncer is not running; the files
are still copied. Add this renewal hook after the stack is running:

```bash
sudo sh -c 'printf "%s\n" "#!/bin/sh" "cd /home/ubuntu/redbotleads.com && CERT_DIR=/etc/letsencrypt/live/db.redbotleads.com sh ./scripts/sync-pgbouncer-tls.sh" > /etc/letsencrypt/renewal-hooks/deploy/reload-pgbouncer'
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-pgbouncer
```

Adjust `/home/ubuntu/redbotleads.com` if the repository is elsewhere.

## 5. Initialize and migrate

```bash
docker compose --env-file .env.vm -f compose.vm.yaml up -d postgres redis
docker compose --env-file .env.vm -f compose.vm.yaml run --rm \
  -e FRESH_DATABASE_BOOTSTRAP=true migrate
docker compose --env-file .env.vm -f compose.vm.yaml up --build -d
```

The first command intentionally bootstraps a fresh database from the current
Prisma schema and records the repository's legacy incremental migrations as an
applied baseline. The flag resets the `public` schema and must never be used on
a database containing data. Later deployments run normal `prisma migrate
deploy` automatically without this flag.

The application role is created only when the PostgreSQL volume is initialized.
Changing its name or password later requires an explicit `ALTER ROLE` or a new
empty volume.

Verify migrations and exact vector behavior through the private database:

```bash
docker compose --env-file .env.vm -f compose.vm.yaml run --rm \
  migrate npx prisma migrate status

docker compose --env-file .env.vm -f compose.vm.yaml run --rm \
  migrate npm run db:verify-vector
```

## 6. Configure Vercel

Set the production `DATABASE_URL` to the limited application role:

```env
DATABASE_URL=postgresql://reddit_leads_app:URL_ENCODED_PASSWORD@db.redbotleads.com:6432/reddit_leads?sslmode=verify-full
DATABASE_POOL_MAX=2
```

Keep the embedding contract unchanged:

```env
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536
SEMANTIC_MATCH_THRESHOLD=0.5
```

Redeploy Vercel after removing the Neon URL. Confirm login, campaign creation,
semantic-query writes, and the semantic playground before enabling scheduled
workers.

## 7. Backups

Create one encrypted PostgreSQL custom-format dump:

```bash
cd ~/redbotleads.com
S3_BACKUP_URI=s3://YOUR_PRIVATE_BUCKET/postgres sh ./scripts/backup-postgres.sh
```

The script retains local dumps for seven days, uploads every run under `daily/`,
and uploads Sunday runs under `weekly/`. Configure the S3 bucket with server-side
encryption, blocked public access, and lifecycle rules that expire `daily/`
objects after 8 days and `weekly/` objects after 29 days. Configure AWS CLI
credentials with access limited to that bucket.

Run the backup daily with cron:

```cron
15 2 * * * cd /home/ubuntu/redbotleads.com && S3_BACKUP_URI=s3://YOUR_PRIVATE_BUCKET/postgres sh ./scripts/backup-postgres.sh >> /home/ubuntu/reddit-leads-backup.log 2>&1
```

Restore only into an empty database and stop workers first:

```bash
docker compose --env-file .env.vm -f compose.vm.yaml stop worker db-maintenance-worker
docker compose --env-file .env.vm -f compose.vm.yaml exec -T postgres \
  sh -c 'pg_restore --clean --if-exists --no-owner --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" /backups/REPLACE_WITH_BACKUP.dump'
```

Run migrations and `npm run db:verify-vector` after every restore.

## 8. Operations

```bash
docker compose --env-file .env.vm -f compose.vm.yaml ps
docker compose --env-file .env.vm -f compose.vm.yaml logs --tail 200 postgres pgbouncer worker
df -h
free -h
```

Create alerts for VM CPU, burst capacity, status checks, and disk usage. Warn at
70% disk usage and treat 85% as critical. Do not add HNSW or IVFFlat indexes
without measuring recall against exact cosine results first.

## Lightweight RSS polling worker

The optional `worker-rss` image must use the same application database role and
Redis URL:

```env
DATABASE_URL=postgresql://reddit_leads_app:PASSWORD@PRIVATE_VM_ADDRESS:5432/reddit_leads
REDIS_URL=redis://:PASSWORD@PRIVATE_REDIS_ADDRESS:6379
```

Prefer running it in the main Compose network instead of exposing PostgreSQL.
