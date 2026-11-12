"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/components/providers/auth-provider"
import { ApiError, apiFetch, errorText } from "@/lib/api"
import { parsePlan, type SeasonPlan } from "@/lib/plan"

// The first plan for a farm waits on a NASA lookup (up to 20 s on the server).
const PLAN_TIMEOUT_MS = 35_000

export type SeasonPlanState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error"; message: string }
  | { status: "ready"; plan: SeasonPlan }

/**
 * The season plan from the Flask backend (GET /api/plan). The server builds it from the
 * saved farm profile and stores ticked tasks, so this hook only fetches and sends changes.
 */
export function useSeasonPlan() {
  const { state: auth, expireSession } = useAuth()
  const profileVersion = auth.status === "signed-in" ? auth.account.profile?.updatedAt ?? "none" : null
  const [crop, setCrop] = useState<string | null>(null)
  const [state, setState] = useState<SeasonPlanState>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (profileVersion === null) return
    let cancelled = false
    setState((current) => (current.status === "ready" ? current : { status: "loading" }))
    const query = crop ? `?crop=${encodeURIComponent(crop)}` : ""
    apiFetch(`/plan${query}`, { timeoutMs: PLAN_TIMEOUT_MS })
      .then((data) => {
        if (!cancelled) setState({ status: "ready", plan: parsePlan(data) })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 401) return expireSession()
        if (error instanceof ApiError && error.status === 409) return setState({ status: "missing" })
        setState({ status: "error", message: errorText(error, "Could not build your plan.") })
      })
    return () => {
      cancelled = true
    }
  }, [profileVersion, crop, attempt, expireSession])

  /** Tick or untick a task: shown at once, saved on the server, undone if the save fails. */
  const setTaskDone = useCallback(
    async (taskId: string, done: boolean) => {
      const apply = (value: boolean) =>
        setState((current) => {
          if (current.status !== "ready") return current
          const tasks = current.plan.tasks.map((task) => (task.id === taskId ? { ...task, done: value } : task))
          return {
            status: "ready",
            plan: { ...current.plan, tasks, progress: { ...current.plan.progress, done: tasks.filter((t) => t.done).length } },
          }
        })
      apply(done)
      try {
        await apiFetch(`/plan/tasks/${encodeURIComponent(taskId)}`, { method: "PUT", body: { done } })
      } catch (error) {
        apply(!done)
        if (error instanceof ApiError && error.status === 401) expireSession()
        throw error
      }
    },
    [expireSession],
  )

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  return { state, crop, setCrop, setTaskDone, retry }
}
