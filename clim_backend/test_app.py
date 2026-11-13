"""Tests for the crop recommendation API. Run from clim_backend: python -m unittest test_app"""
import os

os.environ.setdefault("CLIMAI_SECRET_KEY", "test-only-secret-key-0123456789abcdef")

import http.client
import io
import json
import unittest
from unittest.mock import patch

import app as backend
from app import ClimateUnavailable, app

# Example farm near Des Moines, Iowa. Same numbers as the crop_suitability self check.
DES_MOINES_TEMP = (-6, -3, 4, 11, 17, 22, 24, 23, 18, 11, 3, -4)
DES_MOINES_RAIN = (25, 32, 55, 95, 125, 130, 115, 105, 80, 65, 50, 35)
FARM = {
    "location": "Des Moines, Iowa",
    "coordinates": {"lat": 41.6012, "lon": -93.6091},
    "farm": {"size": 40, "sizeUnit": "acres", "fieldCount": 2},
    "soilType": "Silt",
    "irrigation": {"available": False, "method": None},
}


def post(payload):
    return app.test_client().post("/api/crop-analysis", json=payload)


def by_crop(response):
    return {r["crop"]: r for r in response.get_json()["recommendations"]}


@patch.object(backend, "fetch_monthly_climate", return_value=(DES_MOINES_TEMP, DES_MOINES_RAIN))
class CropAnalysisTest(unittest.TestCase):
    def test_ranks_crops_best_first(self, fetch):
        response = post(FARM)

        self.assertEqual(response.status_code, 200)
        recs = response.get_json()["recommendations"]
        self.assertEqual(recs, sorted(recs, key=lambda r: r["score"], reverse=True))
        maize = by_crop(response)["Maize"]
        self.assertEqual(maize["score"], 100)
        self.assertEqual(maize["harvest_lb_total"], 9800 * 40)
        self.assertEqual(maize["needs"]["temp_c"], [18, 33])
        self.assertEqual(maize["season_days"], 120)
        self.assertFalse(maize["dry_season"])
        self.assertEqual(response.get_json()["farm"], {"acres": 40, "soil_type": "silt loam", "irrigated": False})
        fetch.assert_called_once_with(41.6, -93.61)  # rounded so nearby lookups share the cache

    def test_converts_hectares_to_acres(self, fetch):
        farm = {**FARM, "farm": {"size": 10, "sizeUnit": "hectares"}}

        maize = by_crop(post(farm))["Maize"]

        self.assertEqual(maize["harvest_lb_total"], round(9800 * 24.7105))

    def test_irrigation_lifts_thirsty_crops(self, fetch):
        irrigated = {**FARM, "irrigation": {"available": True, "method": "Flood"}}

        dry_rice = by_crop(post(FARM))["Rice"]["score"]
        wet_rice = by_crop(post(irrigated))["Rice"]["score"]

        self.assertGreater(wet_rice, dry_rice)

    def test_rejects_bad_input(self, fetch):
        bad_payloads = [
            [1, 2],
            {**FARM, "coordinates": None},
            {**FARM, "coordinates": {"lat": 120, "lon": 0}},
            {**FARM, "coordinates": {"lat": True, "lon": 0}},
            {**FARM, "coordinates": {"lat": "41", "lon": 0}},
            {**FARM, "soilType": "Gravel"},
            {**FARM, "soilType": ["Loam"]},
            {**FARM, "farm": {"size": -5, "sizeUnit": "acres"}},
            {**FARM, "farm": {"size": 5, "sizeUnit": "miles"}},
            {**FARM, "coordinates": {"lat": int("9" * 401), "lon": 0}},  # too big to turn into a float
            {**FARM, "farm": {"size": int("9" * 401), "sizeUnit": "acres"}},
            {**FARM, "farm": {"size": 1e308, "sizeUnit": "hectares"}},  # would become infinite acres
        ]
        for payload in bad_payloads:
            with self.subTest(payload=payload):
                response = post(payload)
                self.assertEqual(response.status_code, 400)
                self.assertIn("error", response.get_json())
        fetch.assert_not_called()

    def test_odd_location_text_does_not_crash(self, fetch):
        response = post({**FARM, "location": "\ud800"})  # lone surrogate: valid JSON, not encodable as UTF-8

        self.assertEqual(response.status_code, 200)

    def test_climate_outage_returns_502(self, fetch):
        fetch.side_effect = ClimateUnavailable("timed out")

        response = post(FARM)

        self.assertEqual(response.status_code, 502)
        self.assertIn("error", response.get_json())


class FetchMonthlyClimateTest(unittest.TestCase):
    def setUp(self):
        backend.fetch_monthly_climate.cache_clear()

    def nasa_reply(self, temp, rain_per_day):
        months = backend.MONTH_KEYS
        body = {"properties": {"parameter": {
            "T2M": dict(zip(months, temp)),
            "PRECTOTCORR": dict(zip(months, rain_per_day)),
        }}}
        return patch("urllib.request.urlopen", return_value=io.BytesIO(json.dumps(body).encode()))

    def test_turns_daily_rain_into_monthly_totals(self):
        with self.nasa_reply([10] * 12, [2] * 12):
            temp, rain = backend.fetch_monthly_climate(1.0, 2.0)

        self.assertEqual(temp, (10.0,) * 12)
        self.assertEqual(rain[0], 62.0)  # 2 mm a day for the 31 days of January

    def test_fill_values_mean_no_data(self):
        for bad_value in (-999, float("nan")):
            with self.subTest(bad_value=bad_value):
                backend.fetch_monthly_climate.cache_clear()
                with self.nasa_reply([bad_value] * 12, [2] * 12), self.assertRaises(ClimateUnavailable):
                    backend.fetch_monthly_climate(1.0, 2.0)

    def test_truncated_reply_means_no_data(self):
        with patch("urllib.request.urlopen", side_effect=http.client.IncompleteRead(b"")), \
                self.assertRaises(ClimateUnavailable):
            backend.fetch_monthly_climate(1.0, 2.0)


if __name__ == "__main__":
    unittest.main()


@patch.object(backend, "fetch_monthly_climate", return_value=(DES_MOINES_TEMP, DES_MOINES_RAIN))
class HarvestEstimateTest(unittest.TestCase):
    def estimate(self, **changes):
        return app.test_client().post("/api/harvest-estimate", json={**FARM, "crop": "Maize", **changes})

    def test_matches_the_crop_finder_scorer(self, _fetch):
        body = self.estimate().get_json()
        self.assertEqual((body["score"], body["lbPerAcre"], body["lbTotal"]), (100, 9800, 9800 * 40))
        self.assertEqual(body["what"], "grain")
        self.assertEqual(body["acres"], 40)

    def test_display_name_soybeans_maps_to_the_scorer(self, _fetch):
        body = self.estimate(crop="Soybeans").get_json()
        self.assertEqual(body["crop"], "Soybeans")
        self.assertIsNotNone(body["score"])

    def test_poor_fit_has_no_harvest_and_no_size_has_no_total(self, _fetch):
        rice = self.estimate(crop="Rice").get_json()  # rainfed rice scores 30 in Des Moines
        self.assertIsNone(rice["lbPerAcre"])
        no_size = self.estimate(farm={}).get_json()
        self.assertEqual(no_size["lbPerAcre"], 9800)
        self.assertIsNone(no_size["lbTotal"])

    def test_bad_input(self, _fetch):
        self.assertEqual(self.estimate(crop="Moonbeans").status_code, 400)
        self.assertEqual(self.estimate(coordinates={"lat": 99, "lon": 0}).status_code, 400)
