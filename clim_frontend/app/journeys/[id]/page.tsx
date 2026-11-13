import { JourneyDetail } from "@/components/journeys/journey-detail";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Crop journey" };

export default async function JourneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JourneyDetail id={id} />;
}
