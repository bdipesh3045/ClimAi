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
