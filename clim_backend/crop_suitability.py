"""ClimateAI: crop suitability scoring in Python.

Same rules as crop-suitability.js, so the backend and the page give the same scores.
Reads crops.json from the same folder.

    from crop_suitability import recommend_crops
    results = recommend_crops(monthly_temp_c, monthly_rain_mm, ph=6.4, texture="silt loam", acres=40)
"""
import json
from pathlib import Path

CROPS = json.loads(Path(__file__).with_name("crops.json").read_text(encoding="utf-8"))["crops"]


def _use_ecocrop_ranges(crops):
    """Take temperature, rain and pH ranges from FAO ECOCROP, matched by scientific name, so
    Crop Finder scores with the same numbers the season and planting tools show. A crop keeps
    its crops.json ranges only if ECOCROP is unavailable or missing a value. Returns the source."""
    try:
        from services.crops import ecocrop_ranges
    except ImportError:  # run outside the backend folder
        return "crops.json"
    matched = 0
    for crop in crops:
        ranges = ecocrop_ranges(crop.get("scientific", ""))
        if ranges:
            crop.update(ranges)
            matched += 1
    return "FAO ECOCROP" if matched == len(crops) else f"FAO ECOCROP ({matched} of {len(crops)} crops)"


RANGES_SOURCE = _use_ecocrop_ranges(CROPS)
MONTHS = ["January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"]
WRONG_SOIL_TYPE_SCORE = 0.4


def range_score(value, best, limit):
    """1 inside the best range, sliding down to 0 at the survival limit."""
    if best[0] <= value <= best[1]:
        return 1.0
    if value < best[0]:
        return max(0.0, (value - limit[0]) / (best[0] - limit[0]))
    return max(0.0, (limit[1] - value) / (limit[1] - best[1]))


def best_growing_window(crop, temp, rain):
    """Try planting in each month. Keep the start with the best warmth, then the most rain."""
    months = min(12, max(1, round(crop["season_days"] / 30)))
    best = None
    for start in range(12):
        window = [(start + i) % 12 for i in range(months)]  # % 12 lets a season wrap past December
        season_temp = sum(temp[m] for m in window) / months
        season_rain = sum(rain[m] for m in window)
        key = (range_score(season_temp, crop["temp_opt"], crop["temp_abs"]), season_rain)
        if best is None or key > best[0]:
            best = (key, start, months, season_temp)
    (temp_score, season_rain), start, months, season_temp = best
    return start, months, season_temp, season_rain, temp_score


def recommend_crops(temp, rain, ph=None, texture=None, irrigated=False, acres=None):
    """Rank all crops for one piece of land, best first.

    temp:      12 monthly average temperatures in deg C, January first
    rain:      12 monthly rainfall totals in mm, January first
    ph:        soil pH, or None if unknown
    texture:   "sand", "sandy loam", "loam", "silt loam", "clay loam" or "clay", or None if unknown
    irrigated: True if the farmer can water the crop
    acres:     field size, or None to skip the total harvest
    """
    if len(temp) != 12 or len(rain) != 12:
        raise ValueError("temp and rain must each have 12 monthly values")

    yearly_rain = sum(rain)
    results = []
    for crop in CROPS:
        start, months, season_temp, season_rain, temp_score = best_growing_window(crop, temp, rain)

        water = range_score(yearly_rain, crop["rain_opt"], crop["rain_abs"])
        too_dry = yearly_rain < crop["rain_opt"][0]
        dry_season = months < 12 and season_rain < 0.4 * crop["rain_opt"][0]
        if irrigated and (too_dry or dry_season):
            water = 1.0  # irrigation covers a lack of rain
        elif dry_season:
            water = min(water, 0.5)

        factors = {"warmth": temp_score, "water": water}
        if ph is not None:
            factors["soil acidity"] = range_score(ph, crop["ph_opt"], crop["ph_abs"])
        if texture is not None:
            factors["soil type"] = 1.0 if texture in crop["soil_texture"] else WRONG_SOIL_TYPE_SCORE

        # A crop is only as strong as its weakest need, so the weakest score counts the most.
        scores = list(factors.values())
        overall = round(100 * (0.6 * min(scores) + 0.4 * sum(scores) / len(scores)))
        level = ("Great fit" if overall >= 80 else "Good fit" if overall >= 60
                 else "Possible with care" if overall >= 40 else "Not recommended")

        # Harvest: typical good yield, shrunk by the match score. No number for poor fits.
        lb_per_acre = None if overall < 40 else round(crop["yield_lb_acre"] * overall / 100)

        results.append({
            "crop": crop["name"],
            "scientific_name": crop.get("scientific"),
            "emoji": crop["emoji"],
            "category": crop["category"],
            "season_days": crop["season_days"],
            # What the crop wants, so the page can explain each check. Same units as crops.json.
            "needs": {
                "temp_c": crop["temp_opt"], "temp_limit_c": crop["temp_abs"],
                "rain_mm": crop["rain_opt"], "rain_limit_mm": crop["rain_abs"],
                "ph": crop["ph_opt"], "soil_types": crop["soil_texture"],
            },
            "score": overall,
            "level": level,
            "main_limit": min(factors, key=factors.get),
            "factors": {name: round(s, 2) for name, s in factors.items()},
            "plant_month": None if months == 12 else MONTHS[start],
            "harvest_month": None if months == 12 else MONTHS[(start + months) % 12],
            "season_temp_c": round(season_temp, 1),
            "yearly_rain_mm": round(yearly_rain),
            "season_rain_mm": round(season_rain),
            "dry_season": dry_season,
            "harvest_lb_per_acre": lb_per_acre,
            "harvest_lb_total": None if lb_per_acre is None or not acres else round(lb_per_acre * acres),
            "harvest_what": crop["yield_what"],
            "missing": [name for name, value in (("soil pH", ph), ("soil type", texture)) if value is None],
        })
    return sorted(results, key=lambda r: r["score"], reverse=True)


if __name__ == "__main__":
    # Example farm near Des Moines, Iowa. Same numbers as EXAMPLE_SITE in crop-suitability.js.
    temp = [-6, -3, 4, 11, 17, 22, 24, 23, 18, 11, 3, -4]
    rain = [25, 32, 55, 95, 125, 130, 115, 105, 80, 65, 50, 35]
    results = recommend_crops(temp, rain, ph=6.4, texture="silt loam", acres=40)
    by_name = {r["crop"]: r for r in results}

    # Self check: these must match what the JavaScript version gives.
    assert range_score(14, [18, 33], [10, 45]) == 0.5
    assert by_name["Maize"]["score"] == 100 and by_name["Maize"]["plant_month"] == "May"
    assert by_name["Potato"]["score"] == 93 and by_name["Rice"]["score"] == 30
    assert by_name["Rice"]["harvest_lb_per_acre"] is None
    assert recommend_crops(temp, rain, ph=6.4, texture="silt loam", irrigated=True)[1]["crop"] == "Rice"

    for r in results[:6]:
        print(f'{r["emoji"]} {r["crop"]:<12} {r["score"]:>3}  {r["level"]:<10} plant in {r["plant_month"]}, '
              f'about {r["harvest_lb_total"]:,} lb of {r["harvest_what"]} on 40 acres')
