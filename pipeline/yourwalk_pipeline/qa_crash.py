"""QA rules for Victoria Road Crash Data — Night Index pedestrian crashes."""

from __future__ import annotations

from yourwalk_pipeline.crash_light import LIGHT_CATEGORY_SQL

COORD_QA_SQL = """
CASE
  WHEN latitude IS NULL OR longitude IS NULL THEN 'missing_coords'
  WHEN latitude = 0 AND longitude = 0 THEN 'zero_coords'
  WHEN latitude < -39.2 OR latitude > -33.9 OR longitude < 140.9 OR longitude > 149.9 THEN 'out_of_vic_bounds'
  ELSE 'ok'
END
"""

LIGHT_QA_SQL = f"""
CASE
  WHEN ({LIGHT_CATEGORY_SQL}) = 'missing' THEN 'missing_light'
  WHEN ({LIGHT_CATEGORY_SQL}) = 'other' THEN 'unknown_light'
  ELSE 'ok'
END
"""

DATE_QA_SQL = """
CASE
  WHEN crash_date IS NULL THEN 'missing_date'
  ELSE 'ok'
END
"""
