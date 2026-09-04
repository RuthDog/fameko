import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceSource = readFileSync(
  new URL("../../app/app/page.tsx", import.meta.url),
  "utf8",
);

test("existing income rows expose one optional metadata edit experience", () => {
  assert.match(workspaceSource, /Ändra fler uppgifter för \$\{label\}/);
  assert.match(workspaceSource, /<IncomeMetadataDialog/);
  assert.match(workspaceSource, />\s*Fler uppgifter\s*</);
  assert.match(workspaceSource, /Arbetsgivare/);
  assert.match(workspaceSource, /Anställningsform/);
  assert.match(workspaceSource, /Befattning/);
  assert.match(workspaceSource, /Kommentar/);
});

test("metadata save uses PlanningData while cancel only closes the draft", () => {
  assert.match(
    workspaceSource,
    /setPlanningData\(\(currentData\) =>\s*updateIncomeMetadata\(/,
  );
  assert.match(workspaceSource, /function closeIncomeMetadataDialog\(\)/);
  const closeHandler = workspaceSource.slice(
    workspaceSource.indexOf("function closeIncomeMetadataDialog()"),
    workspaceSource.indexOf("function saveIncomeMetadata()"),
  );
  assert.doesNotMatch(closeHandler, /setPlanningData/);
});

test("household name is optional and edited in the existing year context", () => {
  assert.match(workspaceSource, /\+ Hushållsnamn/);
  assert.match(workspaceSource, /<HouseholdProfileDialog/);
  assert.match(
    workspaceSource,
    /updateHouseholdDisplayName\(currentData, householdDisplayNameDraft\)/,
  );
});

test("metadata language remains voluntary and secondary", () => {
  assert.match(workspaceSource, /Frivilligt\. Namnet kan användas/);
  assert.match(workspaceSource, /Lägg till om du vill göra framtida ekonomiska sammanställningar mer kompletta\./);
  assert.match(workspaceSource, /Namn och belopp ändras som vanligt direkt i planeringen\./);
});
