#!/usr/bin/env bash
# Run on the production VPS from repo root after git pull.
set -euo pipefail

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

echo "==> Pull latest images / rebuild"
$COMPOSE build

echo "==> Run migrations (direct Postgres, one shot per release)"
$COMPOSE run --rm api alembic upgrade head

echo "==> Rolling restart"
$COMPOSE up -d

echo "==> Health check"
curl -sf "http://127.0.0.1:5330/api/v1/health/ready" | head -c 200
echo
echo "Production deploy complete. Verify https://api.skulpulse.com/api/v1/health/ready"
