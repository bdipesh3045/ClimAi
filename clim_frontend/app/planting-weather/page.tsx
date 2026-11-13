import { PlantingWeather } from '@/components/weather/planting-weather'
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Planting & Weather" };

export default function PlantingWeatherPage() {
  return <PlantingWeather />
}
