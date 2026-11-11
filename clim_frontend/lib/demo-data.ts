export type LocationName = string

export type CropRecommendation = {
  id: string
  name: string
  image: string
  score: number
  label: "Highly suitable" | "Moderately suitable" | "More information needed"
  summary: string
  climate: string
  soil: string
  uncertainty: string
  plantingWindow: string
}

export const cropRecommendations: CropRecommendation[] = [
  {
    id: "rice",
    name: "Rice",
    image: "/images/rice-field.png",
    score: 92,
    label: "Highly suitable",
    summary: "A familiar regional crop that can fit warm, humid growing conditions.",
    climate: "Warm-season profile",
    soil: "Performs best with managed water and suitable field conditions",
    uncertainty: "Field flooding capacity and local soil conditions are not assessed.",
    plantingWindow: "Spring · typical regional window",
  },
  {
    id: "soybeans",
    name: "Soybeans",
    image: "/images/soybean-field.png",
    score: 84,
    label: "Highly suitable",
    summary: "A common rotation option to investigate for a long, warm growing season.",
    climate: "Warm-season profile",
    soil: "Prefers well-drained soil; pH and drainage are unknown",
    uncertainty: "No field-level soil test or cultivar information is connected.",
    plantingWindow: "Spring · typical regional window",
  },
  {
    id: "corn",
    name: "Corn",
    image: "/images/corn-field.png",
    score: 76,
    label: "Moderately suitable",
    summary: "Could be worth comparing where soil moisture and planting timing align.",
    climate: "Warm-season profile",
    soil: "Soil fertility and drainage need field-level confirmation",
    uncertainty: "Heat, water availability, and variety selection may change the outlook.",
    plantingWindow: "Early spring · typical regional window",
  },
  {
    id: "cotton",
    name: "Cotton",
    image: "/images/corn-field.png",
    score: 68,
    label: "Moderately suitable",
    summary: "A warm-season option to discuss with a local agricultural advisor.",
    climate: "Warm-season profile",
    soil: "Soil texture and field drainage are not available",
    uncertainty: "This demonstration does not consider local pest pressure or economics.",
    plantingWindow: "Spring · typical regional window",
  },
]

export const rainfallByMonth = [
  { month: "Jan", previous: 4.8, current: 5.2 },
  { month: "Feb", previous: 4.2, current: 4.6 },
  { month: "Mar", previous: 5.1, current: 5.4 },
  { month: "Apr", previous: 5.3, current: 4.7 },
  { month: "May", previous: 5.7, current: 5.9 },
  { month: "Jun", previous: 5.1, current: 4.3 },
  { month: "Jul", previous: 5.8, current: 5.4 },
  { month: "Aug", previous: 4.9, current: 4.6 },
  { month: "Sep", previous: 4.1, current: 4.4 },
  { month: "Oct", previous: 4.2, current: 4.8 },
  { month: "Nov", previous: 4.5, current: 4.1 },
  { month: "Dec", previous: 4.8, current: 5.0 },
]

export const temperatureByMonth = [
  { month: "Jan", previous: 51, current: 54 },
  { month: "Feb", previous: 55, current: 57 },
  { month: "Mar", previous: 63, current: 65 },
  { month: "Apr", previous: 70, current: 72 },
  { month: "May", previous: 77, current: 79 },
  { month: "Jun", previous: 83, current: 85 },
  { month: "Jul", previous: 85, current: 86 },
  { month: "Aug", previous: 84, current: 85 },
  { month: "Sep", previous: 79, current: 81 },
  { month: "Oct", previous: 69, current: 71 },
  { month: "Nov", previous: 59, current: 61 },
  { month: "Dec", previous: 52, current: 54 },
]

export const forecast = [
  { day: "Today", shortDay: "Tue", high: 76, low: 58, rain: 20, icon: "sun-cloud" },
  { day: "Wednesday", shortDay: "Wed", high: 78, low: 60, rain: 10, icon: "sun" },
  { day: "Thursday", shortDay: "Thu", high: 74, low: 59, rain: 55, icon: "rain" },
  { day: "Friday", shortDay: "Fri", high: 71, low: 56, rain: 70, icon: "rain" },
  { day: "Saturday", shortDay: "Sat", high: 73, low: 54, rain: 15, icon: "sun-cloud" },
  { day: "Sunday", shortDay: "Sun", high: 77, low: 57, rain: 5, icon: "sun" },
  { day: "Monday", shortDay: "Mon", high: 80, low: 60, rain: 10, icon: "sun" },
]

export const plantingWindows: Record<string, { start: number; end: number; note: string }> = {
  rice: { start: 3, end: 5, note: "Typical Louisiana rice planting period; check local field conditions and extension guidance." },
  soybeans: { start: 3, end: 5, note: "Illustrative regional window only. Variety, soil temperature, and local guidance matter." },
  corn: { start: 2, end: 4, note: "Illustrative regional window only. Confirm soil temperature and local recommendations." },
  wheat: { start: 9, end: 10, note: "Fall planting is typical in the region; verify timing with local extension advice." },
  cotton: { start: 3, end: 4, note: "Illustrative regional window only. Field readiness and local guidance matter." },
}

export type ImprovementAction = {
  id: string
  title: string
  description: string
  why: string
  priority: "High priority" | "Worth exploring" | "Good to plan"
  timeframe: string
}

export const improvementActions: ImprovementAction[] = [
  {
    id: "soil-test",
    title: "Arrange a soil test",
    description: "Collect representative samples from each field before making input decisions.",
    why: "Current soil pH, nutrients, and texture are not available in this demo.",
    priority: "High priority",
    timeframe: "Before planting",
  },
  {
    id: "drainage",
    title: "Walk the field after rain",
    description: "Note where water stands and how quickly different areas drain.",
    why: "Drainage can affect crop choice and planting access, but field conditions are unknown.",
    priority: "Worth exploring",
    timeframe: "Next wet period",
  },
  {
    id: "extension",
    title: "Talk with your local extension office",
    description: "Bring your crop plan and recent field observations to a local expert.",
    why: "Regional guidance can account for varieties, pests, and conditions this demo cannot see.",
    priority: "Good to plan",
    timeframe: "This month",
  },
  {
    id: "records",
    title: "Record last season’s field notes",
    description: "Capture planting dates, rainfall impacts, and areas that need attention.",
    why: "A clear baseline makes next season’s comparisons more useful.",
    priority: "Good to plan",
    timeframe: "When convenient",
  },
]

export const seasonalSummary = {
  currentYear: 2026,
  previousYear: 2025,
  currentRainfall: 58.4,
  previousRainfall: 58.5,
  currentTemperature: 70.8,
  previousTemperature: 68.9,
  wetPeriods: 6,
  dryPeriods: 3,
}
