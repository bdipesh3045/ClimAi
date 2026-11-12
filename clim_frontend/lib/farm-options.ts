// Choices shared by the Crop Finder and the farm profile. Soil values must match
// SOIL_TEXTURES in clim_backend/validation.py.

export const CROP_OPTIONS = [
  "Rice",
  "Corn",
  "Soybeans",
  "Wheat",
  "Cotton",
  "Sugarcane",
  "Sweet potatoes",
  "Pecans",
  "Other",
] as const

export const SOIL_OPTIONS = ["Clay", "Silt", "Loam", "Sandy", "Not sure"] as const

export const IRRIGATION_METHODS = ["Drip", "Sprinkler", "Flood", "Other"] as const

export const IRRIGATION_CHOICES = [
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
] as const

export type IrrigationChoice = (typeof IRRIGATION_CHOICES)[number]["value"] | ""
