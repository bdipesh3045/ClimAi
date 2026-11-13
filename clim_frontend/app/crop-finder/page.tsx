import { CropFinder } from '@/components/crops/crop-finder'
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Crop Finder" };

export default function CropFinderPage() {
  return <CropFinder />
}
