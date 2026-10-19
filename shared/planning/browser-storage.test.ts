import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  dismissLegacyPlanningDataNotice,
  getLegacyImportPolicy,
  isVerifiedLegacyDeletionContext,
  isVerifiedLegacyImport,
  legacyPlanningDataStorageKey,
  readLegacyPlanningData,
  removeLegacyPlanningData,
  shouldShowLegacyPlanningDataNotice,
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

test("closing a legacy notice suppresses only that copy for the active module session", () => {
  assert.equal(shouldShowLegacyPlanningDataNotice("legacy-a"), true);
  dismissLegacyPlanningDataNotice("legacy-a");
  assert.equal(shouldShowLegacyPlanningDataNotice("legacy-a"), false);
  assert.equal(shouldShowLegacyPlanningDataNotice("legacy-b"), true);
});

test("legacy removal deletes only the identified legacy key after exact-value verification", () => {
  const values = new Map<string, string>([
    [legacyPlanningDataStorageKey, "legacy-a"],
    ["fameko.non-sensitive-preference", "keep-me"],
  ]);
  const removedKeys: string[] = [];
  const result = removeLegacyPlanningData(
    {
      getItem: (key) => values.get(key) ?? null,
      removeItem(key) {
        removedKeys.push(key);
        values.delete(key);
      },
    },
    "legacy-a",
  );

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(removedKeys, [legacyPlanningDataStorageKey]);
  assert.equal(values.get(legacyPlanningDataStorageKey), undefined);
  assert.equal(values.get("fameko.non-sensitive-preference"), "keep-me");
});

test("cancelled or stale legacy deletion leaves browser data intact", () => {
  const values = new Map([[legacyPlanningDataStorageKey, "newer-copy"]]);
  let removeCalls = 0;
  const result = removeLegacyPlanningData(
    {
      getItem: (key) => values.get(key) ?? null,
      removeItem() {
        removeCalls += 1;
      },
    },
    "copy-shown-in-dialog",
  );

  assert.deepEqual(result, { ok: false, reason: "changed" });
  assert.equal(removeCalls, 0);
  assert.equal(values.get(legacyPlanningDataStorageKey), "newer-copy");
});

test("legacy removal reports removeItem failures and failed readback", () => {
  assert.deepEqual(
    removeLegacyPlanningData(
      {
        getItem() {
          throw new Error("blocked");
        },
        removeItem() {},
      },
      "legacy-a",
    ),
    { ok: false, reason: "storage-unavailable" },
  );
  assert.deepEqual(
    removeLegacyPlanningData(
      {
        getItem: () => null,
        removeItem() {
          throw new Error("must not be called");
        },
      },
      "legacy-a",
    ),
    { ok: false, reason: "missing" },
  );
  assert.deepEqual(
    removeLegacyPlanningData(
      {
        getItem: () => "legacy-a",
        removeItem() {
          throw new Error("blocked");
        },
      },
      "legacy-a",
    ),
    { ok: false, reason: "remove-failed" },
  );
  assert.deepEqual(
    removeLegacyPlanningData(
      {
        getItem: () => "legacy-a",
        removeItem() {},
      },
      "legacy-a",
    ),
    { ok: false, reason: "remove-failed" },
  );
});

test("legacy deletion requires current server data for the expected year and session", () => {
  const base = {
    expectedSessionId: "session-a",
    expectedYear: 2026,
    serverYear: { revision: 3, sessionContextId: "session-a", year: 2026 },
    session: { sessionContextId: "session-a", years: [2025, 2026, 2027] },
  };

  assert.equal(isVerifiedLegacyDeletionContext(base), true);
  assert.equal(
    isVerifiedLegacyDeletionContext({
      ...base,
      session: { ...base.session, sessionContextId: "session-b" },
    }),
    false,
  );
  assert.equal(
    isVerifiedLegacyDeletionContext({
      ...base,
      serverYear: { ...base.serverYear, sessionContextId: "session-b" },
    }),
    false,
  );
  assert.equal(
    isVerifiedLegacyDeletionContext({
      ...base,
      session: { ...base.session, years: [2025, 2027] },
    }),
    false,
  );
  assert.equal(isVerifiedLegacyDeletionContext({ ...base, serverYear: null }), false);
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
  assert.doesNotMatch(workspaceSource + detailSource, /localStorage\.clear/);
  assert.match(workspaceSource, /removeLegacyPlanningData\(window\.localStorage/);
  assert.match(workspaceSource, /loadCloudPlanningYears\(\)/);
  assert.match(workspaceSource, /loadCloudPlanningYear\(/);
});

test("legacy UX keeps export, explicit confirmation and in-session dismissal", () => {
  assert.match(workspaceSource, /Exportera lokal säkerhetskopia/);
  assert.match(workspaceSource, /fameko-legacy-sakerhetskopia-/);
  assert.match(workspaceSource, /Ta bort äldre lokal kopia/);
  assert.match(workspaceSource, /role="alertdialog"/);
  assert.match(workspaceSource, /dismissLegacyPlanningDataNotice\(legacyRecord\.raw\)/);
  assert.match(workspaceSource, /shouldShowLegacyPlanningDataNotice\(storedData\.raw\)/);
});

test("legacy deletion is read-only toward the server and verifies it immediately before removal", () => {
  const start = workspaceSource.indexOf("async function deleteLegacyPlanningDataCopy()");
  const end = workspaceSource.indexOf("async function saveToCloud()", start);
  const deletionSource = workspaceSource.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(deletionSource, /await loadCloudPlanningYears\(\)/);
  assert.match(deletionSource, /await loadCloudPlanningYear\(expectedYear, expectedSessionId\)/);
  assert.match(deletionSource, /isVerifiedLegacyDeletionContext/);
  assert.match(deletionSource, /removeLegacyPlanningData\(window\.localStorage, expectedRaw\)/);
  assert.doesNotMatch(deletionSource, /saveCloudPlanningYear|method:\s*"PUT"/);
});

test("legacy data never becomes active React state before verified Cloud Save", () => {
  assert.doesNotMatch(workspaceSource, /setPlanningData\(storedData/);
  assert.match(workspaceSource, /setImportCandidate\(storedData\.data\)/);
  assert.match(workspaceSource, /setLegacyDialogMode\("conflict"\)/);
  assert.match(workspaceSource, /legacyOwnershipConfirmed/);
});
