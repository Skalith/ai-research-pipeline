#!/usr/bin/env bash
# One-command dev stack: Postgres -> Redis -> Uvicorn -> Celery worker -> Frontend
# Logs: ./logs/backend.log, ./logs/celery.log, ./logs/frontend.log
# Usage:  ./dev.sh [start|stop|status|restart]   (default: start)
# Live logs:  ./logs.sh   (or: cd logs && tail -f backend.log celery.log frontend.log)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
PY="$BACKEND/.venv/bin/python"
RUN_DIR="$ROOT/logs"
mkdir -p "$RUN_DIR"

UV_URL="http://localhost:8000/api/v1/health"
FE_URL="http://localhost:3000"

ensure_db() {
  if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^research-pg$'; then
    if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q '^research-pg$'; then
      echo "  - starting Postgres container (research-pg)..."
      docker start research-pg >/dev/null
    else
      echo "  - creating Postgres container (research-pg, port 5434)..."
      docker run -d --name research-pg --restart unless-stopped \
        -e POSTGRES_USER=research_user -e POSTGRES_PASSWORD=local_dev_password \
        -e POSTGRES_DB=research_pipeline -p 127.0.0.1:5434:5432 \
        pgvector/pgvector:pg16 >/dev/null
    fi
    for i in $(seq 1 15); do docker exec research-pg pg_isready -U research_user -q 2>/dev/null && break; sleep 1; done
  fi
  echo "  - Postgres ready (localhost:5434)"
}

run_migrations() {
  echo "  - applying database migrations..."
  (cd "$BACKEND" && "$PY" -m alembic upgrade head)
}

ensure_redis() {
  if command -v redis-server >/dev/null 2>&1; then
    redis-cli ping >/dev/null 2>&1 || { echo "  - starting local redis-server..."; redis-server --daemonize yes >/dev/null; }
  else
    echo "  - (redis-server not found; using Docker) starting redis container..."
    if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^research-redis$'; then
      docker run -d --name research-redis --restart unless-stopped \
        -p 127.0.0.1:6379:6379 redis:7-alpine >/dev/null
    else
      docker start research-redis >/dev/null
    fi
  fi
  echo "  - Redis ready (localhost:6379)"
}

is_running() { [ -f "$RUN_DIR/.$1.pid" ] && kill -0 "$(cat "$RUN_DIR/.$1.pid")" 2>/dev/null; }

start() {
  echo "Starting research-pipeline dev stack..."
  ensure_db
  ensure_redis
  run_migrations

  if ! is_running uvicorn; then
    echo "  - starting uvicorn (port 8000, reload enabled) -> logs/backend.log"
    cd "$BACKEND"
    # dev.sh manages the worker explicitly; disable the app-level auto-start worker
    setsid env AUTO_START_WORKER=0 "$PY" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload \
      >"$RUN_DIR/backend.log" 2>&1 < /dev/null &
    echo $! > "$RUN_DIR/.uvicorn.pid"
  else
    echo "  - uvicorn already running"
  fi

  if ! is_running worker; then
    echo "  - starting celery worker (USE_MOCK_LLM=1, queue=research) -> logs/celery.log"
    setsid env USE_MOCK_LLM=1 "$PY" -m celery -A app.workers.celery_app worker \
      -Q research --loglevel=info --concurrency=2 >"$RUN_DIR/celery.log" 2>&1 < /dev/null &
    echo $! > "$RUN_DIR/.worker.pid"
  else
    echo "  - celery worker already running"
  fi

  if ! is_running frontend; then
    echo "  - starting frontend dev server (port 3000) -> logs/frontend.log"
    cd "$FRONTEND"
    setsid npm run dev >"$RUN_DIR/frontend.log" 2>&1 < /dev/null &
    echo $! > "$RUN_DIR/.frontend.pid"
  else
    echo "  - frontend already running"
  fi

  echo "  - waiting for API and frontend..."
  for i in $(seq 1 30); do
    if curl -sf "$UV_URL" >/dev/null 2>&1 && curl -sf "$FE_URL" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  status
}

stop() {
  echo "Stopping research-pipeline dev stack..."
  for name in frontend worker uvicorn; do
    if is_running "$name"; then
      kill "$(cat "$RUN_DIR/.$name.pid")" 2>/dev/null || true
      rm -f "$RUN_DIR/.$name.pid"
      echo "  - stopped $name (logs kept)"
    else
      rm -f "$RUN_DIR/.$name.pid"
      echo "  - $name not running"
    fi
  done
}

status() {
  echo "=== status ==="
  if curl -sf "$UV_URL" >/dev/null 2>&1; then echo "  API      : UP  http://localhost:8000/docs"; else echo "  API      : down"; fi
  if is_running worker; then echo "  Celery   : UP  (pid $(cat "$RUN_DIR/.worker.pid"))"; else echo "  Celery   : down"; fi
  if is_running frontend; then echo "  Frontend : UP  (pid $(cat "$RUN_DIR/.frontend.pid")) -> http://localhost:3000"; else echo "  Frontend : down"; fi
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^research-pg$'; then echo "  Postgres : UP  localhost:5434"; else echo "  Postgres : down"; fi
  if redis-cli ping >/dev/null 2>&1; then echo "  Redis    : UP  localhost:6379"; else echo "  Redis    : down"; fi
  echo "  Logs     : $RUN_DIR/{backend.log,celery.log,frontend.log}   live: ./scripts/logs.sh"
}

case "${1:-start}" in
  start) start ;;
  stop)  stop ;;
  restart) stop; sleep 1; start ;;
  status) status ;;
  *) echo "Usage: $0 [start|stop|status|restart]"; exit 1 ;;
esac