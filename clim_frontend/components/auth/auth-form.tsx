"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Leaf, LoaderCircle } from "lucide-react"
import { useAuth } from "@/components/providers/auth-provider"
import { apiFetch, errorText } from "@/lib/api"
import { destinationAfterSignIn, parseAccount } from "@/lib/session"

const MIN_PASSWORD_LENGTH = 8 // same limits as clim_backend/accounts.py
const MAX_PASSWORD_LENGTH = 128
const MAX_EMAIL_LENGTH = 254

type AuthMode = "login" | "signup"

interface AuthFormProps {
  mode: AuthMode
  /** Where to go after signing in, already checked with safeNextPath. */
  nextPath: string | null
}

const COPY = {
  login: {
    heading: "Welcome back",
    intro: "Sign in to see your crop plans and farm insights.",
    submit: "Sign in",
    submitting: "Signing in...",
    switchPrompt: "New to ClimateAI?",
    switchLabel: "Create an account",
    switchHref: "/signup",
    passwordAutoComplete: "current-password",
  },
  signup: {
    heading: "Create your farmer account",
    intro: "Save your farm details once and get crop advice matched to your land.",
    submit: "Create account",
    submitting: "Creating account...",
    switchPrompt: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/login",
    passwordAutoComplete: "new-password",
  },
} as const

const labelClass = "mb-1.5 block text-[12px] font-bold tracking-[0.12em] text-[#5d7267] uppercase"
const inputClass =
  "w-full rounded-[14px] border border-[#dfe8df] bg-[#f9fbf9] px-3 py-3 text-[15px] text-[#1f2d27] outline-none focus:border-[#4b805d] focus:ring-2 focus:ring-[#4b805d]/20"

export function AuthForm({ mode, nextPath }: AuthFormProps) {
  const router = useRouter()
  const { state, signIn } = useAuth()
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const copy = COPY[mode]
  const switchHref = nextPath ? `${copy.switchHref}?next=${encodeURIComponent(nextPath)}` : copy.switchHref

  // Covers both a fresh sign-in and opening this page while already signed in.
  useEffect(() => {
    if (state.status === "signed-in") router.replace(destinationAfterSignIn(state.account, nextPath))
  }, [nextPath, router, state])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setIsSubmitting(true)
    setError("")
    try {
      const body = { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") }
      signIn(parseAccount(await apiFetch(`/auth/${mode}`, { method: "POST", body })))
    } catch (submitError) {
      setError(errorText(submitError, "Something went wrong. Please try again."))
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f8faf6] px-4 py-10 text-[#1d2a22]">
      <div className="w-full max-w-[420px]">
        <Link href="/" aria-label="ClimateAI home" className="mb-8 flex items-center justify-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-[#17452d] text-white">
            <Leaf size={20} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="font-heading text-[19px] font-extrabold tracking-[-0.04em] text-[#17452d]">
            Climate<span className="text-[#398253]">AI</span>
          </span>
        </Link>

        <section
          aria-labelledby="auth-heading"
          className="rounded-[22px] border border-[#dfe8df] bg-white p-6 shadow-[0_1px_0_rgba(14,36,22,0.02)] sm:p-8"
        >
          <h1 id="auth-heading" className="font-heading text-[26px] leading-tight font-extrabold tracking-[-0.04em] text-[#172720]">
            {copy.heading}
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-[#5d6a60]">{copy.intro}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className={labelClass}>Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                maxLength={MAX_EMAIL_LENGTH}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Password</span>
              <input
                name="password"
                type="password"
                required
                autoComplete={copy.passwordAutoComplete}
                minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
                maxLength={MAX_PASSWORD_LENGTH}
                aria-describedby={mode === "signup" ? "password-hint" : undefined}
                className={inputClass}
              />
              {mode === "signup" && (
                <span id="password-hint" className="mt-1.5 block text-[12px] text-[#6b7a6e]">
                  At least {MIN_PASSWORD_LENGTH} characters.
                </span>
              )}
            </label>

            {error && (
              <p role="alert" className="rounded-xl border border-[#f0d4d0] bg-[#fdf3f1] px-3 py-2 text-[13px] text-[#a33c32]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1b4d35] px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-[#123d2b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1b4d35] disabled:cursor-wait disabled:opacity-70"
            >
              {isSubmitting && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
              {isSubmitting ? copy.submitting : copy.submit}
            </button>
          </form>
        </section>

        <p className="mt-5 text-center text-[13px] text-[#5d6a60]">
          {copy.switchPrompt}{" "}
          <Link href={switchHref} className="font-semibold text-[#1d4d31] underline-offset-2 hover:underline">
            {copy.switchLabel}
          </Link>
        </p>
      </div>
    </main>
  )
}
