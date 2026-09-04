import assert from "node:assert/strict";
import test from "node:test";

import {
  getWorkspaceSavePresentation,
  hasUnsavedWorkspaceChanges,
  shouldConfirmWorkspaceNavigation,
} from "./save-experience.ts";

test("one snapshot comparison marks every Workspace module dirty", () => {
  const saved = JSON.stringify({ housing: 1, car: 1, planning: 1, savings: 1 });
  const oneChange = JSON.stringify({ housing: 2, car: 1, planning: 1, savings: 1 });
  const severalChanges = JSON.stringify({ housing: 2, car: 2, planning: 2, savings: 2 });

  assert.equal(hasUnsavedWorkspaceChanges(false, saved, oneChange), false);
  assert.equal(hasUnsavedWorkspaceChanges(true, null, oneChange), false);
  assert.equal(hasUnsavedWorkspaceChanges(true, saved, saved), false);
  assert.equal(hasUnsavedWorkspaceChanges(true, saved, oneChange), true);
  assert.equal(hasUnsavedWorkspaceChanges(true, saved, severalChanges), true);
});

test("income and household metadata use the same global dirty snapshot", () => {
  const saved = JSON.stringify({ version: 3, incomeMetadata: {} });
  const incomeEdited = JSON.stringify({
    version: 3,
    incomeMetadata: { salaryOne: { employer: "Halmstads kommun" } },
  });
  const householdEdited = JSON.stringify({
    version: 3,
    householdProfile: { householdDisplayName: "Ola & Therese" },
    incomeMetadata: {},
  });

  assert.equal(hasUnsavedWorkspaceChanges(true, saved, incomeEdited), true);
  assert.equal(hasUnsavedWorkspaceChanges(true, saved, householdEdited), true);
});

test("save presentation has one shared saved, dirty and saving model", () => {
  assert.deepEqual(getWorkspaceSavePresentation(false, "idle"), {
    label: "Sparat i molnet",
    status: "saved",
    symbol: "✓",
  });
  assert.deepEqual(getWorkspaceSavePresentation(true, "idle"), {
    label: "Du har osparade ändringar",
    status: "dirty",
    symbol: "●",
  });
  assert.deepEqual(getWorkspaceSavePresentation(true, "saving"), {
    label: "Sparar...",
    status: "saving",
    symbol: "⟳",
  });
  assert.equal(getWorkspaceSavePresentation(true, "error").status, "dirty");
  assert.equal(getWorkspaceSavePresentation(true, "conflict").status, "dirty");
});

test("saving wins while a snapshot is being synchronized", () => {
  assert.equal(getWorkspaceSavePresentation(false, "saving").status, "saving");
  assert.equal(getWorkspaceSavePresentation(true, "saving").status, "saving");
});

test("navigation confirmation is shared and ignores same-page anchors", () => {
  const current = "https://fameko.se/app?year=2026#planning";

  assert.equal(
    shouldConfirmWorkspaceNavigation(false, current, "https://fameko.se/app/boende"),
    false,
  );
  assert.equal(
    shouldConfirmWorkspaceNavigation(true, current, "https://fameko.se/app?year=2026#economy"),
    false,
  );
  assert.equal(
    shouldConfirmWorkspaceNavigation(true, current, "https://fameko.se/app/boende"),
    true,
  );
  assert.equal(
    shouldConfirmWorkspaceNavigation(true, current, "https://example.com/"),
    true,
  );
});
