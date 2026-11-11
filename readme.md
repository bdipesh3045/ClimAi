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
cd backend

python -m venv venv
source venv/bin/activate

pip install -r requirements.txt
python app.py
```

The Flask backend will run at:

`http://127.0.0.1:5000`

### 3. Run the Frontend

Open another terminal:

```bash
cd frontend

npm install
npm run dev
```

The frontend will run at:

`http://localhost:3000`

### Crop Finder API

Set `NEXT_PUBLIC_CROP_ANALYSIS_API_URL` in `clim_frontend/.env.local` to `http://127.0.0.1:5000/api/crop-analysis` for local development. The Flask endpoint prints the received JSON in the backend terminal and returns it in the response. The backend must allow requests from the frontend origin when hosted on a different port or domain.

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

## Project Goal

Our goal is to make agricultural information easier to access and help farmers make better decisions using climate data and artificial intelligence.

## Project Information

- Project: ClimateAI
- Event: TechXpo 2026
- Institution: University of Louisiana Monroe
- Field: Artificial Intelligence and Agriculture
