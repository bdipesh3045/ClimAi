from flask import Flask, jsonify
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
    return jsonify({"message": "Crop analysis endpoint"}), 200


if __name__ == "__main__":
    app.run(debug=True, port=5000)
