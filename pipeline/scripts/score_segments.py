#!/usr/bin/env python3
"""Score harmonised T1EAM segments — Day and Night Vulnerability Index.

Reads segment_features.parquet, writes segment_scores.parquet.
See docs/SCORING_SPEC_v1.1.md.

Usage:
    python scripts/score_segments.py
    python scripts/score_segments.py --input path/to/segment_features.parquet
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from yourwalk_pipeline.paths import INTERMEDIATE_DIR, QA_DIR, ensure_data_dirs
from yourwalk_pipeline.scoring import load_segment_features, score_segments

OUTPUT_PARQUET = INTERMEDIATE_DIR / "segment_scores.parquet"
QA_REPORT = QA_DIR / "segment_scoring.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        type=Path,
        default=None,
        help="Override segment_features.parquet path",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    ensure_data_dirs()

    input_path = args.input or INTERMEDIATE_DIR / "segment_features.parquet"
    if not Path(input_path).exists():
        print(f"Missing harmonised features: {input_path}", file=sys.stderr)
        print("Run: python scripts/harmonise_segments.py", file=sys.stderr)
        return 1

    print(f"Scoring segments from {input_path} …")
    features = load_segment_features(str(input_path))
    scored, qa = score_segments(features)

    scored.to_parquet(OUTPUT_PARQUET, index=False)
    QA_REPORT.write_text(json.dumps(qa, indent=2), encoding="utf-8")

    print(f"\n→ {OUTPUT_PARQUET} ({len(scored):,} segments)")
    print(f"→ {QA_REPORT}")
    print(f"  score_eligible: {qa['score_eligible_count']:,}")
    print(
        f"  day_index median: {qa['day_index']['median']:.1f} "
        f"(mean {qa['day_index']['mean']:.1f})"
    )
    print(
        f"  night_index median: {qa['night_index']['median']:.1f} "
        f"(mean {qa['night_index']['mean']:.1f})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
