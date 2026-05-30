"""QA rules for Metro Melbourne Urban Heat 2018 mesh blocks."""

from __future__ import annotations

UHI_QA_SQL = """
CASE
  WHEN uhi18_m IS NULL THEN 'missing_uhi'
  WHEN uhi18_m < -10 OR uhi18_m > 20 THEN 'outlier_uhi'
  ELSE 'ok'
END
"""
