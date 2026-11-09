#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  echo "Usage: $0 {backend|frontend}"
  echo "Run ./start.sh backend in one terminal and ./start.sh frontend in another."
}

if [[ $# -ne 1 ]]; then
  usage >&2
  exit 2
fi

case "$1" in
  backend)
    if [[ -x "$ROOT/backend/.venv/bin/python" ]]; then
      PYTHON="$ROOT/backend/.venv/bin/python"
    else
      PYTHON="$(command -v python3 || true)"
    fi

    if [[ -z "$PYTHON" ]]; then
      echo "Python 3 is required to run the backend." >&2
      exit 1
    fi
    if ! "$PYTHON" -c 'import fastapi, uvicorn' >/dev/null 2>&1; then
      echo "Backend dependencies are missing. Install them with:" >&2
      echo "  python3 -m venv \"$ROOT/backend/.venv\"" >&2
      echo "  \"$ROOT/backend/.venv/bin/pip\" install -r \"$ROOT/backend/requirements.txt\"" >&2
      exit 1
    fi

    cd "$ROOT/backend"
    exec "$PYTHON" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
    ;;
  frontend)
    if ! command -v npm >/dev/null 2>&1; then
      echo "Node.js and npm are required to run the frontend." >&2
      exit 1
    fi
    if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
      echo "Frontend dependencies are missing. Run: npm --prefix \"$ROOT/frontend\" install" >&2
      exit 1
    fi

    export VITE_API_BASE_URL="${VITE_API_BASE_URL:-http://localhost:8000}"
    cd "$ROOT/frontend"
    exec npm run dev -- --host 127.0.0.1
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
