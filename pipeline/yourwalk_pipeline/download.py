"""Download helpers for Casey Open Data and Transport Victoria direct URLs."""

from __future__ import annotations

import json
from pathlib import Path

import httpx

CASEY_API_BASE = "https://data.casey.vic.gov.au/api/explore/v2.1/catalog/datasets"


def download_geojson_export(
    dataset_id: str,
    dest: Path,
    *,
    force: bool = False,
    timeout: float = 600.0,
) -> Path:
    """Download full dataset GeoJSON export from Casey Open Data."""
    if dest.exists() and not force:
        return dest

    dest.parent.mkdir(parents=True, exist_ok=True)
    url = f"{CASEY_API_BASE}/{dataset_id}/exports/geojson"

    with httpx.stream("GET", url, timeout=timeout, follow_redirects=True) as response:
        response.raise_for_status()
        with dest.open("wb") as handle:
            for chunk in response.iter_bytes():
                handle.write(chunk)

    # Validate JSON parses (GeoJSON FeatureCollection)
    with dest.open(encoding="utf-8") as handle:
        json.load(handle)

    return dest


def download_file(
    url: str,
    dest: Path,
    *,
    force: bool = False,
    timeout: float = 1800.0,
) -> Path:
    """Stream-download a file from a direct URL (e.g. Transport Victoria CKAN)."""
    if dest.exists() and not force:
        return dest

    dest.parent.mkdir(parents=True, exist_ok=True)

    with httpx.stream("GET", url, timeout=timeout, follow_redirects=True) as response:
        response.raise_for_status()
        with dest.open("wb") as handle:
            for chunk in response.iter_bytes():
                handle.write(chunk)

    return dest
