import os
import unittest
from unittest import mock

os.environ.setdefault("CLIMAI_SECRET_KEY", "x" * 40)

import app as climai  # noqa: E402
from services import weather  # noqa: E402

TEMPS = tuple(float(t) for t in (5, 7, 11, 15, 20, 24, 27, 26, 22, 16, 10, 6))
RAIN = (100.0, 90.0, 110.0, 95.0, 120.0, 140.0, 150.0, 130.0, 80.0, 70.0, 60.0, 105.0)


class WeatherOverviewTests(unittest.TestCase):
    def setUp(self):
        weather._cache.clear()
        self.client = climai.app.test_client()

    def test_rejects_bad_coordinates(self):
        self.assertEqual(self.client.get("/api/weather/overview?lat=abc&lon=1").status_code, 400)
        self.assertEqual(self.client.get("/api/weather/overview?lat=95&lon=1").status_code, 400)

    def test_climate_normal_summarises_climatology(self):
        with mock.patch.object(weather, "fetch_monthly_climate", return_value=(TEMPS, RAIN)):
            normal = weather.climate_normal(30.0, -91.0)
        self.assertEqual(normal["annualRainIn"], round(sum(RAIN) / 25.4, 1))
        self.assertEqual(normal["warmestMonth"]["month"], "Jul")
        self.assertEqual(normal["coolestMonth"]["month"], "Jan")
        self.assertEqual(normal["wettestMonth"]["month"], "Jul")
        self.assertEqual(normal["driestMonth"]["month"], "Nov")

    def test_one_failing_part_does_not_blank_the_others(self):
        def broken(lat, lon):
            raise weather.WeatherUnavailable("down")

        with mock.patch.object(weather, "current_conditions", broken), \
                mock.patch.object(weather, "active_alerts", return_value=[]), \
                mock.patch.object(weather, "fetch_monthly_climate", return_value=(TEMPS, RAIN)):
            body = self.client.get("/api/weather/overview?lat=30.45&lon=-91.15").get_json()
        self.assertIn("error", body["current"])
        self.assertEqual(body["alerts"], {"data": []})
        self.assertIn("data", body["normal"])

    def test_current_conditions_parses_open_meteo(self):
        reply = {"current": {"temperature_2m": 20.0, "weather_code": 2, "time": "2026-11-12T10:00"},
                 "hourly": {"precipitation": [0.0, 1.27, None, 1.27]}, "timezone_abbreviation": "CST"}
        with mock.patch.object(weather, "_get_json", return_value=reply):
            current = weather.current_conditions(30.0, -91.0)
        self.assertEqual(current["temperatureF"], 68)
        self.assertEqual(current["conditions"], "Partly cloudy")
        self.assertEqual(current["rainPast24hIn"], 0.1)


if __name__ == "__main__":
    unittest.main()
