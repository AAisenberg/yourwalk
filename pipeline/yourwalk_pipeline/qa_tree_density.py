"""QA rules for Vicmap Vegetation Tree Density polygons."""

from __future__ import annotations

VALID_DENSITY_CLASSES = ("dense", "medium", "sparse")

DENSITY_QA_SQL = """
CASE
  WHEN tree_density IS NULL OR trim(tree_density) = '' THEN 'missing_density'
  WHEN lower(trim(tree_density)) NOT IN ('dense', 'medium', 'sparse') THEN 'invalid_density'
  ELSE 'ok'
END
"""

AREA_QA_SQL = """
CASE
  WHEN area_m2 IS NULL OR area_m2 <= 0 THEN 'invalid_area'
  ELSE 'ok'
END
"""
