import {
  isHouseholdProfile,
  updateHouseholdDisplayName,
  type HouseholdProfile,
} from "./household.ts";

export {
  isHouseholdProfile,
  updateHouseholdDisplayName,
  type HouseholdProfile,
};

export const incomeLineKeys = [
  "salaryOne",
  "salaryTwo",
  "benefits",
  "other",
] as const;

export type IncomeLineKey = (typeof incomeLineKeys)[number];

export const employmentTypes = [
  "permanent",
  "temporary",
  "hourly",
  "selfEmployed",
  "parentalLeave",
  "student",
  "other",
] as const;

export type EmploymentType = (typeof employmentTypes)[number];

export type IncomeMetadata = {
  employer?: string | null;
  employmentType?: EmploymentType | null;
  occupation?: string | null;
  incomeComment?: string | null;
};

const metadataTextMaxLength = 280;

export function isEmploymentType(value: unknown): value is EmploymentType {
  return (
    typeof value === "string" &&
    employmentTypes.includes(value as EmploymentType)
  );
}

function isOptionalNullableString(value: unknown, maxLength: number) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.length <= maxLength)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isIncomeMetadataMap(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  if (!isRecord(value) || Object.keys(value).some((key) => !incomeLineKeys.includes(key as IncomeLineKey))) {
    return false;
  }

  return Object.values(value).every(
    (metadata) =>
      isRecord(metadata) &&
      Object.keys(metadata).every((key) =>
        ["employer", "employmentType", "occupation", "incomeComment"].includes(key),
      ) &&
      isOptionalNullableString(metadata.employer, 120) &&
      (metadata.employmentType === undefined ||
        metadata.employmentType === null ||
        isEmploymentType(metadata.employmentType)) &&
      isOptionalNullableString(metadata.occupation, 120) &&
      isOptionalNullableString(metadata.incomeComment, metadataTextMaxLength),
  );
}
