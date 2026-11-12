"""NASA POWER 30-year monthly climatology, shared by every feature that needs climate normals.

Crop Finder scores crops against it, and the planting window uses it by default, so both
answer from the same baseline for the same place.
"""
import http.client
import json
import math
import urllib.request
from functools import lru_cache

# NASA POWER 30-year climatology: mean temperature (deg C) and rainfall (mm per day) for each month.
NASA_POWER_URL = (
    "https://power.larc.nasa.gov/api/temporal/climatology/point"
    "?parameters=T2M,PRECTOTCORR&community=AG&latitude={lat}&longitude={lon}&format=JSON"
)
NASA_TIMEOUT_SECONDS = 20  # the page gives up after 30 seconds
NASA_FILL_VALUE = -999
MONTH_KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
DAYS_IN_MONTH = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
CLIMATOLOGY_LABEL = "NASA POWER 30-year monthly climatology"


class ClimateUnavailable(Exception):
    """NASA POWER could not give usable climate data for a location."""


# ponytail: no rate limit, so a caller looping over coordinates can make many NASA calls.
# Add Flask-Limiter, or round to NASA's 0.5 degree grid, before exposing this publicly.
@lru_cache(maxsize=256)
def fetch_monthly_climate(lat, lon):
    """Return (12 monthly mean temps in deg C, 12 monthly rain totals in mm), January first."""
    url = NASA_POWER_URL.format(lat=lat, lon=lon)
    try:
        with urllib.request.urlopen(url, timeout=NASA_TIMEOUT_SECONDS) as response:
            params = json.load(response)["properties"]["parameter"]
        temp = tuple(float(params["T2M"][m]) for m in MONTH_KEYS)
        rain_per_day = tuple(float(params["PRECTOTCORR"][m]) for m in MONTH_KEYS)
    # OSError covers network errors and timeouts. HTTPException covers a reply cut off midway.
    except (OSError, http.client.HTTPException, ValueError, KeyError, TypeError) as error:
        raise ClimateUnavailable(f"NASA POWER lookup failed: {error!r}") from error
    if not all(math.isfinite(v) and v > NASA_FILL_VALUE for v in temp + rain_per_day):
        raise ClimateUnavailable("NASA POWER has no data for this point")
    rain = tuple(round(r * days, 1) for r, days in zip(rain_per_day, DAYS_IN_MONTH))
    return temp, rain
