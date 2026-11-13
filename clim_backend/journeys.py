"""Crop journeys for the signed-in farmer: a crop from sowing to harvest, its timeline entries
and the expert-guide steps marked done.

Reached through the Next.js /backend proxy like the account and plan routes, so the session
cookie identifies the farmer. Photos are not stored yet; entries keep their text.
"""
import json
import re
import time
from datetime import date

from flask import Blueprint, Response, current_app, jsonify, request

from accounts import SIGN_IN_MESSAGE, error, json_body, load_profile, now_iso, signed_in_user
from db import get_db
from services import expert, weather
from services.climate import ClimateUnavailable, fetch_monthly_climate
from services.crops import ecocrop_ranges
from services.expert_alerts import field_alerts
from services.journey_crops import CROPS, crop_list
from validation import clean_text, in_range

bp = Blueprint("journeys", __name__, url_prefix="/api")

# Every crop in crops.json can start a journey; its season_days sets the expected harvest.
SEASON_DAYS = {name: crop["seasonDays"] for name, crop in CROPS.items()}
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


def _coordinates(value, user_id):
    """The field's coordinates from the form, else the profile farm's, else (None, None)."""
    if value is not None:
        lat = value.get("lat") if isinstance(value, dict) else None
        lon = value.get("lon") if isinstance(value, dict) else None
        if not (in_range(lat, -90, 90) and in_range(lon, -180, 180)):
            raise ValueError("Coordinates must be a real latitude and longitude.")
        return float(lat), float(lon)
    profile = load_profile(user_id)
    if profile:
        return profile["coordinates"]["lat"], profile["coordinates"]["lon"]
    return None, None


def _owned_journey(journey_id, user_id):
    return get_db().execute(
        "SELECT * FROM journeys WHERE id = ? AND user_id = ?", (journey_id, user_id)
    ).fetchone()


def _entry_json(row):
    entry = {"id": f"e{row['id']}", "date": row["entry_date"], "type": row["action"], "details": row["details"]}
    if "has_photo" in row.keys() and row["has_photo"]:
        entry["hasPhoto"] = True
    return entry


def _journey_json(row):
    db = get_db()
    entries = db.execute(
        "SELECT e.*, p.entry_id IS NOT NULL AS has_photo FROM journey_entries e "
        "LEFT JOIN journey_photos p ON p.entry_id = e.id WHERE e.journey_id = ? ORDER BY e.id",
        (row["id"],),
    ).fetchall()
    steps = db.execute("SELECT step_id FROM journey_steps WHERE journey_id = ? ORDER BY step_id", (row["id"],)).fetchall()
    return {
        "id": str(row["id"]),
        "crop": row["crop"],
        "location": row["location"],
        "sownOn": row["sown_on"],
        "seasonDays": row["season_days"],
        "coordinates": (
            {"lat": row["lat"], "lon": row["lon"]} if row["lat"] is not None and row["lon"] is not None else None
        ),
        "sample": False,
        "entries": [_entry_json(entry) for entry in entries],
        "doneSteps": [step["step_id"] for step in steps],
    }


@bp.get("/journeys/crops")
def journey_crops():
    """Crops a journey can follow, grouped by category in crops.json order."""
    return jsonify({"crops": crop_list()}), 200


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
        lat, lon = _coordinates(payload.get("coordinates"), user["id"])
    except ValueError as message:
        return error(str(message), 400)

    db = get_db()
    count = db.execute("SELECT COUNT(*) FROM journeys WHERE user_id = ?", (user["id"],)).fetchone()[0]
    if count >= MAX_JOURNEYS_PER_FARMER:
        return error(f"You can keep up to {MAX_JOURNEYS_PER_FARMER} journeys.", 409)
    created = now_iso()
    with db:
        cursor = db.execute(
            "INSERT INTO journeys (user_id, crop, location, sown_on, season_days, created_at, lat, lon) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (user["id"], crop, location, sown_on.isoformat(), SEASON_DAYS[crop], created, lat, lon),
        )
        db.execute(
            "INSERT INTO journey_entries (journey_id, entry_date, action, details, created_at) VALUES (?, ?, 'sowing', ?, ?)",
            (cursor.lastrowid, sown_on.isoformat(), f"{crop} sown. Journey started.", created),
        )
    return jsonify({"journey": _journey_json(_owned_journey(cursor.lastrowid, user["id"]))}), 201


@bp.delete("/journeys/<int:journey_id>")
def delete_journey(journey_id):
    """Delete a journey with everything under it: entries, photos, ticked steps and the stored
    expert playbook (all removed by ON DELETE CASCADE)."""
    user, failure = _require_user()
    if failure:
        return failure
    db = get_db()
    with db:
        cursor = db.execute("DELETE FROM journeys WHERE id = ? AND user_id = ?", (journey_id, user["id"]))
    if cursor.rowcount == 0:
        return error("That journey does not exist.", 404)
    return "", 204


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


# --------------------------------------------------------------- entry photos

MAX_PHOTO_BYTES = 4 * 1024 * 1024  # the browser shrinks photos to about 1280 px first, so real ones are far smaller
MAX_PHOTOS_PER_JOURNEY = 200


def _image_type(data):
    """The real image type from the first bytes, never from the file name or claimed type."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    return None


def _owned_entry(journey_id, entry_id, user_id):
    return get_db().execute(
        "SELECT e.id FROM journey_entries e JOIN journeys j ON j.id = e.journey_id "
        "WHERE e.id = ? AND e.journey_id = ? AND j.user_id = ?",
        (entry_id, journey_id, user_id),
    ).fetchone()


@bp.put("/journeys/<int:journey_id>/entries/<int:entry_id>/photo")
def upload_entry_photo(journey_id, entry_id):
    user, failure = _require_user()
    if failure:
        return failure
    if _owned_entry(journey_id, entry_id, user["id"]) is None:
        return error("That entry does not exist.", 404)
    request.max_content_length = MAX_PHOTO_BYTES + 64 * 1024  # only this route accepts photos
    file = request.files.get("image")
    if file is None:
        return error("Send the photo as a form upload named image.", 400)
    data = file.read(MAX_PHOTO_BYTES + 1)
    if not data:
        return error("Choose a photo.", 400)
    if len(data) > MAX_PHOTO_BYTES:
        return error("The photo is too large. Use a photo under 4 MB.", 413)
    media_type = _image_type(data)
    if media_type is None:
        return error("Use a JPG or PNG photo.", 415)
    db = get_db()
    count = db.execute(
        "SELECT COUNT(*) FROM journey_photos p JOIN journey_entries e ON e.id = p.entry_id WHERE e.journey_id = ?",
        (journey_id,),
    ).fetchone()[0]
    if count >= MAX_PHOTOS_PER_JOURNEY:
        return error(f"A journey can hold up to {MAX_PHOTOS_PER_JOURNEY} photos.", 409)
    with db:
        db.execute(
            "INSERT INTO journey_photos (entry_id, media_type, data, created_at) VALUES (?, ?, ?, ?) "
            "ON CONFLICT (entry_id) DO UPDATE SET media_type = excluded.media_type, data = excluded.data, "
            "created_at = excluded.created_at",
            (entry_id, media_type, data, now_iso()),
        )
    return jsonify({"id": f"e{entry_id}", "hasPhoto": True}), 200


@bp.get("/journeys/<int:journey_id>/entries/<int:entry_id>/photo")
def entry_photo(journey_id, entry_id):
    user, failure = _require_user()
    if failure:
        return failure
    if _owned_entry(journey_id, entry_id, user["id"]) is None:
        return error("That photo does not exist.", 404)
    row = get_db().execute("SELECT media_type, data FROM journey_photos WHERE entry_id = ?", (entry_id,)).fetchone()
    if row is None:
        return error("That photo does not exist.", 404)
    response = Response(row["data"], mimetype=row["media_type"])
    response.headers["Cache-Control"] = "private, max-age=86400"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


# --------------------------------------------------------------- crop expert

REFRESH_LIMIT = 5  # playbook regenerations per farmer per hour
REFRESH_WINDOW_SECONDS = 3600
AI_RETRY_AFTER_SECONDS = 600  # after a failed AI call, use the general playbook for 10 minutes
_refreshes = {}
_ai_failed_at = {}


def _ai_recently_failed(key):
    failed = _ai_failed_at.get(key)
    return failed is not None and time.monotonic() - failed < AI_RETRY_AFTER_SECONDS


def _allow_refresh(user_id):
    now = time.monotonic()
    recent = [t for t in _refreshes.get(user_id, []) if now - t < REFRESH_WINDOW_SECONDS]
    if len(recent) >= REFRESH_LIMIT:
        _refreshes[user_id] = recent
        return False
    _refreshes[user_id] = recent + [now]
    return True


def _expert_view(journey, user_id, regenerate=False):
    db = get_db()
    crop = CROPS.get(journey["crop"])
    if crop is None:
        return error("This journey's crop is no longer supported.", 409)
    entries = [dict(row) for row in db.execute(
        "SELECT * FROM journey_entries WHERE journey_id = ? ORDER BY entry_date, id", (journey["id"],)
    ).fetchall()]
    timeline = [{"date": e["entry_date"], "type": e["action"], "details": e["details"]} for e in entries]
    done = {r["step_id"] for r in db.execute("SELECT step_id FROM journey_steps WHERE journey_id = ?", (journey["id"],))}

    season_days = journey["season_days"]
    day = max(0, (date.today() - date.fromisoformat(journey["sown_on"])).days)
    stage, stage_share = expert.current_stage(day, season_days)
    profile = load_profile(user_id)
    lat, lon = journey["lat"], journey["lon"]
    if lat is None and profile:
        lat, lon = profile["coordinates"]["lat"], profile["coordinates"]["lon"]

    based_on, warnings = ["your journey timeline", "the crop's typical season length"], []
    if profile:
        based_on.append("your farm profile (soil, irrigation)")
    ecocrop = ecocrop_ranges(crop["scientific"])
    if ecocrop:
        based_on.append("FAO ECOCROP crop limits")
    climate = forecast = None
    if lat is not None:
        try:
            climate = fetch_monthly_climate(round(lat, 2), round(lon, 2))
            based_on.append("NASA POWER 30-year climate normal")
        except ClimateUnavailable:
            warnings.append("The 30-year climate normal is unavailable right now.")
        try:
            forecast = weather.daily_forecast(lat, lon)
            based_on.append("Open-Meteo 7-day forecast")
        except weather.WeatherUnavailable:
            warnings.append("The weather forecast is unavailable right now, so weather alerts are paused.")
    else:
        warnings.append("This journey has no location, so there are no weather alerts.")

    facts = expert.build_facts(dict(journey), crop, day, stage, timeline, profile, ecocrop, climate, forecast,
                               lat is not None)

    # Playbook: stored AI answer, else generate, else the general playbook.
    stored = db.execute("SELECT * FROM journey_guides WHERE journey_id = ?", (journey["id"],)).fetchone()
    ai_key = ("playbook", journey["id"])
    if stored and not regenerate:
        stages, source, model, generated_at = json.loads(stored["content"]), stored["source"], stored["model"], stored["created_at"]
    elif _ai_recently_failed(ai_key) and not regenerate:
        stages, source, model, generated_at = expert.general_playbook(), "general", None, None
    else:
        try:
            stages, model = expert.generate_playbook(facts)
            source, generated_at = "ai", now_iso()
            with db:
                db.execute(
                    "INSERT INTO journey_guides (journey_id, content, source, model, created_at) VALUES (?, ?, 'ai', ?, ?) "
                    "ON CONFLICT (journey_id) DO UPDATE SET content = excluded.content, source = 'ai', "
                    "model = excluded.model, created_at = excluded.created_at",
                    (journey["id"], json.dumps(stages), model, generated_at),
                )
            _ai_failed_at.pop(ai_key, None)
        except (expert.ExpertUnavailable, expert.ExpertInvalid) as problem:
            current_app.logger.warning("Crop expert playbook fell back to general guidance: %s", problem)
            _ai_failed_at[ai_key] = time.monotonic()
            if stored:  # keep the last good AI playbook rather than replacing it with general text
                stages, source, model, generated_at = json.loads(stored["content"]), stored["source"], stored["model"], stored["created_at"]
            else:
                stages, source, model, generated_at = expert.general_playbook(), "general", None, None

    ranges = {r["stage"]: r for r in expert.stage_ranges(season_days)}
    for s in stages:
        s["fromDay"], s["toDay"] = ranges[s["stage"]]["fromDay"], ranges[s["stage"]]["toDay"]

    # Alerts: deterministic rules on the forecast.
    current = next((s for s in stages if s["stage"] == stage), None)
    open_steps = [step["title"] for step in (current["steps"] if current else []) if step["id"] not in done]
    limits = {"tempMinC": ecocrop["temp_abs"][0], "tempMaxC": ecocrop["temp_abs"][1]} if ecocrop else None
    irrigated = bool(profile["irrigation"]["available"]) if profile else None
    alerts = field_alerts(forecast, limits, irrigated, timeline, date.today().isoformat(), open_steps, stage_share) if forecast else []

    # Reaction to the latest entry: stored, else AI, else a general line.
    reaction = None
    if entries:
        latest = entries[-1]
        if latest["expert_note"]:
            reaction = {"entryId": f"e{latest['id']}", "text": latest["expert_note"], "source": "ai"}
        else:
            text, source_r = expert.GENERAL_REACTIONS.get(latest["action"], ""), "general"
            reaction_key = ("reaction", latest["id"])
            if not _ai_recently_failed(reaction_key):
                try:
                    text = expert.generate_reaction(facts, timeline[-1])
                    source_r = "ai"
                    with db:
                        db.execute("UPDATE journey_entries SET expert_note = ? WHERE id = ?", (text, latest["id"]))
                except (expert.ExpertUnavailable, expert.ExpertInvalid) as problem:
                    current_app.logger.warning("Crop expert reaction fell back: %s", problem)
                    _ai_failed_at[reaction_key] = time.monotonic()
            reaction = {"entryId": f"e{latest['id']}", "text": text, "source": source_r}

    return jsonify({
        "source": source,
        "model": model,
        "generatedAt": generated_at,
        "day": day,
        "stage": stage,
        "stages": stages,
        "alerts": alerts,
        "reaction": reaction,
        "basedOn": based_on,
        "warnings": warnings,
    }), 200


@bp.get("/journeys/<int:journey_id>/expert")
def journey_expert(journey_id):
    user, failure = _require_user()
    if failure:
        return failure
    journey = _owned_journey(journey_id, user["id"])
    if journey is None:
        return error("That journey does not exist.", 404)
    return _expert_view(journey, user["id"])


@bp.post("/journeys/<int:journey_id>/expert/refresh")
def refresh_journey_expert(journey_id):
    user, failure = _require_user()
    if failure:
        return failure
    journey = _owned_journey(journey_id, user["id"])
    if journey is None:
        return error("That journey does not exist.", 404)
    if not _allow_refresh(user["id"]):
        return error("You've refreshed the advice a lot. Please wait a while and try again.", 429)
    return _expert_view(journey, user["id"], regenerate=True)
