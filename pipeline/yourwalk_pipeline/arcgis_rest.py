"""Fetch GeoJSON from DEECA / Plan Melbourne ArcGIS MapServer layers."""

from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlencode

import httpx

DEFAULT_PAGE_SIZE = 1000


def download_mapserver_geojson(
    layer_url: str,
    dest: Path,
    *,
    where: str = "1=1",
    geometry: tuple[float, float, float, float] | None = None,
    in_sr: int = 4326,
    out_fields: str = "*",
    out_sr: int = 4326,
    page_size: int = DEFAULT_PAGE_SIZE,
    force: bool = False,
    timeout: float = 600.0,
) -> Path:
    """Paginate an ArcGIS MapServer /query endpoint into one GeoJSON file."""
    if dest.exists() and not force:
        return dest

    dest.parent.mkdir(parents=True, exist_ok=True)
    layer_url = layer_url.rstrip("/")
    all_features: list[dict] = []
    offset = 0

    while True:
        params: dict[str, str | int] = {
            "where": where,
            "outFields": out_fields,
            "outSR": out_sr,
            "returnGeometry": "true",
            "resultRecordCount": page_size,
            "resultOffset": offset,
            "f": "geojson",
        }
        if geometry is not None:
            minx, miny, maxx, maxy = geometry
            params.update(
                {
                    "geometry": f"{minx},{miny},{maxx},{maxy}",
                    "geometryType": "esriGeometryEnvelope",
                    "inSR": in_sr,
                    "spatialRel": "esriSpatialRelIntersects",
                }
            )

        url = f"{layer_url}/query?{urlencode(params)}"
        response = httpx.get(url, timeout=timeout, follow_redirects=True)
        response.raise_for_status()
        payload = response.json()

        if "error" in payload:
            raise RuntimeError(f"ArcGIS query failed: {payload['error']}")

        features = payload.get("features", [])
        all_features.extend(features)

        if len(features) < page_size:
            break
        offset += page_size

    collection = {"type": "FeatureCollection", "features": all_features}
    dest.write_text(json.dumps(collection), encoding="utf-8")
    return dest
