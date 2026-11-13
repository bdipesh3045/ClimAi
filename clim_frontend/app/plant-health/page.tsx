import { PlantHealthCheck } from "@/components/plant-health/plant-health-check";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Plant Health" };

export default function PlantHealthPage() {
  return <PlantHealthCheck />;
}
