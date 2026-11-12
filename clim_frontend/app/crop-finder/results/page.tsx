import type { Metadata } from "next";

import { CropResultsPage } from "@/components/crops/results/crop-results-page";

export const metadata: Metadata = { title: "Crop results" };

export default function Page() {
  return <CropResultsPage />;
}
