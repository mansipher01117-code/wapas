"""Fair deduction estimates from the local rate card. Pre-existing and fixed items always cost the tenant 0."""
import json
from functools import lru_cache
from pathlib import Path

CARD_PATH = Path(__file__).with_name("ratecard.json")


@lru_cache
def card() -> dict:
    return json.loads(CARD_PATH.read_text(encoding="utf-8"))


def _round50(x: float) -> int:
    return int(round(x / 50.0) * 50)


def estimate(item: str, issue_type: str, severity: str, verdict: str) -> tuple[int, int]:
    if verdict not in ("new", "worsened"):
        return 0, 0
    c = card()
    lo, hi = c["rates"].get(f"{item}:{issue_type}") or c["by_type"].get(issue_type) or c["default"]
    mult = c["severity_multiplier"].get(severity, 1.0)
    if verdict == "worsened":
        mult *= c["worsened_share"]
    return _round50(lo * mult), _round50(hi * mult)


def source_note() -> str:
    return card().get("source_note", "")
