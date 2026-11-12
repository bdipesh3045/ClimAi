"""Season plan: the tasks one farm needs for one crop, built from the crop scorer's output.

Every task explains itself with numbers the scorer returned for this land; nothing is invented.
Dates are month based: a task is due in a month (0-11) or at any time (None).
"""
from datetime import date

MONTHS = ["January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"]
FULL_MARK = 0.999
LB_PER_TON = 2000
MM_PER_INCH = 25.4
FACTOR_LABELS = {"warmth": "warmth", "water": "water", "soil type": "soil type", "soil acidity": "soil pH"}
# Crop names on the farm profile -> names the scorer uses.
CROP_ALIASES = {"corn": "Maize", "soybeans": "Soybean", "sweet potatoes": "Sweet potato", "peanuts": "Groundnut (peanut)"}
GROUP_TITLES = {"now": "Do now", "soon": "Next 3 months", "later": "Later in the year"}


def inches(mm):
    return round(mm / MM_PER_INCH)


def fahrenheit(celsius):
    return round(celsius * 9 / 5 + 32)


def weight(pounds):
    if pounds < LB_PER_TON:
        return f"{round(pounds):,} lb"
    tons = pounds / LB_PER_TON
    return f"{tons:.1f} tons" if tons < 10 else f"{round(tons):,} tons"


def factor_label(name):
    return FACTOR_LABELS.get(name, name)


def all_checks_pass(rec):
    return all(value >= FULL_MARK for value in rec["factors"].values())


def month_index(name):
    return MONTHS.index(name) if name in MONTHS else -1


def shift(month, by):
    return (month + by) % 12


def months_until(month, today):
    return (month - (today.month - 1)) % 12


def season_months(rec):
    """12 booleans: True for months between planting and harvest. Year-round crops are all True."""
    plant, harvest = month_index(rec["plant_month"]), month_index(rec["harvest_month"])
    if plant < 0 or harvest < 0:
        return [True] * 12
    if plant <= harvest:
        return [plant <= m <= harvest for m in range(12)]
    return [m >= plant or m <= harvest for m in range(12)]


def match_current_crops(names, recs):
    """Pair each crop on the profile with its scored result (None when the scorer has no such crop)."""
    by_name = {rec["crop"].lower(): rec for rec in recs}
    matched = []
    for name in names:
        if name.lower() == "other":
            continue
        target = CROP_ALIASES.get(name.lower(), name).lower()
        matched.append({"name": name, "rec": by_name.get(target)})
    return matched


def default_focus(current, recs):
    grown = [c["rec"] for c in current if c["rec"]]
    if grown:
        return max(grown, key=lambda rec: rec["score"])
    return recs[0] if recs else None


def _key(name):
    return "".join(ch if ch.isalnum() else "-" for ch in name.lower()).strip("-")


def build_tasks(focus, farm, current, top):
    """Ordered task list for one crop on this farm. farm = {"acres", "soil_type", "irrigated"}."""
    k = _key(focus["crop"])
    crop = focus["crop"]
    plant, harvest = month_index(focus["plant_month"]), month_index(focus["harvest_month"])
    seasonal = plant >= 0 and harvest >= 0

    def before(months):
        return shift(plant, -months) if seasonal else None

    tasks = []

    def add(task_id, title, why, category, priority, due, link=None):
        tasks.append({"id": f"{k}:{task_id}", "title": title, "why": why, "category": category,
                      "priority": priority, "dueMonth": due, "link": link})

    # Soil
    if "soil pH" in focus["missing"]:
        add("soil-test", "Get a soil test",
            f"Soil pH is not known, so {crop}'s match uses {len(focus['factors'])} of 4 checks. "
            f"It does best at pH {focus['needs']['ph'][0]}–{focus['needs']['ph'][1]}.",
            "Soil", "High", before(2), {"href": "/profile", "label": "Update farm profile"})
    if "soil type" in focus["missing"]:
        add("soil-type", "Identify your soil texture",
            f"{crop} prefers {', '.join(focus['needs']['soil_types'])} soil. Add your soil type to score this check.",
            "Soil", "Medium", before(2), {"href": "/profile", "label": "Add soil type"})
    elif focus["factors"].get("soil type", 1) < FULL_MARK and farm["soil_type"]:
        add("soil-amend", "Improve soil structure before planting",
            f"Your {farm['soil_type']} soil is a weaker match; {crop} prefers "
            f"{', '.join(focus['needs']['soil_types'])}. Organic matter and raised beds can help.",
            "Soil", "Medium", before(2))

    # Water
    rain_low, rain_high = focus["needs"]["rain_mm"]
    if focus["dry_season"] and not farm["irrigated"]:
        add("dry-season", "Plan water for the dry stretch",
            f"Only about {inches(focus['season_rain_mm'])} in of rain falls during {crop}'s growing season. "
            "Without irrigation, expect dry spells.",
            "Water", "High", before(1))
    elif focus["yearly_rain_mm"] < rain_low and not farm["irrigated"]:
        add("too-dry", "Secure extra water",
            f"About {inches(focus['yearly_rain_mm'])} in of rain falls in a year; {crop} needs at least {inches(rain_low)} in.",
            "Water", "High", before(1))
    if focus["yearly_rain_mm"] > rain_high:
        add("drainage", "Check field drainage",
            f"About {inches(focus['yearly_rain_mm'])} in of rain a year is above {crop}'s {inches(rain_high)} in limit. "
            "Walk the field after rain and note where water stands.",
            "Water", "Medium", before(2))

    # Warmth
    if focus["factors"].get("warmth", 1) < FULL_MARK:
        cool = focus["season_temp_c"] < focus["needs"]["temp_c"][0]
        add("variety", "Choose a cold-tolerant variety" if cool else "Choose a heat-tolerant variety",
            f"The growing season averages about {fahrenheit(focus['season_temp_c'])}°F; {crop} grows best at "
            f"{fahrenheit(focus['needs']['temp_c'][0])}–{fahrenheit(focus['needs']['temp_c'][1])}°F.",
            "Crop", "Medium", before(2))

    # Season timeline
    if seasonal:
        name = crop.lower()
        add("seed", f"Order {name} seed",
            f"Planting opens around {MONTHS[plant]}. Order a variety suited to your area before then.",
            "Timing", "Medium", before(1))
        add("prepare", "Prepare the fields", f"Get beds ready the month before planting in {MONTHS[plant]}.",
            "Timing", "Medium", before(1))
        add("plant", f"Plant {name}",
            f"{MONTHS[plant]} starts the best-fitting {focus['season_days']}-day window for this location.",
            "Timing", "High", plant, {"href": "/planting-weather", "label": "Check the planting window"})
        add("scout", "Scout for pests and disease",
            "Mid-season is when problems are easiest to catch. Walk each field and write down what you see in Field notes.",
            "Crop", "Medium", shift(plant, max(1, round(focus["season_days"] / 60))))
        if focus["harvest_lb_total"] is not None and farm["acres"]:
            harvest_why = (f"Ready around {MONTHS[harvest]}. Expect about {weight(focus['harvest_lb_total'])} "
                           f"of {focus['harvest_what']} on {round(farm['acres'], 1):g} acres.")
        else:
            harvest_why = f"Ready around {MONTHS[harvest]}, about {focus['season_days']} days after planting."
        add("harvest", f"Harvest {name}", harvest_why, "Timing", "High", harvest)
        add("records", "Record planting dates and yield",
            "Your own records make next season's comparison sharper than any average.",
            "Advice", "Low", harvest, {"href": "/season-comparison", "label": "Compare seasons"})
    else:
        add("year-round", f"Plan continuous care for {crop.lower()}",
            f"{crop} grows year-round here once established, so there is no single planting month.",
            "Timing", "Medium", None)

    # Crops already grown that fit poorly
    for item in current:
        rec = item["rec"]
        if not rec or rec["crop"] == crop or rec["level"] not in ("Possible with care", "Not recommended"):
            continue
        weakest = round(rec["factors"].get(rec["main_limit"], 0) * 100)
        alternative = f" The top match for this land is {top['crop']} ({top['score']}/100)." if top and top["crop"] != rec["crop"] else ""
        tasks.append({
            "id": f"{_key(rec['crop'])}:reconsider",
            "title": f"Reconsider {item['name'].lower()}",
            "why": f"It scores {rec['score']}/100 here; its weakest point is {factor_label(rec['main_limit'])} "
                   f"({weakest}% match).{alternative}",
            "category": "Crop", "priority": "Medium", "dueMonth": None,
            "link": {"href": "/crop-finder/results", "label": "See crop results"},
        })

    add("extension", "Review the plan with your extension office",
        "Local experts know varieties, pests and markets this plan cannot see.", "Advice", "Low", None)
    return tasks


def schedule(task, today):
    """Add when the task is due relative to today: months away, a group and a label."""
    due = task["dueMonth"]
    if due is None:
        away, group, label = None, "now", "Any time"
    else:
        away = months_until(due, today)
        group = "now" if away == 0 else "soon" if away <= 3 else "later"
        label = ("This month" if away == 0 else f"Next month · {MONTHS[due]}" if away == 1
                 else f"{MONTHS[due]} · in {away} months")
    return {**task, "monthsAway": away, "group": group, "dueLabel": label}


def build_plan(recs, farm, profile_crops, focus_name=None, done_ids=frozenset(), today=None):
    """The full plan payload for the page. Returns None when there is no crop to plan for."""
    today = today or date.today()
    current = match_current_crops(profile_crops, recs)
    grown_names = {c["rec"]["crop"] for c in current if c["rec"]}

    options = []
    for rec in [c["rec"] for c in current] + recs[:4]:
        if rec and rec not in options:
            options.append(rec)
    focus = next((rec for rec in options if rec["crop"] == focus_name), None) or default_focus(current, recs)
    if focus is None:
        return None

    top = recs[0] if recs else None
    tasks = [schedule(task, today) for task in build_tasks(focus, farm, current, top)]
    for task in tasks:
        task["done"] = task["id"] in done_ids
    # Soonest first; within a month, higher priority first; "any time" tasks after dated ones due now.
    rank = {"High": 0, "Medium": 1, "Low": 2}
    tasks.sort(key=lambda t: (t["monthsAway"] or 0, t["monthsAway"] is None, rank[t["priority"]]))
    plant = month_index(focus["plant_month"])

    return {
        "today": {"month": today.month - 1, "monthName": MONTHS[today.month - 1]},
        "focus": {
            "crop": focus["crop"],
            "category": focus["category"],
            "level": focus["level"],
            "score": focus["score"],
            "grown": focus["crop"] in grown_names,
            "plantMonth": focus["plant_month"],
            "harvestMonth": focus["harvest_month"],
            "monthsToPlanting": months_until(plant, today) if plant >= 0 else None,
            "seasonDays": focus["season_days"],
            "seasonMonths": season_months(focus),
            "allChecksPass": all_checks_pass(focus),
            "weakestPoint": factor_label(focus["main_limit"]),
            "weakestPercent": round(focus["factors"].get(focus["main_limit"], 0) * 100),
        },
        "options": [{"crop": r["crop"], "score": r["score"], "level": r["level"], "grown": r["crop"] in grown_names}
                    for r in options],
        "currentCrops": [
            {"name": c["name"], "crop": c["rec"]["crop"] if c["rec"] else None,
             "score": c["rec"]["score"] if c["rec"] else None, "level": c["rec"]["level"] if c["rec"] else None,
             "allChecksPass": all_checks_pass(c["rec"]) if c["rec"] else None,
             "weakestPoint": factor_label(c["rec"]["main_limit"]) if c["rec"] else None}
            for c in current
        ],
        "topMatch": {"crop": top["crop"], "score": top["score"]} if top else None,
        "groups": [{"id": gid, "title": title} for gid, title in GROUP_TITLES.items()],
        "tasks": tasks,
        "progress": {"done": sum(t["done"] for t in tasks), "total": len(tasks)},
    }
