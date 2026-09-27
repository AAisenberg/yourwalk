"""Run from pipeline/: python -m yourwalk_pipeline.test_street_names"""

from yourwalk_pipeline.street_names import street_label

CASES = [
    ("CROSSWATER BOULEVARD Footpath", "Crosswater Boulevard"),
    ("A'Beckett Road Footpath, From Oakview", "A'Beckett Road"),
    ("Footpath - Berwick-Cranbourne Rd", "Berwick-Cranbourne Road"),
    ("BURNBANK PRD Footpath", "Burnbank Parade"),
    ("FP06658-010/24  Morison Rd Footpath", "Morison Road"),
    ("20187U1I1/1", None),
    (None, None),
]


def main() -> int:
    failed = 0
    for raw, want in CASES:
        got = street_label(raw)
        if got != want:
            print(f"FAIL {raw!r}: got {got!r} want {want!r}")
            failed += 1
    if failed:
        return 1
    print(f"street_label {len(CASES)} cases ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
