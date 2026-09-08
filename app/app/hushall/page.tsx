"use client";

import { updateHouseholdProfile } from "../../../shared/planning/household.ts";
import { DetailPageShell } from "../detail-page-shell.tsx";
import { HouseholdOverview } from "../household-overview.tsx";
import { usePlanningDetail } from "../use-planning-detail.ts";

export default function HouseholdDetailPage() {
  const planning = usePlanningDetail();

  return (
    <DetailPageShell
      description="Samla hushållets gemensamma grunduppgifter utan att skapa personprofiler. Allt sparas med samma årsplanering som resten av din ekonomi."
      hasChanges={planning.hasChanges}
      loadState={planning.loadState}
      message={planning.message}
      onSave={() => void planning.save()}
      saveState={planning.saveState}
      title="Hushåll"
    >
      {planning.data ? (
        <HouseholdOverview
          data={planning.data.householdProfile}
          onChange={(householdProfile) =>
            planning.updateData((current) =>
              updateHouseholdProfile(current, householdProfile),
            )
          }
        />
      ) : null}
    </DetailPageShell>
  );
}
