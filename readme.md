# ClimateAI

ClimateAI is an AI-powered agricultural platform that helps farmers make better farming decisions using soil, weather, and climate data.

Farmers can search for their location, and ClimateAI analyzes the local environmental conditions to recommend suitable crops and provide useful farming insights.

## Features

### 1. Crop Recommendations

- Search for a farm location.
- Automatically retrieve soil and climate information.
- Recommend suitable crops based on local conditions.
- Explain why a crop is suitable.
- Identify possible climate and soil risks.

### 2. Last Season Comparison

- Compare weather conditions from previous growing seasons.
- Analyze temperature and rainfall changes.
- Record previous crops and harvest results.
- Identify possible reasons for changes in crop performance.

### 3. Improvement Plans

- Provide suggestions based on farm conditions.
- Identify possible soil and water problems.
- Recommend ways to improve farming practices.

### 4. Planting and Weather

- Show suitable planting periods.
- Provide local weather information.
- Highlight important weather conditions and risks.

### 5. AI Assistant

- Answer farming-related questions.
- Explain crop recommendations.
- Help farmers understand climate and soil conditions.

## Technologies Used

**Frontend**

- Next.js
- React
- TypeScript
- Tailwind CSS

**Backend**

- Python
- Flask
- Pandas
- Scikit-learn

**Machine Learning**

- Decision Tree Regression
- Crop yield prediction
- Crop suitability analysis

## Data Sources

- [USDA NRCS](https://websoilsurvey.nrcs.usda.gov/) - Soil information.
- [Open-Meteo](https://open-meteo.com/) - Weather data.
- [NASA POWER](https://power.larc.nasa.gov/) - Historical climate data.
- USDA and agricultural research publications - Crop information and growing requirements.

## Machine Learning

ClimateAI uses historical agricultural data to understand the relationship between climate conditions and crop yields.

The existing dataset contains approximately 28,242 records from 1990 to 2013.

It includes information such as:

- Temperature
- Rainfall
- Pesticide usage
- Crop type
- Historical crop yield

A Decision Tree Regression model is used for crop yield prediction.

Crop suitability analysis is developed separately using crop requirements, soil information, and climate conditions.

## Project Structure

```text
climateai/
├── frontend/
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   ├── services/
│   │   └── models/
│   ├── data/
│   ├── app.py
│   ├── model.py
│   └── requirements.txt
└── README.md
```

## Installation

### Prerequisites

- Python 3.10+
- Node.js
- npm
- Git

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd climateai
```

### 2. Run the Backend

```bash
cd clim_backend

python -m venv venv
source venv/bin/activate

pip install -r requirements.txt
export CLIMAI_SECRET_KEY=$(python -c 'import secrets; print(secrets.token_hex(32))')
python app.py
```

`CLIMAI_SECRET_KEY` signs the sign-in cookie, and the backend refuses to start without it (at least 32 characters). A new key on each start signs everyone out, which is fine locally. Keep one fixed key in a deployed environment. Accounts and profiles are stored in `clim_backend/climai.db`, created on first use. Set `CLIMAI_DB_PATH` to store them elsewhere. See `clim_backend/.env.example`.

Start the backend with `python app.py` rather than `flask run`. Only `python app.py` turns off the `Secure` cookie flag for the plain-http dev server, and some browsers, Safari among them, will not keep the sign-in cookie without that.

The Flask backend will run at:

`http://127.0.0.1:5001`

### 3. Run the Frontend

Open another terminal:

```bash
cd clim_frontend

npm install
npm run dev
```

The frontend will run at:

`http://localhost:3000`

### Crop Finder API

Set `NEXT_PUBLIC_CROP_ANALYSIS_API_URL` in `clim_frontend/.env.local` to `http://127.0.0.1:5001/api/crop-analysis` for local development. The Flask endpoint looks up the 30-year monthly climate for the coordinates from NASA POWER, scores every crop in `clim_backend/crops.json` with `crop_suitability.py`, and returns the crops ranked best first. The backend must allow requests from the frontend origin when hosted on a different port or domain.

The response looks like this (one entry per crop, best first):

```json
{
  "message": "Crop recommendations ready.",
  "location": "Monroe, Louisiana",
  "farm": {
    "acres": 24.5,
    "irrigated": false,
    "soil_type": "loam"
  },
  "climate": {
    "source": "NASA POWER 30-year monthly climatology",
    "monthly_temp_c": [7.03, 9.16, "... 12 values, January first"],
    "monthly_rain_mm": [122.1, 133.6, "... 12 values, January first"]
  },
  "recommendations": [
    {
      "crop": "Soybean",
      "emoji": "🫛",
      "category": "legume",
      "season_days": 120,
      "needs": {
        "temp_c": [20, 33],
        "temp_limit_c": [10, 38],
        "rain_mm": [600, 1500],
        "rain_limit_mm": [450, 1800],
        "ph": [5.5, 6.5],
        "soil_types": ["loam", "silt loam", "clay loam"]
      },
      "score": 100,
      "level": "Great fit",
      "main_limit": "warmth",
      "factors": {
        "soil type": 1.0,
        "warmth": 1.0,
        "water": 1.0
      },
      "plant_month": "March",
      "harvest_month": "July",
      "season_temp_c": 20.7,
      "yearly_rain_mm": 1411,
      "season_rain_mm": 478,
      "dry_season": false,
      "harvest_lb_per_acre": 3000,
      "harvest_lb_total": 73500,
      "harvest_what": "beans",
      "missing": ["soil pH"]
    }
  ]
}
```

`level` is `Great fit` (80+), `Good fit` (60+), `Possible with care` (40+) or `Not recommended`. Harvest numbers are `null` for crops scoring under 40. `needs` holds the crop's ideal (`temp_c`, `rain_mm`, `ph`) and survival (`*_limit_*`) ranges from `crops.json`, in deg C and mm. `farm` echoes the inputs the scorer used. The Crop Finder page saves the response in `sessionStorage` and shows it on `/crop-finder/results`. Invalid input returns `400` and a failed climate lookup returns `502`, both as `{"error": "..."}`. Run the backend tests with `python -m unittest test_app test_accounts` from `clim_backend`.

The request body is JSON with this shape:

```json
{
  "location": "Klaten Regency, Central Java, Indonesia",
  "coordinates": {
    "lat": -7.7058,
    "lon": 110.6064
  },
  "farm": {
    "size": 24.5,
    "sizeUnit": "acres",
    "fieldCount": 3
  },
  "soilType": "Loam",
  "currentCrops": ["Rice", "Corn"],
  "irrigation": {
    "available": true,
    "method": "Drip"
  },
  "goals": ["Increase crop yield"],
  "challenges": ["Drought"],
  "plantingSeason": "Summer",
  "harvestHistory": {
    "previousCrop": "Rice",
    "notes": "Harvest notes"
  },
  "otherNotes": ""
}
```

Restart the frontend after changing the environment variable. HTTP errors from the backend are shown in the form.
`soilType` is `null` when not selected. When irrigation is unavailable, `irrigation.method` is `null`; when available, a delivery method is required. `otherNotes` is an optional trimmed string.

### Accounts and Farm Profile

Farmers sign up at `/signup` and sign in at `/login`. Every page except the landing page, `/login` and `/signup` needs a signed-in farmer. A guest is sent to `/login?next=<page>` and returns to that page after signing in. A farmer without a profile goes to `/profile` first. The profile stores name, optional phone and farm name, farm location, size, soil type, irrigation and current crops. The Crop Finder starts from these values.

The browser calls `/backend/*` on the Next.js site, and `next.config.mjs` forwards those calls to Flask at `BACKEND_URL` (default `http://127.0.0.1:5001`). This keeps the sign-in cookie first-party, so the account routes need no CORS.

| Method | Path | Body | Success |
|--------|------|------|---------|
| POST | `/api/auth/signup` | `{"email", "password"}` | `201 {"user", "profile": null}`, signs in |
| POST | `/api/auth/login` | `{"email", "password"}` | `200 {"user", "profile"}`, signs in |
| POST | `/api/auth/logout` | none | `204` |
| GET | `/api/auth/me` | none | `200 {"user", "profile"}` |
| PUT | `/api/profile` | profile fields | `200 {"profile"}` |

Passwords must be 8 to 128 characters and are stored as scrypt hashes. Errors come back as `{"error": "..."}`: `400` for invalid input, `401` when not signed in or for a wrong email or password, `409` when the email is taken, and `429` after 10 failed sign-ins for one email within 15 minutes. That limit is kept in memory, so it resets when the backend restarts.

The profile body uses the same shape the Crop Finder sends:

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

## Project Goal

Our goal is to make agricultural information easier to access and help farmers make better decisions using climate data and artificial intelligence.

## Project Information

- Project: ClimateAI
- Event: TechXpo 2026
- Institution: University of Louisiana Monroe
- Field: Artificial Intelligence and Agriculture
