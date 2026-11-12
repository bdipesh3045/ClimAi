"""Input checks shared by the Crop Finder and farmer profile routes.

Each parse_* function takes the decoded JSON body and raises ValueError with a message
the farmer can read.
"""

FARM_SIZE_UNITS = ("acres", "hectares")
MIN_FARM_SIZE = 0.01  # same minimum as the form
MAX_FARM_SIZE = 10_000_000  # far above any real farm, keeps harvest math finite
# Soil choices on the Crop Finder form, mapped to the textures crops.json uses.
SOIL_TEXTURES = {"Clay": "clay", "Silt": "silt loam", "Loam": "loam", "Sandy": "sandy loam", "Not sure": None}


def in_range(value, low, high):
    """True for a real number from low to high. Compares without converting to float, so a
    400-digit JSON integer cannot overflow, and NaN or Infinity fail the comparison."""
    return isinstance(value, (int, float)) and not isinstance(value, bool) and low <= value <= high


def parse_coordinates(payload):
    """Return (lat, lon) from {"coordinates": {"lat": ..., "lon": ...}}."""
    coords = payload.get("coordinates")
    lat = coords.get("lat") if isinstance(coords, dict) else None
    lon = coords.get("lon") if isinstance(coords, dict) else None
    if not (in_range(lat, -90, 90) and in_range(lon, -180, 180)):
        raise ValueError("Pick your farm location from the search results (coordinates are missing or invalid).")
    return lat, lon


def parse_soil(payload):
    """Return the soilType form choice, or None when it is left out."""
    soil = payload.get("soilType")
    if soil is not None and (not isinstance(soil, str) or soil not in SOIL_TEXTURES):
        raise ValueError(f"soilType must be one of: {', '.join(SOIL_TEXTURES)}.")
    return soil


def parse_farm_size(payload, required=False):
    """Return (size, unit) from {"farm": {"size": ..., "sizeUnit": ...}}. Size is None when optional and left out."""
    farm = payload.get("farm") if isinstance(payload.get("farm"), dict) else {}
    size, unit = farm.get("size"), farm.get("sizeUnit", "acres")
    if size is None and required:
        raise ValueError("Enter your farm size.")
    if size is not None and not in_range(size, MIN_FARM_SIZE, MAX_FARM_SIZE):
        raise ValueError(f"Farm size must be a number from {MIN_FARM_SIZE} to {MAX_FARM_SIZE:,}.")
    if unit not in FARM_SIZE_UNITS:
        raise ValueError("Farm size unit must be acres or hectares.")
    return size, unit


def clean_text(value, label, max_length, required=False):
    """Return the trimmed string, or None when it is blank and optional."""
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise ValueError(f"{label} is required.")
        return None
    if not isinstance(value, str):
        raise ValueError(f"{label} must be text.")
    text = value.strip()
    if len(text) > max_length:
        raise ValueError(f"{label} must be at most {max_length} characters.")
    return text
