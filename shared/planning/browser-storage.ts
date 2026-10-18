export const legacyPlanningDataStorageKey = "fameko.planning-data.v3";
export const legacyImportDecisionStoragePrefix = "fameko.cloud-import.v1.";

export type LegacyPlanningData<T> =
  | { kind: "none" }
  | { kind: "invalid"; raw: string }
  | { data: T; kind: "valid"; raw: string };

type ReadableStorage = Pick<Storage, "getItem">;

export function readLegacyPlanningData<T>(
  storage: ReadableStorage,
  parse: (value: unknown) => T | null,
): LegacyPlanningData<T> {
  const raw = storage.getItem(legacyPlanningDataStorageKey);
  if (raw === null) {
    return { kind: "none" };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    const data = parse(parsed);
    return data === null ? { kind: "invalid", raw } : { data, kind: "valid", raw };
  } catch {
    return { kind: "invalid", raw };
  }
}

export type LegacyImportPolicy =
  | "create-only"
  | "export-only"
  | "ownership-confirmation-required"
  | "server-conflict";

export function getLegacyImportPolicy(options: {
  hasServerYear: boolean;
  legacyIsValid: boolean;
  ownershipConfirmed: boolean;
}): LegacyImportPolicy {
  if (!options.legacyIsValid) {
    return "export-only";
  }

  if (options.hasServerYear) {
    return "server-conflict";
  }

  return options.ownershipConfirmed ? "create-only" : "ownership-confirmation-required";
}

export function isVerifiedLegacyImport<T>(options: {
  expectedData: T;
  expectedSessionId: string;
  expectedYear: number;
  readback: { data: T; revision: number; sessionContextId: string; year: number };
  saved: { data: T; revision: number; sessionContextId: string; year: number };
}): boolean {
  return (
    options.saved.year === options.expectedYear &&
    options.readback.year === options.expectedYear &&
    options.saved.sessionContextId === options.expectedSessionId &&
    options.readback.sessionContextId === options.expectedSessionId &&
    options.saved.revision === options.readback.revision &&
    options.saved.revision >= 1 &&
    JSON.stringify(options.saved.data) === JSON.stringify(options.expectedData) &&
    JSON.stringify(options.readback.data) === JSON.stringify(options.expectedData)
  );
}
