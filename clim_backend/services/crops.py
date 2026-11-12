"""Crop catalog backed by the real FAO ECOCROP database.

The catalog is downloaded once from the public ECOCROP dataset mirror and
cached on disk, so later searches are served locally. ECOCROP carries optimal
and absolute temperature ranges (degrees C) and annual rainfall ranges (mm)
for ~2,568 species, which is exactly what crop suitability needs.
"""

from __future__ import annotations

import csv
import io
import os
import re
import unicodedata
import urllib.error
import urllib.request

ECOCROP_URL = "https://raw.githubusercontent.com/OpenCLIM/ecocrop/main/EcoCrop_DB.csv"
DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data"
)
CACHE_PATH = os.path.join(DATA_DIR, "ecocrop.csv")

# Minimal offline fallback so the feature still works if the download fails.
FALLBACK_ROWS = [
    {
        "ScientificName": "Oryza sativa",
        "COMNAME": "rice, paddy",
        "TOPMN": "22",
        "TOPMX": "35",
        "ROPMN": "1200",
        "ROPMX": "2500",
        "LIFO": "Annual",
    },
    {
        "ScientificName": "Zea mays",
        "COMNAME": "corn, maize",
        "TOPMN": "18",
        "TOPMX": "35",
        "ROPMN": "600",
        "ROPMX": "1500",
        "LIFO": "Annual",
    },
    {
        "ScientificName": "Glycine max",
        "COMNAME": "soybean, soya",
        "TOPMN": "18",
        "TOPMX": "30",
        "ROPMN": "500",
        "ROPMX": "1500",
        "LIFO": "Annual",
    },
    {
        "ScientificName": "Triticum aestivum",
        "COMNAME": "wheat",
        "TOPMN": "12",
        "TOPMX": "25",
        "ROPMN": "400",
        "ROPMX": "1200",
        "LIFO": "Annual",
    },
    {
        "ScientificName": "Gossypium hirsutum",
        "COMNAME": "cotton",
        "TOPMN": "18",
        "TOPMX": "35",
        "ROPMN": "500",
        "ROPMX": "1500",
        "LIFO": "Annual",
    },
]

_catalog: list[dict] | None = None
_catalog_source = "unknown"
# Full ECOCROP ranges by scientific name, for the Crop Finder scorer.
_ranges_by_name: dict[str, dict] = {}
RANGE_COLUMNS = {
    "temp_opt": ("TOPMN", "TOPMX"),
    "temp_abs": ("TMIN", "TMAX"),
    "rain_opt": ("ROPMN", "ROPMX"),
    "rain_abs": ("RMIN", "RMAX"),
    "ph_opt": ("PHOPMN", "PHOPMX"),
    "ph_abs": ("PHMIN", "PHMAX"),
}


def _normalize(text: str) -> str:
    """Lowercase, strip accents and punctuation for forgiving matching."""
    decomposed = unicodedata.normalize("NFKD", text or "")
    ascii_only = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9 ]+", " ", ascii_only.lower()).strip()


def _number(row: dict, key: str) -> float | None:
    try:
        value = float(row.get(key) or "")
    except (TypeError, ValueError):
        return None
    # ECOCROP uses -999 style sentinels for "no value".
    if value <= -900:
        return None
    return value


def _download_catalog_text() -> str:
    """Fetch the ECOCROP CSV, preferring the disk cache when present."""
    if os.path.exists(CACHE_PATH) and os.path.getsize(CACHE_PATH) > 100_000:
        with open(CACHE_PATH, encoding="utf-8", errors="replace") as handle:
            return handle.read()

    request = urllib.request.Request(
        ECOCROP_URL, headers={"User-Agent": "ClimateAI/1.0 (season comparison)"}
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read().decode("utf-8", errors="replace")

    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(CACHE_PATH, "w", encoding="utf-8") as handle:
            handle.write(raw)
    except OSError:
        pass  # Caching is optional; parsing in memory still works.
    return raw


def _build_crop(row: dict) -> dict | None:
    scientific = (row.get("ScientificName") or "").strip()
    if not scientific:
        return None
    common = [
        name.strip() for name in (row.get("COMNAME") or "").split(",") if name.strip()
    ]
    temp_min, temp_max = _number(row, "TOPMN"), _number(row, "TOPMX")
    rain_min, rain_max = _number(row, "ROPMN"), _number(row, "ROPMX")
    if temp_min is None or temp_max is None:
        return None

    display = common[0].title() if common else scientific
    return {
        "id": (row.get("EcoPortCode") or scientific).strip(),
        "name": display,
        "scientificName": scientific,
        "commonNames": common[:6],
        "lifeForm": (row.get("LIFO") or "").strip() or None,
        # ECOCROP stores temperatures in degrees Celsius.
        "tempOptimalC": [temp_min, temp_max],
        # ECOCROP stores rainfall as mm per year.
        "rainOptimalMmYear": [rain_min, rain_max],
        "_searchBlob": " ".join(
            [_normalize(scientific)] + [_normalize(c) for c in common]
        ),
    }


def load_catalog() -> list[dict]:
    """Load and cache the crop catalog (downloaded once)."""
    global _catalog, _catalog_source, _ranges_by_name
    if _catalog is not None:
        return _catalog

    try:
        raw = _download_catalog_text()
        rows = list(csv.DictReader(io.StringIO(raw)))
        crops = [crop for crop in (_build_crop(row) for row in rows) if crop]
        if len(crops) < 50:
            raise ValueError("ECOCROP payload looked incomplete")
        _catalog_source = "FAO ECOCROP dataset"
        _ranges_by_name = {
            (row.get("ScientificName") or "").strip().lower(): row for row in rows
        }
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError, OSError):
        crops = [crop for crop in (_build_crop(row) for row in FALLBACK_ROWS) if crop]
        _catalog_source = "built-in fallback (ECOCROP unavailable)"

    _catalog = crops
    return _catalog


def catalog_source() -> str:
    load_catalog()
    return _catalog_source


def search_crops(query: str, limit: int = 8) -> list[dict]:
    """Search ECOCROP crops by common or scientific name."""
    needle = _normalize(query)
    catalog = load_catalog()
    if not needle:
        return []

    scored: list[tuple[int, dict]] = []
    for crop in catalog:
        blob = crop["_searchBlob"]
        if needle not in blob:
            continue
        name_norm = _normalize(crop["name"])
        scientific_norm = _normalize(crop["scientificName"])
        if name_norm == needle or scientific_norm == needle:
            score = 0
        elif name_norm.startswith(needle) or scientific_norm.startswith(needle):
            score = 1
        elif any(_normalize(c).startswith(needle) for c in crop["commonNames"]):
            score = 2
        else:
            score = 3
        scored.append((score, crop))

    scored.sort(key=lambda pair: (pair[0], len(pair[1]["name"])))
    results = []
    for _, crop in scored[:limit]:
        item = {key: value for key, value in crop.items() if key != "_searchBlob"}
        item["name"] = _display_name(crop, needle)
        results.append(item)
    return results


def _display_name(crop: dict, needle: str) -> str:
    """Pick the common name that best answers the search, not ECOCROP's first entry.

    ECOCROP lists colloquial names first (e.g. "bachanta" for sorghum), so an
    exact/prefix match on the query reads far better in an autocomplete list.
    """
    candidates = crop.get("commonNames") or []
    for candidate in candidates:
        if _normalize(candidate).startswith(needle):
            return candidate.title()
    for candidate in candidates:
        if needle in _normalize(candidate):
            return candidate.title()
    if candidates:
        return min(candidates, key=len).title()
    return crop["name"]


def ecocrop_ranges(scientific_name: str) -> dict | None:
    """Optimal and absolute temperature (C), annual rain (mm) and pH ranges for one species,
    keyed like crops.json. None when ECOCROP is unavailable or any range is missing."""
    load_catalog()
    row = _ranges_by_name.get((scientific_name or "").strip().lower())
    if row is None:
        return None
    ranges = {}
    for key, (low_col, high_col) in RANGE_COLUMNS.items():
        low, high = _number(row, low_col), _number(row, high_col)
        if low is None or high is None or low > high:
            return None
        ranges[key] = [int(v) if float(v).is_integer() else v for v in (low, high)]
    return ranges
