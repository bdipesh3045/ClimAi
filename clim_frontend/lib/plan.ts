// Types and a checked parser for the Flask season plan and field notes routes
// (GET /api/plan, PUT /api/plan/tasks/:id, /api/notes). The backend builds every task;
// the page only displays them.

import type { CropFitLevel } from "./crop-analysis"

export type TaskCategory = "Soil" | "Water" | "Crop" | "Timing" | "Advice"
export type TaskPriority = "High" | "Medium" | "Low"
export type TaskGroup = "now" | "soon" | "later"

export interface PlanTask {
  id: string
  title: string
  why: string
  category: TaskCategory
  priority: TaskPriority
  dueMonth: number | null
  monthsAway: number | null
  group: TaskGroup
  dueLabel: string
  link: { href: string; label: string } | null
  done: boolean
}

export interface SeasonPlan {
  location: string
  farmName: string | null
  climateSource: string
  farm: { acres: number; soilType: string | null; irrigated: boolean }
  today: { month: number; monthName: string }
  focus: {
    crop: string
    category: string
    level: CropFitLevel
    score: number
    grown: boolean
    plantMonth: string | null
    harvestMonth: string | null
    monthsToPlanting: number | null
    seasonDays: number
    seasonMonths: boolean[]
    allChecksPass: boolean
    weakestPoint: string
    weakestPercent: number
  }
  options: Array<{ crop: string; score: number; level: CropFitLevel; grown: boolean }>
  currentCrops: Array<{
    name: string
    crop: string | null
    score: number | null
    level: CropFitLevel | null
    allChecksPass: boolean | null
    weakestPoint: string | null
  }>
  topMatch: { crop: string; score: number } | null
  groups: Array<{ id: TaskGroup; title: string }>
  tasks: PlanTask[]
  progress: { done: number; total: number }
}

export interface FieldNote {
  id: number
  crop: string
  date: string | null
  challenge: string | null
  notes: string
  createdAt: string
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

function check(condition: boolean, what: string) {
  if (!condition) throw new Error(`The plan service sent an unexpected response (${what}).`)
}

/** Light shape check: the backend owns the content, the page only needs the fields it reads. */
export function parsePlan(data: unknown): SeasonPlan {
  check(isObject(data), "plan")
  const plan = data as Record<string, unknown>
  check(isObject(plan.focus), "focus")
  check(Array.isArray(plan.tasks), "tasks")
  check(Array.isArray(plan.options), "options")
  check(Array.isArray(plan.currentCrops), "currentCrops")
  check(isObject(plan.progress), "progress")
  const focus = plan.focus as Record<string, unknown>
  check(typeof focus.crop === "string" && Array.isArray(focus.seasonMonths) && focus.seasonMonths.length === 12, "focus")
  for (const task of plan.tasks as unknown[]) {
    check(isObject(task) && typeof task.id === "string" && typeof task.title === "string" && typeof task.done === "boolean", "task")
  }
  return data as SeasonPlan
}

export function parseNotes(data: unknown): FieldNote[] {
  check(isObject(data) && Array.isArray(data.notes), "notes")
  return (data as { notes: FieldNote[] }).notes
}

export function parseNote(data: unknown): FieldNote {
  check(isObject(data) && isObject(data.note) && typeof data.note.id === "number", "note")
  return (data as { note: FieldNote }).note
}
