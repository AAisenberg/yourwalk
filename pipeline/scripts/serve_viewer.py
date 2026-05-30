#!/usr/bin/env python3
"""Serve the local pipeline QA map viewer.

Builds viewer GeoJSON from intermediate Parquet if missing, then starts a
static file server rooted at the pipeline directory.

Usage:
    python scripts/serve_viewer.py
    python scripts/serve_viewer.py --rebuild
    python scripts/serve_viewer.py --port 8765 --open
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parent.parent
BUILD_SCRIPT = PIPELINE_ROOT / "scripts" / "build_viewer_layers.py"
MANIFEST = PIPELINE_ROOT / "data" / "viewer" / "layers.json"
FILTERS = PIPELINE_ROOT / "data" / "viewer" / "filters.json"
DEFAULT_PORT = 8765


class ViewerHandler(SimpleHTTPRequestHandler):
    """Static files with permissive CORS for local GeoJSON fetches."""

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format: str, *args) -> None:
        if args and isinstance(args[0], str) and args[0].startswith(("GET /viewer", "GET /data/viewer")):
            super().log_message(format, *args)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--rebuild", action="store_true", help="Rebuild viewer GeoJSON before serving")
    parser.add_argument("--open", action="store_true", help="Open browser to the viewer")
    return parser.parse_args()


def ensure_layers(*, rebuild: bool) -> None:
    missing_filters = not FILTERS.exists()
    if rebuild or not MANIFEST.exists() or missing_filters:
        cmd = [sys.executable, str(BUILD_SCRIPT)]
        if rebuild or missing_filters:
            cmd.append("--force")
        subprocess.run(cmd, cwd=PIPELINE_ROOT, check=True)


def main() -> int:
    args = parse_args()
    ensure_layers(rebuild=args.rebuild)

    handler = partial(ViewerHandler, directory=str(PIPELINE_ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    url = f"http://127.0.0.1:{args.port}/viewer/index.html"

    print(f"Serving pipeline QA viewer at {url}")
    print("Press Ctrl+C to stop.")

    if args.open:
        webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.shutdown()

    return 0


if __name__ == "__main__":
    sys.exit(main())
