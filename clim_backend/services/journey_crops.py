"""The crops a journey can follow: every crop in crops.json, shared by journeys.py and the expert."""
import json
from pathlib import Path

# "Soybean" is shown as "Soybeans", the name the journey pages and models already use.
DISPLAY_NAMES = {"Soybean": "Soybeans"}

_RAW = json.loads((Path(__file__).resolve().parent.parent / "crops.json").read_text())["crops"]

CROPS = {
    DISPLAY_NAMES.get(c["name"], c["name"]): {
        "name": DISPLAY_NAMES.get(c["name"], c["name"]),
        "scientific": c["scientific"],
        "category": c["category"],
        "seasonDays": c["season_days"],
    }
    for c in _RAW
}


def crop_list():
    """Public list for the crop picker, in crops.json order."""
    return [{"name": c["name"], "category": c["category"], "seasonDays": c["seasonDays"]} for c in CROPS.values()]
