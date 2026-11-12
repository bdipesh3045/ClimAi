"""Tests for sign up, sign in, and the farmer profile. Run from clim_backend: python -m unittest test_accounts"""
import os

os.environ.setdefault("CLIMAI_SECRET_KEY", "test-only-secret-key-0123456789abcdef")

import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import accounts
from app import app
from db import get_db

EMAIL = "asha@example.com"
PASSWORD = "correct horse battery"
PROFILE = {
    "fullName": "Asha Patel",
    "phone": "+1 (515) 555-0100",
    "farmName": "Prairie Creek Farm",
    "location": "Des Moines, Polk County, Iowa, United States",
    "coordinates": {"lat": 41.6012, "lon": -93.6091},
    "farm": {"size": 40, "sizeUnit": "acres"},
    "soilType": "Silt",
    "irrigation": {"available": True, "method": "Drip"},
    "currentCrops": ["Corn", "Soybeans"],
}


class AccountsTestCase(unittest.TestCase):
    """Each test gets its own empty database and a fresh browser-like client."""

    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.db_path = str(Path(folder.name) / "test.db")
        self.enterContext(patch.dict(app.config, DATABASE=self.db_path))
        accounts.LOGIN_FAILURES.clear()
        with app.app_context():
            get_db()  # creates the tables, so tests can count rows before any request opens the database
        self.client = app.test_client()

    def signup(self, email=EMAIL, password=PASSWORD):
        return self.client.post("/api/auth/signup", json={"email": email, "password": password})

    def login(self, email=EMAIL, password=PASSWORD, client=None):
        return (client or self.client).post("/api/auth/login", json={"email": email, "password": password})

    def me(self, client=None):
        return (client or self.client).get("/api/auth/me")

    def save_profile(self, profile=PROFILE):
        return self.client.put("/api/profile", json=profile)

    def query(self, sql, *params):
        with sqlite3.connect(self.db_path) as conn:
            return conn.execute(sql, params).fetchall()


class SignupTest(AccountsTestCase):
    def test_signup_creates_account_and_signs_in(self):
        response = self.signup()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["user"]["email"], EMAIL)
        self.assertIsNone(response.get_json()["profile"])
        self.assertEqual(self.me().get_json()["user"]["email"], EMAIL)

    def test_email_is_trimmed_and_case_insensitive(self):
        self.assertEqual(self.signup(email="  Asha@Example.COM ").get_json()["user"]["email"], EMAIL)

        response = self.signup(email="ASHA@example.com")

        self.assertEqual(response.status_code, 409)
        self.assertIn("error", response.get_json())

    def test_password_is_stored_hashed(self):
        self.signup()

        [(stored,)] = self.query("SELECT password_hash FROM users")

        self.assertNotIn(PASSWORD, stored)
        self.assertTrue(stored.startswith("scrypt:"))

    def test_rejects_bad_input(self):
        bad_bodies = [
            {"email": "asha", "password": PASSWORD},
            {"email": "a@b", "password": PASSWORD},
            {"email": "x" * 250 + "@example.com", "password": PASSWORD},
            {"email": ["asha@example.com"], "password": PASSWORD},
            {"email": EMAIL, "password": "short"},
            {"email": EMAIL, "password": "x" * 129},
            {"email": EMAIL, "password": 123456789},
            {"email": EMAIL},
            [EMAIL, PASSWORD],
        ]
        for body in bad_bodies:
            with self.subTest(body=body):
                response = self.client.post("/api/auth/signup", json=body)
                self.assertEqual(response.status_code, 400)
                self.assertIn("error", response.get_json())
        self.assertEqual(self.query("SELECT COUNT(*) FROM users"), [(0,)])

    def test_form_posts_are_refused(self):
        # A cross-site HTML form can only send form data, so requiring JSON blocks form-based CSRF.
        response = self.client.post("/api/auth/signup", data={"email": EMAIL, "password": PASSWORD})

        self.assertEqual(response.status_code, 400)


class LoginTest(AccountsTestCase):
    def setUp(self):
        super().setUp()
        self.signup()
        self.guest = app.test_client()

    def test_login_with_right_password(self):
        response = self.login(client=self.guest)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["user"]["email"], EMAIL)
        self.assertEqual(self.me(self.guest).status_code, 200)

    def test_wrong_password_and_unknown_email_look_the_same(self):
        wrong_password = self.login(password="not the password", client=self.guest)
        unknown_email = self.login(email="nobody@example.com", client=self.guest)

        self.assertEqual(wrong_password.status_code, 401)
        self.assertEqual(unknown_email.status_code, 401)
        self.assertEqual(wrong_password.get_json(), unknown_email.get_json())
        self.assertEqual(self.me(self.guest).status_code, 401)

    def test_locks_account_after_repeated_failures(self):
        for _ in range(accounts.MAX_LOGIN_FAILURES):
            self.assertEqual(self.login(password="wrong guess!", client=self.guest).status_code, 401)

        locked = self.login(client=self.guest)
        other_account = self.login(email="other@example.com", password="wrong guess!", client=self.guest)

        self.assertEqual(locked.status_code, 429)
        self.assertEqual(other_account.status_code, 401)

    def test_lockout_expires(self):
        with patch.object(accounts, "monotonic", return_value=1000.0):
            for _ in range(accounts.MAX_LOGIN_FAILURES):
                self.login(password="wrong guess!", client=self.guest)
        later = 1000.0 + accounts.LOGIN_WINDOW_SECONDS + 1

        with patch.object(accounts, "monotonic", return_value=later):
            self.assertEqual(self.login(client=self.guest).status_code, 200)

    def test_success_resets_failure_count(self):
        for _ in range(2):
            for _ in range(accounts.MAX_LOGIN_FAILURES - 1):
                self.login(password="wrong guess!", client=self.guest)
            self.assertEqual(self.login(client=self.guest).status_code, 200)

    def test_rejects_bad_input(self):
        for body in ([EMAIL], {"email": EMAIL}, {"email": 5, "password": PASSWORD}):
            with self.subTest(body=body):
                self.assertEqual(self.guest.post("/api/auth/login", json=body).status_code, 400)

    def test_overlong_email_is_refused_before_it_is_tracked(self):
        response = self.login(email="x" * 60_000 + "@example.com", client=self.guest)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(accounts.LOGIN_FAILURES, {})

    def test_failure_tracking_stays_bounded(self):
        # Failed logins for many different emails must not grow memory without limit.
        with patch.object(accounts, "MAX_TRACKED_EMAILS", 3):
            for n in range(6):
                self.login(email=f"guess{n}@example.com", password="wrong guess!", client=self.guest)

        self.assertLessEqual(len(accounts.LOGIN_FAILURES), 3)
        self.assertIn("guess5@example.com", accounts.LOGIN_FAILURES)

    def test_busy_server_refuses_instead_of_queueing_hashes(self):
        slots = [accounts.HASH_SLOTS.acquire(blocking=False) for _ in range(accounts.MAX_CONCURRENT_HASHES)]
        self.assertTrue(all(slots))
        try:
            with patch.object(accounts, "HASH_WAIT_SECONDS", 0):
                login = self.login(client=self.guest)
                signup = self.guest.post("/api/auth/signup", json={"email": "new@example.com", "password": PASSWORD})
        finally:
            for _ in slots:
                accounts.HASH_SLOTS.release()

        self.assertEqual(login.status_code, 503)
        self.assertEqual(signup.status_code, 503)
        self.assertIn("error", login.get_json())
        self.assertEqual(self.login(client=self.guest).status_code, 200)


class SessionTest(AccountsTestCase):
    def test_me_requires_sign_in(self):
        response = self.me()

        self.assertEqual(response.status_code, 401)
        self.assertIn("error", response.get_json())

    def test_logout_ends_session(self):
        self.signup()

        self.assertEqual(self.client.post("/api/auth/logout").status_code, 204)
        self.assertEqual(self.me().status_code, 401)

    def test_session_cookie_is_locked_down(self):
        cookie = self.signup().headers["Set-Cookie"]

        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Lax", cookie)
        self.assertIn("Secure", cookie)

    def test_user_ids_are_never_reused(self):
        # Otherwise an old cookie for a deleted account would sign in as the next new account.
        first_id = self.signup().get_json()["user"]["id"]
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DELETE FROM users")

        second_id = self.signup(email="next@example.com").get_json()["user"]["id"]

        self.assertGreater(second_id, first_id)

    def test_session_of_deleted_account_is_rejected(self):
        self.signup()
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DELETE FROM users")

        self.assertEqual(self.me().status_code, 401)


class ProfileTest(AccountsTestCase):
    def setUp(self):
        super().setUp()
        self.signup()

    def test_requires_sign_in(self):
        response = app.test_client().put("/api/profile", json=PROFILE)

        self.assertEqual(response.status_code, 401)

    def test_saves_profile_and_returns_it_everywhere(self):
        response = self.save_profile()

        self.assertEqual(response.status_code, 200)
        saved = response.get_json()["profile"]
        self.assertEqual({k: v for k, v in saved.items() if k != "updatedAt"}, PROFILE)
        self.assertEqual(self.me().get_json()["profile"], saved)
        self.assertEqual(self.login(client=app.test_client()).get_json()["profile"], saved)

    def test_saving_again_replaces_profile(self):
        self.save_profile()

        self.save_profile({**PROFILE, "farm": {"size": 12.5, "sizeUnit": "hectares"}})

        self.assertEqual(self.me().get_json()["profile"]["farm"], {"size": 12.5, "sizeUnit": "hectares"})
        self.assertEqual(self.query("SELECT COUNT(*) FROM profiles"), [(1,)])

    def test_optional_fields_can_be_left_out(self):
        minimal = {
            "fullName": "Asha Patel",
            "phone": "",
            "location": PROFILE["location"],
            "coordinates": PROFILE["coordinates"],
            "farm": {"size": 3, "sizeUnit": "acres"},
            "soilType": None,
            "irrigation": {"available": False, "method": "Drip"},
            "currentCrops": [],
        }

        saved = self.save_profile(minimal).get_json()["profile"]

        self.assertIsNone(saved["phone"])
        self.assertIsNone(saved["farmName"])
        self.assertIsNone(saved["soilType"])
        self.assertEqual(saved["irrigation"], {"available": False, "method": None})
        self.assertEqual(saved["currentCrops"], [])

    def test_text_is_trimmed_and_crops_deduplicated(self):
        saved = self.save_profile(
            {**PROFILE, "fullName": "  Asha Patel ", "currentCrops": [" Corn", "Corn", "Wheat "]}
        ).get_json()["profile"]

        self.assertEqual(saved["fullName"], "Asha Patel")
        self.assertEqual(saved["currentCrops"], ["Corn", "Wheat"])

    def test_rejects_bad_profile(self):
        without_name = {k: v for k, v in PROFILE.items() if k != "fullName"}
        without_location = {k: v for k, v in PROFILE.items() if k != "location"}
        bad_profiles = [
            without_name,
            without_location,
            {**PROFILE, "fullName": "   "},
            {**PROFILE, "fullName": "x" * 101},
            {**PROFILE, "fullName": 42},
            {**PROFILE, "phone": "call me maybe"},
            {**PROFILE, "farmName": "x" * 101},
            {**PROFILE, "coordinates": {"lat": 91, "lon": 0}},
            {**PROFILE, "coordinates": None},
            {**PROFILE, "farm": {"sizeUnit": "acres"}},
            {**PROFILE, "farm": {"size": -1, "sizeUnit": "acres"}},
            {**PROFILE, "farm": {"size": 5, "sizeUnit": "miles"}},
            {**PROFILE, "soilType": "Gravel"},
            {**PROFILE, "irrigation": {}},
            {**PROFILE, "irrigation": {"available": "yes"}},
            {**PROFILE, "irrigation": {"available": True, "method": "x" * 51}},
            {**PROFILE, "currentCrops": "Corn"},
            {**PROFILE, "currentCrops": [1]},
            {**PROFILE, "currentCrops": [""]},
            {**PROFILE, "currentCrops": [f"Crop {n}" for n in range(accounts.MAX_CURRENT_CROPS + 1)]},
            [PROFILE],
        ]
        for profile in bad_profiles:
            with self.subTest(profile=profile):
                response = self.save_profile(profile)
                self.assertEqual(response.status_code, 400)
                self.assertIn("error", response.get_json())
        self.assertEqual(self.query("SELECT COUNT(*) FROM profiles"), [(0,)])


if __name__ == "__main__":
    unittest.main()
