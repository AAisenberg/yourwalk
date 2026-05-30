"""QA rules for Casey School Crossings (T1EAM) — Accessibility enrichment."""

from __future__ import annotations

SCHOOL_QA_SQL = """
CASE
  WHEN name_of_school IS NULL OR trim(name_of_school) = '' THEN 'missing_school'
  ELSE 'ok'
END
"""

STREET_QA_SQL = """
CASE
  WHEN streetname IS NULL OR trim(streetname) = '' THEN 'missing_street'
  ELSE 'ok'
END
"""
