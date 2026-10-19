export const legacyPlanningDataStorageKey = "fameko.planning-data.v3";
export const legacyImportDecisionStoragePrefix = "fameko.cloud-import.v1.";

export type LegacyPlanningData<T> =
  | { kind: "none" }
  | { kind: "invalid"; raw: string }
  | { data: T; kind: "valid"; raw: string };

type ReadableStorage = Pick<Storage, "getItem">;
type RemovableStorage = Pick<Storage, "getItem" | "removeItem">;

let dismissedLegacyPlanningDataRaw: string | null = null;

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

export function dismissLegacyPlanningDataNotice(raw: string): void {
  dismissedLegacyPlanningDataRaw = raw;
}

export function shouldShowLegacyPlanningDataNotice(raw: string): boolean {
  return dismissedLegacyPlanningDataRaw !== raw;
}

export type LegacyPlanningDataRemovalResult =
  | { ok: true }
  | {
      ok: false;
      reason: "changed" | "missing" | "remove-failed" | "storage-unavailable";
    };

export function removeLegacyPlanningData(
  storage: RemovableStorage,
  expectedRaw: string,
): LegacyPlanningDataRemovalResult {
  let currentRaw: string | null;

  try {
    currentRaw = storage.getItem(legacyPlanningDataStorageKey);
  } catch {
    return { ok: false, reason: "storage-unavailable" };
  }

  if (currentRaw === null) {
    return { ok: false, reason: "missing" };
  }

  if (currentRaw !== expectedRaw) {
    return { ok: false, reason: "changed" };
  }

  try {
    storage.removeItem(legacyPlanningDataStorageKey);
  } catch {
    return { ok: false, reason: "remove-failed" };
  }

  try {
    return storage.getItem(legacyPlanningDataStorageKey) === null
      ? { ok: true }
      : { ok: false, reason: "remove-failed" };
  } catch {
    return { ok: false, reason: "storage-unavailable" };
  }
}

export function isVerifiedLegacyDeletionContext(options: {
  expectedSessionId: string;
  expectedYear: number;
  serverYear: { revision: number; sessionContextId: string; year: number } | null;
  session: { sessionContextId: string; years: number[] };
}): boolean {
  return (
    options.session.sessionContextId === options.expectedSessionId &&
    options.session.years.includes(options.expectedYear) &&
    options.serverYear !== null &&
    options.serverYear.sessionContextId === options.expectedSessionId &&
    options.serverYear.year === options.expectedYear &&
    Number.isInteger(options.serverYear.revision) &&
    options.serverYear.revision >= 1
  );
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
