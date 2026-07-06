#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${FINANCE_DATA_API_ENV_FILE:-$PROJECT_ROOT/.env}"
PID_FILE="${FINANCE_DATA_API_PID_FILE:-$PROJECT_ROOT/.finance-data-api.pid}"
LOG_FILE="${FINANCE_DATA_API_LOG_FILE:-$PROJECT_ROOT/.finance-data-api.log}"

PRINT_ENV=false
QUIET=false
ENSURE=true

for arg in "$@"; do
  case "$arg" in
    --ensure) ENSURE=true ;;
    --print-env) PRINT_ENV=true ;;
    --quiet) QUIET=true ;;
    *)
      echo "Usage: $0 [--ensure] [--print-env] [--quiet]" >&2
      exit 2
      ;;
  esac
done

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

PORT="${PORT:-3000}"
FINANCE_DATA_API_HOST="${FINANCE_DATA_API_HOST:-127.0.0.1}"
FINANCE_DATA_API_BASE_URL="${FINANCE_DATA_API_BASE_URL:-http://$FINANCE_DATA_API_HOST:$PORT}"
API_TOKEN="${API_TOKEN:-change-me-local-token}"
FINANCE_DATA_API_TOKEN="${FINANCE_DATA_API_TOKEN:-$API_TOKEN}"
START_TIMEOUT_SECONDS="${FINANCE_DATA_API_START_TIMEOUT_SECONDS:-30}"

log() {
  if [[ "$QUIET" != "true" ]]; then
    echo "$@" >&2
  fi
}

healthcheck() {
  curl -fsS --max-time 3 "$FINANCE_DATA_API_BASE_URL/health" >/dev/null 2>&1
}

pid_is_running() {
  [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" >/dev/null 2>&1
}

start_api() {
  mkdir -p "$(dirname "$PID_FILE")" "$(dirname "$LOG_FILE")"

  if [[ ! -f "$PROJECT_ROOT/dist/src/server.js" ]]; then
    log "finance-data-api dist build not found; running npm run build"
    (cd "$PROJECT_ROOT" && npm run build)
  fi

  log "Starting finance-data-api on $FINANCE_DATA_API_BASE_URL"
  (
    cd "$PROJECT_ROOT"
    setsid env \
      PORT="$PORT" \
      API_TOKEN="$API_TOKEN" \
      FINANCE_DATA_API_TOKEN="$FINANCE_DATA_API_TOKEN" \
      FINANCE_DATA_API_BASE_URL="$FINANCE_DATA_API_BASE_URL" \
      DATABASE_URL="${DATABASE_URL:-}" \
      APP_DATABASE_URL="${APP_DATABASE_URL:-}" \
      GUARDIAN_API_KEY="${GUARDIAN_API_KEY:-}" \
      npm run start >>"$LOG_FILE" 2>&1 </dev/null &
    echo $! > "$PID_FILE"
    disown "$!" >/dev/null 2>&1 || true
  )
}

if [[ "$ENSURE" == "true" ]]; then
  if healthcheck; then
    log "finance-data-api is already active at $FINANCE_DATA_API_BASE_URL"
  else
    if pid_is_running; then
      log "finance-data-api pid exists but healthcheck failed; see $LOG_FILE"
    else
      rm -f "$PID_FILE"
      start_api
    fi

    deadline=$((SECONDS + START_TIMEOUT_SECONDS))
    until healthcheck; do
      if [[ -f "$PID_FILE" ]] && ! pid_is_running; then
        echo "finance-data-api process exited before becoming healthy; see $LOG_FILE" >&2
        exit 1
      fi
      if (( SECONDS >= deadline )); then
        echo "finance-data-api did not become healthy within ${START_TIMEOUT_SECONDS}s; see $LOG_FILE" >&2
        exit 1
      fi
      sleep 1
    done
    sleep 1
    if ! healthcheck; then
      echo "finance-data-api became healthy but did not stay active; see $LOG_FILE" >&2
      exit 1
    fi
    log "finance-data-api is active at $FINANCE_DATA_API_BASE_URL"
  fi
fi

if [[ "$PRINT_ENV" == "true" ]]; then
  printf 'export FINANCE_DATA_API_HOST=%q\n' "$FINANCE_DATA_API_HOST"
  printf 'export FINANCE_DATA_API_BASE_URL=%q\n' "$FINANCE_DATA_API_BASE_URL"
  printf 'export FINANCE_DATA_API_TOKEN=%q\n' "$FINANCE_DATA_API_TOKEN"
  printf 'export API_TOKEN=%q\n' "$API_TOKEN"
fi
