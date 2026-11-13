"""Tests for crop journeys. Run from clim_backend: python -m unittest test_journeys"""
import os

os.environ.setdefault("CLIMAI_SECRET_KEY", "test-only-secret-key-0123456789abcdef")

from datetime import date, timedelta

from app import app
from test_accounts import AccountsTestCase

TODAY = date.today()
SOWN = (TODAY - timedelta(days=20)).isoformat()


class JourneyTest(AccountsTestCase):
    def setUp(self):
        super().setUp()
        self.signup()

    def create(self, **overrides):
        body = {"crop": "Soybeans", "sownOn": SOWN, "location": "Baton Rouge, Louisiana", **overrides}
        return self.client.post("/api/journeys", json=body)

    def test_guests_are_refused(self):
        guest = app.test_client()
        self.assertEqual(guest.get("/api/journeys").status_code, 401)
        self.assertEqual(guest.post("/api/journeys", json={}).status_code, 401)

    def test_create_stores_the_journey_with_a_sowing_entry(self):
        response = self.create()
        self.assertEqual(response.status_code, 201)
        journey = response.get_json()["journey"]
        self.assertEqual(journey["crop"], "Soybeans")
        self.assertEqual(journey["seasonDays"], 120)
        self.assertEqual(journey["sownOn"], SOWN)
        self.assertEqual([e["type"] for e in journey["entries"]], ["sowing"])
        self.assertEqual(self.query("SELECT COUNT(*) FROM journeys")[0][0], 1)
        listed = self.client.get("/api/journeys").get_json()["journeys"]
        self.assertEqual([j["id"] for j in listed], [journey["id"]])

    def test_create_validates_input(self):
        tomorrow = (TODAY + timedelta(days=1)).isoformat()
        for body in ({"crop": "Moonbeans"}, {"crop": 7}, {"sownOn": tomorrow}, {"sownOn": "2026-02-30"}, {"sownOn": "March 1"},
                     {"location": "  "}, {"location": "x" * 121}, {"sownOn": "1999-12-31"}):
            with self.subTest(body=body):
                self.assertEqual(self.create(**body).status_code, 400)

    def test_coordinates_from_the_form_or_the_profile(self):
        given = self.create(coordinates={"lat": 30.22, "lon": -92.02}).get_json()["journey"]
        self.assertEqual(given["coordinates"], {"lat": 30.22, "lon": -92.02})
        self.assertIsNone(self.create().get_json()["journey"]["coordinates"])  # no profile saved yet
        self.save_profile()
        from_profile = self.create().get_json()["journey"]["coordinates"]
        self.assertIsNotNone(from_profile)
        self.assertEqual(self.create(coordinates={"lat": 99, "lon": 0}).status_code, 400)

    def test_older_databases_gain_the_new_columns(self):
        import sqlite3
        from db import _add_missing_columns
        conn = sqlite3.connect(":memory:")
        conn.execute("CREATE TABLE journeys (id INTEGER PRIMARY KEY, crop TEXT)")
        conn.execute("CREATE TABLE journey_entries (id INTEGER PRIMARY KEY, details TEXT)")
        _add_missing_columns(conn)
        _add_missing_columns(conn)  # running twice is harmless
        self.assertIn("lat", {r[1] for r in conn.execute("PRAGMA table_info(journeys)")})
        self.assertIn("expert_note", {r[1] for r in conn.execute("PRAGMA table_info(journey_entries)")})

    def test_any_crop_from_the_catalogue(self):
        crops = self.client.get("/api/journeys/crops").get_json()["crops"]
        names = [c["name"] for c in crops]
        self.assertEqual(len(crops), 30)
        self.assertIn("Soybeans", names)
        self.assertNotIn("Soybean", names)
        maize = self.create(crop="Maize").get_json()["journey"]
        self.assertEqual((maize["crop"], maize["seasonDays"]), ("Maize", 120))
        cotton = self.create(crop="Cotton").get_json()["journey"]
        self.assertEqual(cotton["seasonDays"], 170)

    def test_entries_are_saved_and_validated(self):
        journey_id = self.create().get_json()["journey"]["id"]
        url = f"/api/journeys/{journey_id}/entries"
        ok = self.client.post(url, json={"date": TODAY.isoformat(), "type": "watering", "details": "Irrigated 1 inch."})
        self.assertEqual(ok.status_code, 201)
        self.assertEqual(ok.get_json()["entry"]["type"], "watering")
        before_sowing = (TODAY - timedelta(days=30)).isoformat()
        for body in ({"date": before_sowing, "type": "note", "details": "x"},
                     {"date": TODAY.isoformat(), "type": "harvest", "details": "x"},
                     {"date": TODAY.isoformat(), "type": "note", "details": ""}):
            with self.subTest(body=body):
                self.assertEqual(self.client.post(url, json=body).status_code, 400)
        entries = self.client.get("/api/journeys").get_json()["journeys"][0]["entries"]
        self.assertEqual([e["type"] for e in entries], ["sowing", "watering"])

    def test_steps_can_be_ticked_and_unticked(self):
        journey_id = self.create().get_json()["journey"]["id"]
        url = f"/api/journeys/{journey_id}/steps/soy-weeds"
        self.assertEqual(self.client.put(url, json={"done": True}).status_code, 200)
        self.assertEqual(self.client.put(url, json={"done": True}).status_code, 200)  # idempotent
        self.assertEqual(self.client.get("/api/journeys").get_json()["journeys"][0]["doneSteps"], ["soy-weeds"])
        self.client.put(url, json={"done": False})
        self.assertEqual(self.client.get("/api/journeys").get_json()["journeys"][0]["doneSteps"], [])
        self.assertEqual(self.client.put(url, json={"done": "yes"}).status_code, 400)
        self.assertEqual(self.client.put(f"/api/journeys/{journey_id}/steps/BAD!", json={"done": True}).status_code, 404)

    def test_farmers_only_see_their_own_journeys(self):
        journey_id = self.create().get_json()["journey"]["id"]
        other = app.test_client()
        other.post("/api/auth/signup", json={"email": "other@example.com", "password": "another-password-123"})
        self.assertEqual(other.get("/api/journeys").get_json()["journeys"], [])
        entry = {"date": TODAY.isoformat(), "type": "note", "details": "Not mine."}
        self.assertEqual(other.post(f"/api/journeys/{journey_id}/entries", json=entry).status_code, 404)
        self.assertEqual(other.put(f"/api/journeys/{journey_id}/steps/soy-weeds", json={"done": True}).status_code, 404)


PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64


class JourneyPhotoTest(AccountsTestCase):
    def setUp(self):
        super().setUp()
        self.signup()
        body = {"crop": "Soybeans", "sownOn": SOWN, "location": "Baton Rouge"}
        self.journey_id = self.client.post("/api/journeys", json=body).get_json()["journey"]["id"]
        entry = {"date": TODAY.isoformat(), "type": "photo", "details": "Leaf check."}
        entry_id = self.client.post(f"/api/journeys/{self.journey_id}/entries", json=entry).get_json()["entry"]["id"]
        self.url = f"/api/journeys/{self.journey_id}/entries/{entry_id[1:]}/photo"

    def upload(self, data, client=None, name="leaf.jpg"):
        import io
        return (client or self.client).put(self.url, data={"image": (io.BytesIO(data), name)},
                                           content_type="multipart/form-data")

    def test_upload_then_download(self):
        self.assertEqual(self.upload(JPEG).status_code, 200)
        photo = self.client.get(self.url)
        self.assertEqual(photo.status_code, 200)
        self.assertEqual(photo.mimetype, "image/jpeg")
        self.assertEqual(photo.data, JPEG)
        entries = self.client.get("/api/journeys").get_json()["journeys"][0]["entries"]
        self.assertTrue(entries[-1]["hasPhoto"])
        self.assertNotIn("hasPhoto", entries[0])  # the sowing entry has no photo

    def test_replacing_a_photo_keeps_one(self):
        self.upload(JPEG)
        self.upload(PNG, name="leaf.png")
        self.assertEqual(self.client.get(self.url).mimetype, "image/png")
        self.assertEqual(self.query("SELECT COUNT(*) FROM journey_photos")[0][0], 1)

    def test_rejects_non_images_and_oversized_photos(self):
        self.assertEqual(self.upload(b"GIF89a not allowed", name="x.gif").status_code, 415)
        self.assertEqual(self.upload(b"").status_code, 400)
        self.assertEqual(self.upload(JPEG + b"\x00" * (4 * 1024 * 1024)).status_code, 413)

    def test_json_routes_keep_the_small_body_limit(self):
        big = {"date": TODAY.isoformat(), "type": "note", "details": "x" * 200_000}
        self.assertEqual(self.client.post(f"/api/journeys/{self.journey_id}/entries", json=big).status_code, 413)

    def test_only_the_owner_can_upload_or_see(self):
        self.upload(JPEG)
        other = app.test_client()
        other.post("/api/auth/signup", json={"email": "other@example.com", "password": "another-password-123"})
        self.assertEqual(other.get(self.url).status_code, 404)
        self.assertEqual(self.upload(PNG, client=other).status_code, 404)
        self.assertEqual(app.test_client().get(self.url).status_code, 401)
        self.assertEqual(self.client.get(self.url.replace("/photo", "9/photo")).status_code, 404)


class DeleteJourneyTest(JourneyPhotoTest):
    """Reuses the photo test setup: a journey with a sowing entry, a photo entry and its photo."""

    def test_delete_removes_everything_under_the_journey(self):
        self.upload(JPEG)
        self.client.put(f"/api/journeys/{self.journey_id}/steps/soy-weeds", json={"done": True})
        with app.app_context():
            from db import get_db
            db = get_db()
            db.execute("INSERT INTO journey_guides (journey_id, content, source, model, created_at) "
                       "VALUES (?, '[]', 'ai', 'm', 'now')", (int(self.journey_id),))
            db.commit()
        self.assertEqual(self.client.delete(f"/api/journeys/{self.journey_id}").status_code, 204)
        for table in ("journeys", "journey_entries", "journey_steps", "journey_photos", "journey_guides"):
            with self.subTest(table=table):
                self.assertEqual(self.query(f"SELECT COUNT(*) FROM {table}")[0][0], 0)
        self.assertEqual(self.client.get("/api/journeys").get_json()["journeys"], [])
        self.assertEqual(self.client.delete(f"/api/journeys/{self.journey_id}").status_code, 404)

    def test_only_the_owner_can_delete(self):
        other = app.test_client()
        other.post("/api/auth/signup", json={"email": "other@example.com", "password": "another-password-123"})
        self.assertEqual(other.delete(f"/api/journeys/{self.journey_id}").status_code, 404)
        self.assertEqual(app.test_client().delete(f"/api/journeys/{self.journey_id}").status_code, 401)
        self.assertEqual(self.query("SELECT COUNT(*) FROM journeys")[0][0], 1)
