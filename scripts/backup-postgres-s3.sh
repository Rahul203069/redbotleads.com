#!/bin/sh
set -eu

: "${S3_BACKUP_URI:?S3_BACKUP_URI is required for off-VM backups}"
ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
exec sh "$ROOT_DIR/scripts/backup-postgres.sh"
