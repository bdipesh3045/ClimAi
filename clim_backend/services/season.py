"""Season comparison data + analysis.

All external fetching (Nominatim, NASA POWER, Open-Meteo) and every derived
number (deltas, extremes, risk levels, crop verdicts, recommendations) live
here, so the frontend only renders a finished payload.
"""

from __future__ import annotations

import urllib.error
import urllib.parse
import urllib.request
from datetime import date

from services.crops import load_catalog

MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
]
MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

# Risk thresholds — returned with every rating so the UI can state them.
HEAT_HOT_F = 86.0  # monthly mean above this = a hot month
EXTREME_DAY_F = 95.0  # daily max above this = an extreme-heat day
DRY_IN = 1.0  # monthly total below this = a dry month
DRY_DAY_MM = 1.0  # daily rain below this = a dry day
WET_IN = 8.0  # monthly total above this = a very wet month
WATERLOG_IN = 6.0  # consecutive months above this = waterlogging risk

USER_AGENT = "ClimateAI/1.0 (season comparison)"
_monthly_cache: dict[tuple[float, float, int], dict] = {}
_daily_cache: dict[tuple[float, float, int], dict] = {}
_seasonal_cache: dict[tuple[float, float], dict] = {}


class SeasonError(Exception):
    """Raised when a required upstream source cannot be used."""


def _get_json(url: str, timeout: int = 40) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json_loads(response.read())


def json_loads(payload: bytes) -> dict:
    import json

    return json.loads(payload.decode("utf-8", errors="replace"))


def c_to_f(value: float) -> float:
    return value * 9 / 5 + 32


def mm_to_in(value: float) -> float:
    return value / 25.4


def _is_number(value) -> bool:
    return isinstance(value, (int, float)) and value > -900


# ---------------------------------------------------------------------------
# Location search
# ---------------------------------------------------------------------------
def geocode(query: str, limit: int = 5) -> list[dict]:
    url = (
        "https://nominatim.openstreetmap.org/search?format=jsonv2"
        f"&limit={limit}&countrycodes=us&q={urllib.parse.quote(query)}"
    )
    request = urllib.request.Request(
        url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        raw = json_loads(response.read())
    return [
        {
            "label": item.get("display_name", ""),
            "lat": float(item["lat"]),
            "lon": float(item["lon"]),
        }
        for item in raw
        if item.get("lat") and item.get("lon")
    ]


# ---------------------------------------------------------------------------
# Upstream climate sources (cached per coordinate/year)
# ---------------------------------------------------------------------------
def fetch_power_monthly(lat: float, lon: float, year: int) -> dict:
    key = (round(lat, 3), round(lon, 3), year)
    if key in _monthly_cache:
        return _monthly_cache[key]
    url = (
        "https://power.larc.nasa.gov/api/temporal/monthly/point"
        "?parameters=T2M,PRECTOTCORR&community=AG"
        f"&latitude={lat}&longitude={lon}&start={year}&end={year}&format=JSON"
    )
    payload = _get_json(url)
    params = (payload.get("properties") or {}).get("parameter") or {}
    data = {"t2m": params.get("T2M") or {}, "prec": params.get("PRECTOTCORR") or {}}
    _monthly_cache[key] = data
    return data


def fetch_power_daily(lat: float, lon: float, year: int) -> dict | None:
    key = (round(lat, 3), round(lon, 3), year)
    if key in _daily_cache:
        return _daily_cache[key]
    url = (
        "https://power.larc.nasa.gov/api/temporal/daily/point"
        "?parameters=T2M_MAX,PRECTOTCORR&community=AG"
        f"&latitude={lat}&longitude={lon}&start={year}0101&end={year}1231&format=JSON"
    )
    try:
        payload = _get_json(url)
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError, OSError):
        return None
    params = (payload.get("properties") or {}).get("parameter") or {}
    data = {
        "tmax": params.get("T2M_MAX") or {},
        "prec": params.get("PRECTOTCORR") or {},
    }
    _daily_cache[key] = data
    return data


def fetch_seasonal(lat: float, lon: float) -> dict | None:
    key = (round(lat, 3), round(lon, 3))
    if key in _seasonal_cache:
        return _seasonal_cache[key]
    url = (
        "https://seasonal-api.open-meteo.com/v1/seasonal"
        f"?latitude={lat}&longitude={lon}&models=ecmwf_seas5_ensemble_mean"
        "&monthly=temperature_2m_mean,precipitation_mean&forecast_days=210&timezone=auto"
    )
    try:
        payload = _get_json(url)
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError, OSError):
        return None
    _seasonal_cache[key] = payload
    return payload


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def window_indices(start: int, end: int) -> list[int]:
    """Months in the growing window; supports windows that wrap the year."""
    if start <= end:
        return [i for i in range(12) if start <= i <= end]
    return [i for i in range(12) if i >= start or i <= end]


def window_label(indices: list[int]) -> str:
    if not indices:
        return "no months"
    ordered = sorted(indices)
    return f"{MONTHS[ordered[0]]}–{MONTHS[ordered[-1]]}"


def level_for_count(count: int, moderate: int = 1, elevated: int = 3) -> str:
    if count >= elevated:
        return "Elevated"
    if count >= moderate:
        return "Moderate"
    return "Low"


def longest_run(values: list[float | None], threshold: float) -> int:
    best = run = 0
    for value in values:
        if value is not None and value > threshold:
            run += 1
            best = max(best, run)
        else:
            run = 0
    return best


def format_temp(value_f: float | None, units: str, decimals: int = 1) -> str:
    if value_f is None:
        return "unavailable"
    if units == "metric":
        return f"{((value_f - 32) * 5 / 9):.{decimals}f}°C"
    return f"{value_f:.{decimals}f}°F"


def format_rain(value_in: float | None, units: str) -> str:
    if value_in is None:
        return "unavailable"
    if units == "metric":
        return f"{value_in * 25.4:.0f} mm"
    return f"{value_in:.1f} in"


def format_delta_temp(delta_f: float | None, units: str) -> dict:
    if delta_f is None:
        return {"value": None, "display": "unavailable", "trend": "flat"}
    if units == "metric":
        delta = delta_f / 1.8
        unit = "°C"
    else:
        delta = delta_f
        unit = "°F"
    sign = "+" if delta > 0.05 else ("−" if delta < -0.05 else "±")
    trend = "up" if delta > 0.05 else ("down" if delta < -0.05 else "flat")
    return {
        "value": round(delta, 1),
        "display": f"{sign}{abs(delta):.1f}{unit}",
        "trend": trend,
    }


def format_delta_rain(delta_in: float | None, units: str) -> dict:
    if delta_in is None:
        return {"value": None, "display": "unavailable", "trend": "flat"}
    if units == "metric":
        delta = delta_in * 25.4
        display = (
            f"{'+' if delta > 1 else ('−' if delta < -1 else '±')}{abs(delta):.0f} mm"
        )
    else:
        delta = delta_in
        display = f"{'+' if delta > 0.05 else ('−' if delta < -0.05 else '±')}{abs(delta):.1f} in"
    trend = "up" if delta_in > 0.05 else ("down" if delta_in < -0.05 else "flat")
    return {"value": round(delta, 1), "display": display, "trend": trend}


# ---------------------------------------------------------------------------
# Crop requirements from ECOCROP
# ---------------------------------------------------------------------------
def resolve_requirements(selected: list[dict]) -> list[dict]:
    """Attach ECOCROP optimal ranges to each requested crop."""
    catalog = load_catalog()
    by_scientific = {crop["scientificName"].lower(): crop for crop in catalog}
    by_name = {crop["name"].lower(): crop for crop in catalog}

    resolved = []
    for item in selected:
        name = (item.get("name") or "").strip()
        scientific = (item.get("scientificName") or "").strip()
        match = None
        if scientific:
            match = by_scientific.get(scientific.lower())
        if match is None and name:
            match = by_name.get(name.lower())
        resolved.append({"requested": name or scientific, "requirement": match})
    return resolved


# ---------------------------------------------------------------------------
# Main comparison
# ---------------------------------------------------------------------------
def compare(
    location: dict,
    crops: list[dict],
    previous_year: int,
    baseline_span: int,
    window_start: int,
    window_end: int,
    units: str = "imperial",
    field_context: dict | None = None,
) -> dict:
    lat = float(location["lat"])
    lon = float(location["lon"])
    prev_years = [previous_year - baseline_span + 1 + i for i in range(baseline_span)]
    months_idx = window_indices(window_start, window_end)
    label = window_label(months_idx)

    # 1. Observed baseline (NASA POWER monthly, averaged over baseline years).
    try:
        monthly_frames = [fetch_power_monthly(lat, lon, year) for year in prev_years]
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError, OSError) as exc:
        raise SeasonError(f"NASA POWER request failed: {exc}") from exc

    if not monthly_frames or not monthly_frames[-1]["t2m"]:
        raise SeasonError(
            "NASA POWER returned no monthly observations for this location."
        )

    # 2. Observed extremes (NASA POWER daily) — optional.
    daily = fetch_power_daily(lat, lon, previous_year)
    extremes = None
    if daily:
        day_keys = sorted(key for key in daily["tmax"] if len(key) == 8)
        days_above = 0
        hottest_f = None
        hottest_date = None
        longest_dry = run = 0
        for day in day_keys:
            tmax = daily["tmax"].get(day)
            prec = daily["prec"].get(day)
            if _is_number(tmax):
                temp_f = c_to_f(tmax)
                if temp_f > EXTREME_DAY_F:
                    days_above += 1
                if hottest_f is None or temp_f > hottest_f:
                    hottest_f = temp_f
                    hottest_date = f"{day[4:6]}/{day[6:8]}"
            if _is_number(prec):
                if prec < DRY_DAY_MM:
                    run += 1
                    longest_dry = max(longest_dry, run)
                else:
                    run = 0
            else:
                run = 0
        if hottest_f is not None:
            extremes = {
                "daysAboveThreshold": days_above,
                "thresholdDisplay": format_temp(EXTREME_DAY_F, units, 0),
                "hottestDayDisplay": format_temp(hottest_f, units),
                "hottestDate": hottest_date,
                "longestDrySpellDays": longest_dry,
            }

    # 3. Outlook (Open-Meteo seasonal) — optional.
    seasonal = fetch_seasonal(lat, lon)
    outlook_temp_by_month: dict[int, float] = {}
    outlook_rain_by_month: dict[int, float] = {}
    outlook_label = "unavailable"
    outlook_range = None
    monthly_block = (seasonal or {}).get("monthly") or {}
    times = monthly_block.get("time") or []
    if times:
        outlook_range = {"start": times[0][:7], "end": times[-1][:7]}
        outlook_label = f"{times[0][:7]} → {times[-1][:7]} (ECMWF SEAS5 ensemble mean)"
        for i, iso in enumerate(times):
            month_index = int(iso[5:7]) - 1
            temp = (monthly_block.get("temperature_2m_mean") or [None] * len(times))[i]
            rain = (monthly_block.get("precipitation_mean") or [None] * len(times))[i]
            if _is_number(temp):
                outlook_temp_by_month[month_index] = c_to_f(temp)
            if _is_number(rain):
                outlook_rain_by_month[month_index] = mm_to_in(rain)

    # 4. Build the monthly table (baseline averaged across years).
    months = []
    for i, month in enumerate(MONTHS):
        temps, rains = [], []
        for year, frame in zip(prev_years, monthly_frames):
            key = f"{year}{i + 1:02d}"
            t2m = frame["t2m"].get(key)
            prec = frame["prec"].get(key)
            if _is_number(t2m):
                temps.append(c_to_f(t2m))
            if _is_number(prec):
                rains.append(mm_to_in(prec * MONTH_LENGTHS[i]))
        baseline_temp_f = sum(temps) / len(temps) if temps else None
        baseline_rain_in = sum(rains) / len(rains) if rains else None
        outlook_temp_f = outlook_temp_by_month.get(i)
        outlook_rain_in = outlook_rain_by_month.get(i)
        months.append(
            {
                "index": i,
                "month": month,
                "inWindow": i in months_idx,
                "baselineTemp": (
                    round(baseline_temp_f, 1) if baseline_temp_f is not None else None
                ),
                "baselineRain": (
                    round(baseline_rain_in, 1) if baseline_rain_in is not None else None
                ),
                "outlookTemp": (
                    round(outlook_temp_f, 1) if outlook_temp_f is not None else None
                ),
                "outlookRain": (
                    round(outlook_rain_in, 1) if outlook_rain_in is not None else None
                ),
            }
        )

    # 5. Window-scoped deltas.
    temp_pairs = [
        (m["outlookTemp"] - m["baselineTemp"])
        for m in months
        if m["inWindow"]
        and m["outlookTemp"] is not None
        and m["baselineTemp"] is not None
    ]
    rain_pairs = [
        (m["outlookRain"] - m["baselineRain"])
        for m in months
        if m["inWindow"]
        and m["outlookRain"] is not None
        and m["baselineRain"] is not None
    ]
    temp_delta_f = sum(temp_pairs) / len(temp_pairs) if temp_pairs else None
    rain_delta_in = sum(rain_pairs) / len(rain_pairs) if rain_pairs else None

    baseline_label = (
        str(previous_year)
        if baseline_span == 1
        else f"{prev_years[0]}–{previous_year} avg"
    )

    temp_summary = (
        f"No overlapping {label} months with both baseline and outlook data."
        if temp_delta_f is None
        else f"Outlook averages {abs(temp_delta_f):.1f}°F "
        f"{'warmer' if temp_delta_f >= 0 else 'cooler'} than the {baseline_label} baseline "
        f"across {len(temp_pairs)} {label} month{'s' if len(temp_pairs) != 1 else ''}."
    )
    rain_summary = (
        f"No overlapping {label} months with both baseline and outlook data."
        if rain_delta_in is None
        else f"Outlook brings {abs(rain_delta_in):.1f} in "
        f"{'more' if rain_delta_in >= 0 else 'less'} rainfall than the {baseline_label} baseline "
        f"across {len(rain_pairs)} {label} month{'s' if len(rain_pairs) != 1 else ''}."
    )

    # 6. Challenges from stated thresholds (window-scoped).
    window_outlook_temps = [months[i]["outlookTemp"] for i in months_idx]
    window_outlook_rains = [months[i]["outlookRain"] for i in months_idx]
    outlook_count = sum(1 for value in window_outlook_temps if value is not None)

    if outlook_count == 0:
        challenges = [
            {
                "key": key,
                "label": name,
                "level": "Unavailable",
                "detail": f"No outlook months fall in the {label} window.",
            }
            for key, name in [
                ("heat", "Heat"),
                ("drought", "Drought"),
                ("excess", "Excess rain"),
                ("waterlogging", "Waterlogging"),
            ]
        ]
    else:
        hot = sum(
            1
            for value in window_outlook_temps
            if value is not None and value > HEAT_HOT_F
        )
        dry = sum(
            1 for value in window_outlook_rains if value is not None and value < DRY_IN
        )
        wet = sum(
            1 for value in window_outlook_rains if value is not None and value > WET_IN
        )
        waterlog = longest_run(window_outlook_rains, WATERLOG_IN)
        challenges = [
            {
                "key": "heat",
                "label": "Heat",
                "level": level_for_count(hot),
                "detail": f"{hot} {label} outlook month{'s' if hot != 1 else ''} above "
                f"{format_temp(HEAT_HOT_F, units, 0)} mean. "
                f"Threshold: 0 Low · 1–2 Moderate · 3+ Elevated.",
            },
            {
                "key": "drought",
                "label": "Drought",
                "level": level_for_count(dry, moderate=1, elevated=2),
                "detail": f"{dry} {label} outlook month{'s' if dry != 1 else ''} below "
                f"{format_rain(DRY_IN, units)}. Threshold: 0 Low · 1 Moderate · 2+ Elevated.",
            },
            {
                "key": "excess",
                "label": "Excess rain",
                "level": level_for_count(wet, moderate=1, elevated=2),
                "detail": f"{wet} {label} outlook month{'s' if wet != 1 else ''} above "
                f"{format_rain(WET_IN, units)}. Threshold: 0 Low · 1 Moderate · 2+ Elevated.",
            },
            {
                "key": "waterlogging",
                "label": "Waterlogging",
                "level": (
                    "Elevated"
                    if waterlog >= 3
                    else ("Moderate" if waterlog >= 2 else "Low")
                ),
                "detail": f"Longest run of {label} months above {format_rain(WATERLOG_IN, units)} "
                f"is {waterlog}. Threshold: 0–1 Low · 2 Moderate · 3+ Elevated.",
            },
        ]

    # 7. Crop verdicts against ECOCROP optimal ranges.
    outlook_avg_temp_f = (
        sum(v for v in window_outlook_temps if v is not None) / outlook_count
        if outlook_count
        else None
    )
    outlook_rains = [v for v in window_outlook_rains if v is not None]
    outlook_avg_rain_in = (
        sum(outlook_rains) / len(outlook_rains) if outlook_rains else None
    )

    verdicts = []
    for entry in resolve_requirements(crops):
        requested = entry["requested"]
        requirement = entry["requirement"]
        if requirement is None:
            verdicts.append(
                {
                    "crop": requested,
                    "verdict": "More Information Needed",
                    "reason": "Not found in the FAO ECOCROP database, so no requirement range is available.",
                }
            )
            continue
        if outlook_avg_temp_f is None or outlook_avg_rain_in is None:
            verdicts.append(
                {
                    "crop": requested,
                    "verdict": "More Information Needed",
                    "reason": f"No outlook months fall in the {label} window, so suitability cannot be assessed.",
                }
            )
            continue

        temp_low, temp_high = requirement["tempOptimalC"]
        temp_low_f, temp_high_f = c_to_f(temp_low), c_to_f(temp_high)
        rain_pair = requirement["rainOptimalMmYear"]
        monthly_rain_in = None
        if rain_pair and None not in rain_pair:
            # ECOCROP rainfall is annual mm; average monthly inches is comparable.
            monthly_rain_in = ((rain_pair[0] + rain_pair[1]) / 2) / 12 / 25.4

        temp_in = temp_low_f <= outlook_avg_temp_f <= temp_high_f
        rain_in = (
            True
            if monthly_rain_in is None
            else abs(outlook_avg_rain_in - monthly_rain_in) <= monthly_rain_in * 0.5
        )
        temp_gap = (
            0
            if temp_in
            else min(
                abs(outlook_avg_temp_f - temp_low_f),
                abs(outlook_avg_temp_f - temp_high_f),
            )
        )
        range_text = (
            f"{format_temp(temp_low_f, units, 0)}–{format_temp(temp_high_f, units, 0)}"
        )
        observed_text = f"{format_temp(outlook_avg_temp_f, units)} / {format_rain(outlook_avg_rain_in, units)}"

        if temp_in and rain_in:
            verdict, reason = (
                "Continue",
                f"{label} outlook averages ({observed_text}) sit inside ECOCROP's optimal "
                f"{range_text} growing range for {requirement['scientificName']}.",
            )
        elif temp_gap <= 3:
            verdict, reason = (
                "More Information Needed",
                f"{label} outlook ({observed_text}) is just outside ECOCROP's optimal "
                f"{range_text} range. Check variety tolerance and field conditions.",
            )
        else:
            verdict, reason = (
                "Reconsider",
                f"{label} outlook ({observed_text}) falls outside ECOCROP's optimal "
                f"{range_text} growing range for {requirement['scientificName']}.",
            )
        verdicts.append(
            {
                "crop": requested,
                "verdict": verdict,
                "reason": reason,
                "requirement": {
                    "scientificName": requirement["scientificName"],
                    "optimalTempRange": range_text,
                    "optimalAnnualRain": (
                        f"{format_rain(monthly_rain_in, units)}/month avg"
                        if monthly_rain_in is not None
                        else "unavailable"
                    ),
                },
            }
        )

    # 8. Recommended actions.
    levels = {challenge["key"]: challenge["level"] for challenge in challenges}
    field = field_context or {}
    recommendations = []
    if levels.get("heat") in {"Moderate", "Elevated"}:
        recommendations.append(
            f"Heat pressure is showing in the {label} outlook — favor heat-tolerant varieties, "
            "avoid midday fieldwork peaks, and plan irrigation before stress sets in."
        )
    if extremes and extremes["daysAboveThreshold"] >= 5:
        recommendations.append(
            f"Last season saw {extremes['daysAboveThreshold']} days above "
            f"{extremes['thresholdDisplay']} — add shade, mulching, or adjusted planting dates "
            "if the outlook trends the same way."
        )
    if levels.get("drought") in {"Moderate", "Elevated"}:
        irrigation = field.get("irrigation")
        recommendations.append(
            "Review irrigation capacity early"
            + (f" (current method: {irrigation})" if irrigation else "")
            + f". Mulching and soil-moisture checks matter most in the driest {label} months."
        )
    if extremes and extremes["longestDrySpellDays"] >= 14:
        recommendations.append(
            f"Last season's longest dry spell ran {extremes['longestDrySpellDays']} days — "
            "keep contingency water or drought-tolerant seed on hand."
        )
    if levels.get("excess") in {"Moderate", "Elevated"}:
        recommendations.append(
            f"Very wet {label} months appear in the outlook — clear drainage channels, avoid "
            "working saturated soil, and protect stored inputs from flooding."
        )
    if levels.get("waterlogging") in {"Moderate", "Elevated"}:
        recommendations.append(
            f"Back-to-back wet {label} months raise waterlogging risk — prioritize raised beds "
            "or well-drained fields and watch low-lying areas after rain."
        )
    if any(v["verdict"] == "Reconsider" for v in verdicts):
        recommendations.append(
            "At least one previous crop looks poorly matched to the outlook — discuss "
            "alternatives or adjusted planting dates with your local extension office."
        )
    if any(v["verdict"] == "More Information Needed" for v in verdicts):
        recommendations.append(
            "Some verdicts need more information — confirm variety heat/rain tolerance and "
            "recent soil tests before finalizing the planting plan."
        )
    if not recommendations:
        recommendations.append(
            f"Conditions look broadly similar to the baseline for {label} — keep standard "
            "practices and re-check the outlook as the season approaches."
        )
    recommendations.append(
        "Bring this comparison to your local extension office: outlooks are coarse (~36 km grid) "
        "and cannot replace field-level advice."
    )
    if field.get("plantingDate") or field.get("harvestDate") or field.get("problems"):
        notes = []
        if field.get("plantingDate"):
            notes.append(f"planting {field['plantingDate']}")
        if field.get("harvestDate"):
            notes.append(f"harvest {field['harvestDate']}")
        if field.get("problems"):
            notes.append(f"past problems: {field['problems']}")
        recommendations.append(
            "Field context noted — "
            + ", ".join(notes)
            + ". Use it alongside the numbers above."
        )

    # 9. Display-ready charts.
    if units == "metric":
        temperature_chart = [
            {
                "month": m["month"],
                "baseline": (
                    None
                    if m["baselineTemp"] is None
                    else round((m["baselineTemp"] - 32) * 5 / 9, 1)
                ),
                "outlook": (
                    None
                    if m["outlookTemp"] is None
                    else round((m["outlookTemp"] - 32) * 5 / 9, 1)
                ),
            }
            for m in months
        ]
        rainfall_chart = [
            {
                "month": m["month"],
                "baseline": (
                    None
                    if m["baselineRain"] is None
                    else round(m["baselineRain"] * 25.4, 1)
                ),
                "outlook": (
                    None
                    if m["outlookRain"] is None
                    else round(m["outlookRain"] * 25.4, 1)
                ),
            }
            for m in months
        ]
        temp_unit, rain_unit = "°C", "mm"
    else:
        temperature_chart = [
            {
                "month": m["month"],
                "baseline": m["baselineTemp"],
                "outlook": m["outlookTemp"],
            }
            for m in months
        ]
        rainfall_chart = [
            {
                "month": m["month"],
                "baseline": m["baselineRain"],
                "outlook": m["outlookRain"],
            }
            for m in months
        ]
        temp_unit, rain_unit = "°F", "in"

    return {
        "generatedAt": date.today().isoformat(),
        "location": {"label": location.get("label", ""), "lat": lat, "lon": lon},
        "units": units,
        "window": {
            "start": window_start,
            "end": window_end,
            "label": label,
            "months": months_idx,
            "monthNames": [MONTHS[i] for i in sorted(months_idx)],
        },
        "baseline": {
            "years": prev_years,
            "label": baseline_label,
            "monthsAvailable": sum(1 for m in months if m["baselineTemp"] is not None),
        },
        "outlook": {
            "label": outlook_label,
            "range": outlook_range,
            "windowMonthsAvailable": outlook_count,
            "windowMonthsTotal": len(months_idx),
        },
        "overview": {
            "tempShift": format_delta_temp(temp_delta_f, units),
            "rainShift": format_delta_rain(rain_delta_in, units),
            "tempSummary": temp_summary,
            "rainSummary": rain_summary,
        },
        "charts": {
            "temperature": temperature_chart,
            "rainfall": rainfall_chart,
            "tempUnit": temp_unit,
            "rainUnit": rain_unit,
        },
        "extremes": extremes,
        "challenges": challenges,
        "verdicts": verdicts,
        "recommendations": recommendations[:7],
        "sources": {
            "observed": "NASA POWER monthly (T2M, PRECTOTCORR) and daily (T2M_MAX)",
            "outlook": "Open-Meteo Seasonal Forecast API (ECMWF SEAS5 ensemble mean)",
            "requirements": "FAO ECOCROP database",
            "geocoding": "OpenStreetMap Nominatim",
        },
    }
