"""Planting window from real climatology.

The window is derived, never guessed: NASA POWER monthly normals for the site
are compared with the FAO ECOCROP optimal temperature range for the chosen
crop. A month is plantable when its long-term mean sits inside that range, and
the window is the longest unbroken run of such months.

Everything here is computed server-side so the browser only renders a finished,
display-ready payload.
"""

from __future__ import annotations

import urllib.error
from datetime import date

from services.climate import CLIMATOLOGY_LABEL, ClimateUnavailable, fetch_monthly_climate
from services.season import (
    MONTH_LENGTHS,
    MONTHS,
    c_to_f,
    fetch_power_monthly,
    format_rain,
    format_temp,
    resolve_requirements,
)


class PlantingError(Exception):
    """Raised when a required source or crop requirement is unavailable."""


# Baseline span meaning "the 30-year climate normal", the same baseline Crop Finder scores with.
NORMAL_SPAN = 30


def _is_number(value) -> bool:
    return isinstance(value, (int, float)) and value > -900


def _baseline_years(span: int) -> list[int]:
    """Most recent complete years — POWER data lags the current year."""
    last = date.today().year - 1
    return [last - span + 1 + i for i in range(span)]


def _monthly_normals(lat: float, lon: float, years: list[int]) -> tuple[list, list]:
    """Average monthly mean temperature (C) and monthly rainfall total (mm)."""
    try:
        frames = [fetch_power_monthly(lat, lon, year) for year in years]
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError, OSError) as exc:
        raise PlantingError("NASA POWER climate data is unavailable right now. Please try again.") from exc

    if not frames or not frames[-1]["t2m"]:
        raise PlantingError(
            "NASA POWER returned no monthly observations for this location."
        )

    temps: list[float | None] = []
    rains: list[float | None] = []
    for index in range(12):
        temp_values, rain_values = [], []
        for year, frame in zip(years, frames):
            key = f"{year}{index + 1:02d}"
            temp = frame["t2m"].get(key)
            rain = frame["prec"].get(key)
            if _is_number(temp):
                temp_values.append(temp)
            if _is_number(rain):
                rain_values.append(rain * MONTH_LENGTHS[index])
        temps.append(sum(temp_values) / len(temp_values) if temp_values else None)
        rains.append(sum(rain_values) / len(rain_values) if rain_values else None)
    return temps, rains


def _longest_run(flags: list[bool]) -> tuple[int, int | None, int | None]:
    """Longest unbroken run of True in a 12-month strip."""
    best_length, best_start, best_end = 0, None, None
    run_start = None
    for index, flag in enumerate(flags + [False]):
        if flag and run_start is None:
            run_start = index
        elif not flag and run_start is not None:
            length = index - run_start
            if length > best_length:
                best_length, best_start, best_end = length, run_start, index - 1
            run_start = None
    return best_length, best_start, best_end


def _month_names(indices: list[int]) -> list[str]:
    return [MONTHS[i] for i in sorted(indices)]


def _window_label(start: int | None, end: int | None) -> str:
    if start is None or end is None:
        return "no suitable window"
    if start == end:
        return MONTHS[start]
    return f"{MONTHS[start]}–{MONTHS[end]}"


def _temp_value(temp_f: float, units: str) -> float:
    return round((temp_f - 32) * 5 / 9, 1) if units == "metric" else round(temp_f, 1)


def _rain_value(rain_mm: float, units: str) -> float:
    return round(rain_mm, 0) if units == "metric" else round(rain_mm / 25.4, 2)


def plan(
    location: dict,
    crop: dict,
    span: int = 3,
    units: str = "imperial",
) -> dict:
    lat = float(location["lat"])
    lon = float(location["lon"])

    requirement = resolve_requirements([crop])[0]["requirement"]
    requested = (crop.get("name") or crop.get("scientificName") or "").strip()
    if requirement is None:
        raise PlantingError(
            f"'{requested or 'That crop'}' is not in the FAO ECOCROP database, "
            "so no temperature requirement is available."
        )

    temp_range = requirement.get("tempOptimalC")
    if not temp_range or None in temp_range:
        raise PlantingError(
            f"ECOCROP has no optimal temperature range for {requirement['scientificName']}."
        )
    low_c, high_c = float(temp_range[0]), float(temp_range[1])
    rain_pair = requirement.get("rainOptimalMmYear")
    rain_low, rain_high = (
        (float(rain_pair[0]), float(rain_pair[1]))
        if rain_pair and None not in rain_pair
        else (None, None)
    )

    if span == NORMAL_SPAN:
        # Same 30-year climatology and rounding as Crop Finder, so both pages agree.
        years = []
        try:
            temp_tuple, rain_tuple = fetch_monthly_climate(round(lat, 2), round(lon, 2))
        except ClimateUnavailable as exc:
            raise PlantingError("NASA POWER climate data is unavailable right now. Please try again.") from exc
        temps_c, rains_mm = list(temp_tuple), list(rain_tuple)
        period = "30-year normal"
        baseline_label = "30-year normal"
        observed_source = CLIMATOLOGY_LABEL
    else:
        years = _baseline_years(span)
        temps_c, rains_mm = _monthly_normals(lat, lon, years)
        period = f"{years[0]}–{years[-1]} mean"
        baseline_label = f"{years[0]}–{years[-1]} avg"
        observed_source = "NASA POWER monthly normals (T2M, PRECTOTCORR)"

    flags: list[bool] = []
    months = []
    for index in range(12):
        temp_c = temps_c[index]
        rain_mm = rains_mm[index]
        suitable = temp_c is not None and low_c <= temp_c <= high_c
        flags.append(suitable)
        temp_f = c_to_f(temp_c) if temp_c is not None else None
        months.append(
            {
                "index": index,
                "month": MONTHS[index],
                "tempSuitable": suitable,
                "tempDisplay": format_temp(temp_f, units),
                "rainDisplay": format_rain(
                    rain_mm / 25.4 if rain_mm is not None else None, units
                ),
                "temp": _temp_value(temp_f, units) if temp_f is not None else None,
                "rain": _rain_value(rain_mm, units) if rain_mm is not None else None,
            }
        )

    length, start, end = _longest_run(flags)
    window_indices = list(range(start, end + 1)) if length and start is not None else []
    for month in months:
        month["inWindow"] = month["index"] in window_indices

    suitable_count = sum(1 for flag in flags if flag)
    label = _window_label(start, end)

    annual_mm = (
        sum(value for value in rains_mm if value is not None)
        if any(value is not None for value in rains_mm)
        else None
    )
    annual_in = annual_mm / 25.4 if annual_mm is not None else None
    rain_ok = (
        None
        if annual_in is None or rain_low is None or rain_high is None
        else rain_low <= annual_mm <= rain_high
    )

    # Ranges repeat the unit once, not on both ends.
    if units == "metric":
        temp_display = f"{low_c:.0f}–{high_c:.0f}°C"
    else:
        temp_display = f"{c_to_f(low_c):.0f}–{c_to_f(high_c):.0f}°F"
    if rain_low is None:
        rain_display = "unavailable"
    elif units == "metric":
        rain_display = f"{rain_low:.0f}–{rain_high:.0f} mm"
    else:
        rain_display = f"{rain_low / 25.4:.1f}–{rain_high / 25.4:.1f} in"

    if suitable_count == 0:
        verdict = "No month matches the crop's temperature range"
    elif rain_ok is False:
        verdict = "Temperature window found, rainfall outside the optimal range"
    elif rain_ok is True:
        verdict = "Window matches the crop's temperature and rainfall range"
    else:
        verdict = "Temperature window found, rainfall range unavailable"

    summary = (
        f"{suitable_count} of 12 months have a {period} temperature "
        f"inside ECOCROP's optimal {temp_display} range for "
        f"{requirement['scientificName']}."
    )

    rain_summary = (
        "No annual rainfall total could be computed for this location."
        if annual_in is None
        else (
            f"Annual rainfall averages {format_rain(annual_in, units)}, "
            + (
                "outside ECOCROP's "
                if rain_ok is False
                else ("inside ECOCROP's " if rain_ok else "against ECOCROP's ")
            )
            + f"{rain_display} annual range."
        )
    )

    notes = [
        summary,
        (
            f"Longest unbroken run of suitable months: {label}."
            if length
            else "No two suitable months are adjacent, so no planting window is claimed."
        ),
        rain_summary,
        "Months are monthly climate normals, not a forecast. Field readiness also depends "
        "on soil temperature, moisture, variety and local extension advice.",
    ]

    if units == "metric":
        temp_unit, rain_unit = "°C", "mm"
    else:
        temp_unit, rain_unit = "°F", "in"

    return {
        "generatedAt": date.today().isoformat(),
        "location": {"label": location.get("label", ""), "lat": lat, "lon": lon},
        "units": units,
        "crop": {
            "name": requested or requirement["name"],
            "scientificName": requirement["scientificName"],
            "lifeForm": requirement.get("lifeForm"),
            "tempOptimal": temp_display,
            "rainOptimal": rain_display,
        },
        "baseline": {
            "years": years,
            "label": baseline_label,
            "monthsAvailable": sum(1 for value in temps_c if value is not None),
        },
        "window": {
            "start": start,
            "end": end,
            "label": label,
            "months": window_indices,
            "monthNames": _month_names(window_indices),
        },
        "suitability": {
            "suitableMonths": suitable_count,
            "verdict": verdict,
            "summary": summary,
        },
        "rainfall": {
            "annual": format_rain(annual_in, units),
            "annualValue": _rain_value(annual_mm, units) if annual_mm is not None else None,
            "withinOptimal": rain_ok,
            "summary": rain_summary,
        },
        "months": months,
        "charts": {
            "temperature": [
                {
                    "month": month["month"],
                    "value": month["temp"],
                    "optimalLow": _temp_value(c_to_f(low_c), units),
                    "optimalHigh": _temp_value(c_to_f(high_c), units),
                }
                for month in months
            ],
            "rainfall": [
                {"month": month["month"], "value": month["rain"]} for month in months
            ],
            "tempUnit": temp_unit,
            "rainUnit": rain_unit,
        },
        "notes": notes,
        "sources": {
            "observed": observed_source,
            "requirements": "FAO ECOCROP database",
            "geocoding": "OpenStreetMap Nominatim",
        },
    }
