"use client";

import { DetailPageShell } from "../detail-page-shell.tsx";
import { HousingOverview } from "../housing-overview.tsx";
import { usePlanningDetail } from "../use-planning-detail.ts";

export default function HousingDetailPage() {
  const planning = usePlanningDetail();

  return (
    <DetailPageShell
      description="Samla bostadens värde och bolån på ett ställe. Nyckeltalen räknas fram direkt från samma HousingData som används i Workspace."
      hasChanges={planning.hasChanges}
      loadState={planning.loadState}
      message={planning.message}
      onSave={() => void planning.save()}
      saveState={planning.saveState}
      title="Boende"
    >
      {planning.data ? (
        <HousingOverview
          data={planning.data.housingData}
          embedded
          onChange={(housingData) =>
            planning.updateData((current) => ({ ...current, housingData }))
          }
        />
      ) : null}
    </DetailPageShell>
  );
}
