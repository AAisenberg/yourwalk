"""Bake-off data paths (under pipeline/data/bakeoff/, gitignored)."""

from __future__ import annotations

from pathlib import Path

BAKEOFF_ROOT = Path(__file__).resolve().parent
PIPELINE_ROOT = BAKEOFF_ROOT.parent
REPO_ROOT = PIPELINE_ROOT.parent
DATA_ROOT = PIPELINE_ROOT / "data"
BAKEOFF_DATA = DATA_ROOT / "bakeoff"

SCORES_PARQUET = DATA_ROOT / "intermediate" / "segment_scores.parquet"
LGA_BOUNDARY = DATA_ROOT / "raw" / "caseylga_boundary.geojson"
OD_FIXTURE = REPO_ROOT / "docs" / "fixtures" / "bakeoff_od_sample.json"

SCORES_EXPORT = BAKEOFF_DATA / "casey_scores_lean.geojson"
OSM_WAYS = BAKEOFF_DATA / "casey_osm_footways.geojson"
OSM_JOINED = BAKEOFF_DATA / "casey_osm_scored_edges.geojson"
GRAPH_PICKLE = BAKEOFF_DATA / "score_aware_graph.gpickle"
RESULTS_DIR = BAKEOFF_DATA / "results"


def ensure_bakeoff_dirs() -> None:
    BAKEOFF_DATA.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
