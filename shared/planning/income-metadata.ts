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

export const employmentTypeLabels: Record<EmploymentType, string> = {
  permanent: "Tillsvidare",
  temporary: "Visstid",
  hourly: "Timanställning",
  selfEmployed: "Egenföretagare",
  parentalLeave: "Föräldraledig",
  student: "Studerande",
  other: "Annat",
};

export type IncomeMetadata = {
  employer?: string | null;
  employmentType?: EmploymentType | null;
  occupation?: string | null;
  incomeComment?: string | null;
};

export type HouseholdProfile = {
  householdDisplayName?: string | null;
};

export type IncomeMetadataPlanningData = {
  householdProfile?: HouseholdProfile;
  incomeMetadata?: Partial<Record<IncomeLineKey, IncomeMetadata>>;
};

export type IncomeMetadataDraft = {
  employer: string;
  employmentType: EmploymentType | "";
  occupation: string;
  incomeComment: string;
};

const metadataTextMaxLength = 280;
const householdNameMaxLength = 120;

function normalizedOptionalText(value: string, maxLength = metadataTextMaxLength) {
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

export function isEmploymentType(value: unknown): value is EmploymentType {
  return (
    typeof value === "string" &&
    employmentTypes.includes(value as EmploymentType)
  );
}

export function getEmploymentTypeLabel(value: EmploymentType | null | undefined) {
  return value ? employmentTypeLabels[value] : null;
}

export function getIncomeMetadataDraft(
  data: IncomeMetadataPlanningData,
  incomeLineKey: IncomeLineKey,
): IncomeMetadataDraft {
  const metadata = data.incomeMetadata?.[incomeLineKey];

  return {
    employer: metadata?.employer ?? "",
    employmentType: metadata?.employmentType ?? "",
    occupation: metadata?.occupation ?? "",
    incomeComment: metadata?.incomeComment ?? "",
  };
}

export function updateIncomeMetadata<T extends IncomeMetadataPlanningData>(
  data: T,
  incomeLineKey: IncomeLineKey,
  draft: IncomeMetadataDraft,
): T {
  return {
    ...data,
    incomeMetadata: {
      ...data.incomeMetadata,
      [incomeLineKey]: {
        employer: normalizedOptionalText(draft.employer, 120),
        employmentType: draft.employmentType || null,
        occupation: normalizedOptionalText(draft.occupation, 120),
        incomeComment: normalizedOptionalText(draft.incomeComment),
      },
    },
  };
}

export function updateHouseholdDisplayName<T extends IncomeMetadataPlanningData>(
  data: T,
  householdDisplayName: string,
): T {
  return {
    ...data,
    householdProfile: {
      ...data.householdProfile,
      householdDisplayName: normalizedOptionalText(
        householdDisplayName,
        householdNameMaxLength,
      ),
    },
  };
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

export function isHouseholdProfile(value: unknown): boolean {
  return (
    value === undefined ||
    (isRecord(value) &&
      Object.keys(value).every((key) => key === "householdDisplayName") &&
      isOptionalNullableString(value.householdDisplayName, householdNameMaxLength))
  );
}
