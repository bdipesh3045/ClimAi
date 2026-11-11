import json

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


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


if __name__ == "__main__":
    app.run(debug=True, port=5000)
