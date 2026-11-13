"""SQLite storage for farmer accounts, profiles, plans and crop journeys. One connection per request."""
import sqlite3

from flask import current_app, g

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,  -- never reuse an id, so old cookies cannot match a new account
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (
    user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name         TEXT NOT NULL,
    phone             TEXT,
    farm_name         TEXT,
    location_label    TEXT NOT NULL,
    lat               REAL NOT NULL,
    lon               REAL NOT NULL,
    farm_size         REAL NOT NULL,
    size_unit         TEXT NOT NULL CHECK (size_unit IN ('acres', 'hectares')),
    soil_type         TEXT,
    irrigated         INTEGER NOT NULL CHECK (irrigated IN (0, 1)),
    irrigation_method TEXT,
    current_crops     TEXT NOT NULL,
    updated_at        TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS plan_progress (
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id  TEXT NOT NULL,
    done_at  TEXT NOT NULL,
    PRIMARY KEY (user_id, task_id)
);
CREATE TABLE IF NOT EXISTS field_notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    crop       TEXT NOT NULL,
    note_date  TEXT,
    challenge  TEXT,
    notes      TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS field_notes_by_user ON field_notes (user_id, id);
CREATE TABLE IF NOT EXISTS journeys (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    crop        TEXT NOT NULL,
    location    TEXT NOT NULL,
    sown_on     TEXT NOT NULL,
    season_days INTEGER NOT NULL,
    created_at  TEXT NOT NULL,
    lat         REAL,
    lon         REAL
);
CREATE INDEX IF NOT EXISTS journeys_by_user ON journeys (user_id, id);
CREATE TABLE IF NOT EXISTS journey_entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    journey_id  INTEGER NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
    entry_date  TEXT NOT NULL,
    action      TEXT NOT NULL,
    details     TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    expert_note TEXT
);
CREATE INDEX IF NOT EXISTS journey_entries_by_journey ON journey_entries (journey_id, id);
CREATE TABLE IF NOT EXISTS journey_steps (
    journey_id  INTEGER NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
    step_id     TEXT NOT NULL,
    done_at     TEXT NOT NULL,
    PRIMARY KEY (journey_id, step_id)
);
CREATE TABLE IF NOT EXISTS journey_guides (
    journey_id  INTEGER PRIMARY KEY REFERENCES journeys(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,   -- validated playbook JSON
    source      TEXT NOT NULL CHECK (source IN ('ai', 'general')),
    model       TEXT,
    created_at  TEXT NOT NULL
);
"""


# Columns added after a table first shipped. CREATE TABLE IF NOT EXISTS never alters an
# existing table, so older database files get them here.
ADDED_COLUMNS = {
    "journeys": {"lat": "REAL", "lon": "REAL"},
    "journey_entries": {"expert_note": "TEXT"},
}


def _add_missing_columns(conn):
    for table, columns in ADDED_COLUMNS.items():
        existing = {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
        for name, kind in columns.items():
            if name not in existing:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {kind}")
    conn.commit()


def get_db():
    """Open this request's connection. Creating the tables here means a new
    database file works without a separate setup step."""
    if "db" not in g:
        conn = sqlite3.connect(current_app.config["DATABASE"])
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.executescript(SCHEMA)
        _add_missing_columns(conn)
        g.db = conn
    return g.db


def close_db(_error=None):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()
