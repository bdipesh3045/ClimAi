"""Season plan, task progress and field notes for the signed-in farmer.

Reached through the Next.js /backend proxy like the account routes, so the session cookie
identifies the farmer. The plan is built from their saved profile on every request; only
ticked tasks and notes are stored.
"""
import re
from datetime import date

from flask import Blueprint, current_app, jsonify, request

from accounts import SIGN_IN_MESSAGE, error, json_body, load_profile, now_iso, signed_in_user
from crop_suitability import recommend_crops
from db import get_db
from services.climate import CLIMATOLOGY_LABEL, ClimateUnavailable, fetch_monthly_climate
from services.season_plan import build_plan
from validation import SOIL_TEXTURES, clean_text

bp = Blueprint("plan", __name__, url_prefix="/api")

ACRES_PER_HECTARE = 2.47105
TASK_ID_PATTERN = re.compile(r"[a-z0-9-]{1,60}:[a-z0-9-]{1,40}")
DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}")
MAX_NOTE_LENGTH = 1000
MAX_CROP_LENGTH = 60
MAX_CHALLENGE_LENGTH = 40
MAX_NOTES_PER_FARMER = 500
PROFILE_REQUIRED = "Complete your farm profile to build a season plan."


def _require_user():
    user = signed_in_user()
    if user is None:
        return None, error(SIGN_IN_MESSAGE, 401)
    return user, None


def _done_task_ids(user_id):
    rows = get_db().execute("SELECT task_id FROM plan_progress WHERE user_id = ?", (user_id,)).fetchall()
    return frozenset(row["task_id"] for row in rows)


@bp.get("/plan")
def season_plan():
    user, failure = _require_user()
    if failure:
        return failure
    profile = load_profile(user["id"])
    if profile is None:
        return jsonify({"error": PROFILE_REQUIRED, "code": "profile_required"}), 409

    lat, lon = profile["coordinates"]["lat"], profile["coordinates"]["lon"]
    try:
        # Same rounding as Crop Finder, so both share the cached climate for this farm.
        temp, rain = fetch_monthly_climate(round(lat, 2), round(lon, 2))
    except ClimateUnavailable:
        current_app.logger.exception("Climate lookup failed for the season plan")
        return error("Could not load climate data for your farm. Please try again.", 502)

    size, unit = profile["farm"]["size"], profile["farm"]["sizeUnit"]
    acres = size * (ACRES_PER_HECTARE if unit == "hectares" else 1)
    farm = {
        "acres": acres,
        "soil_type": SOIL_TEXTURES.get(profile["soilType"]) if profile["soilType"] else None,
        "irrigated": profile["irrigation"]["available"],
    }
    recs = recommend_crops(temp, rain, texture=farm["soil_type"], irrigated=farm["irrigated"], acres=acres)
    focus_name = (request.args.get("crop") or "").strip()[:MAX_CROP_LENGTH] or None

    plan = build_plan(recs, farm, profile["currentCrops"], focus_name, _done_task_ids(user["id"]), date.today())
    if plan is None:
        return error("No crops could be scored for this location.", 422)

    return jsonify({
        "location": profile["location"],
        "farmName": profile["farmName"],
        "climateSource": CLIMATOLOGY_LABEL,
        "farm": {"acres": round(acres, 1), "soilType": farm["soil_type"], "irrigated": farm["irrigated"]},
        **plan,
    }), 200


@bp.put("/plan/tasks/<task_id>")
def set_task_done(task_id):
    user, failure = _require_user()
    if failure:
        return failure
    if not TASK_ID_PATTERN.fullmatch(task_id):
        return error("Unknown task.", 400)
    try:
        done = json_body().get("done")
    except ValueError as message:
        return error(str(message), 400)
    if not isinstance(done, bool):
        return error("done must be true or false.", 400)

    db = get_db()
    with db:
        if done:
            db.execute(
                "INSERT INTO plan_progress (user_id, task_id, done_at) VALUES (?, ?, ?) "
                "ON CONFLICT (user_id, task_id) DO NOTHING",
                (user["id"], task_id, now_iso()),
            )
        else:
            db.execute("DELETE FROM plan_progress WHERE user_id = ? AND task_id = ?", (user["id"], task_id))
    return jsonify({"id": task_id, "done": done}), 200


def _note_json(row):
    return {
        "id": row["id"],
        "crop": row["crop"],
        "date": row["note_date"],
        "challenge": row["challenge"],
        "notes": row["notes"],
        "createdAt": row["created_at"],
    }


@bp.get("/notes")
def list_notes():
    user, failure = _require_user()
    if failure:
        return failure
    rows = get_db().execute(
        "SELECT * FROM field_notes WHERE user_id = ? ORDER BY id DESC", (user["id"],)
    ).fetchall()
    return jsonify({"notes": [_note_json(row) for row in rows]}), 200


@bp.post("/notes")
def add_note():
    user, failure = _require_user()
    if failure:
        return failure
    try:
        payload = json_body()
        crop = clean_text(payload.get("crop"), "Crop", MAX_CROP_LENGTH, required=True)
        notes = clean_text(payload.get("notes"), "Note", MAX_NOTE_LENGTH, required=True)
        challenge = clean_text(payload.get("challenge"), "Issue", MAX_CHALLENGE_LENGTH)
        note_date = clean_text(payload.get("date"), "Date", 10)
        if note_date is not None and not DATE_PATTERN.fullmatch(note_date):
            raise ValueError("Date must look like 2026-03-15.")
    except ValueError as message:
        return error(str(message), 400)

    db = get_db()
    count = db.execute("SELECT COUNT(*) FROM field_notes WHERE user_id = ?", (user["id"],)).fetchone()[0]
    if count >= MAX_NOTES_PER_FARMER:
        return error(f"You can keep up to {MAX_NOTES_PER_FARMER} notes. Delete some old ones first.", 409)
    with db:
        cursor = db.execute(
            "INSERT INTO field_notes (user_id, crop, note_date, challenge, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user["id"], crop, note_date, challenge, notes, now_iso()),
        )
    row = db.execute("SELECT * FROM field_notes WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify({"note": _note_json(row)}), 201


@bp.delete("/notes/<int:note_id>")
def delete_note(note_id):
    user, failure = _require_user()
    if failure:
        return failure
    db = get_db()
    with db:
        cursor = db.execute("DELETE FROM field_notes WHERE id = ? AND user_id = ?", (note_id, user["id"]))
    if cursor.rowcount == 0:
        return error("That note does not exist.", 404)
    return "", 204
