import { OverviewDashboard } from "@/components/dashboard/overview-dashboard"
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Overview" };

export default function DashboardPage() {
  return <OverviewDashboard />
}
