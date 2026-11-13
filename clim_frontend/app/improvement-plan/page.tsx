import { ImprovementPlan } from '@/components/plans/improvement-plan'
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Improvement Plan" };

export default function ImprovementPlanPage() {
  return <ImprovementPlan />
}
