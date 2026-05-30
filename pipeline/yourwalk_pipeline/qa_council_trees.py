"""QA rules for Casey Council Trees (T1EAM) — local inventory, not primary canopy."""

from __future__ import annotations

# Council asset canopy width fields are overwhelmingly zero in portal QA.
# Applied after ingest aliases (canopy_ew_width_m, tree_height_m, tree_age).
CANOPY_WIDTH_QA_SQL = """
CASE
  WHEN (
    COALESCE(canopy_ew_width_m, 0) = 0
    AND COALESCE(canopy_ns_width_m, 0) = 0
  ) THEN 'canopy_width_unpopulated'
  ELSE 'canopy_width_present'
END
"""

HEIGHT_QA_SQL = """
CASE
  WHEN tree_height_m IS NULL THEN 'missing_height'
  WHEN tree_height_m = 0 THEN 'zero_height'
  ELSE 'ok'
END
"""

AGE_QA_SQL = """
CASE
  WHEN tree_age IS NULL OR trim(tree_age) = '' THEN 'missing_age'
  WHEN lower(trim(tree_age)) IN ('to be determined', 'not applicable', 'not appliable') THEN 'placeholder_age'
  ELSE 'ok'
END
"""
