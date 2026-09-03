export type YearTransferStrategy = "missing" | "overwrite";

type PlanningYearStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export const activePlanningYearStorageKey = "fameko.active-planning-year";

type IdentifiedValue = Record<string, unknown> & { id: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIdentifiedArray(value: unknown[]): value is IdentifiedValue[] {
  return value.every(
    (item) => isRecord(item) && typeof item.id === "string" && item.id.length > 0,
  );
}

export function clonePlanningYearData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

function mergeMissingValue(source: unknown, target: unknown): unknown {
  if (target === undefined || target === null) {
    return clonePlanningYearData(source);
  }

  if (Array.isArray(source) && Array.isArray(target)) {
    if (!isIdentifiedArray(source) || !isIdentifiedArray(target)) {
      return clonePlanningYearData(target);
    }

    const existingIds = new Set(target.map((item) => item.id));
    return [
      ...clonePlanningYearData(target),
      ...clonePlanningYearData(source.filter((item) => !existingIds.has(item.id))),
    ];
  }

  if (isRecord(source) && isRecord(target)) {
    const result: Record<string, unknown> = clonePlanningYearData(target);

    for (const [key, sourceValue] of Object.entries(source)) {
      result[key] = mergeMissingValue(sourceValue, result[key]);
    }

    return result;
  }

  return clonePlanningYearData(target);
}

export function transferPlanningYearData<T>(
  source: T,
  target: T,
  strategy: YearTransferStrategy,
): T {
  if (strategy === "overwrite") {
    return clonePlanningYearData(source);
  }

  return mergeMissingValue(source, target) as T;
}

export function normalizePlanningYears(years: readonly number[]): number[] {
  return [...new Set(years)]
    .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2200)
    .sort((first, second) => first - second);
}

export function getNextPlanningYear(year: number): number {
  return Math.min(2200, Math.max(2000, Math.trunc(year) + 1));
}

export function readStoredActivePlanningYear(
  storage: PlanningYearStorage,
  fallbackYear: number,
): number {
  const year = Number(storage.getItem(activePlanningYearStorageKey));
  return Number.isInteger(year) && year >= 2000 && year <= 2200
    ? year
    : fallbackYear;
}

export function storeActivePlanningYear(
  storage: PlanningYearStorage,
  year: number,
): void {
  storage.setItem(activePlanningYearStorageKey, String(year));
}
