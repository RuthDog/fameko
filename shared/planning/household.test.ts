import assert from "node:assert/strict";
import test from "node:test";

import { isPlanningData } from "../../server/planning/planning-schema.ts";
import { buildBankReportModel } from "./bank-report.ts";
import { evaluateFinancialHealth } from "./financial-health.ts";
import {
  createHouseholdChild,
  getHouseholdProfile,
  getHouseholdSizeLabel,
  isHouseholdProfile,
  updateHouseholdProfile,
} from "./household.ts";
import { seedPlanningDataV3 } from "./seed-planning-data.ts";
import { savingsMonthIds } from "./savings.ts";

const completeHousehold = {
  address: "Storgatan 12",
  adultCount: 2,
  childCount: 2,
  children: [
    { age: 8, birthYear: null, id: "child-1" },
    { age: null, birthYear: 2021, id: "child-2" },
  ],
  city: "Halmstad",
  householdDisplayName: "Familjen Solgläntan",
  postalCode: "302 42",
};

test("a new household starts optional and edits normalize one household profile", () => {
  const original = structuredClone(seedPlanningDataV3);
  const updated = updateHouseholdProfile(original, {
    ...completeHousehold,
    address: "  Storgatan 12  ",
    city: " Halmstad ",
    householdDisplayName: " Familjen Solgläntan ",
    postalCode: " 302 42 ",
  });

  assert.equal(original.householdProfile, undefined);
  assert.deepEqual(updated.householdProfile, completeHousehold);
  assert.equal(getHouseholdSizeLabel(updated.householdProfile), "2 vuxna, 2 barn");
});

test("child details contain only a non-identifying id and either age or birth year", () => {
  const withChild = createHouseholdChild({ adultCount: 1, childCount: 0 });
  const updated = updateHouseholdProfile({}, {
    ...withChild,
    children: [{ age: 7, birthYear: 2019, id: "child-1" }],
  });

  assert.equal(updated.householdProfile.childCount, 1);
  assert.deepEqual(updated.householdProfile.children, [
    { age: 7, birthYear: null, id: "child-1" },
  ]);
  assert.deepEqual(
    Object.keys(updated.householdProfile.children![0]).sort(),
    ["age", "birthYear", "id"],
  );
  assert.equal("name" in updated.householdProfile.children![0], false);
});

test("runtime validation accepts legacy absence and rejects person-register fields", () => {
  assert.equal(isHouseholdProfile(undefined), true);
  assert.equal(isHouseholdProfile(completeHousehold), true);
  assert.equal(isHouseholdProfile({ ...completeHousehold, phone: "0700000000" }), false);
  assert.equal(isHouseholdProfile({ ...completeHousehold, personalNumber: "no" }), false);
  assert.equal(
    isHouseholdProfile({
      ...completeHousehold,
      children: [{ age: 8, birthYear: 2018, id: "child-1" }],
    }),
    false,
  );
});

test("household metadata survives PlanningData save and reload serialization", () => {
  const saved = updateHouseholdProfile(structuredClone(seedPlanningDataV3), completeHousehold);
  assert.equal(isPlanningData(saved), true);

  const reloaded: unknown = JSON.parse(JSON.stringify(saved));
  assert.equal(isPlanningData(reloaded), true);
  assert.deepEqual(
    getHouseholdProfile(reloaded as typeof saved),
    completeHousehold,
  );
});

test("BankReportModel reads shared household metadata automatically", () => {
  const data = updateHouseholdProfile(structuredClone(seedPlanningDataV3), completeHousehold);
  const report = buildBankReportModel(data, {
    generatedAt: "2026-09-05T10:00:00Z",
    planningYear: 2026,
  });

  assert.deepEqual(report.metadata, {
    address: "Storgatan 12",
    adultCount: 2,
    childCount: 2,
    city: "Halmstad",
    householdDisplayName: "Familjen Solgläntan",
    missing: report.metadata.missing,
    postalCode: "302 42",
  });
  assert.equal(report.summary.householdDisplayName, "Familjen Solgläntan");
});

test("household metadata never changes Financial Health", () => {
  const base = structuredClone(seedPlanningDataV3);
  const before = evaluateFinancialHealth(base, savingsMonthIds);
  const withHousehold = updateHouseholdProfile(base, completeHousehold);
  const after = evaluateFinancialHealth(withHousehold, savingsMonthIds);

  assert.deepEqual(after, before);
});
