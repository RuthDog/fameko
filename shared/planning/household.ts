export const householdChildAgeMax = 120;
export const householdCountMax = 50;
export const householdNameMaxLength = 120;
export const householdAddressMaxLength = 160;
export const householdPostalCodeMaxLength = 12;
export const householdCityMaxLength = 80;

type LegacyHouseholdChild = {
  age?: number | null;
  birthYear?: number | null;
  id: string;
};

export type HouseholdProfile = {
  adultCount?: number | null;
  childCount?: number | null;
  householdDisplayName?: string | null;
};

type LegacyHouseholdProfile = HouseholdProfile & {
  address?: string | null;
  children?: LegacyHouseholdChild[];
  city?: string | null;
  postalCode?: string | null;
};

export type HouseholdPlanningData = {
  householdProfile?: HouseholdProfile;
};

export const emptyHouseholdProfile: Required<HouseholdProfile> = {
  adultCount: null,
  childCount: null,
  householdDisplayName: null,
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
  data: object,
): Required<HouseholdProfile> {
  const planningData = data as HouseholdPlanningData;
  return {
    adultCount: planningData.householdProfile?.adultCount ?? null,
    childCount: planningData.householdProfile?.childCount ?? null,
    householdDisplayName:
      planningData.householdProfile?.householdDisplayName ?? null,
  };
}

export function updateHouseholdProfile<T extends object>(
  data: T,
  profile: HouseholdProfile,
): T & { householdProfile: HouseholdProfile } {
  return {
    ...data,
    householdProfile: {
      adultCount: normalizedOptionalInteger(
        profile.adultCount,
        householdCountMax,
      ),
      childCount: normalizedOptionalInteger(
        profile.childCount,
        householdCountMax,
      ),
      householdDisplayName: normalizedOptionalText(
        profile.householdDisplayName,
        householdNameMaxLength,
      ),
    },
  };
}

export function updateHouseholdDisplayName<T extends object>(
  data: T,
  householdDisplayName: string,
): T & { householdProfile: HouseholdProfile } {
  return updateHouseholdProfile(data, {
    ...getHouseholdProfile(data),
    householdDisplayName,
  });
}

export function hasHouseholdProfileData(profile: HouseholdProfile | undefined) {
  if (!profile) {
    return false;
  }

  return Boolean(
    profile.householdDisplayName?.trim() ||
      profile.adultCount !== null && profile.adultCount !== undefined ||
      profile.childCount !== null && profile.childCount !== undefined,
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

export function isHouseholdProfile(value: unknown): value is LegacyHouseholdProfile | undefined {
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

/** Validator for the minimized shape accepted by new saves. */
export function isCurrentHouseholdProfile(value: unknown): boolean {
  return value === undefined || (
    isRecord(value) &&
    hasOnlyKeys(value, ["adultCount", "childCount", "householdDisplayName"]) &&
    isOptionalNullableInteger(value.adultCount, householdCountMax) &&
    isOptionalNullableInteger(value.childCount, householdCountMax) &&
    isOptionalNullableString(value.householdDisplayName, householdNameMaxLength)
  );
}

/** Removes retired document metadata without mutating a legacy profile. */
export function minimizeHouseholdProfile(profile: LegacyHouseholdProfile): HouseholdProfile {
  return {
    adultCount: normalizedOptionalInteger(profile.adultCount, householdCountMax),
    childCount: normalizedOptionalInteger(
      profile.childCount ?? (profile.children?.length ? profile.children.length : null),
      householdCountMax,
    ),
    householdDisplayName: normalizedOptionalText(
      profile.householdDisplayName,
      householdNameMaxLength,
    ),
  };
}
