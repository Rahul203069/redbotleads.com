#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CERT_DIR=${CERT_DIR:-/etc/letsencrypt/live/db.redbotleads.com}
TARGET_DIR="$ROOT_DIR/deploy/tls"
PGBOUNCER_GID=${PGBOUNCER_GID:-70}

install -d -m 750 -o root -g "$PGBOUNCER_GID" "$TARGET_DIR"
install -m 644 -o root -g "$PGBOUNCER_GID" "$CERT_DIR/fullchain.pem" "$TARGET_DIR/fullchain.pem"
install -m 640 -o root -g "$PGBOUNCER_GID" "$CERT_DIR/privkey.pem" "$TARGET_DIR/privkey.pem"

if docker compose --env-file "$ROOT_DIR/.env.vm" -f "$ROOT_DIR/compose.vm.yaml" ps --quiet pgbouncer | grep -q .; then
  docker compose --env-file "$ROOT_DIR/.env.vm" -f "$ROOT_DIR/compose.vm.yaml" restart pgbouncer
fi
