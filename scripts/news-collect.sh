#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

eval "$(bash scripts/start-finance-data-api.sh --ensure --print-env --quiet)"

exec ./node_modules/.bin/tsx scripts/news.ts collect "$@"
