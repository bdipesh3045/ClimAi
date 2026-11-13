import json
import os
from datetime import timedelta
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

import accounts
import plan
from crop_suitability import recommend_crops
from services import planting, season, weather
from services.climate import CLIMATOLOGY_LABEL, MONTH_KEYS, ClimateUnavailable, fetch_monthly_climate  # noqa: F401
from services.crops import catalog_source, search_crops
from db import close_db
from validation import SOIL_TEXTURES, in_range, parse_coordinates, parse_farm_size, parse_soil  # noqa: F401

MIN_SECRET_KEY_LENGTH = 32
SECRET_KEY = os.environ.get("CLIMAI_SECRET_KEY", "")
if len(SECRET_KEY) < MIN_SECRET_KEY_LENGTH:
    raise RuntimeError(
        f"Set CLIMAI_SECRET_KEY to a random value of at least {MIN_SECRET_KEY_LENGTH} characters, for example:\n"
        "  export CLIMAI_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
    )

app = Flask(__name__)
app.config.update(
    MAX_CONTENT_LENGTH=64 * 1024,  # the largest form payload is about 2 KB
    SECRET_KEY=SECRET_KEY,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=True,  # turned off for the local http dev server at the bottom of this file
    PERMANENT_SESSION_LIFETIME=timedelta(days=30),
    DATABASE=os.environ.get("CLIMAI_DB_PATH", str(Path(__file__).with_name("climai.db"))),
)
# The pages call these routes directly from the browser. Account routes are reached through
# the Next.js /backend proxy (same origin), so they get no CORS headers.
CORS(app, resources={
    r"/api/crop-analysis": {},
    r"/api/health": {},
    r"/api/locations/search": {},
    r"/api/crops/search": {},
    r"/api/season/compare": {},
    r"/api/planting/plan": {},
    r"/api/weather/overview": {},
})
app.register_blueprint(accounts.bp)
app.register_blueprint(plan.bp)
app.teardown_appcontext(close_db)

ACRES_PER_HECTARE = 2.47105


def parse_farm(payload):
    """Pull what the scorer needs from the Crop Finder payload. Raises ValueError with a message for the user."""
    lat, lon = parse_coordinates(payload)
    soil = parse_soil(payload)
    size, unit = parse_farm_size(payload)
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
                    "source": CLIMATOLOGY_LABEL,
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
    except Exception:  # noqa: BLE001 - details go to the log, never to the browser
        app.logger.exception("Location search failed for %r", query)
        return jsonify({"error": "Location search is unavailable right now. Please try again."}), 502
    return jsonify({"results": results}), 200


@app.route("/api/weather/overview", methods=["GET"])
def weather_overview():
    """Current conditions, active alerts and the climate normal for the Overview page."""
    try:
        lat = float(request.args.get("lat", ""))
        lon = float(request.args.get("lon", ""))
    except ValueError:
        return jsonify({"error": "lat and lon must be numbers."}), 400
    if not (in_range(lat, -90, 90) and in_range(lon, -180, 180)):
        return jsonify({"error": "lat and lon are out of range."}), 400
    return jsonify(weather.overview(lat, lon, logger=app.logger)), 200


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
    except Exception:  # noqa: BLE001 - details go to the log, never to the browser
        app.logger.exception("Crop search failed for %r", query)
        return jsonify({"error": "Crop search is unavailable right now. Please try again."}), 502
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
    if (
        not isinstance(location, dict)
        or location.get("lat") is None
        or location.get("lon") is None
    ):
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
        return (
            jsonify(
                {
                    "error": "previousYear, baselineSpan, windowStart and windowEnd must be integers."
                }
            ),
            400,
        )

    if baseline_span not in (1, 3, 5):
        return jsonify({"error": "baselineSpan must be 1, 3 or 5."}), 400
    if not (0 <= window_start <= 11 and 0 <= window_end <= 11):
        return (
            jsonify({"error": "windowStart and windowEnd must be month indices 0-11."}),
            400,
        )

    units = (
        payload.get("units")
        if payload.get("units") in ("imperial", "metric")
        else "imperial"
    )

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
        app.logger.warning("Season comparison unavailable: %s", exc.__cause__ or exc)
        return jsonify({"error": str(exc)}), 502
    except Exception:  # noqa: BLE001 - details go to the log, never to the browser
        app.logger.exception("Season comparison failed")
        return jsonify({"error": "The season comparison could not be completed right now. Please try again."}), 502

    return jsonify(result), 200


@app.route("/api/planting/plan", methods=["POST"])
def planting_plan():
    """Derive a planting window from real climate normals and ECOCROP."""
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    location = payload.get("location")
    if (
        not isinstance(location, dict)
        or location.get("lat") is None
        or location.get("lon") is None
    ):
        return jsonify({"error": "location with lat and lon is required."}), 400

    crop = payload.get("crop")
    if not isinstance(crop, dict) or not (
        crop.get("name") or crop.get("scientificName")
    ):
        return jsonify({"error": "Search for and select a crop first."}), 400

    try:
        span = int(payload.get("baselineSpan", 3))
    except (TypeError, ValueError):
        return jsonify({"error": "baselineSpan must be an integer."}), 400
    if span not in (1, 3, 5, planting.NORMAL_SPAN):
        return jsonify({"error": "baselineSpan must be 1, 3, 5 or 30."}), 400

    units = (
        payload.get("units")
        if payload.get("units") in ("imperial", "metric")
        else "imperial"
    )

    try:
        result = planting.plan(
            location=location,
            crop=crop,
            span=span,
            units=units,
        )
    except planting.PlantingError as exc:
        if exc.__cause__ is not None:
            app.logger.warning("Planting plan unavailable: %s", exc.__cause__)
        return jsonify({"error": str(exc)}), 400
    except Exception:  # noqa: BLE001 - details go to the log, never to the browser
        app.logger.exception("Planting plan failed")
        return jsonify({"error": "The planting window could not be calculated right now. Please try again."}), 502

    return jsonify(result), 200


if __name__ == "__main__":
    app.config["SESSION_COOKIE_SECURE"] = False  # the dev server is plain http; Safari drops Secure cookies there
    app.run(debug=True, port=5001)  # not 5000: macOS AirPlay Receiver already listens there
