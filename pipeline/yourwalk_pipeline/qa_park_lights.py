"""QA rules for Casey Asset Lights (parks/reserves) — Night Index enrichment."""

from __future__ import annotations

WATTAGE_MAX_VALID_W = 400

WATTAGE_QA_SQL = f"""
CASE
  WHEN luminwatt IS NULL THEN 'missing_wattage'
  WHEN TRY_CAST(luminwatt AS DOUBLE) = 0 THEN 'zero_wattage'
  WHEN TRY_CAST(luminwatt AS DOUBLE) > {WATTAGE_MAX_VALID_W} THEN 'high_wattage'
  ELSE 'ok'
END
"""
