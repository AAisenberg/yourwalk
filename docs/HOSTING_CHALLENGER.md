# Host the Casey challenger (app 0.2.0)

Vercel runs the Next.js app. It cannot hold the Casey graph. Dual Casey cards on production phones need this always-on Python service, then `CHALLENGER_URL` on Vercel.

**Graph:** `pipeline/data/bakeoff/score_aware_graph.gpickle` (~102 MB on disk, ~280 MB RAM). Gitignored. Rebuild with `python bakeoff/build_graph.py` after cost or crossing changes.

**Host:** Fly.io, Sydney (`syd`), 1 GB shared VM, stay-on (`min_machines_running = 1`). First Find must not pay a 10–20 s graph load. Expect a few USD per month.

The browser never talks to Fly. Next `POST /api/challenger-route` (trips) and `POST /api/challenger-loop` (Around-here circuits) proxy with a shared secret.

**Endpoints:** `GET /health`, `POST /route` (A→B preference path), `POST /loop` (up to three Around-here circuits: `{start:{lng,lat}, minutes, mode, prefs}`). Both POST endpoints require the Bearer secret when set.

## What you do (Aisey)

### 1. Fly account

1. Sign up at [fly.io](https://fly.io/app/sign-up) (CrowdLab / personal is fine for the pilot).
2. Add a payment method (always-on 1 GB is billed).
3. On this Mac:

```bash
brew install flyctl
fly auth login
```

A browser window completes login. Then tell Cursor you are logged in.

### 2. Shared secret

In a terminal (do not commit the value):

```bash
openssl rand -hex 32
```

Keep that string. You will paste it in two places: Fly and Vercel.

### 3. After login: deploy from this repo

From the repo root, on a machine that has the pickle (this laptop does):

```bash
fly apps create yourwalk-challenger --org personal
# If the name is taken: change `app` in fly.toml and retry.

fly secrets set CHALLENGER_SHARED_SECRET='<paste the hex>'
fly deploy
```

Confirm:

```bash
curl -sS https://yourwalk-challenger.fly.dev/health
```

Expect `"ok": true`, ~296k nodes, `"auth_required": true`.

A `/route` call without the Bearer token must return 401.

### 4. Vercel env (Production and Preview)

In the [YourWalk Vercel project](https://vercel.com) → Settings → Environment Variables, add both for **Production** and **Preview**:

| Name | Value |
|------|--------|
| `CHALLENGER_URL` | `https://yourwalk-challenger.fly.dev` (no trailing slash) |
| `CHALLENGER_SHARED_SECRET` | the same hex as Fly |

Do **not** prefix these with `NEXT_PUBLIC_`. They stay server-only.

Redeploy the app after saving (or push the 0.2.0 branch / promote to production). Header should read **Beta · app 0.2.0**.

### 5. Phone check before Nikki

On the production URL:

1. Open `/api/challenger-route` — JSON `"ok": true`, not HTML.
2. 66 Cupples Crescent, Berwick → 2 Ashfield Drive, Berwick. Heat & Shade high. Prefer away **off**. **Find**.
3. Two Casey cards (Homestead + Bellevue). Tick away and Find again for the third.

If you only see Mapbox, the proxy cannot reach Fly or the secret does not match.

## Local (unchanged)

```bash
./scripts/dev-up.sh
```

Leave `CHALLENGER_URL=http://127.0.0.1:8790` in `web/.env.local`. Leave `CHALLENGER_SHARED_SECRET` unset locally.

## Rebuild the graph later

1. `cd pipeline && source .venv/bin/activate && python bakeoff/build_graph.py`
   - Sidewalk conversion (ADR-011) needs `data/intermediate/footpaths_ply_t1eam.parquet` and `sharedusepaths_ply_t1eam.parquet`; it skips with a warning if missing (routes revert to centreline drawing).
2. `python bakeoff/export_paths_underlay.py`, then `gh release upload map-data-v1 data/bakeoff/casey_paths_underlay.geojson --clobber` (resident map underlay must match the graph).
3. `fly deploy` from repo root (sends the new pickle).
4. Bump app version if testers need to know the graph changed.

Optional durable copy: GitHub release `challenger-graph-v1` (same pattern as `map-data-v1`). Not required for the first Fly deploy.

## Why not Vercel / Cloud Run

The graph is loaded once into NetworkX (~280 MB). Serverless cold starts would miss Nikki's first Find. Fly keeps one machine warm in Sydney.
