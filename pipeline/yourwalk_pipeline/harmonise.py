"""Join ingested layers to the T1EAM footpath segment network.

See docs/SEGMENT_HARMONISATION.md for rules and column definitions.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import geopandas as gpd
import numpy as np
import pandas as pd

from yourwalk_pipeline.paths import INTERMEDIATE_DIR

METRIC_CRS = "EPSG:7855"
STORAGE_CRS = "EPSG:4326"
CORRIDOR_M = 25
STREETLIGHT_NEAR_M = 30
STREETLIGHT_FAR_M = 50
PARK_LIGHT_M = 50
BENCH_M = 50
FOUNTAIN_NEAR_M = 100
FOUNTAIN_FAR_M = 200
SCHOOL_CROSSING_NEAR_M = 20
SCHOOL_CROSSING_FAR_M = 50
UHI_NEAREST_M = 50
CRASH_YEARS = 5
EXCLUDE_SUBURBS = {"Dandenong"}
METHODOLOGY_VERSION = "1.1"
SPEC_VERSION = "0.3"

PASS_THROUGH = [
    "segment_id",
    "surface_material",
    "width_m",
    "width_qa_flag",
    "length_m",
    "function_use",
    "ownership",
    "suburb",
    "ward",
    "postcode",
    "gis_modified_date",
]


def _load_parquet(name: str) -> gpd.GeoDataFrame:
    path = INTERMEDIATE_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Missing intermediate file: {path}")
    gdf = gpd.read_parquet(path)
    if gdf.crs is None:
        gdf = gdf.set_crs(STORAGE_CRS)
    return gdf.to_crs(METRIC_CRS)


def _empty_index(segments: gpd.GeoDataFrame) -> pd.Index:
    return pd.Index(segments["segment_id"].astype(str), name="segment_id")


def _reindex_series(segments: gpd.GeoDataFrame, values: pd.Series) -> pd.Series:
    idx = _empty_index(segments)
    if values.index.duplicated().any():
        values = values[~values.index.duplicated(keep="first")]
    return values.reindex(idx)


def _clip_lines_to_corridor(
    lines: gpd.GeoDataFrame,
    segments: gpd.GeoDataFrame,
    value_col: str,
) -> pd.DataFrame:
    """Length-weighted stats for line features inside each segment corridor."""
    corridors = gpd.GeoDataFrame(
        segments[["segment_id"]],
        geometry=segments["corridor"],
        crs=segments.crs,
    )
    joined = gpd.sjoin(lines, corridors, predicate="intersects", how="inner")
    if joined.empty:
        return pd.DataFrame()

    seg_corridor = segments.set_index("segment_id")["corridor"]
    lengths: list[float] = []
    for row in joined.itertuples():
        corridor = seg_corridor.loc[row.segment_id]
        clipped = row.geometry.intersection(corridor)
        lengths.append(float(clipped.length) if not clipped.is_empty else 0.0)
    joined = joined.copy()
    joined["len_in_corridor"] = lengths

    def _agg(group: pd.DataFrame) -> pd.Series:
        total = group["len_in_corridor"].sum()
        if total <= 0:
            dominant = np.nan
        else:
            dominant = group.groupby(value_col)["len_in_corridor"].sum().idxmax()
        return pd.Series(
            {
                "speed_corridor_max_kmh": group[value_col].max(),
                "speed_corridor_dominant_kmh": dominant,
                "speed_corridor_line_m": total,
            }
        )

    return joined.groupby("segment_id", as_index=True).apply(_agg, include_groups=False)


def _line_intersect_stats(
    lines: gpd.GeoDataFrame,
    segments: gpd.GeoDataFrame,
    value_col: str,
    prefix: str,
) -> pd.DataFrame:
    joined = gpd.sjoin(lines, segments[["segment_id", "geometry"]], predicate="intersects", how="inner")
    if joined.empty:
        return pd.DataFrame()

    seg_geom = segments.set_index("segment_id")["geometry"]
    overlap: list[float] = []
    for row in joined.itertuples():
        footpath = seg_geom.loc[row.segment_id]
        clipped = row.geometry.intersection(footpath)
        overlap.append(float(clipped.length) if not clipped.is_empty else 0.0)
    joined = joined.copy()
    joined["overlap_m"] = overlap

    def _agg(group: pd.DataFrame) -> pd.Series:
        return pd.Series({f"{prefix}_overlap_m": group["overlap_m"].sum(), f"{prefix}_max_kmh": group[value_col].max()})

    return joined.groupby("segment_id", as_index=True).apply(_agg, include_groups=False)


def _nearest_line_stats(lines: gpd.GeoDataFrame, segments: gpd.GeoDataFrame, value_col: str) -> pd.DataFrame:
    nearest = gpd.sjoin_nearest(
        segments[["segment_id", "geometry"]],
        lines[[value_col, "geometry"]],
        max_distance=500,
        distance_col="dist_m",
    )
    if nearest.empty:
        return pd.DataFrame()
    nearest["segment_id"] = nearest["segment_id"].astype(str)
    idx = nearest.groupby("segment_id")["dist_m"].idxmin()
    return (
        nearest.loc[idx, ["segment_id", "dist_m", value_col]]
        .set_index("segment_id")
        .rename(columns={"dist_m": "speed_nearest_line_m", value_col: "speed_nearest_line_kmh"})
    )


def join_speed_zones(segments: gpd.GeoDataFrame, speed: gpd.GeoDataFrame) -> pd.DataFrame:
    speed = speed[speed["speed_limit_kmh"].notna()].copy()
    speed["speed_limit_kmh"] = pd.to_numeric(speed["speed_limit_kmh"], errors="coerce")
    corridor_stats = _clip_lines_to_corridor(speed, segments, "speed_limit_kmh")
    intersect_stats = _line_intersect_stats(speed, segments, "speed_limit_kmh", "speed_intersect")
    nearest_stats = _nearest_line_stats(speed, segments, "speed_limit_kmh")
    out = pd.DataFrame(index=_empty_index(segments))
    for part in (corridor_stats, intersect_stats, nearest_stats):
        if not part.empty:
            out = out.join(part, how="left")
    return out


def _point_counts_in_buffer(
    segments: gpd.GeoDataFrame,
    points: gpd.GeoDataFrame,
    buffer_m: float,
    count_col: str,
) -> pd.Series:
    buf = gpd.GeoDataFrame(
        segments[["segment_id"]].copy(),
        geometry=segments.geometry.buffer(buffer_m),
        crs=segments.crs,
    )
    joined = gpd.sjoin(points, buf, predicate="within", how="inner")
    counts = joined.groupby("segment_id").size()
    return _reindex_series(segments, counts.rename(count_col)).fillna(0).astype(int)


def _point_counts_corridor(
    segments: gpd.GeoDataFrame,
    points: gpd.GeoDataFrame,
    count_col: str,
    *,
    filter_fn=None,
) -> pd.Series:
    corridors = gpd.GeoDataFrame(
        segments[["segment_id"]],
        geometry=segments["corridor"],
        crs=segments.crs,
    )
    pts = points if filter_fn is None else points[filter_fn(points)]
    joined = gpd.sjoin(pts, corridors, predicate="within", how="inner")
    counts = joined.groupby("segment_id").size()
    return _reindex_series(segments, counts.rename(count_col)).fillna(0).astype(int)


def join_graffiti(segments: gpd.GeoDataFrame, graffiti: gpd.GeoDataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=_empty_index(segments))
    out["graffiti_count_25m"] = _point_counts_corridor(segments, graffiti, "graffiti_count_25m")
    offensive = graffiti[graffiti["graffiti_type"].astype(str).str.lower().eq("offensive")]
    out["graffiti_offensive_count_25m"] = _point_counts_corridor(
        segments, offensive, "graffiti_offensive_count_25m"
    )

    corridors = gpd.GeoDataFrame(
        segments[["segment_id"]],
        geometry=segments["corridor"],
        crs=segments.crs,
    )
    joined = gpd.sjoin(graffiti, corridors, predicate="within", how="inner")
    run_date = datetime.now(UTC).date()
    if not joined.empty and "created_date" in joined.columns:
        created = pd.to_datetime(joined["created_date"], errors="coerce", utc=True)
        joined = joined.assign(created_date=created)
        last = joined.groupby("segment_id")["created_date"].max()
        days_since = (run_date - last.dt.date).apply(lambda d: d.days if pd.notna(d) else np.nan)
        out["graffiti_days_since_last"] = _reindex_series(segments, days_since)
        cutoff = pd.Timestamp(run_date, tz=UTC) - pd.Timedelta(days=365)
        recent = joined[joined["created_date"] >= cutoff]
        out["graffiti_count_25m_365d"] = _reindex_series(
            segments, recent.groupby("segment_id").size()
        ).fillna(0).astype(int)
        if "days_to_remove" in joined.columns:
            completed = joined[joined["days_to_remove"].notna()]
            mean_days = completed.groupby("segment_id")["days_to_remove"].mean()
            out["graffiti_mean_days_to_remove"] = _reindex_series(segments, mean_days)
    else:
        out["graffiti_days_since_last"] = np.nan
        out["graffiti_count_25m_365d"] = 0
    return out


def join_school_crossings(segments: gpd.GeoDataFrame, crossings: gpd.GeoDataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=_empty_index(segments))
    nearest = gpd.sjoin_nearest(
        segments[["segment_id", "geometry"]],
        crossings[["geometry"]],
        max_distance=1000,
        distance_col="school_crossing_nearest_m",
    )
    if nearest.empty:
        out["school_crossing_nearest_m"] = np.nan
        out["school_crossing_within_20m"] = False
        out["school_crossing_within_50m"] = False
        return out
    nearest["segment_id"] = nearest["segment_id"].astype(str)
    idx = nearest.groupby("segment_id")["school_crossing_nearest_m"].idxmin()
    best = nearest.loc[idx, ["segment_id", "school_crossing_nearest_m"]].set_index("segment_id")
    out["school_crossing_nearest_m"] = _reindex_series(segments, best["school_crossing_nearest_m"])
    out["school_crossing_within_20m"] = (out["school_crossing_nearest_m"] <= SCHOOL_CROSSING_NEAR_M).fillna(False)
    out["school_crossing_within_50m"] = (out["school_crossing_nearest_m"] <= SCHOOL_CROSSING_FAR_M).fillna(False)
    return out


def join_urban_heat(segments: gpd.GeoDataFrame, heat: gpd.GeoDataFrame) -> pd.DataFrame:
    heat = heat[heat["uhi18_m"].notna()].copy()
    inter = gpd.overlay(segments[["segment_id", "geometry"]], heat, how="intersection", keep_geom_type=False)
    out = pd.DataFrame(index=_empty_index(segments))
    if inter.empty:
        out["uhi18_m"] = np.nan
        out["uhi_overlap_pct"] = np.nan
        out["uhi_join_method"] = "missing"
        return out

    inter["piece_area"] = inter.geometry.area
    seg_area = segments.set_index("segment_id")["geometry"].area

    def _wmean(g: pd.DataFrame) -> float:
        return float(np.average(g["uhi18_m"], weights=g["piece_area"]))

    out["uhi18_m"] = _reindex_series(segments, inter.groupby("segment_id").apply(_wmean, include_groups=False))
    overlap = inter.groupby("segment_id")["piece_area"].sum()
    out["uhi_overlap_pct"] = _reindex_series(segments, overlap / seg_area * 100)

    if "mesh_block_code" in inter.columns:
        idx = inter.groupby("segment_id")["piece_area"].idxmax()
        out["uhi_mesh_block_code"] = _reindex_series(segments, inter.loc[idx].set_index("segment_id")["mesh_block_code"])
    if "per_any_veg" in inter.columns:
        out["per_any_veg_pct"] = _reindex_series(
            segments,
            inter.groupby("segment_id").apply(
                lambda g: np.average(g["per_any_veg"], weights=g["piece_area"]), include_groups=False
            ),
        )

    missing_mask = out["uhi18_m"].isna()
    if missing_mask.any():
        miss = segments.loc[segments["segment_id"].isin(out.index[missing_mask]), ["segment_id", "geometry"]]
        miss_pts = miss.copy()
        miss_pts["geometry"] = miss_pts.geometry.centroid
        heat_pts = heat[["uhi18_m", "geometry"]].copy()
        if "mesh_block_code" in heat.columns:
            heat_pts["mesh_block_code"] = heat["mesh_block_code"]
        heat_pts["geometry"] = heat_pts.geometry.centroid
        nearest = gpd.sjoin_nearest(
            miss_pts,
            heat_pts,
            max_distance=UHI_NEAREST_M,
            distance_col="dist",
        )
        idx = nearest.groupby("segment_id")["dist"].idxmin()
        pick = nearest.loc[idx].set_index("segment_id")
        out.loc[pick.index, "uhi18_m"] = pick["uhi18_m"]
        if "mesh_block_code" in pick.columns:
            out.loc[pick.index, "uhi_mesh_block_code"] = pick["mesh_block_code"]
        out["uhi_join_method"] = np.where(out["uhi18_m"].notna(), "intersection", "missing")
        out.loc[pick.index, "uhi_join_method"] = "nearest"
    else:
        out["uhi_join_method"] = "intersection"
    return out


def join_tree_density(segments: gpd.GeoDataFrame, trees: gpd.GeoDataFrame) -> pd.DataFrame:
    inter = gpd.overlay(
        segments[["segment_id", "geometry"]],
        trees[["tree_density", "geometry"]],
        how="intersection",
        keep_geom_type=False,
    )
    out = pd.DataFrame(index=_empty_index(segments))
    if inter.empty:
        for c in ("canopy_dense_pct", "canopy_medium_pct", "canopy_sparse_pct", "canopy_cover_pct"):
            out[c] = 0.0
        out["canopy_class_dominant"] = None
        return out

    inter["piece_area"] = inter.geometry.area
    seg_area = segments.set_index("segment_id")["geometry"].area
    inter["tree_density"] = inter["tree_density"].astype(str).str.lower()

    for cls, col in (("dense", "canopy_dense_pct"), ("medium", "canopy_medium_pct"), ("sparse", "canopy_sparse_pct")):
        cls_area = inter[inter["tree_density"] == cls].groupby("segment_id")["piece_area"].sum()
        out[col] = _reindex_series(segments, cls_area / seg_area * 100).fillna(0.0)

    out["canopy_cover_pct"] = out["canopy_dense_pct"] + out["canopy_medium_pct"] + out["canopy_sparse_pct"]

    def dominant(row: pd.Series) -> str | None:
        parts = {"dense": row["canopy_dense_pct"], "medium": row["canopy_medium_pct"], "sparse": row["canopy_sparse_pct"]}
        if max(parts.values()) <= 0:
            return None
        return max(parts, key=parts.get)

    out["canopy_class_dominant"] = out.apply(dominant, axis=1)
    return out


def _nearest_point_m(segments: gpd.GeoDataFrame, points: gpd.GeoDataFrame, col: str) -> pd.Series:
    nearest = gpd.sjoin_nearest(
        segments[["segment_id", "geometry"]],
        points[["geometry"]],
        max_distance=2000,
        distance_col=col,
    )
    if nearest.empty:
        return pd.Series(np.nan, index=_empty_index(segments), name=col)
    nearest["segment_id"] = nearest["segment_id"].astype(str)
    idx = nearest.groupby("segment_id")[col].idxmin()
    best = nearest.loc[idx].set_index("segment_id")[col]
    return _reindex_series(segments, best)


def join_fountains(segments: gpd.GeoDataFrame, fountains: gpd.GeoDataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=_empty_index(segments))
    out["fountain_nearest_m"] = _nearest_point_m(segments, fountains, "fountain_nearest_m")
    out["fountain_within_100m"] = (out["fountain_nearest_m"] <= FOUNTAIN_NEAR_M).fillna(False)
    out["fountain_within_200m"] = (out["fountain_nearest_m"] <= FOUNTAIN_FAR_M).fillna(False)
    return out


def join_benches(segments: gpd.GeoDataFrame, benches: gpd.GeoDataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=_empty_index(segments))
    out["bench_count_50m"] = _point_counts_in_buffer(segments, benches, BENCH_M, "bench_count_50m")
    out["bench_nearest_m"] = _nearest_point_m(segments, benches, "bench_nearest_m")
    return out


def join_streetlights(segments: gpd.GeoDataFrame, lights: gpd.GeoDataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=_empty_index(segments))
    out["streetlight_count_30m"] = _point_counts_in_buffer(
        segments, lights, STREETLIGHT_NEAR_M, "streetlight_count_30m"
    )
    out["streetlight_count_50m"] = _point_counts_in_buffer(
        segments, lights, STREETLIGHT_FAR_M, "streetlight_count_50m"
    )
    out["streetlight_nearest_m"] = _nearest_point_m(segments, lights, "streetlight_nearest_m")

    nearest = gpd.sjoin_nearest(
        segments[["segment_id", "geometry"]],
        lights[["wattage_w", "geometry"]],
        max_distance=500,
        distance_col="d",
    )
    if not nearest.empty:
        nearest["segment_id"] = nearest["segment_id"].astype(str)
        idx = nearest.groupby("segment_id")["d"].idxmin()
        out["streetlight_nearest_wattage_w"] = _reindex_series(
            segments, nearest.loc[idx].set_index("segment_id")["wattage_w"]
        )
    return out


def join_park_lights(segments: gpd.GeoDataFrame, lights: gpd.GeoDataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=_empty_index(segments))
    out["park_light_count_50m"] = _point_counts_in_buffer(segments, lights, PARK_LIGHT_M, "park_light_count_50m")
    out["park_light_nearest_m"] = _nearest_point_m(segments, lights, "park_light_nearest_m")
    return out


def join_crashes(segments: gpd.GeoDataFrame, crashes: gpd.GeoDataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=_empty_index(segments))
    out["crash_ped_count_25m"] = _point_counts_corridor(segments, crashes, "crash_ped_count_25m")

    run_date = pd.Timestamp(datetime.now(UTC))
    cutoff = run_date - pd.DateOffset(years=CRASH_YEARS)
    crashes = crashes.copy()
    crashes["crash_date"] = pd.to_datetime(crashes["crash_date"], errors="coerce", utc=True)
    recent = crashes[crashes["crash_date"] >= cutoff]
    out["crash_ped_count_25m_5y"] = _point_counts_corridor(segments, recent, "crash_ped_count_25m_5y")

    night = crashes[crashes["night_index_eligible"] == True]  # noqa: E712
    out["crash_night_count_25m"] = _point_counts_corridor(segments, night, "crash_night_count_25m")
    night_recent = night[night["crash_date"] >= cutoff]
    out["crash_night_count_25m_5y"] = _point_counts_corridor(
        segments, night_recent, "crash_night_count_25m_5y"
    )

    corridors = gpd.GeoDataFrame(
        segments[["segment_id"]],
        geometry=segments["corridor"],
        crs=segments.crs,
    )
    joined = gpd.sjoin(crashes, corridors, predicate="within", how="inner")
    if not joined.empty:
        last = joined.groupby("segment_id")["crash_date"].max()
        days = (run_date - last).dt.days
        out["crash_days_since_last"] = _reindex_series(segments, days)
    else:
        out["crash_days_since_last"] = np.nan
    return out


def join_council_trees(segments: gpd.GeoDataFrame, trees: gpd.GeoDataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=_empty_index(segments))
    out["council_tree_count_25m"] = _point_counts_corridor(segments, trees, "council_tree_count_25m")
    street = trees[trees["tree_type"].astype(str).eq("Street Tree")]
    out["council_tree_street_count_25m"] = _point_counts_corridor(
        segments, street, "council_tree_street_count_25m"
    )
    out["council_tree_nearest_m"] = _nearest_point_m(segments, trees, "council_tree_nearest_m")
    return out


def _coverage_flags(row: pd.Series) -> dict[str, str]:
    flags: dict[str, str] = {}
    if pd.isna(row.get("speed_corridor_max_kmh")):
        flags["speed"] = "missing"
    elif (row.get("speed_corridor_line_m") or 0) < 5:
        flags["speed"] = "low"
    else:
        flags["speed"] = "ok"

    flags["uhi"] = "ok" if row.get("uhi_join_method") == "intersection" else (
        "low" if row.get("uhi_join_method") == "nearest" else "missing"
    )
    flags["canopy"] = "ok" if (row.get("canopy_cover_pct") or 0) > 0 else "missing"
    flags["streetlight"] = "ok" if pd.notna(row.get("streetlight_nearest_m")) else "missing"
    flags["crash"] = "ok" if (row.get("crash_ped_count_25m") or 0) > 0 else "missing"
    flags["graffiti"] = "ok" if (row.get("graffiti_count_25m") or 0) >= 0 else "missing"
    flags["crossing"] = "gap" if not row.get("school_crossing_within_50m") else "ok"
    return flags


def build_segment_features(*, include_council_trees: bool = True) -> tuple[gpd.GeoDataFrame, dict[str, Any]]:
    """Harmonise all ingested layers onto footpath segments."""
    segments = _load_parquet("footpaths_ply_t1eam.parquet")
    segments["segment_id"] = segments["segment_id"].astype(str)
    segments["corridor"] = segments.geometry.buffer(CORRIDOR_M)

    base = segments[PASS_THROUGH + ["geometry"]].copy()
    base = base.set_index("segment_id")

    joins: list[pd.DataFrame] = [
        join_speed_zones(segments, _load_parquet("speed_zones_casey_2026-02.parquet")),
        join_graffiti(segments, _load_parquet("graffiti-locations.parquet")),
        join_school_crossings(segments, _load_parquet("school_crossings_pt_t1eam.parquet")),
        join_urban_heat(segments, _load_parquet("metro_urban_heat_2018_casey.parquet")),
        join_tree_density(segments, _load_parquet("vicmap_tree_density_casey.parquet")),
        join_fountains(segments, _load_parquet("drinkingfountains_pt_t1eam.parquet")),
        join_benches(segments, _load_parquet("benches_seats_pt_t1eam.parquet")),
        join_streetlights(segments, _load_parquet("ausnet_unitedenergy_mvp4_streetlights.parquet")),
        join_park_lights(segments, _load_parquet("parkreserve_light_pt_t1eam.parquet")),
        join_crashes(segments, _load_parquet("vic_crashes_casey_pedestrian.parquet")),
    ]

    if include_council_trees:
        joins.append(join_council_trees(segments, _load_parquet("council_trees_pt_t1eam.parquet")))

    result = base
    for part in joins:
        if not part.empty:
            if part.index.duplicated().any():
                part = part[~part.index.duplicated(keep="first")]
            result = result.join(part, how="left")

    if result.index.duplicated().any():
        result = result[~result.index.duplicated(keep="first")]

    result["score_eligible"] = ~result["suburb"].isin(EXCLUDE_SUBURBS)

    join_params = {
        "corridor_m": CORRIDOR_M,
        "metric_crs": METRIC_CRS,
        "streetlight_near_m": STREETLIGHT_NEAR_M,
        "streetlight_far_m": STREETLIGHT_FAR_M,
        "crash_years": CRASH_YEARS,
        "exclude_suburbs": sorted(EXCLUDE_SUBURBS),
        "speed_vintage": "2026-02",
    }
    result["harmonised_at"] = datetime.now(UTC).isoformat()
    result["methodology_version"] = METHODOLOGY_VERSION
    result["harmonisation_spec_version"] = SPEC_VERSION
    result["join_params"] = json.dumps(join_params)
    result["coverage_flags"] = result.apply(lambda r: json.dumps(_coverage_flags(r)), axis=1)

    out_gdf = gpd.GeoDataFrame(result.reset_index(), geometry="geometry", crs=METRIC_CRS)
    out_gdf = out_gdf.to_crs(STORAGE_CRS)

    qa = {
        "harmonised_at": result["harmonised_at"].iloc[0],
        "segment_count": int(len(out_gdf)),
        "methodology_version": METHODOLOGY_VERSION,
        "harmonisation_spec_version": SPEC_VERSION,
        "join_params": join_params,
        "null_rates": {
            col: float(out_gdf[col].isna().mean())
            for col in out_gdf.columns
            if col not in ("geometry", "join_params", "coverage_flags")
        },
        "score_eligible_count": int(out_gdf["score_eligible"].sum()),
        "exclude_suburbs": sorted(EXCLUDE_SUBURBS),
    }
    return out_gdf, qa
