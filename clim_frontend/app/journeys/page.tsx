import { JourneyList } from "@/components/journeys/journey-list";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Crop Journeys" };

export default function JourneysPage() {
  return <JourneyList />;
}
