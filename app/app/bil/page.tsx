"use client";

import { getCarPlanningEconomics } from "../../../shared/planning/car.ts";
import { currentPlanningYear } from "../../../shared/planning/seed-planning-data.ts";
import { CarOverview } from "../car-overview.tsx";
import { DetailPageShell } from "../detail-page-shell.tsx";
import { usePlanningDetail } from "../use-planning-detail.ts";

const monthIds = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function currentPlanningMonthId() {
  const today = new Date();
  return today.getFullYear() === currentPlanningYear ? monthIds[today.getMonth()] : monthIds[0];
}

export default function CarDetailPage() {
  const planning = usePlanningDetail();
  const carPlanning = planning.data
    ? getCarPlanningEconomics(planning.data, currentPlanningMonthId())
    : null;

  return (
    <DetailPageShell
      description="Se bilens lån och ägandeuppgifter tillsammans med de kostnader som redan finns i årsplaneringen—utan dubbellagring."
      hasChanges={planning.hasChanges}
      loadState={planning.loadState}
      message={planning.message}
      onSave={() => void planning.save()}
      saveState={planning.saveState}
      title="Bil"
    >
      {planning.data && carPlanning ? (
        <CarOverview
          data={planning.data.carData}
          onChange={(carData) => planning.updateData((current) => ({ ...current, carData }))}
          planning={carPlanning}
        />
      ) : null}
    </DetailPageShell>
  );
}
