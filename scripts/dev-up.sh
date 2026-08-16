#!/usr/bin/env bash
# Start YourWalk local hybrid stack: score-aware challenger (:8790) + Next.js (:3000).
# If :3000 is already taken by another app (e.g. CrashDash Vite), falls back to :3001.
# Processes are double-fork detached so they survive Cursor agent shells exiting.
# Usage (from repo root): ./scripts/dev-up.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="${ROOT}/.dev-pids"
DETACH="${ROOT}/scripts/dev-detach.py"
WEB_PORT="${WEB_PORT:-3000}"
CHALLENGER_PORT="${CHALLENGER_PORT:-8790}"
CHALLENGER_URL="${CHALLENGER_URL:-http://127.0.0.1:${CHALLENGER_PORT}}"

mkdir -p "${PID_DIR}"

healthy() {
  local url="$1"
  curl -sf --max-time 2 "$url" >/dev/null 2>&1
}

web_url() {
  echo "http://localhost:${WEB_PORT}"
}

proxy_ok_on() {
  local port="$1"
  local body
  body="$(curl -sS --max-time 3 "http://localhost:${port}/api/challenger-route" 2>/dev/null || true)"
  echo "$body" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'
}

port_serving_html_api() {
  local port="$1"
  local body
  body="$(curl -sS --max-time 2 "http://localhost:${port}/api/challenger-route" 2>/dev/null || true)"
  echo "$body" | grep -qi '<!doctype html\|<html'
}

echo "YourWalk local hybrid"
echo "  challenger: ${CHALLENGER_URL}"
echo "  preferred app port: ${WEB_PORT}"
echo

# --- Challenger ---
if healthy "${CHALLENGER_URL}/health"; then
  echo "✓ Challenger already up on :${CHALLENGER_PORT}"
else
  rm -f "${PID_DIR}/challenger.pid"
  if [[ ! -x "${ROOT}/pipeline/.venv/bin/python" ]]; then
    echo "✗ Missing pipeline/.venv — create it first:"
    echo "    cd pipeline && python -m venv .venv && source .venv/bin/activate && pip install -e '.[bakeoff]'"
    exit 1
  fi
  if [[ ! -f "${ROOT}/pipeline/data/bakeoff/score_aware_graph.gpickle" ]]; then
    echo "✗ Missing score_aware_graph.gpickle — build it first:"
    echo "    cd pipeline && source .venv/bin/activate && python bakeoff/build_graph.py"
    exit 1
  fi
  echo "→ Starting challenger on :${CHALLENGER_PORT}…"
  : >"${PID_DIR}/challenger.log"
  python3 "${DETACH}" \
    "${PID_DIR}/challenger.pid" \
    "${PID_DIR}/challenger.log" \
    "${ROOT}/pipeline" \
    -- \
    "${ROOT}/pipeline/.venv/bin/python" bakeoff/serve_challenger.py --port "${CHALLENGER_PORT}"
  for _ in $(seq 1 60); do
    if healthy "${CHALLENGER_URL}/health"; then
      break
    fi
    sleep 0.5
  done
  if healthy "${CHALLENGER_URL}/health"; then
    echo "✓ Challenger ready (pid $(cat "${PID_DIR}/challenger.pid"))"
  else
    echo "✗ Challenger failed to become healthy. Log: ${PID_DIR}/challenger.log"
    tail -n 40 "${PID_DIR}/challenger.log" || true
    exit 1
  fi
fi

# --- Pick web port: prefer requested, else 3001 if occupied by non-YourWalk ---
if proxy_ok_on "${WEB_PORT}"; then
  echo "✓ YourWalk Next already up on :${WEB_PORT} (challenger proxy OK)"
elif port_serving_html_api "${WEB_PORT}"; then
  echo "⚠ :${WEB_PORT} is another app (HTML from /api/challenger-route), not YourWalk."
  if [[ "${WEB_PORT}" == "3000" ]]; then
    WEB_PORT=3001
    echo "→ Using :${WEB_PORT} for YourWalk instead"
  else
    echo "  Set WEB_PORT to a free port, e.g. WEB_PORT=3001 ./scripts/dev-up.sh"
    exit 1
  fi
fi

WEB_URL="$(web_url)"

# --- Next.js ---
if proxy_ok_on "${WEB_PORT}"; then
  echo "✓ Next.js ready on :${WEB_PORT}"
elif curl -sf --max-time 2 "${WEB_URL}/" >/dev/null 2>&1; then
  echo "⚠ :${WEB_PORT} responds but challenger proxy is not OK."
  echo "  Check web/.env.local has CHALLENGER_URL=${CHALLENGER_URL}"
  echo "  Restart YourWalk Next after env changes."
  exit 1
else
  if [[ ! -f "${ROOT}/web/package.json" ]]; then
    echo "✗ Missing web/package.json"
    exit 1
  fi
  if [[ ! -f "${ROOT}/web/.env.local" ]]; then
    echo "⚠ web/.env.local missing — copy from web/.env.example and set NEXT_PUBLIC_MAPBOX_TOKEN"
  fi
  echo "→ Starting YourWalk Next.js on :${WEB_PORT}…"
  : >"${PID_DIR}/web.log"
  # Prefer local next binary so we do not depend on npm's wrapper staying alive.
  if [[ -x "${ROOT}/web/node_modules/.bin/next" ]]; then
    python3 "${DETACH}" \
      "${PID_DIR}/web.pid" \
      "${PID_DIR}/web.log" \
      "${ROOT}/web" \
      -- \
      "${ROOT}/web/node_modules/.bin/next" dev --port "${WEB_PORT}"
  else
    python3 "${DETACH}" \
      "${PID_DIR}/web.pid" \
      "${PID_DIR}/web.log" \
      "${ROOT}/web" \
      -- \
      npm run dev -- --port "${WEB_PORT}"
  fi
  for _ in $(seq 1 120); do
    if curl -sf --max-time 2 "${WEB_URL}/" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
  if ! curl -sf --max-time 2 "${WEB_URL}/" >/dev/null 2>&1; then
    echo "✗ Next.js failed to become ready. Log: ${PID_DIR}/web.log"
    tail -n 40 "${PID_DIR}/web.log" || true
    exit 1
  fi
  for _ in $(seq 1 40); do
    if proxy_ok_on "${WEB_PORT}"; then
      break
    fi
    sleep 0.25
  done
  if proxy_ok_on "${WEB_PORT}"; then
    echo "✓ Next.js ready on :${WEB_PORT} (pid $(cat "${PID_DIR}/web.pid"); challenger proxy OK)"
  else
    echo "⚠ Next.js is up on :${WEB_PORT} but /api/challenger-route is not healthy yet."
    echo "  Log: ${PID_DIR}/web.log"
  fi
fi

echo "${WEB_PORT}" >"${PID_DIR}/web.port"

echo
WEB_PORT="${WEB_PORT}" WEB_URL="${WEB_URL}" CHALLENGER_URL="${CHALLENGER_URL}" \
  "${ROOT}/scripts/dev-status.sh"
echo
echo "Open ${WEB_URL}"
echo "Demo tip: numbered addresses (66 Cupples Crescent / 2 Ashfield Drive) → Find."
echo "Stop YourWalk pids: ${ROOT}/scripts/dev-down.sh"
echo "(Does not stop CrashDash or other apps on :3000.)"
