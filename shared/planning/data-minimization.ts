import { minimizeHouseholdProfile, type HouseholdProfile } from "./household.ts";

export const planningDataMinimizationVersion = 1;

type LegacyMetadataPlanningData = Record<string, unknown> & {
  householdProfile?: Parameters<typeof minimizeHouseholdProfile>[0];
  incomeMetadata?: unknown;
};

/** Canonicalizes a legacy document in memory; it never writes to D1. */
export function minimizePlanningData<T extends LegacyMetadataPlanningData>(data: T) {
  const { householdProfile, incomeMetadata: _retiredIncomeMetadata, ...current } = data;
  return {
    ...current,
    ...(householdProfile === undefined
      ? {}
      : { householdProfile: minimizeHouseholdProfile(householdProfile) }),
  } as Omit<T, "householdProfile" | "incomeMetadata"> & {
    householdProfile?: HouseholdProfile;
  };
}
