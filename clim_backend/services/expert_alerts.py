"""Field alerts for a crop journey: deterministic rules on the real forecast, never AI.

Each alert says which rule fired and where the numbers came from, so the farmer can check it.
"""
from datetime import date

FROST_C = 0.0
HEAVY_RAIN_MM = 50.0  # 3-day forecast total
HEAVY_RAIN_DAYS = 3
DRY_DAYS = 10  # past days checked for rain and logged watering
DRY_RAIN_MM = 5.0
OVERDUE_SHARE = 0.6  # a current-stage step still open after 60% of the stage has passed


def _f(celsius):
    return round(celsius * 9 / 5 + 32)


def _rain_text(mm):
    """Inches to one decimal, the same rounding the expert's fact sheet uses."""
    inches = mm / 25.4
    return "Under 0.1 in" if inches < 0.05 else f"Only {inches:.1f} in"


def _day_label(iso):
    day = date.fromisoformat(iso)
    return f"{day:%a} {day:%b} {day.day}"


def field_alerts(forecast, crop_limits, irrigated, entries, today_iso, open_steps, stage_progress):
    """
    forecast:       weather.daily_forecast rows (past=True for the last 10 days)
    crop_limits:    {"tempMinC", "tempMaxC"} from ECOCROP absolute range, or None
    irrigated:      bool from the farm profile (None when unknown)
    entries:        journey entries [{"date", "type"}]
    open_steps:     titles of current-stage expert steps not yet done
    stage_progress: 0-1 share of the current stage already passed
    """
    alerts = []
    ahead = [day for day in forecast if not day["past"]]
    past = [day for day in forecast if day["past"]]

    # Frost: only matters for crops that can't take freezing (ECOCROP minimum above 0 C).
    if crop_limits and crop_limits["tempMinC"] > FROST_C:
        frosty = [d for d in ahead if d["tminC"] is not None and d["tminC"] <= FROST_C]
        if frosty:
            first = frosty[0]
            alerts.append({
                "kind": "frost", "level": "warning",
                "title": f"Frost possible {_day_label(first['date'])}",
                "detail": f"Forecast low {_f(first['tminC'])}°F. This crop is damaged below about "
                          f"{_f(crop_limits['tempMinC'])}°F. Protect young plants or delay planting.",
                "source": "Open-Meteo forecast; FAO ECOCROP minimum temperature",
            })

    # Heat: forecast highs above the crop's ECOCROP absolute maximum.
    if crop_limits:
        hot = [d for d in ahead if d["tmaxC"] is not None and d["tmaxC"] > crop_limits["tempMaxC"]]
        if hot:
            peak = max(hot, key=lambda d: d["tmaxC"])
            alerts.append({
                "kind": "heat", "level": "warning",
                "title": f"{len(hot)} hot day{'s' if len(hot) > 1 else ''} ahead",
                "detail": f"Up to {_f(peak['tmaxC'])}°F on {_day_label(peak['date'])}, above this crop's limit of "
                          f"about {_f(crop_limits['tempMaxC'])}°F. Keep water steady.",
                "source": "Open-Meteo forecast; FAO ECOCROP maximum temperature",
            })

    # Heavy rain: any 3-day window in the forecast.
    for i in range(max(0, len(ahead) - HEAVY_RAIN_DAYS + 1)):
        window = ahead[i:i + HEAVY_RAIN_DAYS]
        total = sum(d["rainMm"] or 0 for d in window)
        if total >= HEAVY_RAIN_MM:
            alerts.append({
                "kind": "rain", "level": "watch",
                "title": f"Heavy rain from {_day_label(window[0]['date'])}",
                "detail": f"About {total / 25.4:.1f} in over {HEAVY_RAIN_DAYS} days. Check drainage and hold off spraying.",
                "source": "Open-Meteo forecast",
            })
            break

    # Dry spell: little rain lately, nothing logged, and no irrigation on the farm.
    if irrigated is False and past:
        recent_rain = sum(d["rainMm"] or 0 for d in past[-DRY_DAYS:])
        first_day = past[-DRY_DAYS:][0]["date"]
        watered = any(e["type"] == "watering" and first_day <= e["date"] <= today_iso for e in entries)
        if recent_rain < DRY_RAIN_MM and not watered:
            alerts.append({
                "kind": "dry", "level": "watch",
                "title": f"Dry for {DRY_DAYS} days",
                "detail": f"{_rain_text(recent_rain)} of rain in the last {DRY_DAYS} days and no watering logged. "
                          "Check soil moisture.",
                "source": "Open-Meteo past 10 days; your journey timeline",
            })

    # Overdue expert steps.
    if open_steps and stage_progress >= OVERDUE_SHARE:
        alerts.append({
            "kind": "overdue", "level": "info",
            "title": f"{len(open_steps)} step{'s' if len(open_steps) > 1 else ''} still open this stage",
            "detail": "Next: " + open_steps[0] + ".",
            "source": "Your expert guide",
        })
    return alerts
