import http.client
import json
import math
import urllib.request
from functools import lru_cache

from flask import Flask, jsonify, request
from flask_cors import CORS

from crop_suitability import recommend_crops
from services import season
from services.crops import catalog_source, search_crops

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024  # the form payload is about 1 KB
CORS(app)

# NASA POWER 30-year climatology: mean temperature (deg C) and rainfall (mm per day) for each month.
NASA_POWER_URL = (
    "https://power.larc.nasa.gov/api/temporal/climatology/point"
    "?parameters=T2M,PRECTOTCORR&community=AG&latitude={lat}&longitude={lon}&format=JSON"
)
NASA_TIMEOUT_SECONDS = 20  # the page gives up after 30 seconds
NASA_FILL_VALUE = -999
MONTH_KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
DAYS_IN_MONTH = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
ACRES_PER_HECTARE = 2.47105
FARM_SIZE_UNITS = ("acres", "hectares")
MIN_FARM_SIZE = 0.01  # same minimum as the form
MAX_FARM_SIZE = 10_000_000  # far above any real farm, keeps harvest math finite
# Soil choices on the Crop Finder form, mapped to the textures crops.json uses.
SOIL_TEXTURES = {"Clay": "clay", "Silt": "silt loam", "Loam": "loam", "Sandy": "sandy loam", "Not sure": None}


class ClimateUnavailable(Exception):
    """NASA POWER could not give usable climate data for a location."""


def in_range(value, low, high):
    """True for a real number from low to high. Compares without converting to float, so a
    400-digit JSON integer cannot overflow, and NaN or Infinity fail the comparison."""
    return isinstance(value, (int, float)) and not isinstance(value, bool) and low <= value <= high


# ponytail: no rate limit, so a caller looping over coordinates can make many NASA calls.
# Add Flask-Limiter, or round to NASA's 0.5 degree grid, before exposing this publicly.
@lru_cache(maxsize=256)
def fetch_monthly_climate(lat, lon):
    """Return (12 monthly mean temps in deg C, 12 monthly rain totals in mm), January first."""
    url = NASA_POWER_URL.format(lat=lat, lon=lon)
    try:
        with urllib.request.urlopen(url, timeout=NASA_TIMEOUT_SECONDS) as response:
            params = json.load(response)["properties"]["parameter"]
        temp = tuple(float(params["T2M"][m]) for m in MONTH_KEYS)
        rain_per_day = tuple(float(params["PRECTOTCORR"][m]) for m in MONTH_KEYS)
    # OSError covers network errors and timeouts. HTTPException covers a reply cut off midway.
    except (OSError, http.client.HTTPException, ValueError, KeyError, TypeError) as error:
        raise ClimateUnavailable(f"NASA POWER lookup failed: {error!r}") from error
    if not all(math.isfinite(v) and v > NASA_FILL_VALUE for v in temp + rain_per_day):
        raise ClimateUnavailable("NASA POWER has no data for this point")
    rain = tuple(round(r * days, 1) for r, days in zip(rain_per_day, DAYS_IN_MONTH))
    return temp, rain


def parse_farm(payload):
    """Pull what the scorer needs from the Crop Finder payload. Raises ValueError with a message for the user."""
    coords = payload.get("coordinates")
    lat = coords.get("lat") if isinstance(coords, dict) else None
    lon = coords.get("lon") if isinstance(coords, dict) else None
    if not (in_range(lat, -90, 90) and in_range(lon, -180, 180)):
        raise ValueError("Pick your farm location from the search results (coordinates are missing or invalid).")

    soil = payload.get("soilType")
    if soil is not None and (not isinstance(soil, str) or soil not in SOIL_TEXTURES):
        raise ValueError(f"soilType must be one of: {', '.join(SOIL_TEXTURES)}.")

    farm = payload.get("farm") if isinstance(payload.get("farm"), dict) else {}
    size, unit = farm.get("size"), farm.get("sizeUnit", "acres")
    if size is not None and not in_range(size, MIN_FARM_SIZE, MAX_FARM_SIZE):
        raise ValueError(f"Farm size must be a number from {MIN_FARM_SIZE} to {MAX_FARM_SIZE:,}.")
    if unit not in FARM_SIZE_UNITS:
        raise ValueError("Farm size unit must be acres or hectares.")
    acres = None if size is None else size * (ACRES_PER_HECTARE if unit == "hectares" else 1)

    irrigation = payload.get("irrigation")
    irrigated = isinstance(irrigation, dict) and irrigation.get("available") is True
    return lat, lon, SOIL_TEXTURES.get(soil), irrigated, acres


@app.route("/api/health", methods=["GET"])
def health():
    return (
        jsonify(
            {
                "status": "healthy",
                "message": "ClimateAI backend is running",
                "cropCatalog": catalog_source(),
            }
        ),
        200,
    )


@app.route("/api/crop-analysis", methods=["POST"])
def crop_analysis():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    print(
        "Received crop analysis data:\n"
        + json.dumps(payload, indent=2),  # escaped, so odd unicode cannot crash the print
        flush=True,
    )

    try:
        lat, lon, texture, irrigated, acres = parse_farm(payload)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    try:
        # ~1 km rounding: far finer than NASA's 0.5 degree grid, and lets nearby farms share the cache.
        temp, rain = fetch_monthly_climate(round(lat, 2), round(lon, 2))
    except ClimateUnavailable:
        app.logger.exception("Climate lookup failed for lat=%s lon=%s", lat, lon)
        return jsonify({"error": "Could not load climate data for this location. Please try again."}), 502

    return (
        jsonify(
            {
                "message": "Crop recommendations ready.",
                "location": location if isinstance(location := payload.get("location"), str) else None,
                "farm": {
                    "acres": None if acres is None else round(acres, 1),
                    "soil_type": texture,
                    "irrigated": irrigated,
                },
                "climate": {
                    "source": "NASA POWER 30-year monthly climatology",
                    "monthly_temp_c": temp,
                    "monthly_rain_mm": rain,
                },
                "recommendations": recommend_crops(
                    temp, rain, texture=texture, irrigated=irrigated, acres=acres
                ),
            }
        ),
        200,
    )


@app.route("/api/locations/search", methods=["GET"])
def location_search():
    """Proxy geocoding so the browser never talks to Nominatim directly."""
    query = (request.args.get("q") or "").strip()
    if len(query) < 3:
        return jsonify({"error": "Enter at least 3 characters."}), 400
    try:
        results = season.geocode(query, limit=5)
    except Exception as exc:  # noqa: BLE001 - upstream failure is reported to the UI
        return jsonify({"error": f"Location search failed: {exc}"}), 502
    return jsonify({"results": results}), 200


@app.route("/api/crops/search", methods=["GET"])
def crop_search():
    """Search the FAO ECOCROP catalog by common or scientific crop name."""
    query = (request.args.get("q") or "").strip()
    try:
        limit = max(1, min(int(request.args.get("limit", 8)), 25))
    except ValueError:
        limit = 8
    if not query:
        return jsonify({"error": "Provide a crop name with ?q=."}), 400
    try:
        results = search_crops(query, limit=limit)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": f"Crop search failed: {exc}"}), 502
    return (
        jsonify(
            {
                "query": query,
                "count": len(results),
                "source": catalog_source(),
                "results": results,
            }
        ),
        200,
    )


@app.route("/api/season/compare", methods=["POST"])
def season_compare():
    """Fetch real climate data and return a finished, display-ready comparison."""
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    location = payload.get("location")
    if not isinstance(location, dict) or location.get("lat") is None or location.get("lon") is None:
        return jsonify({"error": "location with lat and lon is required."}), 400

    crops = payload.get("crops") or []
    if not isinstance(crops, list) or not crops:
        return jsonify({"error": "Select at least one previous crop."}), 400

    try:
        previous_year = int(payload.get("previousYear"))
        baseline_span = int(payload.get("baselineSpan", 1))
        window_start = int(payload.get("windowStart", 3))
        window_end = int(payload.get("windowEnd", 8))
    except (TypeError, ValueError):
        return jsonify({"error": "previousYear, baselineSpan, windowStart and windowEnd must be integers."}), 400

    if baseline_span not in (1, 3, 5):
        return jsonify({"error": "baselineSpan must be 1, 3 or 5."}), 400
    if not (0 <= window_start <= 11 and 0 <= window_end <= 11):
        return jsonify({"error": "windowStart and windowEnd must be month indices 0-11."}), 400

    units = payload.get("units") if payload.get("units") in ("imperial", "metric") else "imperial"

    try:
        result = season.compare(
            location=location,
            crops=crops,
            previous_year=previous_year,
            baseline_span=baseline_span,
            window_start=window_start,
            window_end=window_end,
            units=units,
            field_context=payload.get("fieldContext") or {},
        )
    except season.SeasonError as exc:
        return jsonify({"error": str(exc)}), 502
    except Exception as exc:  # noqa: BLE001 - surface unexpected upstream issues
        return jsonify({"error": f"Comparison failed: {exc}"}), 502

    return jsonify(result), 200


if __name__ == "__main__":
    app.run(debug=True, port=5001)  # not 5000: macOS AirPlay Receiver already listens there
