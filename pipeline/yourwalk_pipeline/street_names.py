"""Clean street or reserve labels from the T1EAM footpath `description` field.

The raw text mixes street names, house addresses ("From 40 Cresthaven Boulevard
BERWICK VIC 3806 to ..."), asset codes ("FP06817-010/1") and free notes. Only a
short street or place name survives; anything with digits is dropped so no house
address reaches the map.
"""

from __future__ import annotations

import re

_ABBREV = {
    "RD": "Road",
    "ST": "Street",
    "AV": "Avenue",
    "AVE": "Avenue",
    "DR": "Drive",
    "DV": "Drive",
    "DRIV": "Drive",
    "BOULEVAR": "Boulevard",
    "CT": "Court",
    "CRT": "Court",
    "CRES": "Crescent",
    "CR": "Crescent",
    "PL": "Place",
    "PRD": "Parade",
    "PDE": "Parade",
    "BVD": "Boulevard",
    "BLVD": "Boulevard",
    "HWY": "Highway",
    "GR": "Grove",
    "GRA": "Grange",
    "CL": "Close",
    "CCT": "Circuit",
    "RES": "Reserve",
}

_PREFIX = re.compile(
    r"^(road\s*-\s*path\s*-\s*|footpath\s*(?:--|-|@|at)\s*|footpath\s+(?=[A-Z]{2,}\b)|shared\s+path\s*-\s*)",
    re.IGNORECASE,
)
_SUFFIX = re.compile(
    r"\s*\b(heavy duty\s+)?(footpath|shared use path|shared path|path)\b.*$",
    re.IGNORECASE,
)
_CUT = re.compile(r"(,|\.\s+(?=from\b)|\s+from\s+|\s+-\s+|\s+@\s*|\s+between\s+).*$", re.IGNORECASE)
_ASSET_CODE = re.compile(r"^(FPP?\d[\w-]*/\d+|\d+[A-Z]\d+[A-Z]\d+/\d+)\s+(?=[A-Za-z])")


def _title(word: str) -> str:
    up = word.upper().strip(".")
    if up in _ABBREV:
        return _ABBREV[up]
    if word.isupper() or word.islower():
        return "-".join(
            "'".join(p[:1].upper() + p[1:].lower() for p in part.split("'"))
            for part in word.split("-")
        )
    return word


def street_label(description: str | None) -> str | None:
    """Return e.g. "Crosswater Boulevard", or None when nothing clean is left."""
    if not isinstance(description, str) or not description:
        return None
    text = " ".join(description.split())
    text = _ASSET_CODE.sub("", text)
    text = _PREFIX.sub("", text)
    # "Road - Path - X Footpath - SUBURB" and "Footpath SMITHS LANE From ..." both
    # put the name first once the prefix is gone.
    text = _SUFFIX.sub("", text) if not re.match(r"^(footpath|path)\b", text, re.I) else text
    text = _CUT.sub("", text).strip(" -,.;").replace(". ", " ")
    if not text or re.search(r"\d", text) or "/" in text:
        return None
    words = text.split()
    if len(words) > 5 or len(text) > 40 or len(text) < 3:
        return None
    return " ".join(_title(w) for w in words)
