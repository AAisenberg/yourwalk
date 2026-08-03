"""Segment-level Day/Night Vulnerability Index scoring.

See docs/SCORING_SPEC_v1.1.md and docs/VULNERABILITY_INDEX.md v1.1.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import geopandas as gpd
import numpy as np
import pandas as pd

from yourwalk_pipeline.paths import INTERMEDIATE_DIR

METHODOLOGY_VERSION = "1.1"
SCORING_SPEC_VERSION = "1.1.3"

# Lighting density (lights per 100 m of segment). See SCORING_SPEC §6.1.
LIGHT_DENSITY_GOOD = 1.0  # ~1 light / 100 m — minimum for good tier
LIGHT_DENSITY_POOR = 0.3  # < ~1 light / 333 m — poor tier
LIGHT_DENSITY_SAT = 2.0  # ~1 light / 50 m — saturates density bonus
LIGHT_LENGTH_FLOOR_100M = 0.5  # treat stubs shorter than 50 m as 50 m

DATA_VINTAGE = {
    "heat": "2018",
    "canopy": "2019/2020",
    "street_lights": "2024-06",
    "speed_zones": "2026-02",
    "crashes": "2012-present, 5y window",
}

SURFACE_SMOOTH = {
    "Concrete",
    "Reinforced Concrete",
    "Condensed Silica Fume Treated Concrete",
    "Condensed Silica Fume Treated Reinforced Concrete",
    "Asphalt - DGA",
    "Spray Seal",
}
# Moderate bucket → 50 (Nicole Kalms, 3 Jul 2026): brick paving, crushed rock, timber.
SURFACE_MODERATE = {
    "Brick Paving",
    "Class 2 Fine Crushed Rock",
    "Class 2 Crushed Rock",
    "Class 3 Fine Crushed Rock",
    "Timber",
}
SURFACE_ROUGH = {"Gravel", "Rubber", "Not Applicable"}

ACCESSIBILITY_WEIGHTS = {
    "width": 0.30,
    "surface": 0.25,
    "speed": 0.25,
    "graffiti": 0.15,
}
SCHOOL_CROSSING_BONUS = 5.0

HEAT_SHADE_WEIGHTS = {
    "heat": 0.45,
    "canopy": 0.40,
    "comfort": 0.15,
}
NIGHT_STREAM_WEIGHTS = {
    "lighting": 0.70,
    "crash": 0.30,
}
INDEX_BLEND = {
    "accessibility": 0.60,
    "stream": 0.40,
}


def _clamp(series: pd.Series, lo: float = 0.0, hi: float = 100.0) -> pd.Series:
    return series.clip(lower=lo, upper=hi)


def _interp(x: pd.Series, knots_x: list[float], knots_y: list[float]) -> pd.Series:
    return pd.Series(np.interp(x.to_numpy(dtype=float), knots_x, knots_y), index=x.index)


def _percentile_rank(series: pd.Series, eligible: pd.Series) -> pd.Series:
    ref = series[eligible & series.notna()]
    if ref.empty:
        return pd.Series(0.5, index=series.index)
    ranks = ref.rank(method="average", pct=True)
    out = pd.Series(np.nan, index=series.index)
    out.loc[ranks.index] = ranks
    return out.fillna(0.5)


def score_width(df: pd.DataFrame) -> pd.Series:
    width = df["width_m"].astype(float)
    path_class = df.get("walk_path_class", pd.Series("footpath", index=df.index))
    qa = df.get("width_qa_flag", pd.Series("ok", index=df.index))

    neutral = qa.isin(["missing", "zero"]) | width.isna()
    shared = path_class.eq("shared_use")

    foot = _interp(
        width,
        [0.8, 1.0, 1.2, 1.5, 1.8, 2.5],
        [15.0, 35.0, 50.0, 70.0, 85.0, 100.0],
    )
    foot = foot.where(width >= 0.8, 15.0)
    foot = foot.where(width <= 2.5, 100.0)

    shared_score = _interp(
        width,
        [2.0, 2.5, 3.0, 4.0, 6.0],
        [20.0, 45.0, 70.0, 90.0, 100.0],
    )
    shared_score = shared_score.where(width >= 2.0, 20.0)
    shared_score = shared_score.where(width <= 6.0, 100.0)

    out = foot.where(~shared, shared_score)
    out = out.where(~neutral, 50.0)
    return _clamp(out)


def score_surface(material: pd.Series) -> pd.Series:
    mat = material.fillna("").astype(str)
    out = pd.Series(50.0, index=material.index)
    out = out.where(~mat.isin(SURFACE_SMOOTH), 90.0)
    out = out.where(~mat.isin(SURFACE_MODERATE), 50.0)
    out = out.where(~mat.isin(SURFACE_ROUGH), 35.0)
    unknown = mat.eq("") | mat.eq("To be determined")
    out = out.where(~unknown, 50.0)
    return out


def score_speed(speed_kmh: pd.Series) -> pd.Series:
    speed = speed_kmh.astype(float)
    out = _interp(speed, [40, 50, 60, 70, 80, 90, 100], [100, 85, 70, 55, 40, 30, 20])
    out = out.where(speed <= 100, 20.0)
    out = out.where(speed >= 40, 100.0)
    return out.where(speed.notna(), np.nan)


def score_graffiti(df: pd.DataFrame) -> pd.Series:
    count = df["graffiti_count_25m"].fillna(0).astype(float)
    recent = df.get("graffiti_count_25m_365d", pd.Series(0, index=df.index)).fillna(0).astype(float)
    days = df.get("graffiti_days_since_last", pd.Series(np.nan, index=df.index)).astype(float)

    density = 100.0 - np.minimum(100.0, 25.0 * np.log1p(count))
    recency = np.where(count.eq(0), 100.0, np.minimum(100.0, days / 10.0))
    active_penalty = np.minimum(30.0, 15.0 * recent)
    raw = 0.6 * density + 0.4 * recency - active_penalty
    return _clamp(pd.Series(raw, index=df.index))


def score_school_crossing_bonus(within_20m: pd.Series) -> pd.Series:
    return within_20m.fillna(False).astype(bool).map({True: SCHOOL_CROSSING_BONUS, False: 0.0})


def score_accessibility(df: pd.DataFrame) -> tuple[pd.Series, dict[str, pd.Series]]:
    components = {
        "width": score_width(df),
        "surface": score_surface(df["surface_material"]),
        "speed": score_speed(df["speed_corridor_max_kmh"]),
        "graffiti": score_graffiti(df),
    }
    bonus = score_school_crossing_bonus(df["school_crossing_within_20m"])

    weight_keys = list(ACCESSIBILITY_WEIGHTS.keys())
    weight_sum = pd.Series(0.0, index=df.index)
    weighted = pd.Series(0.0, index=df.index)
    for key in weight_keys:
        w = ACCESSIBILITY_WEIGHTS[key]
        comp = components[key]
        present = comp.notna()
        weighted = weighted + comp.fillna(0.0) * w * present
        weight_sum = weight_sum + w * present

    base = weighted / weight_sum.replace(0, np.nan)
    total = _clamp(base.fillna(50.0) + bonus)
    return total, {**components, "school_crossing_bonus": bonus}


def score_heat(uhi: pd.Series, eligible: pd.Series) -> pd.Series:
    pct = _percentile_rank(uhi, eligible)
    out = 100.0 * (1.0 - pct)
    return _clamp(out.where(uhi.notna(), 50.0))


def score_canopy(df: pd.DataFrame) -> pd.Series:
    dense = df["canopy_dense_pct"].fillna(0).astype(float)
    medium = df["canopy_medium_pct"].fillna(0).astype(float)
    sparse = df["canopy_sparse_pct"].fillna(0).astype(float)
    cover = df["canopy_cover_pct"].fillna(0).astype(float)
    weighted = dense * 100.0 + medium * 60.0 + sparse * 20.0
    out = weighted / cover.clip(lower=1.0)
    return _clamp(out.where(cover > 0, 30.0))


def score_comfort(df: pd.DataFrame) -> pd.Series:
    fountain_m = df["fountain_nearest_m"].astype(float)
    bench_count = df["bench_count_50m"].fillna(0).astype(float)
    bench_m = df["bench_nearest_m"].astype(float)

    fountain = pd.Series(20.0, index=df.index)
    fountain = fountain.where(~(fountain_m <= 100), 100.0)
    fountain = fountain.where(~((fountain_m > 100) & (fountain_m <= 200)), 70.0)
    fountain = fountain.where(~((fountain_m > 200) & (fountain_m <= 400)), 40.0)

    bench = pd.Series(30.0, index=df.index)
    bench = bench.where(~(bench_count >= 2), 100.0)
    bench = bench.where(~(bench_count == 1), 80.0)
    bench = bench.where(~((bench_count < 1) & (bench_m <= 100)), 60.0)

    return _clamp(0.55 * fountain + 0.45 * bench)


def score_heat_shade(df: pd.DataFrame, eligible: pd.Series) -> tuple[pd.Series, dict[str, pd.Series]]:
    components = {
        "heat": score_heat(df["uhi18_m"], eligible),
        "canopy": score_canopy(df),
        "comfort": score_comfort(df),
    }
    total = sum(components[k] * HEAT_SHADE_WEIGHTS[k] for k in components)
    return _clamp(total), components


def _combined_lighting(df: pd.DataFrame) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Nearest m, combined count, and lights per 100 m of segment length."""
    street_near = df["streetlight_nearest_m"].astype(float)
    park_near = df.get("park_light_nearest_m", pd.Series(np.nan, index=df.index)).astype(float)
    nearest = pd.concat([street_near, park_near], axis=1).min(axis=1, skipna=True)
    count = df["streetlight_count_30m"].fillna(0).astype(float) + df.get(
        "park_light_count_50m", pd.Series(0, index=df.index)
    ).fillna(0).astype(float)
    length_m = df["length_m"].astype(float)
    density = count / np.maximum(length_m / 100.0, LIGHT_LENGTH_FLOOR_100M)
    return nearest, count, density


def score_lighting(df: pd.DataFrame) -> pd.Series:
    """Length-normalised lighting coverage (SCORING_SPEC §6.1 / v1.1.3).

    Nearest distance alone must not mark a long segment as well lit when only
    one pole sits on the buffer edge (creek trails / mega-polygons).
    """
    nearest, count, density = _combined_lighting(df)
    poor = (nearest > 40) | count.eq(0) | (density < LIGHT_DENSITY_POOR)
    good = (nearest <= 25) & (density >= LIGHT_DENSITY_GOOD)

    # Good: proximity term + density term (saturates near typical ~50 m spacing)
    curve = (
        55.0
        + 25.0 * (1.0 - nearest / 25.0)
        + 20.0 * np.minimum(density / LIGHT_DENSITY_SAT, 1.0)
    )
    curve = np.minimum(100.0, curve)

    mod_score = 30.0 + 40.0 * (1.0 - (nearest - 25.0).clip(lower=0) / 15.0)
    mod_score = mod_score + 15.0 * np.minimum(density / LIGHT_DENSITY_GOOD, 1.0)
    mod_score = mod_score.clip(upper=84.0)
    mod_score = mod_score.where(count >= 1, mod_score * 0.7)

    out = pd.Series(np.where(good, curve, np.where(poor, 35.0, mod_score)), index=df.index)
    return _clamp(out)


def score_crash(df: pd.DataFrame, eligible: pd.Series) -> pd.Series:
    count = df["crash_night_count_25m_5y"].fillna(0).astype(float)
    length_km = (df["length_m"].astype(float) / 1000.0).clip(lower=0.05)
    density = count / length_km
    pct = _percentile_rank(density, eligible)
    out = 100.0 * (1.0 - pct)
    return _clamp(out)


def score_lighting_after_dark(
    df: pd.DataFrame, eligible: pd.Series
) -> tuple[pd.Series, dict[str, pd.Series]]:
    components = {
        "lighting": score_lighting(df),
        "crash": score_crash(df, eligible),
    }
    total = sum(components[k] * NIGHT_STREAM_WEIGHTS[k] for k in components)
    return _clamp(total), components


def _confidence_tier(start: str, deductions: int) -> str:
    tiers = ["high", "medium", "low"]
    idx = tiers.index(start) + deductions
    return tiers[min(idx, len(tiers) - 1)]


def compute_confidence(df: pd.DataFrame, scored: pd.DataFrame) -> tuple[pd.Series, pd.Series]:
    day_ded = pd.Series(0, index=df.index)
    night_ded = pd.Series(0, index=df.index)

    width_bad = ~df.get("width_qa_flag", pd.Series("ok", index=df.index)).eq("ok")
    speed_miss = df["speed_corridor_max_kmh"].isna()
    canopy_zero = df["canopy_cover_pct"].fillna(0).eq(0)
    uhi_weak = df.get("uhi_join_method", pd.Series("intersection", index=df.index)).ne("intersection") | df[
        "uhi18_m"
    ].isna()

    nearest, count, density = _combined_lighting(df)
    light_poor = (nearest > 40) | count.eq(0) | (density < LIGHT_DENSITY_POOR)

    crossing_gap = df.get("coverage_flags", pd.Series("{}", index=df.index)).astype(str).str.contains(
        '"crossing": "gap"'
    )

    day_ded = day_ded + width_bad.astype(int) + speed_miss.astype(int) + crossing_gap.astype(int)
    day_ded = day_ded + uhi_weak.astype(int) + canopy_zero.astype(int)

    night_ded = night_ded + width_bad.astype(int) + speed_miss.astype(int) + crossing_gap.astype(int)
    night_ded = night_ded + light_poor.astype(int)

    conf_day = day_ded.apply(lambda d: _confidence_tier("high", int(d)))
    conf_night = night_ded.apply(lambda d: _confidence_tier("high", int(d)))
    return conf_day, conf_night


def score_segments(features: gpd.GeoDataFrame) -> tuple[gpd.GeoDataFrame, dict[str, Any]]:
    """Compute Day/Night index scores from harmonised segment features."""
    df = features.copy()
    eligible = df["score_eligible"].fillna(False).astype(bool)

    accessibility, acc_parts = score_accessibility(df)
    heat_shade, day_parts = score_heat_shade(df, eligible)
    lighting_stream, night_parts = score_lighting_after_dark(df, eligible)

    day_index = _clamp(
        INDEX_BLEND["accessibility"] * accessibility + INDEX_BLEND["stream"] * heat_shade
    )
    night_index = _clamp(
        INDEX_BLEND["accessibility"] * accessibility + INDEX_BLEND["stream"] * lighting_stream
    )

    day_index = day_index.where(eligible, np.nan)
    night_index = night_index.where(eligible, np.nan)

    conf_day, conf_night = compute_confidence(df, pd.DataFrame({"day": day_index}))

    scored_at = datetime.now(UTC).isoformat()
    out = df[
        [
            "segment_id",
            "geometry",
            "walk_path_class",
            "score_eligible",
            "suburb",
            "ward",
            "length_m",
        ]
    ].copy()

    out["score_width"] = acc_parts["width"].round(1)
    out["score_surface"] = acc_parts["surface"].round(1)
    out["score_speed"] = acc_parts["speed"].round(1)
    out["score_graffiti"] = acc_parts["graffiti"].round(1)
    out["score_school_crossing_bonus"] = acc_parts["school_crossing_bonus"].round(1)
    out["accessibility_score"] = accessibility.round(1)

    out["score_heat"] = day_parts["heat"].round(1)
    out["score_canopy"] = day_parts["canopy"].round(1)
    out["score_comfort"] = day_parts["comfort"].round(1)
    out["heat_shade_score"] = heat_shade.round(1)
    out["day_index_score"] = day_index.round(1)

    _nearest, _count, lighting_density = _combined_lighting(df)
    out["lighting_density_per_100m"] = lighting_density.round(3)
    out["score_lighting"] = night_parts["lighting"].round(1)
    out["score_crash"] = night_parts["crash"].round(1)
    out["lighting_after_dark_score"] = lighting_stream.round(1)
    out["night_index_score"] = night_index.round(1)

    out["day_index_display"] = (day_index / 10.0).round(1)
    out["night_index_display"] = (night_index / 10.0).round(1)

    out["confidence_day"] = conf_day
    out["confidence_night"] = conf_night
    out["data_vintage"] = json.dumps(DATA_VINTAGE)
    out["scored_at"] = scored_at
    out["methodology_version"] = METHODOLOGY_VERSION
    out["scoring_spec_version"] = SCORING_SPEC_VERSION

    eligible_day = out.loc[eligible, "day_index_score"]
    eligible_night = out.loc[eligible, "night_index_score"]

    qa: dict[str, Any] = {
        "scored_at": scored_at,
        "segment_count": int(len(out)),
        "score_eligible_count": int(eligible.sum()),
        "methodology_version": METHODOLOGY_VERSION,
        "scoring_spec_version": SCORING_SPEC_VERSION,
        "data_vintage": DATA_VINTAGE,
        "day_index": {
            "median": float(eligible_day.median()),
            "mean": float(eligible_day.mean()),
            "min": float(eligible_day.min()),
            "max": float(eligible_day.max()),
            "null_count": int(out["day_index_score"].isna().sum()),
        },
        "night_index": {
            "median": float(eligible_night.median()),
            "mean": float(eligible_night.mean()),
            "min": float(eligible_night.min()),
            "max": float(eligible_night.max()),
            "null_count": int(out["night_index_score"].isna().sum()),
        },
        "sub_score_medians": {
            "accessibility_score": float(out.loc[eligible, "accessibility_score"].median()),
            "heat_shade_score": float(out.loc[eligible, "heat_shade_score"].median()),
            "lighting_after_dark_score": float(
                out.loc[eligible, "lighting_after_dark_score"].median()
            ),
            "score_lighting": float(out.loc[eligible, "score_lighting"].median()),
            "lighting_density_per_100m": float(
                out.loc[eligible, "lighting_density_per_100m"].median()
            ),
        },
        "lighting_density": {
            "good_threshold_per_100m": LIGHT_DENSITY_GOOD,
            "poor_threshold_per_100m": LIGHT_DENSITY_POOR,
            "saturation_per_100m": LIGHT_DENSITY_SAT,
            "eligible_median_density": float(
                out.loc[eligible, "lighting_density_per_100m"].median()
            ),
            "eligible_below_poor_threshold": int(
                (out.loc[eligible, "lighting_density_per_100m"] < LIGHT_DENSITY_POOR).sum()
            ),
        },
        "confidence_day_counts": out["confidence_day"].value_counts().to_dict(),
        "confidence_night_counts": out["confidence_night"].value_counts().to_dict(),
    }
    return out, qa


def load_segment_features(path: str | None = None) -> gpd.GeoDataFrame:
    parquet = INTERMEDIATE_DIR / "segment_features.parquet" if path is None else path
    gdf = gpd.read_parquet(parquet)
    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")
    return gdf
