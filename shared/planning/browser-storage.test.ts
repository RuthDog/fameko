import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getLegacyImportPolicy,
  isVerifiedLegacyImport,
  legacyPlanningDataStorageKey,
  readLegacyPlanningData,
} from "./browser-storage.ts";

const workspaceSource = readFileSync(
  new URL("../../app/app/page.tsx", import.meta.url),
  "utf8",
);
const detailSource = readFileSync(
  new URL("../../app/app/use-planning-detail.ts", import.meta.url),
  "utf8",
);

function storageWith(value: string | null) {
  return {
    getItem(key: string) {
      assert.equal(key, legacyPlanningDataStorageKey);
      return value;
    },
  };
}

test("legacy data is read without changing or deleting browser storage", () => {
  const parsed = readLegacyPlanningData(storageWith('{"version":3,"value":42}'), (value) => {
    if (value && typeof value === "object" && "version" in value && value.version === 3) {
      return value as { value: number; version: 3 };
    }
    return null;
  });

  assert.equal(parsed.kind, "valid");
  assert.deepEqual(parsed.kind === "valid" ? parsed.data : null, { value: 42, version: 3 });
  assert.deepEqual(readLegacyPlanningData(storageWith(null), () => null), { kind: "none" });
  assert.equal(readLegacyPlanningData(storageWith("not-json"), () => null).kind, "invalid");
});

test("legacy import policy never overwrites an existing server year", () => {
  assert.equal(
    getLegacyImportPolicy({
      hasServerYear: true,
      legacyIsValid: true,
      ownershipConfirmed: true,
    }),
    "server-conflict",
  );
  assert.equal(
    getLegacyImportPolicy({
      hasServerYear: false,
      legacyIsValid: true,
      ownershipConfirmed: false,
    }),
    "ownership-confirmation-required",
  );
  assert.equal(
    getLegacyImportPolicy({
      hasServerYear: false,
      legacyIsValid: true,
      ownershipConfirmed: true,
    }),
    "create-only",
  );
  assert.equal(
    getLegacyImportPolicy({
      hasServerYear: false,
      legacyIsValid: false,
      ownershipConfirmed: true,
    }),
    "export-only",
  );
});

test("legacy cleanup requires matching save, readback, revision, year and session", () => {
  const data = { openingBalance: 100, version: 3 };
  const saved = {
    data,
    revision: 1,
    sessionContextId: "session-a",
    year: 2026,
  };

  assert.equal(
    isVerifiedLegacyImport({
      expectedData: data,
      expectedSessionId: "session-a",
      expectedYear: 2026,
      readback: { ...saved },
      saved,
    }),
    true,
  );
  assert.equal(
    isVerifiedLegacyImport({
      expectedData: data,
      expectedSessionId: "session-a",
      expectedYear: 2026,
      readback: { ...saved, sessionContextId: "session-b" },
      saved,
    }),
    false,
  );
  assert.equal(
    isVerifiedLegacyImport({
      expectedData: data,
      expectedSessionId: "session-a",
      expectedYear: 2026,
      readback: { ...saved, revision: 2 },
      saved,
    }),
    false,
  );
});

test("Workspace and detail pages create no permanent sensitive browser copies", () => {
  assert.doesNotMatch(workspaceSource, /localStorage\.setItem/);
  assert.doesNotMatch(detailSource, /localStorage\.setItem/);
  assert.doesNotMatch(workspaceSource + detailSource, /sessionStorage|indexedDB|IndexedDB/);
  assert.match(workspaceSource, /legacyDialogMode !== "verified"/);
  assert.match(workspaceSource, /localStorage\.removeItem\(legacyPlanningDataStorageKey\)/);
});

test("legacy data never becomes active React state before verified Cloud Save", () => {
  assert.doesNotMatch(workspaceSource, /setPlanningData\(storedData/);
  assert.match(workspaceSource, /setImportCandidate\(storedData\.data\)/);
  assert.match(workspaceSource, /setLegacyDialogMode\("conflict"\)/);
  assert.match(workspaceSource, /legacyOwnershipConfirmed/);
});
