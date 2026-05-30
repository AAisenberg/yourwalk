"""QA rules for Transport Victoria Speed Zones — Accessibility stream input."""

from __future__ import annotations

# Victoria posted speed limits (km/h) — flag outliers, do not drop.
SPEED_MIN_VALID_KMH = 10
SPEED_MAX_VALID_KMH = 110

SPEED_LIMIT_QA_SQL = f"""
CASE
  WHEN speed_limit_kmh IS NULL THEN 'missing_limit'
  WHEN speed_limit_kmh < {SPEED_MIN_VALID_KMH} THEN 'below_range'
  WHEN speed_limit_kmh > {SPEED_MAX_VALID_KMH} THEN 'above_range'
  ELSE 'ok'
END
"""

ZONE_LENGTH_QA_SQL = """
CASE
  WHEN zone_length_m IS NULL THEN 'missing_length'
  WHEN zone_length_m <= 0 THEN 'invalid_length'
  ELSE 'ok'
END
"""
