import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceSource = readFileSync(
  new URL("../../app/app/page.tsx", import.meta.url),
  "utf8",
);

test("income rows retain label and amount editing without document metadata", () => {
  assert.match(workspaceSource, /ariaLabel={`Redigera namnet \$\{label\}`}/);
  assert.match(workspaceSource, /ariaLabel={`Redigera \$\{label\} i \$\{month\.name\}/);
  assert.doesNotMatch(workspaceSource, /IncomeMetadataDialog|Ändra fler uppgifter/);
});

test("retired income metadata cannot be collected or saved from Workspace", () => {
  for (const retired of ["Arbetsgivare", "Anställningsform", "Befattning", "Inkomstkommentar"]) {
    assert.doesNotMatch(workspaceSource, new RegExp(retired));
  }
  assert.doesNotMatch(workspaceSource, /updateIncomeMetadata|getIncomeMetadataDraft/);
});

test("household metadata has moved from a dialog to its domain module", () => {
  assert.doesNotMatch(workspaceSource, /HouseholdProfileDialog/);
  assert.doesNotMatch(workspaceSource, /householdDisplayNameDraft/);
});

test("the current PlanningData shape explicitly rejects retired income metadata", () => {
  assert.match(workspaceSource, /!\("incomeMetadata" in data\)/);
  assert.match(workspaceSource, /minimizePlanningData\(legacy\)/);
});
