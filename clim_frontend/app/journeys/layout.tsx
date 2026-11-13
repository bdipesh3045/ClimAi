import { JourneyProvider } from "@/components/journeys/journey-store";

// One store for the list and every journey page, so entries added on a journey show on the list.
export default function JourneysLayout({ children }: { children: React.ReactNode }) {
  return <JourneyProvider>{children}</JourneyProvider>;
}
