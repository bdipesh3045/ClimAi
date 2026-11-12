import type { Metadata } from "next"
import { AuthForm } from "@/components/auth/auth-form"
import { safeNextPath } from "@/lib/session"

export const metadata: Metadata = { title: "Sign in" }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams
  return <AuthForm mode="login" nextPath={safeNextPath(next)} />
}
