import assert from "node:assert/strict";
import test from "node:test";

import {
  isHouseholdProfile,
  isIncomeMetadataMap,
  updateHouseholdDisplayName,
} from "./income-metadata.ts";
import { minimizePlanningData, planningDataMinimizationVersion } from "./data-minimization.ts";

test("data minimization compatibility is explicitly versioned", () => {
  assert.equal(planningDataMinimizationVersion, 1);
});

test("legacy income metadata is removed without mutating economics or stable ids", () => {
  const legacy = {
    incomeMetadata: { salaryOne: { employer: "Legacy employer" } },
    incomes: [{ id: "income-stable", monthlyValues: { jan: 42_000 } }],
    openingBalance: 10_000,
    version: 3,
  };
  const current = minimizePlanningData(legacy);

  assert.equal("incomeMetadata" in current, false);
  assert.deepEqual(current.incomes, legacy.incomes);
  assert.equal(current.openingBalance, legacy.openingBalance);
  assert.deepEqual(legacy.incomeMetadata, { salaryOne: { employer: "Legacy employer" } });
});

test("household display name is optional, trimmed and independently immutable", () => {
  const original = {};
  const named = updateHouseholdDisplayName(original, " Ola & Therese ");
  const cleared = updateHouseholdDisplayName(named, "  ");

  assert.equal(named.householdProfile?.householdDisplayName, "Ola & Therese");
  assert.equal(cleared.householdProfile?.householdDisplayName, null);
  assert.deepEqual(original, {});
});

test("runtime validators accept legacy absence and reject unknown metadata", () => {
  assert.equal(isIncomeMetadataMap(undefined), true);
  assert.equal(isHouseholdProfile(undefined), true);
  assert.equal(
    isIncomeMetadataMap({ salaryOne: { employer: null, employmentType: "hourly" } }),
    true,
  );
  assert.equal(isIncomeMetadataMap({ salaryOne: { salary: 68_500 } }), false);
  assert.equal(isIncomeMetadataMap({ salaryOne: { employmentType: "consultant" } }), false);
  assert.equal(isHouseholdProfile({ householdDisplayName: "Familjen Fischer" }), true);
  assert.equal(isHouseholdProfile({ personalNumber: "no" }), false);
});
