"use client";

import { GenerativeBrief } from "@/components/shared/generative-brief";

/** Planting & weather: the payload is simulated demo data, labelled as such. */
export function PlantingBrief({ context }: { context: unknown }) {
  return (
    <GenerativeBrief
      endpoint="/api/planting-brief"
      bodyKey="context"
      payload={context}
      cacheNamespace="planting"
      label="Generative brief · OpenUI"
      title="Your planting window, laid out as a dashboard"
    />
  );
}

export default PlantingBrief;
