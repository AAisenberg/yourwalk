#!/usr/bin/env python3
"""Local HTTP service: score-aware challenger routes for the YourWalk web app.

Usage (from pipeline/ with venv):

    python bakeoff/serve_challenger.py --port 8790

Web app proxies via POST /api/challenger-route → this service.
Env override: CHALLENGER_URL (default http://127.0.0.1:8790).
"""

from __future__ import annotations

import argparse
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from challenger import load_graph, plan_challenger  # noqa: E402


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path in ("/", "/health"):
            try:
                g = load_graph()
                self._json(
                    200,
                    {
                        "ok": True,
                        "service": "yourwalk-challenger",
                        "nodes": g.number_of_nodes(),
                        "edges": g.number_of_edges(),
                    },
                )
            except Exception as exc:  # noqa: BLE001
                self._json(503, {"ok": False, "error": str(exc)})
            return
        if path == "/route":
            qs = parse_qs(urlparse(self.path).query)
            try:
                olng = float(qs["origin_lng"][0])
                olat = float(qs["origin_lat"][0])
                dlng = float(qs["dest_lng"][0])
                dlat = float(qs["dest_lat"][0])
            except (KeyError, IndexError, ValueError):
                self._json(
                    400,
                    {
                        "error": "Need origin_lng, origin_lat, dest_lng, dest_lat",
                    },
                )
                return
            mode = (qs.get("mode") or ["day"])[0]
            self._handle_route(olng, olat, dlng, dlat, mode, None)
            return
        self._json(404, {"error": "Not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path not in ("/route", "/"):
            self._json(404, {"error": "Not found"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._json(400, {"error": "Invalid JSON"})
            return
        try:
            origin = body["origin"]
            dest = body["destination"]
            olng = float(origin["lng"] if isinstance(origin, dict) else origin[0])
            olat = float(origin["lat"] if isinstance(origin, dict) else origin[1])
            dlng = float(dest["lng"] if isinstance(dest, dict) else dest[0])
            dlat = float(dest["lat"] if isinstance(dest, dict) else dest[1])
        except (KeyError, TypeError, ValueError, IndexError):
            self._json(
                400,
                {
                    "error": "Body needs origin/destination as {lng,lat} or [lng,lat]",
                },
            )
            return
        mode = str(body.get("mode") or "day")
        prefs = body.get("prefs") if isinstance(body.get("prefs"), dict) else None
        self._handle_route(olng, olat, dlng, dlat, mode, prefs)

    def _handle_route(
        self,
        olng: float,
        olat: float,
        dlng: float,
        dlat: float,
        mode: str,
        prefs: dict | None = None,
    ) -> None:
        try:
            route = plan_challenger(
                olng, olat, dlng, dlat, mode=mode, prefs=prefs
            )
        except FileNotFoundError as exc:
            self._json(503, {"error": str(exc)})
            return
        except Exception as exc:  # noqa: BLE001
            self._json(500, {"error": str(exc)})
            return
        if route is None:
            self._json(404, {"error": "No score-aware path between these points"})
            return
        self._json(200, {"route": route})


def main() -> int:
    parser = argparse.ArgumentParser(description="YourWalk score-aware challenger HTTP")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8790)
    args = parser.parse_args()

    print("Loading score-aware graph…", flush=True)
    try:
        g = load_graph(force=True)
    except FileNotFoundError as exc:
        print(exc, file=sys.stderr)
        return 1
    print(
        f"Graph ready: {g.number_of_nodes()} nodes / {g.number_of_edges()} edges",
        flush=True,
    )

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Challenger listening on http://{args.host}:{args.port}", flush=True)
    print("  GET  /health", flush=True)
    print("  POST /route  JSON {origin:{lng,lat}, destination:{lng,lat}, mode}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
