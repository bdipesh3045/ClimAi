"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { type LocationName } from "@/lib/demo-data"

export type FarmerObservation = {
  id: string
  crop: string
  plantingDate: string
  challenge: string
  notes: string
  createdAt: string
}

export type Coordinates = { lat: number; lon: number }

type SavedDemoData = {
  location: LocationName
  /** Present when the location came from a geocoded search result. */
  coordinates: Coordinates | null
  completedActionIds: string[]
  observations: FarmerObservation[]
}

type AppDataContextValue = SavedDemoData & {
  setLocation: (location: LocationName, coordinates?: Coordinates | null) => void
  toggleAction: (actionId: string) => void
  addObservation: (observation: Omit<FarmerObservation, "id" | "createdAt">) => void
}

const storageKey = "climateai-demo-data-v2"
const legacyStorageKey = "climateai-demo-data-v1"
const AppDataContext = createContext<AppDataContextValue | null>(null)

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocationName] = useState<LocationName>("")
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null)
  const [completedActionIds, setCompletedActionIds] = useState<string[]>([])
  const [observations, setObservations] = useState<FarmerObservation[]>([])
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    try {
      const currentData = window.localStorage.getItem(storageKey)
      const saved = currentData ?? window.localStorage.getItem(legacyStorageKey)
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<SavedDemoData>
        if (currentData && typeof parsed.location === "string") setLocationName(parsed.location.trim())
        if (currentData && isCoordinates(parsed.coordinates)) setCoordinates(parsed.coordinates)
        if (Array.isArray(parsed.completedActionIds)) {
          setCompletedActionIds(parsed.completedActionIds.filter((id): id is string => typeof id === "string"))
        }
        if (Array.isArray(parsed.observations)) {
          setObservations(parsed.observations.filter(isFarmerObservation))
        }
      }
    } catch {
      try {
        window.localStorage.removeItem(storageKey)
      } catch {
        // Storage can be unavailable in restricted browsing contexts.
      }
    } finally {
      setIsHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    const saved: SavedDemoData = { location, coordinates, completedActionIds, observations }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(saved))
    } catch {
      // The app remains usable if browser storage is disabled or full.
    }
  }, [completedActionIds, coordinates, isHydrated, location, observations])

  const value = useMemo<AppDataContextValue>(() => ({
    location,
    coordinates,
    completedActionIds,
    observations,
    setLocation: (nextLocation, nextCoordinates = null) => {
      setLocationName(nextLocation)
      setCoordinates(nextCoordinates)
    },
    toggleAction: (actionId) => {
      setCompletedActionIds((current) => current.includes(actionId)
        ? current.filter((id) => id !== actionId)
        : [...current, actionId])
    },
    addObservation: (observation) => {
      setObservations((current) => [{
        ...observation,
        id: window.crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }, ...current])
    },
  }), [completedActionIds, coordinates, location, observations])

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const context = useContext(AppDataContext)
  if (!context) throw new Error("useAppData must be used inside AppDataProvider")
  return context
}

function isFarmerObservation(value: unknown): value is FarmerObservation {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.id === "string"
    && typeof record.crop === "string"
    && typeof record.plantingDate === "string"
    && typeof record.challenge === "string"
    && typeof record.notes === "string"
    && typeof record.createdAt === "string"
}

function isCoordinates(value: unknown): value is Coordinates {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.lat === "number" && Number.isFinite(record.lat)
    && typeof record.lon === "number" && Number.isFinite(record.lon)
}
