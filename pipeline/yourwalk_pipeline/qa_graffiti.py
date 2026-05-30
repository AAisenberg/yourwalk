"""QA rules for Casey Graffiti Locations — Accessibility stream environmental order proxy."""

from __future__ import annotations

# Area removed (m²) — flag extreme portal values for manual review, do not drop.
AREA_MAX_VALID_M2 = 500

GRAFFITI_TYPE_QA_SQL = """
CASE
  WHEN response_times IS NULL THEN 'missing_type'
  WHEN response_times NOT IN ('Offensive', 'Non-Offensive') THEN 'unknown_type'
  ELSE 'ok'
END
"""

AREA_QA_SQL = f"""
CASE
  WHEN area_removed_m2 IS NULL THEN 'missing_area'
  WHEN area_removed_m2 < 0 THEN 'invalid_area'
  WHEN area_removed_m2 > {AREA_MAX_VALID_M2} THEN 'high_area'
  ELSE 'ok'
END
"""

DATE_QA_SQL = """
CASE
  WHEN created_date IS NULL THEN 'missing_created_date'
  WHEN completed_date IS NOT NULL AND completed_date < created_date THEN 'completed_before_created'
  ELSE 'ok'
END
"""
