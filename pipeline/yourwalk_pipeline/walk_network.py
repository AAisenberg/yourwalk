"""Walk network classification and shared-use path QA crosswalk."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import duckdb

WALK_PATH_CLASS_SQL = """
CASE
  WHEN feature_type = 'Shared Use Path' THEN 'shared_use'
  WHEN feature_type = 'Footpath' THEN 'footpath'
  ELSE 'other'
END
"""

SHARED_USE_DATASET_ID = "sharedusepaths_ply_t1eam"
FOOTPATHS_DATASET_ID = "footpaths_ply_t1eam"


def crosswalk_shareduse_qa(
    con: duckdb.DuckDBPyConnection,
    *,
    footpaths_table: str = "footpaths",
    shared_use_table: str = "shared_use_paths",
) -> dict[str, Any]:
    """Compare Council shared-use export to footpaths master on t1key / attributes."""
    sup_count = con.execute(f"SELECT COUNT(*) FROM {shared_use_table}").fetchone()[0]
    fp_count = con.execute(f"SELECT COUNT(*) FROM {footpaths_table}").fetchone()[0]
    fp_shared = con.execute(
        f"""
        SELECT COUNT(*) FROM {footpaths_table}
        WHERE walk_path_class = 'shared_use'
        """
    ).fetchone()[0]

    t1key_only_sup = con.execute(
        f"""
        SELECT COUNT(*) FROM {shared_use_table} s
        WHERE s.t1key IS NOT NULL
          AND s.t1key NOT IN (SELECT t1key FROM {footpaths_table} WHERE t1key IS NOT NULL)
        """
    ).fetchone()[0]

    t1key_in_both = con.execute(
        f"""
        SELECT COUNT(DISTINCT s.t1key) FROM {shared_use_table} s
        INNER JOIN {footpaths_table} f ON s.t1key = f.t1key
        """
    ).fetchone()[0]

    gisfid_only_sup = con.execute(
        f"""
        SELECT COUNT(*) FROM {shared_use_table} s
        WHERE CAST(s.segment_id AS VARCHAR) NOT IN (
            SELECT CAST(segment_id AS VARCHAR) FROM {footpaths_table}
        )
        """
    ).fetchone()[0]

    width_mismatch = con.execute(
        f"""
        SELECT COUNT(*) FROM (
            SELECT DISTINCT s.t1key
            FROM {shared_use_table} s
            INNER JOIN {footpaths_table} f ON s.t1key = f.t1key
            WHERE ABS(COALESCE(s.width_m, 0) - COALESCE(f.width_m, 0)) > 0.1
        )
        """
    ).fetchone()[0]

    surface_mismatch = con.execute(
        f"""
        SELECT COUNT(*) FROM (
            SELECT DISTINCT s.t1key
            FROM {shared_use_table} s
            INNER JOIN {footpaths_table} f ON s.t1key = f.t1key
            WHERE COALESCE(s.surface_material, '') != COALESCE(f.surface_material, '')
        )
        """
    ).fetchone()[0]

    class_mismatch = con.execute(
        f"""
        SELECT COUNT(*) FROM {shared_use_table} s
        INNER JOIN {footpaths_table} f ON s.t1key = f.t1key
        WHERE f.walk_path_class != 'shared_use'
        """
    ).fetchone()[0]

    return {
        "dataset_id": SHARED_USE_DATASET_ID,
        "master_dataset_id": FOOTPATHS_DATASET_ID,
        "crosswalk_at": datetime.now(UTC).isoformat(),
        "shared_use_export_rows": int(sup_count),
        "footpaths_master_rows": int(fp_count),
        "footpaths_shared_use_class_rows": int(fp_shared),
        "t1key_only_in_shared_use_export": int(t1key_only_sup),
        "distinct_t1key_in_both_layers": int(t1key_in_both),
        "gisfid_only_in_shared_use_export": int(gisfid_only_sup),
        "t1key_width_mismatch_gt_0_1m": int(width_mismatch),
        "t1key_surface_material_mismatch": int(surface_mismatch),
        "t1key_master_not_shared_use_class": int(class_mismatch),
        "merge_policy": (
            "Do not UNION footpaths and shared-use exports. Master network is "
            "footpaths_ply_t1eam (all feature_type values). Shared-use export is "
            "validation-only; walk_path_class on master marks shared-use segments."
        ),
        "notes": (
            "Portal states shared-use layer is generated from footpaths. "
            "gisfid may differ between exports for the same t1key; t1key is the "
            "stable asset key for crosswalk."
        ),
    }
