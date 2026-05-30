"""QA rules for AusNet / United Energy street lights — Night Index input."""

from __future__ import annotations

# Wattage bounds for Casey distributor extract QA (watts).
# No lux data available; wattage is a proxy only — flag outliers, do not drop.
WATTAGE_MAX_VALID_W = 400

WATTAGE_QA_SQL = f"""
CASE
  WHEN rating IS NULL THEN 'missing_wattage'
  WHEN rating = 0 THEN 'zero_wattage'
  WHEN rating > {WATTAGE_MAX_VALID_W} THEN 'high_wattage'
  ELSE 'ok'
END
"""
