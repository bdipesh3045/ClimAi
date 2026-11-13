import { JourneyDetail } from "@/components/journeys/journey-detail";

export default async function JourneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JourneyDetail id={id} />;
}
