import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceSource = readFileSync(
  new URL("../../app/app/page.tsx", import.meta.url),
  "utf8",
);
const detailSource = readFileSync(
  new URL("../../app/app/use-planning-detail.ts", import.meta.url),
  "utf8",
);
const collectionRouteSource = readFileSync(
  new URL("../../app/app/api/planning-years/route.ts", import.meta.url),
  "utf8",
);

test("the year selector renders only years returned by the PlanningYear API", () => {
  assert.match(workspaceSource, /availableYears\.map\(\(year\) =>/);
  assert.match(workspaceSource, /loadCloudPlanningYears\(\)/);
  assert.match(collectionRouteSource, /listYears\(/);
  assert.match(collectionRouteSource, /requirePlanningAuthorization\(request\)/);
  assert.doesNotMatch(workspaceSource, /const planningYears = \[/);
});

test("new year supports empty and complete-copy creation through existing Cloud Save", () => {
  assert.match(workspaceSource, /label: "Tom planering"/);
  assert.match(workspaceSource, /label: `Kopiera hela \$\{sourceYear\}`/);
  assert.match(workspaceSource, /clonePlanningYearData\(planningData\)/);
  assert.match(workspaceSource, /clonePlanningYearData\(emptyPlanningData\)/);
  assert.match(workspaceSource, /saveCloudPlanningYear\(data, null, targetYear\)/);
});

test("transfer exposes target-wins and overwrite strategies with optimistic saving", () => {
  assert.match(workspaceSource, /label: "Behåll befintligt"/);
  assert.match(workspaceSource, /label: "Skriv över"/);
  assert.match(workspaceSource, /transferPlanningYearData\(/);
  assert.match(
    workspaceSource,
    /saveCloudPlanningYear\(transferred, target\.revision, targetYear\)/,
  );
  assert.match(workspaceSource, /Tidigare år påverkas inte\./);
});

test("detail pages use the same persisted active PlanningYear as Workspace", () => {
  assert.match(detailSource, /readStoredActivePlanningYear\(/);
  assert.match(detailSource, /loadPlanningYear\(activeYear\)/);
  assert.match(detailSource, /savePlanningYear\(data, revision, planningYear\)/);
});
