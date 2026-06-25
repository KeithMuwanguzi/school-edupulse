#!/usr/bin/env bash
# Run on the staging VPS from repo root after git pull.
set -euo pipefail

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.staging.yml"

echo "==> Pull latest images / rebuild"
$COMPOSE build

echo "==> Run migrations"
$COMPOSE run --rm api alembic upgrade head

echo "==> Rolling restart"
$COMPOSE up -d

echo "==> Health check"
curl -sf "http://127.0.0.1:5331/api/v1/health/ready" | head -c 200
echo
echo "Staging deploy complete. Verify https://staging.api.skulpulse.com/api/v1/health/ready"
