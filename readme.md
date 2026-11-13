# ClimateCrop AI

ClimateCrop AI turns public climate and crop records into planting decisions. A farmer saves their farm once (location, size, soil, irrigation, crops), and the app answers four questions for that exact place:

- **Which crops fit this land?** All 30 crops are scored against the NASA 30-year climate and FAO ECOCROP crop ranges.
- **What changed since last season?** A past season's observed weather is set against the coming seasonal outlook.
- **When should this crop go in the ground?** A month-by-month planting window comes from climate normals.
- **What do I do next?** A season plan of dated tasks, built from the farm's own data, with progress and field notes saved to the account.

Every number shown is either sourced real data or clearly labelled as a sample. A page-by-page guide to what each screen calls is in [`docs/pages.md`](docs/pages.md).

## Features

| Page | What it does | Data |
|---|---|---|
| Crop Finder and Crop Results | Ranks 30 crops for the farm. Shows the top crop's season, expected harvest, and how it fits on warmth, water and soil, plus the full ranked table and the land's climate. | NASA POWER 30-year climatology, FAO ECOCROP, `crops.json` |
| Season Comparison | Compares a past season (or a 3- or 5-year average) with the Open-Meteo seasonal outlook over the farmer's growing window. Shows climate risks, a verdict for each crop (Continue, Monitor, Reconsider) and next steps. | NASA POWER monthly and daily, Open-Meteo seasonal (ECMWF SEAS5), FAO ECOCROP |
| Planting & Weather | Finds the months whose mean temperature is inside a crop's ECOCROP optimum, and the longest unbroken window. Charts how far each month sits from the optimum, plus rain during the window. | NASA POWER (30-year normal by default, or the last 1, 3 or 5 years), FAO ECOCROP |
| Improvement Plan | Builds a season plan on the server from the saved profile: soil, water, variety and timing tasks with due months, plus field notes. | Farm profile, NASA POWER 30-year climatology, crop scorer |
| Crop Journeys | Follows one crop (any of the 30) from sowing to harvest: a timeline of everything done to it, its stage and progress, and a **crop expert**. The expert gives field alerts from rules on the real forecast (frost, heat, heavy rain, dry spell, overdue steps), plus a stage-by-stage playbook and a reaction to each entry written by Gemini from this field's real data. Each journey shows an **expected harvest** from the Crop Finder scorer for that crop on that field. Journeys, entries and ticked steps are saved per account. The plant-health check still runs on labelled mock data until its image model is connected. | SQLite (`journeys.py`), Gemini (`services/expert.py`), Open-Meteo, NASA POWER, FAO ECOCROP; mock data (`clim_frontend/lib/journeys-mock.ts`) |
| AI Assistant | Answers farming questions in plain language using the farmer's profile as context. It also opens as a side panel on each crop journey, where it knows that crop's stage, timeline, expert steps and field alerts. | Google Gemini (server-side) |
| Overview | Location search with a satellite map, live conditions, the 30-year climate normal, active weather alerts (US only), and the next tasks from the season plan. | OpenStreetMap Nominatim, Open-Meteo forecast, US National Weather Service, NASA POWER, season plan |
| Farm Profile, sign-up and sign-in | Farmer accounts and the saved farm details every tool starts from. | SQLite, OpenStreetMap Nominatim (location picker, called from the browser) |

## How the scoring works

ClimateCrop AI's scores and alerts are rule-based and transparent. There is no trained machine-learning model. Generative AI (Gemini) is used only to write advice text, from facts the app supplies, and that text is checked before it is shown (see the crop expert below).

- **Crop score** (`clim_backend/crop_suitability.py`): each crop gets a 0 to 1 score for warmth, water, and soil pH and type when known. The score is 1 inside the crop's ideal range and slides to 0 at its survival limit. The overall score is `60% × weakest factor + 40% × average`, because a crop is only as strong as its weakest need. The levels are Great fit (80+), Good fit (60+), Possible with care (40+) and Not recommended. The best planting month is found by trying every start month. Expected harvest is the crop's typical good-year yield × the score.
- **Crop ranges**: temperature, rainfall and pH ranges come from **FAO ECOCROP**, matched by scientific name. This is the same database the season and planting tools use, so every page agrees. `crops.json` adds the season length, soil textures and typical yield, which are approximate prototype values.
- **Season risks** (`services/season.py`): fixed thresholds. A hot month has a mean above 86°F, an extreme day goes above 95°F, a dry month gets under 1 in of rain, a very wet month gets over 8 in, and waterlogging means consecutive months above 6 in. The thresholds are returned with every rating.
- **Crop expert** (`services/expert.py`, `services/expert_alerts.py`):
  - **Alerts are rules, never AI:** frost (forecast low ≤ 0 °C for a frost-tender crop), heat (forecast high above the ECOCROP maximum), heavy rain (≥ 50 mm in 3 days), dry spell (< 5 mm in 10 days, no watering logged, not irrigated), and steps still open late in a stage.
  - **The playbook is AI text in a fixed format:** Gemini gets a fact sheet (journey, timeline, profile, ECOCROP limits, NASA 30-year normal, the past 10 days of rain, the 7-day forecast) and must answer in a JSON schema.
  - **The answer is rejected if it gives a product dose or rate, or uses a number above 10 that isn't in the facts.** It is retried once, then the general playbook is used instead.
  - The playbook is stored per journey so it doesn't change on every refresh.
- **Season plan** (`services/season_plan.py`): each task is triggered by the analysis. For example, a soil test is added when pH is unknown, a water plan when the crop's season is dry and the farm isn't irrigated, and drainage checks when rain exceeds the crop's range. Each task states the numbers that triggered it.

## Data sources

- [NASA POWER](https://power.larc.nasa.gov/): 30-year monthly climatology, plus monthly and daily observations.
- [Open-Meteo Seasonal Forecast API](https://open-meteo.com/en/docs/seasonal-forecast-api): ECMWF SEAS5 ensemble-mean outlook.
- [FAO ECOCROP](https://github.com/OpenCLIM/ecocrop): crop temperature, rainfall and pH ranges for 2,568 species. Downloaded once and saved to `clim_backend/data/ecocrop.csv`.
- [Open-Meteo Forecast API](https://open-meteo.com/en/docs): current temperature, conditions and the last 24 hours of rain.
- [US National Weather Service](https://www.weather.gov/documentation/services-web-api): active weather alerts for US locations.
- [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/): place search.
- [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9): satellite maps, with OpenStreetMap as the street layer.

## Technologies

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Recharts, Leaflet, Vercel AI SDK (Gemini for the assistant).
- **Backend:** Python, Flask 3, flask-cors, SQLite, `google-genai` (Gemini for the crop expert). The standard library does the rest; there is no pandas or scikit-learn.
- **Design:** the "Seed Packet" system, documented in [`DESIGN.md`](DESIGN.md), with product notes in [`PRODUCT.md`](PRODUCT.md).

## Project structure

```text
climAi/
├── clim_backend/                 Flask API (port 5001)
│   ├── app.py                    App setup, CORS, crop analysis, search, season and planting routes
│   ├── accounts.py               Sign up, sign in, farm profile
│   ├── plan.py                   Season plan, task progress, field notes
│   ├── db.py                     SQLite schema and connection
│   ├── validation.py             Shared input checks
│   ├── crop_suitability.py       Crop scoring rules
│   ├── crops.json                30 crops (scientific name, season, soils, yield)
│   ├── services/
│   │   ├── climate.py            NASA POWER 30-year climatology (shared)
│   │   ├── crops.py              FAO ECOCROP catalog, search and ranges
│   │   ├── season.py             Season comparison, geocoding, NASA and Open-Meteo
│   │   ├── planting.py           Planting window
│   │   ├── weather.py            Overview: live conditions, NWS alerts, climate normal
│   │   └── season_plan.py        Season plan tasks
│   ├── data/ecocrop.csv          Cached ECOCROP database
│   ├── journeys.py           Crop journeys, entries, expert steps and the crop expert routes (signed-in)
│   ├── services/expert.py         Crop expert: fact sheet, Gemini playbook and reactions, checks, fallback
│   ├── services/expert_alerts.py  Crop expert field alerts (rules on the forecast)
│   └── test_app.py, test_accounts.py, test_plan.py, test_weather.py, test_journeys.py, test_expert.py, test_expert_alerts.py
├── clim_frontend/                Next.js app (port 3000)
│   ├── app/                      Pages and the assistant API route
│   ├── components/               Page components and the shared UI kit
│   └── lib/                      API client, response parsers, helpers
├── docs/                         Page guide and feature plans
├── DESIGN.md                     Design system
└── PRODUCT.md                    Product context
```

## Running locally

### Prerequisites

- Python 3.10+
- Node.js 22+ with pnpm (the repo uses `pnpm-lock.yaml`)

### 1. Backend

```bash
cd clim_backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Once: create a secret key file (git-ignored)
echo "CLIMAI_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_hex(32))')" > .env

# Every time
set -a; source .env; set +a
python app.py
```

The API runs at `http://127.0.0.1:5001`. Port 5000 is avoided because macOS AirPlay uses it.

`CLIMAI_SECRET_KEY` signs the sign-in cookie, and the backend refuses to start without one of at least 32 characters. Accounts, profiles, plan progress and field notes are stored in `clim_backend/climai.db`, which is created on first use. Set `CLIMAI_DB_PATH` to store it elsewhere. Add `GOOGLE_GENERATIVE_AI_API_KEY` to `clim_backend/.env` for the crop expert. Without it, journeys show the general playbook and the rule-based alerts still work. `GEMINI_MODEL` optionally overrides the model (default `gemini-3.5-flash-lite`). Start with `python app.py` rather than `flask run`, because only `python app.py` turns off the `Secure` cookie flag for the plain-http dev server (Safari drops the cookie otherwise).

### 2. Frontend

```bash
cd clim_frontend
cp .env.example .env.local   # then fill in the values below
pnpm install
pnpm dev
```

The app runs at `http://localhost:3000`.

| Variable | Used for |
|---|---|
| `NEXT_PUBLIC_CROP_ANALYSIS_API_URL` | Crop Finder posts here, normally `http://127.0.0.1:5001/api/crop-analysis` |
| `NEXT_PUBLIC_API_BASE_URL` | Optional base for the search, season, planting and weather routes (default `http://127.0.0.1:5001`) |
| `BACKEND_URL` | Server-side target of the `/backend/*` proxy for account, plan and notes routes (default `http://127.0.0.1:5001`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | AI Assistant (Gemini). Server-side only |
| `GEMINI_MODEL` | Optional assistant model override |

Restart the frontend after changing environment variables.

### 3. Tests

```bash
cd clim_backend
python -m unittest              # all backend tests
python crop_suitability.py      # scorer self-check

cd ../clim_frontend
pnpm test                       # frontend unit tests
```

## Deploying a demo

The demo setup is free and needs no servers to manage:

- The **frontend** runs on Vercel.
- The **backend** runs on Render.
- **GitHub Actions** (`.github/workflows/ci.yml`) runs the backend tests and the frontend type check, tests and build on every push and pull request.

Both hosts deploy automatically when you push to `main`, and Render waits for CI to pass first.

```
git push ──> GitHub Actions (tests + build)
         ├─> Render: Flask API   (deploys after checks pass)
         └─> Vercel: Next.js app (builds and deploys on every push)
```

### 1. Backend on Render (once)

1. Sign in to [render.com](https://render.com) with GitHub.
2. Choose **New > Blueprint**, then pick this repository. Render reads `render.yaml`, which sets up a free Python web service with a generated `CLIMAI_SECRET_KEY`. It asks for `GOOGLE_GENERATIVE_AI_API_KEY` (your Gemini key, for the crop expert).
3. When it is live, open `https://<your-service>.onrender.com/api/health`. It should say `healthy`. Copy this URL for the next step.

### 2. Frontend on Vercel (once)

1. Sign in to [vercel.com](https://vercel.com) with GitHub and import this repository.
2. Set **Root Directory** to `clim_frontend`. The framework (Next.js) is detected automatically.
3. Add these environment variables, replacing `<api>` with the Render URL from step 1:

| Variable | Value |
|---|---|
| `BACKEND_URL` | `<api>` |
| `NEXT_PUBLIC_API_BASE_URL` | `<api>` |
| `NEXT_PUBLIC_CROP_ANALYSIS_API_URL` | `<api>/api/crop-analysis` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Your Gemini key (only needed for the AI Assistant) |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1`, so Vercel uses the pnpm version pinned in `package.json` |

4. Deploy. Every later push to `main` redeploys, and pull requests get their own preview links.

### Demo limits (fine for showing the project, not for real users)

- **Render's free plan sleeps after 15 minutes without traffic.** The first request after that takes about a minute, so open the site a minute before you present.
- **The SQLite database is wiped whenever Render redeploys or restarts the service.** Accounts, profiles, plan ticks and notes then disappear, so sign up again after a deploy. For data that lasts, add a Render disk (paid) and set `CLIMAI_DB_PATH` to a path on it.

## API reference

All errors come back as `{"error": "..."}` with plain, user-safe messages. Technical details are only written to the server log.

### Routes the browser calls directly (CORS-allowed)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Status and crop catalog source |
| POST | `/api/crop-analysis` | Score all crops for a farm (Crop Finder) |
| GET | `/api/locations/search?q=` | Place search, up to 5 results |
| GET | `/api/crops/search?q=&limit=` | Search the FAO ECOCROP catalog |
| POST | `/api/season/compare` | Season comparison |
| POST | `/api/planting/plan` | Planting window. `baselineSpan` is `30` (30-year normal) or `1`, `3`, `5` years |
| POST | `/api/harvest-estimate` | Expected harvest for one crop on one field: the Crop Finder body (`coordinates`, `soilType`, `farm`, `irrigation`) plus `crop`, returns `{score, level, mainLimit, lbPerAcre, lbTotal, what, acres}` (`lbPerAcre` is null below a score of 40) |
| GET | `/api/weather/overview?lat=&lon=` | Overview: `current`, `alerts` and `normal`, each `{data}` or `{error}` so one failure doesn't hide the rest. `alerts.data` is `null` outside the US |

A new browser-called route must be added to the CORS list in `app.py`.

### Routes behind the `/backend` proxy (signed-in, same-origin cookie)

The browser calls `/backend/*` on the Next.js site, and `next.config.mjs` forwards those calls to Flask at `BACKEND_URL`. This keeps the sign-in cookie first-party, so these routes need no CORS.

| Method | Path | Body | Success |
|---|---|---|---|
| POST | `/api/auth/signup` | `{"email", "password"}` | `201 {"user", "profile": null}`, signs in |
| POST | `/api/auth/login` | `{"email", "password"}` | `200 {"user", "profile"}`, signs in |
| POST | `/api/auth/logout` | none | `204` |
| GET | `/api/auth/me` | none | `200 {"user", "profile"}` |
| PUT | `/api/profile` | profile fields | `200 {"profile"}` |
| GET | `/api/plan?crop=` | none | `200` season plan for the saved profile (`409` with `code: "profile_required"` without a profile) |
| PUT | `/api/plan/tasks/<task_id>` | `{"done": true}` | `200 {"id", "done"}` |
| GET | `/api/notes` | none | `200 {"notes": [...]}`, newest first |
| POST | `/api/notes` | `{"crop", "date", "challenge", "notes"}` | `201 {"note"}` |
| DELETE | `/api/notes/<id>` | none | `204` (`404` for another farmer's note) |
| GET | `/api/journeys/crops` | none | `200 {"crops": [{"name", "category", "seasonDays"}]}`, the 30 crops in `crops.json` |
| GET | `/api/journeys` | none | `200 {"journeys": [...]}`, newest first, each with `entries` and `doneSteps` |
| POST | `/api/journeys` | `{"crop" (any name from /api/journeys/crops), "sownOn", "location"}` | `201 {"journey"}`, with its sowing entry |
| POST | `/api/journeys/<id>/entries` | `{"date", "type", "details"}` | `201 {"entry"}` (`404` for another farmer's journey) |
| PUT | `/api/journeys/<id>/steps/<step_id>` | `{"done": true}` | `200 {"id", "done"}` |
| GET | `/api/journeys/<id>/expert` | none | `200 {source: "ai" or "general", model, generatedAt, day, stage, stages, alerts, reaction, basedOn, warnings}`; the playbook is stored after the first AI answer |
| POST | `/api/journeys/<id>/expert/refresh` | none | Same shape; rewrites the playbook (5 per farmer per hour, then `429`) |

Passwords must be 8 to 128 characters and are stored as scrypt hashes. Sign-in returns `429` after 10 failed attempts for one email within 15 minutes; that count is kept in memory and resets when the backend restarts.

### Crop analysis request

```json
{
  "location": "Monroe, Ouachita Parish, Louisiana, United States",
  "coordinates": { "lat": 32.5093, "lon": -92.1193 },
  "farm": { "size": 40, "sizeUnit": "acres", "fieldCount": 2 },
  "soilType": "Loam",
  "currentCrops": ["Soybeans", "Rice"],
  "irrigation": { "available": false, "method": null },
  "goals": ["Increase crop yield"],
  "challenges": ["Drought"],
  "plantingSeason": "Spring",
  "harvestHistory": { "previousCrop": "Rice", "notes": "" },
  "otherNotes": ""
}
```

Only `coordinates`, `farm`, `soilType` and `irrigation` affect the score. `soilType` is `null` when not selected.

### Crop analysis response (one entry per crop, best first)

```json
{
  "message": "Crop recommendations ready.",
  "location": "Monroe, Ouachita Parish, Louisiana, United States",
  "farm": { "acres": 40, "irrigated": false, "soil_type": "loam" },
  "climate": {
    "source": "NASA POWER 30-year monthly climatology",
    "monthly_temp_c": [7.0, 9.2, "... 12 values, January first"],
    "monthly_rain_mm": [122.1, 133.6, "... 12 values, January first"]
  },
  "recommendations": [
    {
      "crop": "Soybean",
      "scientific_name": "Glycine max",
      "emoji": "🫛",
      "category": "legume",
      "season_days": 120,
      "needs": {
        "temp_c": [20, 33], "temp_limit_c": [10, 38],
        "rain_mm": [600, 1500], "rain_limit_mm": [450, 1800],
        "ph": [5.5, 6.5], "soil_types": ["loam", "silt loam", "clay loam"]
      },
      "score": 100,
      "level": "Great fit",
      "main_limit": "warmth",
      "factors": { "soil type": 1.0, "warmth": 1.0, "water": 1.0 },
      "plant_month": "March",
      "harvest_month": "July",
      "season_temp_c": 20.7,
      "yearly_rain_mm": 1411,
      "season_rain_mm": 478,
      "dry_season": false,
      "harvest_lb_per_acre": 3000,
      "harvest_lb_total": 120000,
      "harvest_what": "beans",
      "missing": ["soil pH"]
    }
  ]
}
```

Harvest numbers are `null` for crops scoring under 40. `needs` holds the crop's ideal and survival ranges from FAO ECOCROP, in °C and mm. The Crop Finder page saves the response in `sessionStorage` and shows it on `/crop-finder/results`. Invalid input returns `400` and a failed climate lookup returns `502`.

### Farm profile body

```json
{
  "fullName": "Asha Patel",
  "phone": "+1 515 555 0100",
  "farmName": "Prairie Creek Farm",
  "location": "Des Moines, Polk County, Iowa, United States",
  "coordinates": { "lat": 41.6012, "lon": -93.6091 },
  "farm": { "size": 40, "sizeUnit": "acres" },
  "soilType": "Silt",
  "irrigation": { "available": true, "method": "Drip" },
  "currentCrops": ["Corn", "Soybeans"]
}
```

`phone`, `farmName` and `soilType` may be `null`. The response adds `updatedAt`.

## Known limits

- `crops.json` season lengths, soil textures and yields are approximate prototype values. Verify them before real agronomic use.
- No rate limit on external API calls yet (NASA, Nominatim). Add one before public deployment.
- The Overview's "Sample conditions" and "A season to plan for" panels are labelled demo data; no live weather feed is connected.
- `debug=True` and the relaxed cookie flag in `python app.py` are for local development only.

## Project information

- Project: ClimateCrop AI
- Event: TechXpo 2026
- Institution: University of Louisiana Monroe
- Field: Artificial Intelligence and Agriculture
