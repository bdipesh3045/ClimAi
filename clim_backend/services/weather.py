"""Overview weather: current conditions, active alerts and the 30-year climate normal for one point.

Current conditions come from the Open-Meteo forecast API, alerts from the US National Weather
Service (US points only), and the normal from the shared NASA POWER climatology. Each part
fails on its own, so one slow source never blanks the whole panel.
"""
import http.client
from concurrent.futures import ThreadPoolExecutor
import json
import time
import urllib.error
import urllib.parse
import urllib.request

from services.climate import CLIMATOLOGY_LABEL, ClimateUnavailable, fetch_monthly_climate

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
NWS_ALERTS_URL = "https://api.weather.gov/alerts/active"
USER_AGENT = "ClimateAI/1.0 (farm overview)"
TIMEOUT_SECONDS = 10
CACHE_SECONDS = 10 * 60  # current weather changes slowly; spare the free APIs
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
MM_PER_INCH = 25.4
MAX_ALERTS = 5

# WMO weather interpretation codes, as documented by Open-Meteo.
WMO_CODES = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Freezing fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Rain showers", 81: "Rain showers", 82: "Heavy rain showers",
    85: "Snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
}

_cache = {}


class WeatherUnavailable(Exception):
    """A weather source did not answer usefully."""


def _get_json(url, accept="application/json"):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return json.load(response)
    except (OSError, http.client.HTTPException, ValueError) as error:
        raise WeatherUnavailable(f"{url.split('?')[0]} failed: {error!r}") from error


def _fahrenheit(celsius):
    return round(celsius * 9 / 5 + 32)


def current_conditions(lat, lon):
    query = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon,
        "current": "temperature_2m,weather_code",
        "hourly": "precipitation", "past_hours": 24, "forecast_hours": 0,
        "timezone": "auto",
    })
    data = _get_json(f"{OPEN_METEO_URL}?{query}")
    try:
        current = data["current"]
        temp_c = float(current["temperature_2m"])
        code = int(current["weather_code"])
        rain_mm = sum(float(v) for v in data["hourly"]["precipitation"] if v is not None)
    except (KeyError, TypeError, ValueError) as error:
        raise WeatherUnavailable(f"Open-Meteo reply was incomplete: {error!r}") from error
    return {
        "temperatureF": _fahrenheit(temp_c),
        "temperatureC": round(temp_c, 1),
        "conditions": WMO_CODES.get(code, "Unknown"),
        "rainPast24hIn": round(rain_mm / MM_PER_INCH, 2),
        "observedAt": current.get("time"),
        "timezone": data.get("timezone_abbreviation") or data.get("timezone"),
        "source": "Open-Meteo forecast API",
    }


_forecast_cache = {}


def daily_forecast(lat, lon, days=7):
    """Next `days` days from Open-Meteo, plus the past 10 days of rain, as one list of
    {"date", "tmaxC", "tminC", "rainMm", "past"} dicts. Cached for 10 minutes per point."""
    key = (round(lat, 2), round(lon, 2), days)
    cached = _forecast_cache.get(key)
    if cached and time.monotonic() - cached[0] < CACHE_SECONDS:
        return cached[1]
    query = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon,
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
        "past_days": 10, "forecast_days": days, "timezone": "auto",
    })
    data = _get_json(f"{OPEN_METEO_URL}?{query}")
    try:
        daily = data["daily"]
        rows = []
        for i, day in enumerate(daily["time"]):
            rows.append({
                "date": day,
                "tmaxC": daily["temperature_2m_max"][i],
                "tminC": daily["temperature_2m_min"][i],
                "rainMm": daily["precipitation_sum"][i] or 0.0,
                "past": i < 10,
            })
    except (KeyError, TypeError, IndexError) as error:
        raise WeatherUnavailable(f"Open-Meteo forecast was incomplete: {error!r}") from error
    _forecast_cache[key] = (time.monotonic(), rows)
    return rows


def active_alerts(lat, lon):
    """Active NWS alerts for the point. Returns None outside NWS coverage (non-US points)."""
    query = urllib.parse.urlencode({"point": f"{lat:.4f},{lon:.4f}"})
    request = urllib.request.Request(
        f"{NWS_ALERTS_URL}?{query}", headers={"User-Agent": USER_AGENT, "Accept": "application/geo+json"}
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            data = json.load(response)
    except urllib.error.HTTPError as error:
        if error.code in (400, 404):  # the point is outside the US
            return None
        raise WeatherUnavailable(f"NWS alerts failed: {error!r}") from error
    except (OSError, http.client.HTTPException, ValueError) as error:
        raise WeatherUnavailable(f"NWS alerts failed: {error!r}") from error
    alerts = []
    for feature in data.get("features", [])[:MAX_ALERTS]:
        props = feature.get("properties") or {}
        alerts.append({
            "id": props.get("id") or feature.get("id"),
            "event": props.get("event") or "Weather alert",
            "severity": props.get("severity") or "Unknown",
            "headline": props.get("headline") or "",
            "ends": props.get("ends") or props.get("expires"),
        })
    return alerts


def climate_normal(lat, lon):
    temps, rain = fetch_monthly_climate(round(lat, 4), round(lon, 4))
    wettest = max(range(12), key=lambda m: rain[m])
    driest = min(range(12), key=lambda m: rain[m])
    return {
        "annualRainIn": round(sum(rain) / MM_PER_INCH, 1),
        "meanTempF": _fahrenheit(sum(temps) / 12),
        "warmestMonth": {"month": MONTHS[max(range(12), key=lambda m: temps[m])], "tempF": _fahrenheit(max(temps))},
        "coolestMonth": {"month": MONTHS[min(range(12), key=lambda m: temps[m])], "tempF": _fahrenheit(min(temps))},
        "wettestMonth": {"month": MONTHS[wettest], "rainIn": round(rain[wettest] / MM_PER_INCH, 1)},
        "driestMonth": {"month": MONTHS[driest], "rainIn": round(rain[driest] / MM_PER_INCH, 1)},
        "source": CLIMATOLOGY_LABEL,
    }


def overview(lat, lon, logger=None):
    """All three parts; a part that fails comes back as {"error": message} instead of data."""
    key = (round(lat, 3), round(lon, 3))
    cached = _cache.get(key)
    if cached and time.monotonic() - cached[0] < CACHE_SECONDS:
        return cached[1]

    def attempt(fn, message):
        try:
            return {"data": fn(lat, lon)}
        except (WeatherUnavailable, ClimateUnavailable):
            if logger:
                logger.exception("Overview weather part failed")
            return {"error": message}

    parts = {
        "current": (current_conditions, "Current conditions are unavailable right now."),
        "alerts": (active_alerts, "Weather alerts are unavailable right now."),
        "normal": (climate_normal, "The climate normal is unavailable right now."),
    }
    # The three sources are independent, so ask them at the same time.
    with ThreadPoolExecutor(max_workers=len(parts)) as pool:
        futures = {name: pool.submit(attempt, fn, message) for name, (fn, message) in parts.items()}
        result = {name: future.result() for name, future in futures.items()}
    if all("data" in part for part in result.values()):
        _cache[key] = (time.monotonic(), result)
    return result
