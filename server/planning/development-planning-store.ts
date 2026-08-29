import type { PlanningYear } from "./planning-repository.ts";
import type { PlanningDataJson } from "./planning-schema.ts";

type DevelopmentPlanningStore = Map<string, PlanningYear>;

const developmentGlobal = globalThis as typeof globalThis & {
  __famekoDevelopmentPlanningYears?: DevelopmentPlanningStore;
};

const developmentPlanningYears =
  developmentGlobal.__famekoDevelopmentPlanningYears ?? new Map<string, PlanningYear>();

developmentGlobal.__famekoDevelopmentPlanningYears = developmentPlanningYears;

function planningYearKey(householdId: string, year: number): string {
  return `${householdId}:${year}`;
}

export function getDevelopmentPlanningYear(
  householdId: string,
  year: number,
): PlanningYear | null {
  return developmentPlanningYears.get(planningYearKey(householdId, year)) ?? null;
}

export function saveDevelopmentPlanningYear(
  householdId: string,
  year: number,
  expectedRevision: number | null,
  data: PlanningDataJson,
  dataVersion: number,
): PlanningYear | null {
  const key = planningYearKey(householdId, year);
  const existing = developmentPlanningYears.get(key) ?? null;

  if (
    (expectedRevision === null && existing) ||
    (expectedRevision !== null && existing?.revision !== expectedRevision)
  ) {
    return null;
  }

  const planningYear: PlanningYear = {
    data,
    dataVersion,
    id: `fameko-local-development-planning-year-${year}`,
    revision: existing ? existing.revision + 1 : 1,
    updatedAt: new Date().toISOString(),
    year,
  };

  developmentPlanningYears.set(key, planningYear);
  return planningYear;
}
