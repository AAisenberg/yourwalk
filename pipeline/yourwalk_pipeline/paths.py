from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = PIPELINE_ROOT / "data"
RAW_DIR = DATA_ROOT / "raw"
INTERMEDIATE_DIR = DATA_ROOT / "intermediate"
QA_DIR = DATA_ROOT / "qa"


def ensure_data_dirs() -> None:
    for directory in (RAW_DIR, INTERMEDIATE_DIR, QA_DIR):
        directory.mkdir(parents=True, exist_ok=True)
