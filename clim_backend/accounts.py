"""Sign up, sign in, and the farmer profile.

Passwords are hashed with Werkzeug's scrypt. The session is Flask's signed cookie and
holds only the user id. Every write route needs a JSON body: a cross-site HTML form
cannot send one, which, with the SameSite=Lax cookie, blocks form-based CSRF.
"""
import json
import re
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from time import monotonic

from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from db import get_db
from validation import clean_text, parse_coordinates, parse_farm_size, parse_soil

bp = Blueprint("accounts", __name__, url_prefix="/api")

EMAIL_PATTERN = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
MAX_EMAIL_LENGTH = 254
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128  # caps the hashing work one request can cause
MAX_LOGIN_FAILURES = 10
LOGIN_WINDOW_SECONDS = 15 * 60
BAD_LOGIN_MESSAGE = "Email or password is incorrect."
SIGN_IN_MESSAGE = "Sign in to continue."
# Checked when no account has the email, so a miss takes as long as a wrong password.
UNKNOWN_USER_HASH = generate_password_hash("no account has this password")

PHONE_PATTERN = re.compile(r"[0-9 +()\-]{5,30}")
MAX_PHONE_LENGTH = 30
MAX_NAME_LENGTH = 100
MAX_LOCATION_LENGTH = 300
MAX_IRRIGATION_METHOD_LENGTH = 50
MAX_CROP_NAME_LENGTH = 50
MAX_CURRENT_CROPS = 20

UPSERT_PROFILE = """
INSERT INTO profiles (user_id, full_name, phone, farm_name, location_label, lat, lon, farm_size,
                      size_unit, soil_type, irrigated, irrigation_method, current_crops, updated_at)
VALUES (:user_id, :full_name, :phone, :farm_name, :location_label, :lat, :lon, :farm_size,
        :size_unit, :soil_type, :irrigated, :irrigation_method, :current_crops, :updated_at)
ON CONFLICT (user_id) DO UPDATE SET
    full_name = excluded.full_name, phone = excluded.phone, farm_name = excluded.farm_name,
    location_label = excluded.location_label, lat = excluded.lat, lon = excluded.lon,
    farm_size = excluded.farm_size, size_unit = excluded.size_unit, soil_type = excluded.soil_type,
    irrigated = excluded.irrigated, irrigation_method = excluded.irrigation_method,
    current_crops = excluded.current_crops, updated_at = excluded.updated_at
"""

# ponytail: failed sign-ins are counted in memory, per process, by email only (behind the
# Next.js proxy every request arrives from the same address). Counts reset on restart and
# anyone can lock an account for 15 minutes. Move to Flask-Limiter with Redis, keyed by
# client IP, before running more than one backend process.
LOGIN_FAILURES = {}  # email -> attempt times; dict order = least recently active first
MAX_TRACKED_EMAILS = 10_000  # caps memory at a few MB however many emails are tried
_failures_lock = threading.Lock()

# Each scrypt hash takes about 32 MB and 100 ms. Capping how many run at once keeps a flood
# of sign-in requests from exhausting memory and starving the crop analysis route.
MAX_CONCURRENT_HASHES = 4
HASH_WAIT_SECONDS = 5
HASH_SLOTS = threading.BoundedSemaphore(MAX_CONCURRENT_HASHES)


class ServerBusy(Exception):
    """Every password-hashing slot stayed busy for HASH_WAIT_SECONDS."""


@contextmanager
def hashing_slot():
    if not HASH_SLOTS.acquire(timeout=HASH_WAIT_SECONDS):
        raise ServerBusy
    try:
        yield
    finally:
        HASH_SLOTS.release()


def reserve_attempt(email, now):
    """Count this sign-in as a failure up front, under one lock, so parallel guesses cannot
    all slip in under the limit. A success clears it. Returns False when the email is locked."""
    with _failures_lock:
        recent = tuple(t for t in LOGIN_FAILURES.pop(email, ()) if now - t < LOGIN_WINDOW_SECONDS)
        allowed = len(recent) < MAX_LOGIN_FAILURES
        LOGIN_FAILURES[email] = recent + (now,) if allowed else recent  # re-added last = most recent
        while len(LOGIN_FAILURES) > MAX_TRACKED_EMAILS:
            del LOGIN_FAILURES[next(iter(LOGIN_FAILURES))]  # forget the email idle the longest
    return allowed


def clear_failures(email):
    with _failures_lock:
        LOGIN_FAILURES.pop(email, None)


def error(message, status):
    return jsonify({"error": message}), status


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def json_body():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object.")
    return payload


def read_credentials():
    """Return (email, password). The email is trimmed and lowercased."""
    payload = json_body()
    email, password = payload.get("email"), payload.get("password")
    if not isinstance(email, str) or not isinstance(password, str) or not email.strip() or not password:
        raise ValueError("Enter your email and password.")
    email = email.strip().lower()
    if len(email) > MAX_EMAIL_LENGTH:
        raise ValueError("Enter a valid email address.")
    return email, password


def check_new_credentials(email, password):
    if not EMAIL_PATTERN.fullmatch(email):
        raise ValueError("Enter a valid email address.")
    if not MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH:
        raise ValueError(f"Password must be {MIN_PASSWORD_LENGTH} to {MAX_PASSWORD_LENGTH} characters.")


def start_session(user_id):
    session.clear()  # drop anything set before sign-in
    session["user_id"] = user_id
    session.permanent = True


def signed_in_user():
    """Return the signed-in user's row, or None. Clears a session whose account is gone."""
    user_id = session.get("user_id")
    if not isinstance(user_id, int):
        return None
    user = get_db().execute("SELECT id, email FROM users WHERE id = ?", (user_id,)).fetchone()
    if user is None:
        session.clear()
    return user


def account_json(user_id, email):
    return {"user": {"id": user_id, "email": email}, "profile": load_profile(user_id)}


def parse_crops(crops):
    if not isinstance(crops, list) or len(crops) > MAX_CURRENT_CROPS:
        raise ValueError(f"Current crops must be a list of at most {MAX_CURRENT_CROPS} names.")
    names = [clean_text(crop, "Crop name", MAX_CROP_NAME_LENGTH, required=True) for crop in crops]
    return list(dict.fromkeys(names))  # drop repeats, keep order


def parse_profile(payload):
    """Validate a profile body. Returns the column values for the profiles table."""
    phone = clean_text(payload.get("phone"), "Phone number", MAX_PHONE_LENGTH)
    if phone is not None and not PHONE_PATTERN.fullmatch(phone):
        raise ValueError("Phone number can only use digits, spaces, and + - ( ).")
    lat, lon = parse_coordinates(payload)
    size, unit = parse_farm_size(payload, required=True)
    irrigation = payload.get("irrigation") if isinstance(payload.get("irrigation"), dict) else {}
    irrigated = irrigation.get("available")
    if not isinstance(irrigated, bool):
        raise ValueError("Say whether the farm has irrigation.")
    method = irrigation.get("method") if irrigated else None
    return {
        "full_name": clean_text(payload.get("fullName"), "Full name", MAX_NAME_LENGTH, required=True),
        "phone": phone,
        "farm_name": clean_text(payload.get("farmName"), "Farm name", MAX_NAME_LENGTH),
        "location_label": clean_text(payload.get("location"), "Farm location", MAX_LOCATION_LENGTH, required=True),
        "lat": lat,
        "lon": lon,
        "farm_size": size,
        "size_unit": unit,
        "soil_type": parse_soil(payload),
        "irrigated": irrigated,
        "irrigation_method": clean_text(method, "Irrigation method", MAX_IRRIGATION_METHOD_LENGTH),
        "current_crops": parse_crops(payload.get("currentCrops", [])),
    }


def save_profile(user_id, fields):
    row = {
        **fields,
        "user_id": user_id,
        "irrigated": int(fields["irrigated"]),
        "current_crops": json.dumps(fields["current_crops"]),
        "updated_at": now_iso(),
    }
    db = get_db()
    with db:
        db.execute(UPSERT_PROFILE, row)


def load_profile(user_id):
    """Return the profile in the same camelCase shape the page sends, or None."""
    row = get_db().execute("SELECT * FROM profiles WHERE user_id = ?", (user_id,)).fetchone()
    if row is None:
        return None
    return {
        "fullName": row["full_name"],
        "phone": row["phone"],
        "farmName": row["farm_name"],
        "location": row["location_label"],
        "coordinates": {"lat": row["lat"], "lon": row["lon"]},
        "farm": {"size": row["farm_size"], "sizeUnit": row["size_unit"]},
        "soilType": row["soil_type"],
        "irrigation": {"available": bool(row["irrigated"]), "method": row["irrigation_method"]},
        "currentCrops": json.loads(row["current_crops"]),
        "updatedAt": row["updated_at"],
    }


@bp.errorhandler(ServerBusy)
def server_busy(_error):
    return error("The server is busy. Please try again in a moment.", 503)


@bp.post("/auth/signup")
def signup():
    try:
        email, password = read_credentials()
        check_new_credentials(email, password)
    except ValueError as message:
        return error(str(message), 400)

    with hashing_slot():
        password_hash = generate_password_hash(password)
    db = get_db()
    try:
        with db:
            cursor = db.execute(
                "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
                (email, password_hash, now_iso()),
            )
    except sqlite3.IntegrityError:
        return error("An account with this email already exists. Sign in instead.", 409)

    start_session(cursor.lastrowid)
    return jsonify(account_json(cursor.lastrowid, email)), 201


@bp.post("/auth/login")
def login():
    try:
        email, password = read_credentials()
    except ValueError as message:
        return error(str(message), 400)

    with hashing_slot():  # taken first, so a busy server never counts an attempt against the farmer
        if not reserve_attempt(email, monotonic()):
            minutes = LOGIN_WINDOW_SECONDS // 60
            return error(f"Too many failed sign-in attempts. Try again in {minutes} minutes.", 429)
        user = get_db().execute("SELECT id, email, password_hash FROM users WHERE email = ?", (email,)).fetchone()
        stored_hash = user["password_hash"] if user else UNKNOWN_USER_HASH
        password_ok = len(password) <= MAX_PASSWORD_LENGTH and check_password_hash(stored_hash, password)
    if user is None or not password_ok:
        return error(BAD_LOGIN_MESSAGE, 401)  # the attempt was already counted by reserve_attempt

    clear_failures(email)
    start_session(user["id"])
    return jsonify(account_json(user["id"], user["email"])), 200


@bp.post("/auth/logout")
def logout():
    session.clear()
    return "", 204


@bp.get("/auth/me")
def me():
    user = signed_in_user()
    if user is None:
        return error(SIGN_IN_MESSAGE, 401)
    return jsonify(account_json(user["id"], user["email"])), 200


@bp.put("/profile")
def update_profile():
    user = signed_in_user()
    if user is None:
        return error(SIGN_IN_MESSAGE, 401)
    try:
        fields = parse_profile(json_body())
    except ValueError as message:
        return error(str(message), 400)

    save_profile(user["id"], fields)
    return jsonify({"profile": load_profile(user["id"])}), 200
