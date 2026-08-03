#!/usr/bin/env python3
"""Build lean segment_scores map GeoJSON and upload to Supabase Storage.

Faster map loads: one CDN GET (~3 MB gzip) instead of paginated PostGIS REST.

Requires:
  SUPABASE_URL                 e.g. https://muxatxlmpbkrsygmxcje.supabase.co
  SUPABASE_SERVICE_ROLE_KEY    Project Settings → API → service_role (secret)

Optional:
  DATABASE_URL                 apply storage bucket migration if present

Usage:
    export SUPABASE_URL=...
    export SUPABASE_SERVICE_ROLE_KEY=...
    python scripts/upload_segment_scores_geojson.py
    python scripts/upload_segment_scores_geojson.py --skip-upload   # local files only
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import httpx

from yourwalk_pipeline.map_geojson import write_map_geojson_files
from yourwalk_pipeline.paths import INTERMEDIATE_DIR, PIPELINE_ROOT


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = val


_load_dotenv(PIPELINE_ROOT / ".env")
_load_dotenv(PIPELINE_ROOT.parent / ".env")
_load_dotenv(PIPELINE_ROOT.parent / "web" / ".env.local")

DEFAULT_PARQUET = INTERMEDIATE_DIR / "segment_scores.parquet"
VIEWER_DIR = PIPELINE_ROOT / "data" / "viewer"
BUCKET = "map-data"
OBJECT_GEOJSON = "segment_scores.geojson"
OBJECT_GZIP = "segment_scores.geojson.gz"
OBJECT_META = "segment_scores.meta.json"
OBJECT_LGA = "casey_lga_boundary.geojson"
LGA_LOCAL = VIEWER_DIR / "casey_lga_boundary.geojson"
# Lab evidence layers (Night Index inputs) — optional if viewer export exists
EVIDENCE_UPLOADS = (
    ("streetlights.geojson", VIEWER_DIR / "streetlights.geojson"),
    ("park_lights.geojson", VIEWER_DIR / "park_lights.geojson"),
)
MIGRATION = (
    PIPELINE_ROOT.parent
    / "supabase"
    / "migrations"
    / "20260715000001_map_data_storage.sql"
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", type=Path, default=DEFAULT_PARQUET)
    p.add_argument("--skip-upload", action="store_true")
    p.add_argument(
        "--lga-only",
        action="store_true",
        help="Upload Casey LGA boundary only (skip segment rebuild)",
    )
    p.add_argument(
        "--apply-bucket-sql",
        action="store_true",
        help="Apply storage bucket migration via DATABASE_URL",
    )
    return p.parse_args()


def ensure_bucket(client: httpx.Client, base: str, key: str) -> None:
    # List buckets
    r = client.get(
        f"{base}/storage/v1/bucket",
        headers={"Authorization": f"Bearer {key}", "apikey": key},
    )
    r.raise_for_status()
    names = {b.get("id") or b.get("name") for b in r.json()}
    if BUCKET in names:
        return
    r = client.post(
        f"{base}/storage/v1/bucket",
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "Content-Type": "application/json",
        },
        json={
            "id": BUCKET,
            "name": BUCKET,
            "public": True,
            "file_size_limit": 52428800,
        },
    )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Create bucket failed: {r.status_code} {r.text}")


def upload_object(
    client: httpx.Client,
    base: str,
    key: str,
    object_path: str,
    data: bytes,
    content_type: str,
) -> str:
    url = f"{base}/storage/v1/object/{BUCKET}/{object_path}"
    r = client.post(
        url,
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "Content-Type": content_type,
            "x-upsert": "true",
        },
        content=data,
    )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Upload {object_path} failed: {r.status_code} {r.text}")
    return f"{base}/storage/v1/object/public/{BUCKET}/{object_path}"


def apply_bucket_sql() -> None:
    db = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not db:
        print("DATABASE_URL not set — skip SQL migration (bucket created via API).")
        return
    if not MIGRATION.exists():
        print(f"Migration missing: {MIGRATION}")
        return
    try:
        from sqlalchemy import create_engine, text
    except ImportError as exc:
        raise SystemExit("sqlalchemy required for --apply-bucket-sql") from exc

    url = db
    if url.startswith("postgresql://") and "+psycopg" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    engine = create_engine(url, pool_pre_ping=True)
    sql = MIGRATION.read_text(encoding="utf-8")
    statements: list[str] = []
    buf: list[str] = []
    for line in sql.splitlines():
        if line.strip().startswith("--"):
            continue
        buf.append(line)
        if line.strip().endswith(";"):
            statements.append("\n".join(buf).strip())
            buf = []
    with engine.begin() as conn:
        for statement in statements:
            if statement:
                conn.execute(text(statement))
    print(f"Applied {MIGRATION.name}")


def main() -> int:
    args = parse_args()

    base = (
        os.environ.get("SUPABASE_URL")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        or ""
    ).rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get(
        "SUPABASE_SERVICE_KEY"
    )

    out_geojson = VIEWER_DIR / "segment_scores_map.geojson"
    out_gzip = VIEWER_DIR / "segment_scores_map.geojson.gz"
    out_meta = VIEWER_DIR / "segment_scores_map.meta.json"
    meta: dict | None = None

    if not args.lga_only:
        if not args.input.exists():
            print(
                f"Missing {args.input}. Run: python scripts/score_segments.py",
                file=sys.stderr,
            )
            return 1

        print(f"Building map GeoJSON from {args.input} …")
        meta = write_map_geojson_files(args.input, out_geojson, out_gzip, out_meta)
        print(
            f"  features={meta['feature_count']:,}  "
            f"geojson={meta['geojson_bytes'] / 1e6:.1f} MB  "
            f"gzip={meta.get('gzip_bytes', 0) / 1e6:.1f} MB  "
            f"spec={meta.get('scoring_spec_version')}"
        )

    if not LGA_LOCAL.exists():
        print(
            f"Missing LGA boundary {LGA_LOCAL}. "
            "Run: python scripts/build_viewer_layers.py",
            file=sys.stderr,
        )
        return 1

    if args.skip_upload:
        print("Skip upload. Local files ready under data/viewer/")
        return 0

    if not base or not key:
        print(
            "ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to upload.\n"
            "  Or re-run with --skip-upload for local files only.\n"
            "  Service role: Supabase → Project Settings → API → service_role",
            file=sys.stderr,
        )
        return 1

    if args.apply_bucket_sql:
        apply_bucket_sql()

    with httpx.Client(timeout=120.0) as client:
        print(f"Ensuring public bucket '{BUCKET}' …")
        ensure_bucket(client, base, key)

        print("Uploading …")
        url_lga = upload_object(
            client,
            base,
            key,
            OBJECT_LGA,
            LGA_LOCAL.read_bytes(),
            "application/geo+json",
        )
        print(f"  LGA boundary → {url_lga}")

        if args.lga_only:
            print("\nAdd to web/.env.local:")
            print(f"NEXT_PUBLIC_LGA_BOUNDARY_URL={url_lga}")
            return 0

        assert meta is not None
        url_gz = upload_object(
            client,
            base,
            key,
            OBJECT_GZIP,
            out_gzip.read_bytes(),
            "application/gzip",
        )
        url_json = upload_object(
            client,
            base,
            key,
            OBJECT_GEOJSON,
            out_geojson.read_bytes(),
            "application/geo+json",
        )
        meta_public = {
            **meta,
            "public_url_gzip": url_gz,
            "public_url_geojson": url_json,
            "public_url_lga": url_lga,
        }
        url_meta = upload_object(
            client,
            base,
            key,
            OBJECT_META,
            (json.dumps(meta_public, indent=2) + "\n").encode("utf-8"),
            "application/json",
        )

        evidence_urls: dict[str, str] = {}
        for object_name, local_path in EVIDENCE_UPLOADS:
            if not local_path.exists():
                print(
                    f"  skip evidence {object_name} "
                    f"(missing {local_path.name} — run build_viewer_layers.py)"
                )
                continue
            print(
                f"  evidence {object_name} "
                f"({local_path.stat().st_size / 1e6:.1f} MB)…"
            )
            evidence_urls[object_name] = upload_object(
                client,
                base,
                key,
                object_name,
                local_path.read_bytes(),
                "application/geo+json",
            )

    print(json.dumps({"meta_url": url_meta, **meta_public}, indent=2))
    print("\nAdd to web/.env.local:")
    # Prefer plain .geojson — Cloudflare Smart CDN compresses on the wire.
    # Pre-gzipped .gz objects often return HTTP 400 in browsers (Accept-Encoding clash).
    print(f"NEXT_PUBLIC_SEGMENTS_GEOJSON_URL={url_json}")
    print(f"NEXT_PUBLIC_LGA_BOUNDARY_URL={url_lga}")
    print(f"# optional archive copy: {url_gz}")
    if evidence_urls:
        print("# Lab evidence layers (optional overrides; defaults use map-data/):")
        if "streetlights.geojson" in evidence_urls:
            print(
                "NEXT_PUBLIC_STREETLIGHTS_GEOJSON_URL="
                f"{evidence_urls['streetlights.geojson']}"
            )
        if "park_lights.geojson" in evidence_urls:
            print(
                "NEXT_PUBLIC_PARK_LIGHTS_GEOJSON_URL="
                f"{evidence_urls['park_lights.geojson']}"
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
