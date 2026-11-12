import http.client
import json
import math
import os
import urllib.request
from datetime import timedelta
from functools import lru_cache
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

import accounts
from crop_suitability import recommend_crops
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
# The page calls these two routes directly. Account routes are reached through the
# Next.js /backend proxy (same origin), so they get no CORS headers.
CORS(app, resources={r"/api/crop-analysis": {}, r"/api/health": {}})
app.register_blueprint(accounts.bp)
app.teardown_appcontext(close_db)

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


class ClimateUnavailable(Exception):
    """NASA POWER could not give usable climate data for a location."""


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
        jsonify({"status": "healthy", "message": "ClimateAI backend is running"}),
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


if __name__ == "__main__":
    app.config["SESSION_COOKIE_SECURE"] = False  # the dev server is plain http; Safari drops Secure cookies there
    app.run(debug=True, port=5001)  # not 5000: macOS AirPlay Receiver already listens there
