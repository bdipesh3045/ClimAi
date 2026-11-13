"""Crop journeys for the signed-in farmer: a crop from sowing to harvest, its timeline entries
and the expert-guide steps marked done.

Reached through the Next.js /backend proxy like the account and plan routes, so the session
cookie identifies the farmer. Photos are not stored yet; entries keep their text.
"""
import json
import re
from datetime import date
from pathlib import Path

from flask import Blueprint, jsonify, request

from accounts import SIGN_IN_MESSAGE, error, json_body, now_iso, signed_in_user
from db import get_db
from validation import clean_text

bp = Blueprint("journeys", __name__, url_prefix="/api")

# Every crop in crops.json can start a journey; its season_days sets the expected harvest.
# "Soybean" is shown as "Soybeans", the name the journey pages and models already use.
DISPLAY_NAMES = {"Soybean": "Soybeans"}
_CROPS = [
    {"name": DISPLAY_NAMES.get(c["name"], c["name"]), "category": c["category"], "seasonDays": c["season_days"]}
    for c in json.loads((Path(__file__).with_name("crops.json")).read_text())["crops"]
]
SEASON_DAYS = {c["name"]: c["seasonDays"] for c in _CROPS}
ACTIONS = ("sowing", "watering", "pesticide", "fertilizer", "photo", "note")
DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}")
STEP_ID_PATTERN = re.compile(r"[a-z0-9-]{1,60}")
EARLIEST_SOWING = date(2000, 1, 1)
MAX_LOCATION_LENGTH = 120
MAX_DETAILS_LENGTH = 500
MAX_JOURNEYS_PER_FARMER = 50
MAX_ENTRIES_PER_JOURNEY = 500


def _require_user():
    user = signed_in_user()
    if user is None:
        return None, error(SIGN_IN_MESSAGE, 401)
    return user, None


def _parse_date(value, label):
    """A YYYY-MM-DD string that is a real date and not in the future."""
    if not isinstance(value, str) or not DATE_PATTERN.fullmatch(value):
        raise ValueError(f"{label} must look like 2026-03-15.")
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        raise ValueError(f"{label} is not a real date.") from None
    if parsed > date.today():
        raise ValueError(f"{label} can't be in the future.")
    return parsed


def _owned_journey(journey_id, user_id):
    return get_db().execute(
        "SELECT * FROM journeys WHERE id = ? AND user_id = ?", (journey_id, user_id)
    ).fetchone()


def _entry_json(row):
    return {"id": f"e{row['id']}", "date": row["entry_date"], "type": row["action"], "details": row["details"]}


def _journey_json(row):
    db = get_db()
    entries = db.execute(
        "SELECT * FROM journey_entries WHERE journey_id = ? ORDER BY id", (row["id"],)
    ).fetchall()
    steps = db.execute("SELECT step_id FROM journey_steps WHERE journey_id = ? ORDER BY step_id", (row["id"],)).fetchall()
    return {
        "id": str(row["id"]),
        "crop": row["crop"],
        "location": row["location"],
        "sownOn": row["sown_on"],
        "seasonDays": row["season_days"],
        "sample": False,
        "entries": [_entry_json(entry) for entry in entries],
        "doneSteps": [step["step_id"] for step in steps],
    }


@bp.get("/journeys/crops")
def journey_crops():
    """Crops a journey can follow, grouped by category in crops.json order."""
    return jsonify({"crops": _CROPS}), 200


@bp.get("/journeys")
def list_journeys():
    user, failure = _require_user()
    if failure:
        return failure
    rows = get_db().execute("SELECT * FROM journeys WHERE user_id = ? ORDER BY id DESC", (user["id"],)).fetchall()
    return jsonify({"journeys": [_journey_json(row) for row in rows]}), 200


@bp.post("/journeys")
def create_journey():
    user, failure = _require_user()
    if failure:
        return failure
    try:
        payload = json_body()
        crop = payload.get("crop")
        if crop not in SEASON_DAYS:
            raise ValueError("Choose a crop from the list.")
        sown_on = _parse_date(payload.get("sownOn"), "Sowing date")
        if sown_on < EARLIEST_SOWING:
            raise ValueError("Sowing date is too far in the past.")
        location = clean_text(payload.get("location"), "Location", MAX_LOCATION_LENGTH, required=True)
    except ValueError as message:
        return error(str(message), 400)

    db = get_db()
    count = db.execute("SELECT COUNT(*) FROM journeys WHERE user_id = ?", (user["id"],)).fetchone()[0]
    if count >= MAX_JOURNEYS_PER_FARMER:
        return error(f"You can keep up to {MAX_JOURNEYS_PER_FARMER} journeys.", 409)
    created = now_iso()
    with db:
        cursor = db.execute(
            "INSERT INTO journeys (user_id, crop, location, sown_on, season_days, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user["id"], crop, location, sown_on.isoformat(), SEASON_DAYS[crop], created),
        )
        db.execute(
            "INSERT INTO journey_entries (journey_id, entry_date, action, details, created_at) VALUES (?, ?, 'sowing', ?, ?)",
            (cursor.lastrowid, sown_on.isoformat(), f"{crop} sown. Journey started.", created),
        )
    return jsonify({"journey": _journey_json(_owned_journey(cursor.lastrowid, user["id"]))}), 201


@bp.post("/journeys/<int:journey_id>/entries")
def add_entry(journey_id):
    user, failure = _require_user()
    if failure:
        return failure
    journey = _owned_journey(journey_id, user["id"])
    if journey is None:
        return error("That journey does not exist.", 404)
    try:
        payload = json_body()
        entry_date = _parse_date(payload.get("date"), "Date")
        if entry_date.isoformat() < journey["sown_on"]:
            raise ValueError("The date can't be before sowing.")
        action = payload.get("type")
        if action not in ACTIONS:
            raise ValueError(f"Action must be one of: {', '.join(ACTIONS)}.")
        details = clean_text(payload.get("details"), "Details", MAX_DETAILS_LENGTH, required=True)
    except ValueError as message:
        return error(str(message), 400)

    db = get_db()
    count = db.execute("SELECT COUNT(*) FROM journey_entries WHERE journey_id = ?", (journey_id,)).fetchone()[0]
    if count >= MAX_ENTRIES_PER_JOURNEY:
        return error(f"A journey can hold up to {MAX_ENTRIES_PER_JOURNEY} entries.", 409)
    with db:
        cursor = db.execute(
            "INSERT INTO journey_entries (journey_id, entry_date, action, details, created_at) VALUES (?, ?, ?, ?, ?)",
            (journey_id, entry_date.isoformat(), action, details, now_iso()),
        )
    row = db.execute("SELECT * FROM journey_entries WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify({"entry": _entry_json(row)}), 201


@bp.put("/journeys/<int:journey_id>/steps/<step_id>")
def set_step(journey_id, step_id):
    user, failure = _require_user()
    if failure:
        return failure
    if not STEP_ID_PATTERN.fullmatch(step_id):
        return error("That step does not exist.", 404)
    if _owned_journey(journey_id, user["id"]) is None:
        return error("That journey does not exist.", 404)
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not isinstance(payload.get("done"), bool):
        return error("Send {\"done\": true} or {\"done\": false}.", 400)
    db = get_db()
    with db:
        if payload["done"]:
            db.execute(
                "INSERT INTO journey_steps (journey_id, step_id, done_at) VALUES (?, ?, ?) "
                "ON CONFLICT (journey_id, step_id) DO NOTHING",
                (journey_id, step_id, now_iso()),
            )
        else:
            db.execute("DELETE FROM journey_steps WHERE journey_id = ? AND step_id = ?", (journey_id, step_id))
    return jsonify({"id": step_id, "done": payload["done"]}), 200
