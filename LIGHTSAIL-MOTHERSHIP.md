# Lightsail mothership (October 2026)

The production backend is on Ubuntu 24.04 at static IP `63.32.87.20`, with 2 vCPU,
4 GB RAM, an 80 GB disk, and 4 GB swap. SSH uses `ubuntu` and the eu-west-1
Lightsail default key. The checkout is `/home/ubuntu/redbotleads.com`.

## Services and data

`compose.vm.yaml` runs PostgreSQL 17 with pgvector, TLS PgBouncer on port 6432,
Redis on port 6379, the combined application worker, and database maintenance.
The one-off `migrate` service applies Prisma migrations. The Next app remains on
Vercel. The combined worker also refills and consumes the generic `rss-polling`
queue, so generic polling works without the separate RSS VMs, at lower capacity.

The September 11 `postgres-final.dump` was restored into an empty PostgreSQL 17
database. Three later Prisma migrations were applied. The initial restored counts
were 14 users, 57 campaigns, 38,322 leads, and 63,591 Reddit items. The original
archive is retained under `backups/`; a fresh post-migration dump was created
before starting workers. Never run `FRESH_DATABASE_BOOTSTRAP=true` on this DB.

The dedicated Nuveca RSS refiller is absent from Compose. Campaign
`cmrxf5i36000004l16u27gj35` has `rssPollingEnabled=false`; its existing
campaign and lead data remain. Keep the old dedicated Nuveca VM service stopped.

## Connections and secrets

The private VM credentials are in `.env.vm` and `.env.semantic-cron` (mode 600).
VM containers use private Docker URLs. Vercel and external RSS workers use:

```text
DATABASE_URL=postgresql://reddit_leads_app:<password>@63.32.87.20:6432/reddit_leads?sslmode=verify-full
REDIS_URL=redis://:<password>@63.32.87.20:6379
```

Use the actual new passwords from `.env.vm`; do not commit them. The Redis
connection is password protected but does not use TLS. The Lightsail networking
firewall must allow inbound TCP 80 for certificate renewal and 6432 and 6379 for
Vercel. Do not open PostgreSQL port 5432. Restrict SSH port 22 where practical.

Certbot 5.8 issues the short-lived IP certificate. Its deploy hook is
`/etc/letsencrypt/renewal-hooks/deploy/reload-pgbouncer`. Check renewal with
`sudo certbot renew --dry-run --run-deploy-hooks --non-interactive` and check
`snap.certbot.renew.timer` is enabled.

## Operations

```bash
cd /home/ubuntu/redbotleads.com
sudo docker compose --env-file .env.vm -f compose.vm.yaml ps
sudo docker compose --env-file .env.vm -f compose.vm.yaml logs --tail 100 worker db-maintenance-worker
sudo docker compose --env-file .env.vm -f compose.vm.yaml run --rm --no-deps worker npm run db:verify-vector
systemctl list-timers redbot-hourly-semantic.timer redbot-postgres-backup.timer
free -h
df -h /
```

`redbot-hourly-semantic.timer` uses `.env.semantic-cron` and the Vercel
`CRON_SECRET`. Enable it only after Vercel points at the new backend.

`redbot-postgres-backup.timer` runs daily at 02:15 UTC. It requires
`/etc/redbot-backup.env` containing `S3_BACKUP_URI=s3://<private-bucket>/postgres`
and AWS credentials with access only to that bucket. The backup script keeps
seven days locally and uploads daily and Sunday copies to S3. Configure bucket
public access blocking, server-side encryption, and lifecycle expiry of eight
days for `daily/` and 90 days for `weekly/`. Test the first upload before
enabling the timer.

To restore again, stop workers first and restore into an empty database. Apply
Prisma migrations and run `db:verify-vector` before starting application traffic.
