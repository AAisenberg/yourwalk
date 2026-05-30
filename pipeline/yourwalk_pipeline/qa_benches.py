"""QA rules for Casey Benches and Seats (T1EAM) — Day Index comfort input."""

from __future__ import annotations

# Quantity/capacity fields are unreliable in the asset system — score on presence only.
QUANTITY_QA_SQL = """
CASE
  WHEN quantity IS NULL OR trim(quantity) = '' THEN 'missing_quantity'
  WHEN TRY_CAST(quantity AS INTEGER) = 0 THEN 'zero_quantity'
  ELSE 'ok'
END
"""

CAPACITY_QA_SQL = """
CASE
  WHEN capacity IS NULL OR trim(capacity) = '' THEN 'missing_capacity'
  WHEN lower(trim(capacity)) = 'tbd' THEN 'placeholder_capacity'
  ELSE 'ok'
END
"""

FURNCAP_QA_SQL = """
CASE
  WHEN furncap IS NULL THEN 'missing_furncap'
  WHEN furncap = 0 THEN 'zero_furncap'
  ELSE 'ok'
END
"""
