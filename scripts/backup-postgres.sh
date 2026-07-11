#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_NAME="reddit-leads-$STAMP.dump"
BACKUP_PATH="$ROOT_DIR/backups/$BACKUP_NAME"
PARTIAL_PATH="$BACKUP_PATH.partial"

mkdir -p "$ROOT_DIR/backups"
trap 'rm -f "$PARTIAL_PATH"' EXIT
docker compose --env-file "$ROOT_DIR/.env.vm" -f "$ROOT_DIR/compose.vm.yaml" \
  exec -T postgres sh -c \
  'pg_dump --format=custom --compress=9 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  > "$PARTIAL_PATH"
mv "$PARTIAL_PATH" "$BACKUP_PATH"
trap - EXIT

if [ -n "${S3_BACKUP_URI:-}" ]; then
  aws s3 cp "$BACKUP_PATH" "${S3_BACKUP_URI%/}/daily/$BACKUP_NAME" --sse AES256
  if [ "$(date -u +%u)" -eq 7 ]; then
    aws s3 cp "$BACKUP_PATH" "${S3_BACKUP_URI%/}/weekly/$BACKUP_NAME" --sse AES256
  fi
fi

find "$ROOT_DIR/backups" -type f -name 'reddit-leads-*.dump' -mtime +7 -delete
printf '%s\n' "$BACKUP_PATH"
