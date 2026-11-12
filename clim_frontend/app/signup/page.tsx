import type { Metadata } from "next"
import { AuthForm } from "@/components/auth/auth-form"
import { safeNextPath } from "@/lib/session"

export const metadata: Metadata = { title: "Create account" }

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams
  return <AuthForm mode="signup" nextPath={safeNextPath(next)} />
}
