import json

from flask import Flask, jsonify, request
from flask_cors import CORS

from services import season
from services.crops import catalog_source, search_crops

app = Flask(__name__)
CORS(app)


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
        + json.dumps(payload, indent=2, ensure_ascii=False),
        flush=True,
    )
    return (
        jsonify(
            {
                "message": "Crop analysis data received successfully.",
                "received": payload,
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
    app.run(debug=True, port=5000)
