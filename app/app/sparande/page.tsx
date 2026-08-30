"use client";

import { DetailPageShell } from "../detail-page-shell.tsx";
import { SavingsOverview } from "../savings-overview.tsx";
import { usePlanningDetail } from "../use-planning-detail.ts";

export default function SavingsDetailPage() {
  const planning = usePlanningDetail();

  return (
    <DetailPageShell
      description="Se årets planerade sparande, sparkvot och samtliga sparmål i en översikt byggd direkt från PlanningData."
      hasChanges={planning.hasChanges}
      loadState={planning.loadState}
      message={planning.message}
      onSave={() => void planning.save()}
      saveState={planning.saveState}
      title="Sparande"
    >
      {planning.data ? (
        <SavingsOverview
          data={planning.data}
          onChange={(data) => planning.updateData(() => data)}
        />
      ) : null}
    </DetailPageShell>
  );
}
