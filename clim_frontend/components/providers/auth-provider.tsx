"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { ApiError, apiFetch } from "@/lib/api"
import { parseAccount, type Account, type FarmerProfile } from "@/lib/session"

export type AuthState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "signed-in"; account: Account }
  | { status: "error"; message: string }

interface AuthContextValue {
  state: AuthState
  /** Store the account returned by signup or login. */
  signIn: (account: Account) => void
  /** End the session on the server, then forget the account here. Throws if the server cannot be reached. */
  signOut: () => Promise<void>
  /** Replace the stored profile after a save. */
  updateProfile: (profile: FarmerProfile) => void
  /** Call when a request gets 401: the session ended, so AppShell sends the farmer to sign in. */
  expireSession: () => void
  /** Ask the server again who is signed in. */
  reload: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" })
  // Bumped by every change of who is signed in. A /me reply that started before the latest
  // change is stale (for example, it returns 401 just after the farmer signed in) and is ignored.
  const generation = useRef(0)

  const setCurrent = useCallback((next: AuthState) => {
    generation.current += 1
    setState(next)
  }, [])

  const reload = useCallback(async () => {
    const requestGeneration = ++generation.current
    // Keep a signed-in page mounted while checking, so open forms keep what was typed.
    setState((current) => current.status === "signed-in" ? current : { status: "loading" })
    let next: AuthState
    try {
      next = { status: "signed-in", account: parseAccount(await apiFetch("/auth/me")) }
    } catch (error) {
      next = error instanceof ApiError && error.status === 401
        ? { status: "guest" }
        : { status: "error", message: error instanceof Error ? error.message : "Could not check your sign-in." }
    }
    if (requestGeneration === generation.current) setState(next)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const value = useMemo<AuthContextValue>(() => ({
    state,
    reload,
    signIn: (account) => setCurrent({ status: "signed-in", account }),
    signOut: async () => {
      await apiFetch("/auth/logout", { method: "POST" })
      setCurrent({ status: "guest" })
    },
    expireSession: () => setCurrent({ status: "guest" }),
    updateProfile: (profile) => {
      setState((current) => current.status === "signed-in"
        ? { status: "signed-in", account: { ...current.account, profile } }
        : current)
    },
  }), [reload, setCurrent, state])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside AuthProvider")
  return context
}

/** The signed-in account, or null. App pages render only once this is set (see AppShell). */
export function useAccount(): Account | null {
  const { state } = useAuth()
  return state.status === "signed-in" ? state.account : null
}
