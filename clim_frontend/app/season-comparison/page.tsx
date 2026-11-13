import { SeasonComparison } from "@/components/seasons/season-comparison";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Season Comparison" };

export default function SeasonComparisonPage() {
  return <SeasonComparison />;
}
