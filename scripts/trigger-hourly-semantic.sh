#!/usr/bin/env bash
set -euo pipefail

: "${SEMANTIC_CRON_URL:?SEMANTIC_CRON_URL is required}"
: "${CRON_SECRET:?CRON_SECRET is required}"

curl \
  --silent \
  --show-error \
  --fail-with-body \
  --max-time 55 \
  --header "Authorization: Bearer ${CRON_SECRET}" \
  "${SEMANTIC_CRON_URL}"
printf '\n'
