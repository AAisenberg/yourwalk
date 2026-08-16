#!/usr/bin/env bash
# Health-check YourWalk local hybrid stack.
# Usage: ./scripts/dev-status.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="${ROOT}/.dev-pids"
if [[ -z "${WEB_PORT:-}" && -f "${PID_DIR}/web.port" ]]; then
  WEB_PORT="$(tr -d '[:space:]' <"${PID_DIR}/web.port")"
fi
WEB_PORT="${WEB_PORT:-3000}"
CHALLENGER_PORT="${CHALLENGER_PORT:-8790}"
CHALLENGER_URL="${CHALLENGER_URL:-http://127.0.0.1:${CHALLENGER_PORT}}"
WEB_URL="${WEB_URL:-http://localhost:${WEB_PORT}}"

ok() { printf "  ✓ %s\n" "$1"; }
bad() { printf "  ✗ %s\n" "$1"; }

echo "Challenger ${CHALLENGER_URL}"
if body="$(curl -sf --max-time 2 "${CHALLENGER_URL}/health" 2>/dev/null)"; then
  ok "health $(echo "$body" | tr -d '\n' | head -c 120)"
else
  bad "not reachable — run ./scripts/dev-up.sh"
fi

echo "Next.js ${WEB_URL}"
if curl -sf --max-time 2 "${WEB_URL}/" >/dev/null 2>&1; then
  ok "app responding"
else
  bad "app not responding"
fi

echo "Next → challenger proxy"
body="$(curl -sS --max-time 3 "${WEB_URL}/api/challenger-route" 2>/dev/null || true)"
if echo "$body" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
  ok "proxy healthy (JSON ok)"
elif echo "$body" | grep -qi '<!doctype html\|<html'; then
  bad "got HTML instead of JSON — :${WEB_PORT} is probably not YourWalk Next (wrong app/port)"
elif echo "$body" | grep -q 'Challenger service unreachable\|ok.:false\|"ok":false'; then
  bad "Next up but challenger unreachable — start challenger / check CHALLENGER_URL"
elif [[ -z "$body" ]]; then
  bad "no response — is Next running on :${WEB_PORT}?"
else
  bad "unexpected response: $(echo "$body" | tr -d '\n' | head -c 160)"
fi

if [[ -d "${ROOT}/.dev-pids" ]]; then
  echo "Pid files in .dev-pids/"
  for f in challenger.pid web.pid; do
    if [[ -f "${ROOT}/.dev-pids/${f}" ]]; then
      pid="$(cat "${ROOT}/.dev-pids/${f}")"
      if kill -0 "$pid" 2>/dev/null; then
        ok "${f%.pid} pid ${pid} running"
      else
        bad "${f%.pid} pid ${pid} not running (stale file)"
      fi
    fi
  done
fi
