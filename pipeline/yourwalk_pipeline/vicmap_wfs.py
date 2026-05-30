"""Fetch clipped GeoJSON from Vicmap / DEECA open-data WFS."""

from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlencode

import httpx

VICMAP_WFS_BASE = "https://opendata.maps.vic.gov.au/geoserver/wfs"


def download_wfs_geojson(
    type_name: str,
    bbox: tuple[float, float, float, float],
    dest: Path,
    *,
    force: bool = False,
    timeout: float = 600.0,
    srs: str = "EPSG:4326",
) -> Path:
    """Download WFS features as GeoJSON for a bounding box (minx, miny, maxx, maxy)."""
    if dest.exists() and not force:
        return dest

    dest.parent.mkdir(parents=True, exist_ok=True)
    minx, miny, maxx, maxy = bbox
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeName": type_name,
        "bbox": f"{minx},{miny},{maxx},{maxy},{srs}",
        "outputFormat": "application/json",
    }
    url = f"{VICMAP_WFS_BASE}?{urlencode(params)}"

    with httpx.stream("GET", url, timeout=timeout, follow_redirects=True) as response:
        response.raise_for_status()
        with dest.open("wb") as handle:
            for chunk in response.iter_bytes():
                handle.write(chunk)

    with dest.open(encoding="utf-8") as handle:
        payload = json.load(handle)

    if payload.get("type") != "FeatureCollection":
        raise ValueError(f"Expected FeatureCollection from WFS, got {payload.get('type')!r}")

    return dest
