#!/usr/bin/env python3
"""Harmonise ingested layers onto the T1EAM footpath segment network.

Produces segment_features.parquet — one row per segment with join attributes
for scoring. See docs/SEGMENT_HARMONISATION.md.

Usage:
    python scripts/harmonise_segments.py
    python scripts/harmonise_segments.py --skip-council-trees
"""

from __future__ import annotations

import argparse
import json
import sys

from yourwalk_pipeline.harmonise import build_segment_features
from yourwalk_pipeline.paths import INTERMEDIATE_DIR, QA_DIR, ensure_data_dirs

OUTPUT_PARQUET = INTERMEDIATE_DIR / "segment_features.parquet"
QA_REPORT = QA_DIR / "segment_harmonisation.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--skip-council-trees",
        action="store_true",
        help="Skip council tree proximity joins (faster; omit enriching columns)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    ensure_data_dirs()

    print("Harmonising layers to T1EAM segments …")
    print(f"  corridor: 25 m | metric CRS: EPSG:7855")
    if args.skip_council_trees:
        print("  skipping council trees")

    gdf, qa = build_segment_features(include_council_trees=not args.skip_council_trees)

    gdf.to_parquet(OUTPUT_PARQUET, index=False)
    QA_REPORT.write_text(json.dumps(qa, indent=2), encoding="utf-8")

    print(f"\n→ {OUTPUT_PARQUET} ({len(gdf):,} segments)")
    print(f"→ {QA_REPORT}")
    print(f"  score_eligible: {qa['score_eligible_count']:,} segments")
    print(f"  speed_corridor_max_kmh populated: {gdf['speed_corridor_max_kmh'].notna().sum():,}")
    print(f"  uhi18_m populated: {gdf['uhi18_m'].notna().sum():,}")
    print(f"  streetlight_nearest_m populated: {gdf['streetlight_nearest_m'].notna().sum():,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
