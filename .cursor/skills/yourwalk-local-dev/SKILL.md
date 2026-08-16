---
name: yourwalk-local-dev
description: >-
  Starts and checks the YourWalk local hybrid stack (Next.js resident app on
  :3000 plus score-aware challenger on :8790). Use when the user asks to start
  local, fire up the app, run both services, challenger + Next, dev-up, or
  fix localhost only showing one Mapbox route.
---

# YourWalk local hybrid (Next + challenger)

Resident A→B needs **two** local processes:

| Process | Port | Role |
|---------|------|------|
| Next.js (`web/`) | 3000 (or **3001** if 3000 is taken) | App, Mapbox, proxies `/api/challenger-route` |
| `serve_challenger.py` | 8790 | Casey score-aware paths + preference-weighted geometry |

Without the challenger, the UI silently falls back to Mapbox-only (often one card).

**Port clash:** CrashDash Vite often occupies `:3000`. `dev-up.sh` detects non-YourWalk on 3000 (HTML from `/api/challenger-route`) and starts YourWalk on **:3001**. Always tell the user the URL from the script output.

## Do this (agent)

1. From repo root, run:

```bash
./scripts/dev-up.sh
```

2. Confirm with:

```bash
./scripts/dev-status.sh
```

`dev-status` reads `.dev-pids/web.port` when present (so it follows :3001 after auto-fallback). Expect challenger health OK and Next → challenger proxy **JSON** `"ok": true` (not HTML).

3. Tell the user:
   - Open the URL printed by `dev-up` (3000 or 3001)
   - For dual options / pref geometry: numbered From/To (e.g. 66 Cupples Crescent, Berwick → 2 Ashfield Drive, Berwick), set prefs, tap **Find** (not only drag sliders on results)
   - Stop YourWalk pids later: `./scripts/dev-down.sh` (does not kill CrashDash on 3000)

## If dev-up fails

| Symptom | Fix |
|---------|-----|
| Missing `pipeline/.venv` | `cd pipeline && python -m venv .venv && source .venv/bin/activate && pip install -e ".[bakeoff]"` |
| Missing `score_aware_graph.gpickle` | `cd pipeline && source .venv/bin/activate && python bakeoff/build_graph.py` |
| Next up, proxy not OK | Ensure `web/.env.local` has `CHALLENGER_URL=http://127.0.0.1:8790`, then restart Next |
| Port in use, stale | `./scripts/dev-down.sh` then `./scripts/dev-up.sh`; or inspect `lsof -i :3000 -i :8790` |

Logs/pids: `.dev-pids/` (gitignored).

**Why it used to die after agent start:** plain `nohup … &` stayed in the Cursor shell process group and was killed when that command finished. `dev-up.sh` now double-forks via `scripts/dev-detach.py` so challenger + Next keep running after the agent turn ends.

## Manual equivalents

```bash
# Terminal A
cd pipeline && source .venv/bin/activate && python bakeoff/serve_challenger.py --port 8790

# Terminal B
cd web && npm run dev -- --port 3000
```

## Related

- Spec: `docs/PREFS_IN_PATHFINDING.md`
- Routing outputs: `docs/ROUTING_OUTPUTS.md`
- Env template: `web/.env.example`
