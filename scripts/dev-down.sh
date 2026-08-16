#!/usr/bin/env bash
# Stop processes started by ./scripts/dev-up.sh (pid files in .dev-pids/).
# Kills the process group so Next child workers die with the leader.
# Does not kill unrelated node/python on :3000/:8790 unless their pid matches.
# Usage: ./scripts/dev-down.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="${ROOT}/.dev-pids"

stop_pidfile() {
  local name="$1"
  local file="${PID_DIR}/${name}.pid"
  if [[ ! -f "$file" ]]; then
    echo "· no ${name}.pid"
    return 0
  fi
  local pid
  pid="$(tr -d '[:space:]' <"$file")"
  if [[ -z "$pid" ]]; then
    echo "· ${name}.pid empty"
    rm -f "$file"
    return 0
  fi
  if kill -0 "$pid" 2>/dev/null; then
    local pgid
    pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d '[:space:]' || true)"
    echo "→ stopping ${name} (pid ${pid}${pgid:+, pgid ${pgid}})"
    if [[ -n "${pgid}" && "${pgid}" != "0" ]]; then
      kill -- "-${pgid}" 2>/dev/null || kill "$pid" 2>/dev/null || true
    else
      kill "$pid" 2>/dev/null || true
    fi
    sleep 0.5
    if kill -0 "$pid" 2>/dev/null; then
      if [[ -n "${pgid}" && "${pgid}" != "0" ]]; then
        kill -9 -- "-${pgid}" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
      else
        kill -9 "$pid" 2>/dev/null || true
      fi
    fi
    echo "✓ ${name} stopped"
  else
    echo "· ${name} pid ${pid} already gone"
  fi
  rm -f "$file"
}

stop_pidfile challenger
stop_pidfile web
rm -f "${PID_DIR}/web.port"
echo "Done. Check: ./scripts/dev-status.sh"
