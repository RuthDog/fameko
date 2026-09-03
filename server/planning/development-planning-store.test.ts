import assert from "node:assert/strict";
import test from "node:test";

import {
  getDevelopmentPlanningYear,
  listDevelopmentPlanningYears,
  saveDevelopmentPlanningYear,
} from "./development-planning-store.ts";
import type { PlanningDataJson } from "./planning-schema.ts";

test("development PlanningData stays process-local and uses optimistic revisions", () => {
  const householdId = `development-household-${crypto.randomUUID()}`;
  const year = 2026;
  const data = { version: 3 } as PlanningDataJson;

  assert.equal(getDevelopmentPlanningYear(householdId, year), null);

  const created = saveDevelopmentPlanningYear(householdId, year, null, data, 3);
  assert.equal(created?.revision, 1);
  assert.equal(getDevelopmentPlanningYear(householdId, year)?.data, data);

  assert.equal(saveDevelopmentPlanningYear(householdId, year, null, data, 3), null);
  assert.equal(saveDevelopmentPlanningYear(householdId, year, 99, data, 3), null);

  const updated = saveDevelopmentPlanningYear(householdId, year, 1, data, 3);
  assert.equal(updated?.revision, 2);
});

test("development lists only years belonging to the active household", () => {
  const householdId = `development-household-${crypto.randomUUID()}`;
  const otherHouseholdId = `development-household-${crypto.randomUUID()}`;
  const data = { version: 3 } as PlanningDataJson;

  saveDevelopmentPlanningYear(householdId, 2028, null, data, 3);
  saveDevelopmentPlanningYear(householdId, 2026, null, data, 3);
  saveDevelopmentPlanningYear(otherHouseholdId, 2027, null, data, 3);

  assert.deepEqual(listDevelopmentPlanningYears(householdId), [2026, 2028]);
});
