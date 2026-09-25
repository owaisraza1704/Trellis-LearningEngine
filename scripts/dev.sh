#!/usr/bin/env bash
set -euo pipefail
TRELLIS_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$TRELLIS_ROOT"
docker compose up -d --wait db
(cd backend && .venv/bin/alembic upgrade head)
(cd backend && exec .venv/bin/uvicorn trellis.main:app --host 127.0.0.1 --port 8100 --reload) &
TRELLIS_API_PID=$!
(cd trellis-ui && exec pnpm dev --hostname 127.0.0.1 --port 3100) &
TRELLIS_UI_PID=$!
trap 'kill "$TRELLIS_API_PID" "$TRELLIS_UI_PID" 2>/dev/null || true' EXIT INT TERM
wait
