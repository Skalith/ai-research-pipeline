#!/usr/bin/env bash
# Live view of backend / celery / frontend logs.
# Usage:
#   ./logs.sh            live-tail all three logs
#   ./logs.sh backend    tail just backend.log
#   ./logs.sh celery     tail just celery.log
#   ./logs.sh frontend   tail just frontend.log
#   ./logs.sh clear      truncate all log files
#   ./logs.sh files      show log files + sizes
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/logs"
BACKEND_LOG="$LOG_DIR/backend.log"
CELERY_LOG="$LOG_DIR/celery.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

touch "$BACKEND_LOG" "$CELERY_LOG" "$FRONTEND_LOG"

live() {
  echo "Watching: $BACKEND_LOG $CELERY_LOG $FRONTEND_LOG  (press Ctrl-C to stop)"
  exec tail -n 50 -F "$BACKEND_LOG" "$CELERY_LOG" "$FRONTEND_LOG"
}

case "${1:-live}" in
  live)      live ;;
  backend)   exec tail -n 100 -F "$BACKEND_LOG" ;;
  celery)    exec tail -n 100 -F "$CELERY_LOG" ;;
  frontend)  exec tail -n 100 -F "$FRONTEND_LOG" ;;
  clear)     : > "$BACKEND_LOG"; : > "$CELERY_LOG"; : > "$FRONTEND_LOG"; echo "logs cleared" ;;
  files|paths)
    for f in "$BACKEND_LOG" "$CELERY_LOG" "$FRONTEND_LOG"; do
      printf '%-24s %s bytes\n' "$(basename "$f")" "$(wc -c < "$f")"
    done
    echo "dir: $LOG_DIR"
    ;;
  *) echo "Usage: $0 [live|backend|celery|frontend|clear|files]"; exit 1 ;;
esac