#!/usr/bin/env python3
"""Compare v1.1.2 (nearest+count) vs v1.1.3 (density) lighting scores.

Writes data/qa/lighting_density_compare.json for local review.
Does not mutate segment_scores.parquet (run score_segments.py for that).

Usage:
    python scripts/compare_lighting_density.py
"""

from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from yourwalk_pipeline.paths import INTERMEDIATE_DIR, QA_DIR, ensure_data_dirs
from yourwalk_pipeline.scoring import (
    LIGHT_DENSITY_GOOD,
    LIGHT_DENSITY_POOR,
    LIGHT_DENSITY_SAT,
    LIGHT_LENGTH_FLOOR_100M,
    SCORING_SPEC_VERSION,
    _combined_lighting,
    load_segment_features,
    score_lighting,
)

OUT = QA_DIR / "lighting_density_compare.json"
FOCUS_SEGMENT = "92240"


def score_lighting_v112(df: pd.DataFrame) -> pd.Series:
    """Frozen v1.1.2 nearest + absolute count rule (for delta report only)."""
    street_near = df["streetlight_nearest_m"].astype(float)
    park_near = df.get("park_light_nearest_m", pd.Series(np.nan, index=df.index)).astype(
        float
    )
    nearest = pd.concat([street_near, park_near], axis=1).min(axis=1, skipna=True)
    count = df["streetlight_count_30m"].fillna(0).astype(float) + df.get(
        "park_light_count_50m", pd.Series(0, index=df.index)
    ).fillna(0).astype(float)
    poor = (nearest > 40) | count.eq(0)
    good = (nearest <= 25) & (count >= 1)
    curve = np.minimum(
        100.0, 70.0 + 30.0 * (1.0 - nearest / 25.0) + 5.0 * np.minimum(count, 6.0)
    )
    mod = 36.0 + 48.0 * (1.0 - (nearest - 25.0).clip(lower=0) / 15.0)
    mod = mod.where(count >= 1, mod * 0.7)
    return pd.Series(
        np.where(good, curve, np.where(poor, 35.0, mod)), index=df.index
    ).clip(0, 100)


def main() -> int:
    ensure_data_dirs()
    features = load_segment_features()
    eligible = features["score_eligible"].fillna(False).astype(bool)
    df = features.loc[eligible].copy()

    nearest, count, density = _combined_lighting(df)
    old = score_lighting_v112(df)
    new = score_lighting(df)
    delta = new - old

    focus = df[df["segment_id"].astype(str) == FOCUS_SEGMENT]
    focus_row = None
    if len(focus):
        i = focus.index[0]
        focus_row = {
            "segment_id": FOCUS_SEGMENT,
            "suburb": str(focus.at[i, "suburb"]),
            "length_m": float(focus.at[i, "length_m"]),
            "streetlight_nearest_m": float(nearest.loc[i]),
            "combined_count": float(count.loc[i]),
            "lighting_density_per_100m": float(density.loc[i]),
            "score_lighting_v1_1_2": round(float(old.loc[i]), 1),
            "score_lighting_v1_1_3": round(float(new.loc[i]), 1),
            "delta": round(float(delta.loc[i]), 1),
        }

    long_sparse = df[(count == 1) & (df["length_m"].astype(float) > 200)].copy()
    long_sparse = long_sparse.assign(
        dens=density.loc[long_sparse.index],
        old=old.loc[long_sparse.index],
        new=new.loc[long_sparse.index],
        delta=delta.loc[long_sparse.index],
    )

    biggest_drops = (
        pd.DataFrame(
            {
                "segment_id": df["segment_id"].astype(str),
                "suburb": df["suburb"],
                "length_m": df["length_m"].astype(float),
                "density": density,
                "old": old,
                "new": new,
                "delta": delta,
            }
        )
        .nsmallest(15, "delta")
        .round(2)
        .to_dict(orient="records")
    )

    report = {
        "compared_at": datetime.now(UTC).isoformat(),
        "scoring_spec_version_new": SCORING_SPEC_VERSION,
        "thresholds": {
            "good_per_100m": LIGHT_DENSITY_GOOD,
            "poor_per_100m": LIGHT_DENSITY_POOR,
            "saturation_per_100m": LIGHT_DENSITY_SAT,
            "length_floor_100m": LIGHT_LENGTH_FLOOR_100M,
        },
        "eligible_count": int(len(df)),
        "score_lighting": {
            "median_v1_1_2": round(float(old.median()), 2),
            "median_v1_1_3": round(float(new.median()), 2),
            "mean_delta": round(float(delta.mean()), 2),
            "delta_lt_neg20_count": int((delta < -20).sum()),
            "delta_lt_neg40_count": int((delta < -40).sum()),
        },
        "tiers": {
            "good_v1_1_2_nearest_and_count": int(
                ((nearest <= 25) & (count >= 1)).sum()
            ),
            "good_v1_1_3_nearest_and_density": int(
                ((nearest <= 25) & (density >= LIGHT_DENSITY_GOOD)).sum()
            ),
            "poor_v1_1_3": int(
                (
                    (nearest > 40)
                    | (count == 0)
                    | (density < LIGHT_DENSITY_POOR)
                ).sum()
            ),
        },
        "long_single_light_gt_200m": {
            "count": int(len(long_sparse)),
            "median_old": round(float(long_sparse["old"].median()), 2)
            if len(long_sparse)
            else None,
            "median_new": round(float(long_sparse["new"].median()), 2)
            if len(long_sparse)
            else None,
        },
        "focus_segment_92240": focus_row,
        "biggest_drops": biggest_drops,
        "notes": [
            "Density prevents one edge pole from lighting an entire long segment.",
            "Creek / recreational priority corridors are the main audit beneficiaries.",
            "Max-gap along path remains v1.2 (SEGMENT_HARMONISATION §5.8).",
        ],
    }

    OUT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["focus_segment_92240"], indent=2))
    print(
        f"\nNetwork: median lighting {report['score_lighting']['median_v1_1_2']} → "
        f"{report['score_lighting']['median_v1_1_3']} "
        f"(mean Δ {report['score_lighting']['mean_delta']})"
    )
    print(f"→ {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
