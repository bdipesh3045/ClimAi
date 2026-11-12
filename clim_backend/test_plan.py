"""Tests for the season plan, task progress and field notes. Run from clim_backend: python -m unittest test_plan"""
import os

os.environ.setdefault("CLIMAI_SECRET_KEY", "test-only-secret-key-0123456789abcdef")

import unittest
from datetime import date
from unittest.mock import patch

import plan as plan_routes
from crop_suitability import recommend_crops
from services.climate import ClimateUnavailable
from services.season_plan import build_plan, months_until, season_months
from test_accounts import PROFILE, AccountsTestCase

# Example farm near Des Moines, Iowa. Same numbers as the crop_suitability self check.
TEMP = (-6, -3, 4, 11, 17, 22, 24, 23, 18, 11, 3, -4)
RAIN = (25, 32, 55, 95, 125, 130, 115, 105, 80, 65, 50, 35)
FARM = {"acres": 40, "soil_type": "silt loam", "irrigated": False}


class BuildPlanTest(unittest.TestCase):
    def setUp(self):
        self.recs = recommend_crops(TEMP, RAIN, texture="silt loam", acres=40)

    def test_defaults_to_best_crop_the_farmer_grows(self):
        plan = build_plan(self.recs, FARM, ["Corn", "Soybeans"], today=date(2026, 1, 15))
        self.assertEqual(plan["focus"]["crop"], "Maize")  # "Corn" on the profile is Maize to the scorer
        self.assertTrue(plan["focus"]["grown"])
        self.assertEqual([c["crop"] for c in plan["currentCrops"]], ["Maize", "Soybean"])

    def test_season_tasks_follow_the_planting_month(self):
        plan = build_plan(self.recs, FARM, ["Corn"], today=date(2026, 1, 15))
        tasks = {t["id"].split(":")[1]: t for t in plan["tasks"]}
        plant = plan["focus"]["plantMonth"]
        self.assertEqual(plant, "May")
        self.assertEqual(tasks["plant"]["dueMonth"], 4)
        self.assertEqual(tasks["seed"]["dueMonth"], 3)  # a month before planting
        self.assertEqual(tasks["plant"]["monthsAway"], 4)
        self.assertEqual(tasks["plant"]["group"], "later")
        self.assertIn("Expect about", tasks["harvest"]["why"])
        self.assertIn("soil-test", tasks)  # pH is never known from the profile

    def test_unknown_focus_falls_back_and_other_is_ignored(self):
        plan = build_plan(self.recs, FARM, ["Other", "Pecans"], focus_name="Not a crop", today=date(2026, 1, 1))
        self.assertEqual(plan["focus"]["crop"], self.recs[0]["crop"])
        self.assertEqual(plan["currentCrops"], [
            {"name": "Pecans", "crop": None, "score": None, "level": None, "allChecksPass": None, "weakestPoint": None},
        ])

    def test_done_ids_mark_tasks(self):
        first = build_plan(self.recs, FARM, ["Corn"], today=date(2026, 1, 1))["tasks"][0]["id"]
        plan = build_plan(self.recs, FARM, ["Corn"], done_ids=frozenset({first}), today=date(2026, 1, 1))
        self.assertEqual(plan["progress"]["done"], 1)

    def test_poor_fit_crop_gets_a_reconsider_task(self):
        plan = build_plan(self.recs, FARM, ["Corn", "Rice"], today=date(2026, 1, 1))
        self.assertTrue(any(t["id"] == "rice:reconsider" for t in plan["tasks"]))

    def test_month_helpers(self):
        self.assertEqual(months_until(0, date(2026, 11, 3)), 2)
        rec = {"plant_month": "November", "harvest_month": "February"}
        self.assertEqual([m for m, on in enumerate(season_months(rec)) if on], [0, 1, 10, 11])


@patch.object(plan_routes, "fetch_monthly_climate", return_value=(TEMP, RAIN))
class PlanRoutesTest(AccountsTestCase):
    def test_plan_needs_sign_in_and_profile(self, _fetch):
        self.assertEqual(self.client.get("/api/plan").status_code, 401)
        self.signup()
        response = self.client.get("/api/plan")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["code"], "profile_required")

    def test_plan_is_built_from_the_profile(self, fetch):
        self.signup()
        self.save_profile()
        response = self.client.get("/api/plan")
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["farmName"], PROFILE["farmName"])
        self.assertEqual(body["focus"]["crop"], "Maize")
        self.assertTrue(body["farm"]["irrigated"])
        fetch.assert_called_with(41.6, -93.61)

        other = self.client.get("/api/plan?crop=Soybean").get_json()
        self.assertEqual(other["focus"]["crop"], "Soybean")

    def test_ticking_a_task_is_stored_per_farmer(self, _fetch):
        self.signup()
        self.save_profile()
        task_id = self.client.get("/api/plan").get_json()["tasks"][0]["id"]

        self.assertEqual(self.client.put(f"/api/plan/tasks/{task_id}", json={"done": True}).status_code, 200)
        self.assertTrue(self.client.get("/api/plan").get_json()["tasks"][0]["done"])
        self.assertEqual(self.query("SELECT COUNT(*) FROM plan_progress")[0][0], 1)

        self.client.put(f"/api/plan/tasks/{task_id}", json={"done": False})
        self.assertFalse(self.client.get("/api/plan").get_json()["tasks"][0]["done"])

    def test_bad_task_requests_are_rejected(self, _fetch):
        self.signup()
        self.assertEqual(self.client.put("/api/plan/tasks/DROP TABLE", json={"done": True}).status_code, 400)
        self.assertEqual(self.client.put("/api/plan/tasks/maize:plant", json={"done": "yes"}).status_code, 400)

    def test_climate_failure_is_a_plain_message(self, fetch):
        fetch.side_effect = ClimateUnavailable("secret upstream detail")
        self.signup()
        self.save_profile()
        response = self.client.get("/api/plan")
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("secret", response.get_json()["error"])


class NotesRoutesTest(AccountsTestCase):
    def test_notes_round_trip_and_stay_private(self):
        self.assertEqual(self.client.get("/api/notes").status_code, 401)
        self.signup()
        created = self.client.post(
            "/api/notes", json={"crop": "Maize", "date": "2026-05-02", "challenge": "Pests", "notes": " Aphids on row 3 "}
        )
        self.assertEqual(created.status_code, 201)
        note = created.get_json()["note"]
        self.assertEqual(note["notes"], "Aphids on row 3")
        self.assertEqual([n["id"] for n in self.client.get("/api/notes").get_json()["notes"]], [note["id"]])

        other = self.client.application.test_client()
        self.signup_other(other)
        self.assertEqual(other.get("/api/notes").get_json()["notes"], [])
        self.assertEqual(other.delete(f"/api/notes/{note['id']}").status_code, 404)

        self.assertEqual(self.client.delete(f"/api/notes/{note['id']}").status_code, 204)
        self.assertEqual(self.client.get("/api/notes").get_json()["notes"], [])

    def test_note_validation(self):
        self.signup()
        self.assertEqual(self.client.post("/api/notes", json={"crop": "Maize", "notes": ""}).status_code, 400)
        self.assertEqual(self.client.post("/api/notes", json={"crop": "Maize", "notes": "x", "date": "May 2"}).status_code, 400)
        self.assertEqual(self.client.post("/api/notes", json={"crop": "Maize", "notes": "x" * 1001}).status_code, 400)

    def signup_other(self, client):
        client.post("/api/auth/signup", json={"email": "other@example.com", "password": "another password"})


if __name__ == "__main__":
    unittest.main()
