"use client";

import { evaluateFinancialHealth } from "../../../shared/planning/financial-health.ts";
import { savingsMonthIds } from "../../../shared/planning/savings.ts";
import { DetailPageShell } from "../detail-page-shell.tsx";
import { FinancialHealthView } from "../financial-health-view.tsx";
import { usePlanningDetail } from "../use-planning-detail.ts";

export default function FinancialHealthDetailPage() {
  const planning = usePlanningDetail();
  const result = planning.data
    ? evaluateFinancialHealth(planning.data, savingsMonthIds)
    : null;

  return (
    <DetailPageShell
      backHref="/app#financial-health"
      backLabel="Tillbaka till Workspace"
      description="Se vad som stärker hushållets ekonomi, vad som kan vara värt att följa och vilka uppgifter som saknas."
      hasChanges={planning.hasChanges}
      loadState={planning.loadState}
      message={planning.message}
      onSave={() => void planning.save()}
      saveState={planning.saveState}
      title="Din ekonomiska motståndskraft"
    >
      {result ? <FinancialHealthView result={result} /> : null}
    </DetailPageShell>
  );
}
