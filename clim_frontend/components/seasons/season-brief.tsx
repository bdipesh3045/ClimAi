"use client";

import { GenerativeBrief } from "@/components/shared/generative-brief";

/** Season comparison: the payload is the backend's finished comparison. */
export function SeasonBrief({ comparison }: { comparison: unknown }) {
  return (
    <GenerativeBrief
      endpoint="/api/season-brief"
      bodyKey="comparison"
      payload={comparison}
      cacheNamespace="season"
      label="Generative brief · OpenUI"
      title="This comparison, laid out as a dashboard"
    />
  );
}

export default SeasonBrief;
