"""Tests for the rule-based field alerts. Run from clim_backend: python -m unittest test_expert_alerts"""
import unittest

from services.expert_alerts import field_alerts

LIMITS = {"tempMinC": 10, "tempMaxC": 38}


def forecast(ahead=None, past=None):
    past = past or [{"tminC": 15, "tmaxC": 28, "rainMm": 2.0}] * 10
    ahead = ahead or [{"tminC": 15, "tmaxC": 28, "rainMm": 0.0}] * 7
    rows = []
    for i, d in enumerate(past):
        rows.append({**d, "date": f"2026-11-{i + 3:02d}", "past": True})
    for i, d in enumerate(ahead):
        rows.append({**d, "date": f"2026-11-{i + 13:02d}", "past": False})
    return rows


def kinds(alerts):
    return [a["kind"] for a in alerts]


class AlertTests(unittest.TestCase):
    def run_rules(self, fc, irrigated=True, entries=(), open_steps=(), progress=0.0, limits=LIMITS):
        return field_alerts(fc, limits, irrigated, list(entries), "2026-11-13", list(open_steps), progress)

    def test_quiet_week_has_no_alerts(self):
        self.assertEqual(self.run_rules(forecast()), [])

    def test_frost_only_for_frost_tender_crops(self):
        cold = forecast(ahead=[{"tminC": -2, "tmaxC": 8, "rainMm": 0}] + [{"tminC": 12, "tmaxC": 20, "rainMm": 0}] * 6)
        self.assertEqual(kinds(self.run_rules(cold)), ["frost"])
        hardy = {"tempMinC": -5, "tempMaxC": 30}
        self.assertEqual(kinds(self.run_rules(cold, limits=hardy)), [])

    def test_heat_above_crop_limit(self):
        hot = forecast(ahead=[{"tminC": 25, "tmaxC": 40, "rainMm": 0}] * 2 + [{"tminC": 20, "tmaxC": 30, "rainMm": 0}] * 5)
        alerts = self.run_rules(hot)
        self.assertEqual(kinds(alerts), ["heat"])
        self.assertIn("2 hot days", alerts[0]["title"])

    def test_heavy_rain_over_three_days(self):
        wet = forecast(ahead=[{"tminC": 15, "tmaxC": 25, "rainMm": 20}] * 3 + [{"tminC": 15, "tmaxC": 25, "rainMm": 0}] * 4)
        self.assertEqual(kinds(self.run_rules(wet)), ["rain"])

    def test_dry_spell_needs_no_irrigation_and_no_watering(self):
        dry = forecast(past=[{"tminC": 15, "tmaxC": 30, "rainMm": 0}] * 10)
        self.assertEqual(kinds(self.run_rules(dry, irrigated=False)), ["dry"])
        self.assertEqual(kinds(self.run_rules(dry, irrigated=True)), [])
        watered = [{"date": "2026-11-10", "type": "watering"}]
        self.assertEqual(kinds(self.run_rules(dry, irrigated=False, entries=watered)), [])
        self.assertEqual(kinds(self.run_rules(dry, irrigated=None)), [])  # unknown irrigation: no guess

    def test_overdue_steps_late_in_the_stage(self):
        self.assertEqual(kinds(self.run_rules(forecast(), open_steps=["Scout"], progress=0.3)), [])
        self.assertEqual(kinds(self.run_rules(forecast(), open_steps=["Scout"], progress=0.7)), ["overdue"])

    def test_no_crop_limits_skips_temperature_rules(self):
        cold = forecast(ahead=[{"tminC": -5, "tmaxC": 45, "rainMm": 0}] * 7)
        self.assertEqual(kinds(self.run_rules(cold, limits=None)), [])


if __name__ == "__main__":
    unittest.main()
