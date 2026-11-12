import type { Metadata } from "next"
import { ProfileForm } from "@/components/profile/profile-form"

export const metadata: Metadata = { title: "Farm profile" }

export default function ProfilePage() {
  return <ProfileForm />
}
