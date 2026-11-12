"""SQLite storage for farmer accounts and profiles. One connection per request."""
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
"""


def get_db():
    """Open this request's connection. Creating the tables here means a new
    database file works without a separate setup step."""
    if "db" not in g:
        conn = sqlite3.connect(current_app.config["DATABASE"])
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.executescript(SCHEMA)
        g.db = conn
    return g.db


def close_db(_error=None):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()
