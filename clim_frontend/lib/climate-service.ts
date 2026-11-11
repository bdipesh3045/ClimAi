import {
  cropRecommendations,
  forecast,
  rainfallByMonth,
  temperatureByMonth,
  type CropRecommendation,
  type LocationName,
} from "@/lib/demo-data"

export type CropCriteria = {
  soilType: string
  soilPh?: number
  drainage: string
  annualRainfall?: number
  typicalTemperature?: number
  season: string
}

export type DashboardSnapshot = {
  location: LocationName
  temperatureF: number
  recentRainfallInches: number
  conditions: string
  seasonalRainfallInches: number
  seasonalAverageTemperatureF: number
  wetPeriods: number
  dryPeriods: number
  provenance: "demonstration"
}

export type ComparisonDatum = {
  month: string
  previousRain: number
  currentRain: number
  previousTemp: number
  currentTemp: number
}

export type WeatherAlert = {
  id: string
  severity: "Informational" | "Advisory" | "Warning"
  title: string
  description: string
}

export interface ClimateDataService {
  getDashboardSnapshot(location: LocationName): DashboardSnapshot
  getCropRecommendations(criteria: CropCriteria): CropRecommendation[]
  getSeasonComparison(seasonPair: string): ComparisonDatum[]
  getSevenDayForecast(location: LocationName): typeof forecast
  getActiveWeatherAlerts(location: LocationName): WeatherAlert[]
}

export const demoClimateService: ClimateDataService = {
  getDashboardSnapshot(location) {
    return {
      location,
      temperatureF: 74,
      recentRainfallInches: 0.12,
      conditions: "Partly cloudy",
      seasonalRainfallInches: 58.4,
      seasonalAverageTemperatureF: 70.8,
      wetPeriods: 6,
      dryPeriods: 3,
      provenance: "demonstration",
    }
  },

  getCropRecommendations(criteria) {
    return cropRecommendations.map((crop) => {
      let adjustment = 0
      if (criteria.soilType !== "Unknown") adjustment += criteria.soilType === "Loam" ? 2 : criteria.soilType === "Clay" && crop.id === "rice" ? 4 : -1
      if (criteria.drainage !== "Unknown") adjustment += criteria.drainage === "Well drained" && crop.id !== "rice" ? 2 : criteria.drainage === "Poorly drained" && crop.id === "rice" ? 2 : -2
      if (criteria.soilPh !== undefined && criteria.soilPh >= 5.5 && criteria.soilPh <= 7) adjustment += 2
      if (criteria.annualRainfall !== undefined && criteria.annualRainfall >= 35 && criteria.annualRainfall <= 65) adjustment += crop.id === "rice" ? 3 : 1
      if (criteria.typicalTemperature !== undefined && criteria.typicalTemperature >= 65 && criteria.typicalTemperature <= 90 && criteria.season === "Warm season") adjustment += 2
      const score = Math.max(52, Math.min(97, crop.score + adjustment))
      const label: CropRecommendation["label"] = score >= 82 ? "Highly suitable" : score >= 70 ? "Moderately suitable" : "More information needed"
      return { ...crop, score, label }
    }).sort((a, b) => b.score - a.score)
  },

  getSeasonComparison(seasonPair) {
    const isEarlierPair = seasonPair === "2024-2025"
    return rainfallByMonth.map((item, index) => {
      const temperature = temperatureByMonth[index]
      return {
        month: item.month,
        previousRain: isEarlierPair ? Number((item.previous - 0.4).toFixed(1)) : item.previous,
        currentRain: isEarlierPair ? item.previous : item.current,
        previousTemp: isEarlierPair ? temperature.previous - 1 : temperature.previous,
        currentTemp: isEarlierPair ? temperature.previous : temperature.current,
      }
    })
  },

  getSevenDayForecast() {
    return forecast
  },

  getActiveWeatherAlerts() {
    return []
  },
}
