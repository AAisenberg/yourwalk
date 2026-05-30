"""QA rules for Casey Drinking Fountains (T1EAM) — Day Index comfort input."""

from __future__ import annotations

CONDITION_QA_SQL = """
CASE
  WHEN condition IS NULL OR trim(condition) = '' THEN 'missing_condition'
  WHEN lower(trim(condition)) IN ('to be determined', 'not applicable', 'not appliable') THEN 'placeholder_condition'
  ELSE 'ok'
END
"""

TYPE_QA_SQL = """
CASE
  WHEN dftype IS NULL OR trim(dftype) = '' THEN 'missing_type'
  WHEN lower(trim(dftype)) IN ('to be determined', 'not applicable') THEN 'placeholder_type'
  ELSE 'ok'
END
"""
