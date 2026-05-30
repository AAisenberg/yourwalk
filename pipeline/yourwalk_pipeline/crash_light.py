"""Light condition categories for Victoria crash data (aligned with CrashDash mapping)."""

from __future__ import annotations

# DuckDB SQL expression — input column name: light_condition
LIGHT_CATEGORY_SQL = """
CASE
  WHEN light_condition IS NULL OR trim(light_condition) = '' THEN 'missing'
  WHEN lower(trim(light_condition)) IN ('day', 'daylight') THEN 'daylight'
  WHEN lower(trim(light_condition)) LIKE '%dawn%'
    OR lower(trim(light_condition)) LIKE '%dusk%' THEN 'dawn_dusk'
  WHEN lower(trim(light_condition)) LIKE '%lights on%'
    OR (
      lower(trim(light_condition)) LIKE '%lighted%'
      AND lower(trim(light_condition)) NOT LIKE '%not%'
    ) THEN 'dark_lighted'
  WHEN lower(trim(light_condition)) LIKE '%not lighted%'
    OR lower(trim(light_condition)) LIKE '%lights off%'
    OR lower(trim(light_condition)) LIKE '%no street lights%'
    OR lower(trim(light_condition)) LIKE '%lights unknown%' THEN 'dark_not_lighted'
  WHEN lower(trim(light_condition)) LIKE '%dark%' THEN 'dark_not_lighted'
  ELSE 'other'
END
"""

# Night Index scoring uses pedestrian crashes in dark conditions (methodology v1.1 §6.3).
NIGHT_INDEX_LIGHT_CATEGORIES = ("dark_lighted", "dark_not_lighted")
