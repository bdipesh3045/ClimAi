# ClimateCrop AI

ClimateCrop AI turns public climate and crop records into planting decisions for one farm. A farmer saves their farm once (location, size, soil, irrigation, crops). From there the app finds which crops fit, when to plant, and what changed since last season. It then follows a crop from sowing to harvest with an expert at the farmer's side.

Every number comes from a named source. AI writes only advice text, from facts the app gives it, and that text is checked and labelled.

## Features

| Tool | What it does |
| --- | --- |
| **Crop Journeys** | Follows one crop (any of 30) from sowing to harvest: a timeline of everything done to it, with photos, its stage and progress, and an expected harvest. A **crop expert** gives field alerts from the real forecast (frost, heat, heavy rain, dry spells), a stage-by-stage plan with the reason for each step, and a reaction to every entry. Leaf photos can be checked for disease, and the AI Assistant opens beside the journey. |
| **Plant Health** | Checks a leaf photo for disease with Pl@ntNet (Gemini looks when Pl@ntNet is unsure) and gives this week's actions tied to the weather. Every result shows its probability. |
| **Crop Finder** | Ranks 30 crops for the farm against its 30-year climate, soil and water, with the reasons, best planting month and expected harvest. |
| **Season Comparison** | Sets a past season's observed weather against the seasonal outlook, flags climate risks and gives a verdict for each crop. |
| **Planting & Weather** | Finds the months a crop's optimum temperature is met, and the longest planting window. |
| **Improvement Plan** | A dated season plan built from the farm profile, with progress and field notes saved to the account. |
| **AI Assistant** | Plain-language answers from the farm profile, or from a crop journey when asked from one. |
| **Overview** | Live conditions, the 30-year climate normal, US weather alerts and the next season-plan tasks. |

## How it stays honest

- **Scores and alerts are rules, not AI.**
  - Crop fit: `60% × weakest factor + 40% × average` of warmth, water, soil type and pH.
  - Planting windows, season risks and journey alerts use fixed, stated thresholds.
  - Each result shows the numbers behind it.
- **AI only writes advice text** (crop expert, assistant, plant-health advice) from a fact sheet the app builds. The expert's answers must match a fixed format. They're rejected if they give a pesticide or fertilizer dose, or use a number not in the facts, and then the app falls back to general guidance. AI text is labelled.
- **Missing data is shown as missing**, never filled in.

## Data sources

| Source | Used for |
| --- | --- |
| [NASA POWER](https://power.larc.nasa.gov/) | 30-year climate normals, monthly and daily observations |
| [Open-Meteo](https://open-meteo.com/) | Current conditions, 7-day forecast, ECMWF SEAS5 seasonal outlook |
| [FAO ECOCROP](https://github.com/OpenCLIM/ecocrop) | Temperature, rain and pH ranges for 2,568 crop species (`clim_backend/data/ecocrop.csv`) |
| [Pl@ntNet](https://my.plantnet.org/) | Plant and disease identification from photos |
| [Google Gemini](https://ai.google.dev/) | Crop expert advice, assistant answers, plant-health advice |
| [US National Weather Service](https://www.weather.gov/documentation/services-web-api) | Active weather alerts (US only) |
| [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/), [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9) | Place search, satellite maps |

## Run it locally

You need Python 3.10+ and Node.js 22+ with pnpm.

**Backend** (Flask, port 5001):

```bash
cd clim_backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
echo "CLIMAI_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_hex(32))')" > .env
echo "GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-key" >> .env   # for the crop expert
set -a; source .env; set +a
python app.py
```

**Frontend** (Next.js, port 3000):

```bash
cd clim_frontend
cp .env.example .env.local   # then fill in the keys below
pnpm install
pnpm dev
```

| Variable | Where | Needed for |
| --- | --- | --- |
| `CLIMAI_SECRET_KEY` | backend | **Required.** Signs the sign-in cookie (32+ characters) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | backend and frontend | Crop expert (backend); AI Assistant and Plant Health (frontend). Get one at [aistudio.google.com](https://aistudio.google.com/apikey) |
| `PLANTNET_API_KEY` | frontend | Plant Health. Free at [my.plantnet.org](https://my.plantnet.org/); allow your server's IP in the key settings |
| `NEXT_PUBLIC_CROP_ANALYSIS_API_URL` | frontend | Crop Finder, normally `http://127.0.0.1:5001/api/crop-analysis` |
| `NEXT_PUBLIC_API_BASE_URL`, `BACKEND_URL` | frontend | Optional; both default to `http://127.0.0.1:5001` |
| `GEMINI_MODEL`, `CLIMAI_DB_PATH` | optional | Model override (default `gemini-3.5-flash-lite`); where to keep the SQLite database |

Without a Gemini key the crop expert falls back to general guidance, and its weather alerts still work. Start the backend with `python app.py` (not `flask run`) so the sign-in cookie works on plain http locally.

## Tests

```bash
cd clim_backend && python -m unittest && python crop_suitability.py
cd clim_frontend && pnpm test && pnpm build
```

GitHub Actions (`.github/workflows/ci.yml`) runs the same checks on every push and pull request.

## Deploy a demo

The frontend runs on **Vercel** and the backend on **Render**, both free and both deploying on every push to `main`. Render waits for CI to pass.

1. **Render:** New > Blueprint > pick this repo. `render.yaml` sets up the Flask service and generates `CLIMAI_SECRET_KEY`. Enter your Gemini key when asked. Check `https://<service>.onrender.com/api/health`.
2. **Vercel:** import the repo with Root Directory `clim_frontend`. Set:
   - `BACKEND_URL` and `NEXT_PUBLIC_API_BASE_URL` to the Render URL;
   - `NEXT_PUBLIC_CROP_ANALYSIS_API_URL` to `<render-url>/api/crop-analysis`;
   - `GOOGLE_GENERATIVE_AI_API_KEY` and `PLANTNET_API_KEY`;
   - `ENABLE_EXPERIMENTAL_COREPACK=1`.

Render's free plan sleeps after 15 idle minutes (the first request then takes about a minute), and its SQLite database resets on every redeploy.

## Project structure

```
clim_backend/                 Flask API (port 5001), SQLite
  app.py                      Crop analysis, search, season, planting, weather, harvest routes
  accounts.py, plan.py        Accounts and profile; season plan and field notes
  journeys.py                 Crop journeys, entries, photos and crop expert routes
  crop_suitability.py         Crop scoring rules; crops.json holds the 30 crops
  services/                   Climate, season, planting, weather, crop expert and its alert rules
  data/                       ECOCROP database, general expert playbook
  test_*.py                   Backend tests
clim_frontend/                Next.js app (port 3000)
  app/                        Pages, plus the assistant and plant-check API routes (keys stay server-side)
  components/                 Page components and the shared UI kit
  lib/                        API client, parsers and helpers, with *.test.mjs tests
```

The browser calls search, crop analysis, season, planting, weather and harvest routes on Flask directly. Account, profile, plan and journey routes go through the same-origin `/backend` proxy, so the sign-in cookie stays first-party. Each route's request and response shape is documented in its code and tests.

## Known limits

- `crops.json` season lengths, soil textures and yields are approximate prototype values; verify before real agronomic use.
- External APIs (NASA, Nominatim, Open-Meteo) aren't rate-limited by the backend yet.
- The two sample crop journeys and their playbook are demo data, labelled as such. "Next expected action" in a journey is a general rule of thumb.
- Rate limits and AI-failure memory live in each server's memory and reset on restart.

## Project information

- Project: ClimateCrop AI
- Event: TechXpo 2026
- Institution: University of Louisiana Monroe
- Field: Artificial Intelligence and Agriculture
