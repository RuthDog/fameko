export const householdChildAgeMax = 120;
export const householdCountMax = 50;
export const householdNameMaxLength = 120;
export const householdAddressMaxLength = 160;
export const householdPostalCodeMaxLength = 12;
export const householdCityMaxLength = 80;

export type HouseholdChild = {
  age?: number | null;
  birthYear?: number | null;
  id: string;
};

export type HouseholdProfile = {
  address?: string | null;
  adultCount?: number | null;
  childCount?: number | null;
  children?: HouseholdChild[];
  city?: string | null;
  householdDisplayName?: string | null;
  postalCode?: string | null;
};

export type HouseholdPlanningData = {
  householdProfile?: HouseholdProfile;
};

export const emptyHouseholdProfile: Required<HouseholdProfile> = {
  address: null,
  adultCount: null,
  childCount: null,
  children: [],
  city: null,
  householdDisplayName: null,
  postalCode: null,
};

function normalizedOptionalText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim().slice(0, maxLength) ?? "";
  return normalized || null;
}

function normalizedOptionalInteger(
  value: number | null | undefined,
  max: number,
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(max, Math.max(0, Math.trunc(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  const allowedKeys = new Set(allowed);
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isOptionalNullableString(value: unknown, maxLength: number) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.length <= maxLength)
  );
}

function isOptionalNullableInteger(value: unknown, max: number) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= max)
  );
}

export function getHouseholdProfile(
  data: HouseholdPlanningData,
): Required<HouseholdProfile> {
  return {
    address: data.householdProfile?.address ?? null,
    adultCount: data.householdProfile?.adultCount ?? null,
    childCount: data.householdProfile?.childCount ?? null,
    children: (data.householdProfile?.children ?? []).map((child) => ({
      age: child.age ?? null,
      birthYear: child.birthYear ?? null,
      id: child.id,
    })),
    city: data.householdProfile?.city ?? null,
    householdDisplayName:
      data.householdProfile?.householdDisplayName ?? null,
    postalCode: data.householdProfile?.postalCode ?? null,
  };
}

export function updateHouseholdProfile<T extends HouseholdPlanningData>(
  data: T,
  profile: HouseholdProfile,
): T & { householdProfile: HouseholdProfile } {
  return {
    ...data,
    householdProfile: {
      address: normalizedOptionalText(
        profile.address,
        householdAddressMaxLength,
      ),
      adultCount: normalizedOptionalInteger(
        profile.adultCount,
        householdCountMax,
      ),
      childCount: normalizedOptionalInteger(
        profile.childCount,
        householdCountMax,
      ),
      children: (profile.children ?? []).slice(0, householdCountMax).map((child) => {
        const age = normalizedOptionalInteger(child.age, householdChildAgeMax);
        const birthYear =
          child.birthYear === null || child.birthYear === undefined
            ? null
            : Math.min(2200, Math.max(1900, Math.trunc(child.birthYear)));

        return {
          age,
          birthYear: age === null ? birthYear : null,
          id: child.id.trim().slice(0, 64),
        };
      }),
      city: normalizedOptionalText(profile.city, householdCityMaxLength),
      householdDisplayName: normalizedOptionalText(
        profile.householdDisplayName,
        householdNameMaxLength,
      ),
      postalCode: normalizedOptionalText(
        profile.postalCode,
        householdPostalCodeMaxLength,
      ),
    },
  };
}

export function updateHouseholdDisplayName<T extends HouseholdPlanningData>(
  data: T,
  householdDisplayName: string,
): T & { householdProfile: HouseholdProfile } {
  return updateHouseholdProfile(data, {
    ...getHouseholdProfile(data),
    householdDisplayName,
  });
}

export function createHouseholdChild(
  profile: HouseholdProfile,
): Required<HouseholdProfile> {
  const household = getHouseholdProfile({ householdProfile: profile });
  const existingIds = new Set(household.children.map((child) => child.id));
  let index = household.children.length + 1;

  while (existingIds.has(`child-${index}`)) {
    index += 1;
  }

  return {
    ...household,
    childCount: Math.max(household.childCount ?? 0, household.children.length + 1),
    children: [
      ...household.children,
      { age: null, birthYear: null, id: `child-${index}` },
    ],
  };
}

export function hasHouseholdProfileData(profile: HouseholdProfile | undefined) {
  if (!profile) {
    return false;
  }

  return Boolean(
    profile.householdDisplayName?.trim() ||
      profile.address?.trim() ||
      profile.postalCode?.trim() ||
      profile.city?.trim() ||
      profile.adultCount !== null && profile.adultCount !== undefined ||
      profile.childCount !== null && profile.childCount !== undefined ||
      profile.children?.some(
        (child) => child.age !== null && child.age !== undefined ||
          child.birthYear !== null && child.birthYear !== undefined,
      ),
  );
}

export function getHouseholdSizeLabel(profile: HouseholdProfile | undefined) {
  const parts: string[] = [];

  if (profile?.adultCount !== null && profile?.adultCount !== undefined) {
    parts.push(`${profile.adultCount} ${profile.adultCount === 1 ? "vuxen" : "vuxna"}`);
  }

  if (profile?.childCount !== null && profile?.childCount !== undefined) {
    parts.push(`${profile.childCount} barn`);
  }

  return parts.length ? parts.join(", ") : null;
}

export function isHouseholdProfile(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "address",
      "adultCount",
      "childCount",
      "children",
      "city",
      "householdDisplayName",
      "postalCode",
    ]) ||
    !isOptionalNullableString(value.address, householdAddressMaxLength) ||
    !isOptionalNullableInteger(value.adultCount, householdCountMax) ||
    !isOptionalNullableInteger(value.childCount, householdCountMax) ||
    !isOptionalNullableString(value.city, householdCityMaxLength) ||
    !isOptionalNullableString(value.householdDisplayName, householdNameMaxLength) ||
    !isOptionalNullableString(value.postalCode, householdPostalCodeMaxLength) ||
    (value.children !== undefined && !Array.isArray(value.children))
  ) {
    return false;
  }

  const children = value.children ?? [];
  if (children.length > householdCountMax) {
    return false;
  }

  const ids = new Set<string>();
  return children.every((child) => {
    if (
      !isRecord(child) ||
      !hasOnlyKeys(child, ["age", "birthYear", "id"]) ||
      typeof child.id !== "string" ||
      child.id.trim().length === 0 ||
      child.id.length > 64 ||
      ids.has(child.id) ||
      !isOptionalNullableInteger(child.age, householdChildAgeMax) ||
      !isOptionalNullableInteger(child.birthYear, 2200) ||
      typeof child.birthYear === "number" && child.birthYear < 1900 ||
      child.age !== null &&
        child.age !== undefined &&
        child.birthYear !== null &&
        child.birthYear !== undefined
    ) {
      return false;
    }

    ids.add(child.id);
    return true;
  });
}
