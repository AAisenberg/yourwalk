"""Width QA rules for Footpaths (T1EAM) — see docs/VULNERABILITY_INDEX.md §6.1."""

from __future__ import annotations

# Practical footpath width bounds for Casey pilot QA (metres).
# Values outside this range are flagged, not dropped — scoring uses reduced confidence.
WIDTH_MIN_VALID_M = 0.5
WIDTH_MAX_VALID_M = 6.0

WIDTH_QA_SQL = f"""
CASE
  WHEN width_m IS NULL THEN 'missing'
  WHEN width_m = 0 THEN 'zero'
  WHEN width_m < {WIDTH_MIN_VALID_M} THEN 'too_narrow'
  WHEN width_m > {WIDTH_MAX_VALID_M} THEN 'too_wide'
  ELSE 'ok'
END
"""
