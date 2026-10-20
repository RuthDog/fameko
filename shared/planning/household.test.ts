import assert from "node:assert/strict";
import test from "node:test";

import { isPlanningData, readPlanningData } from "../../server/planning/planning-schema.ts";
import { buildBankReportModel } from "./bank-report.ts";
import { evaluateFinancialHealth } from "./financial-health.ts";
import {
  getHouseholdProfile,
  getHouseholdSizeLabel,
  isCurrentHouseholdProfile,
  isHouseholdProfile,
  minimizeHouseholdProfile,
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

  assert.equal("householdProfile" in original, false);
  assert.deepEqual(updated.householdProfile, {
    adultCount: 2,
    childCount: 2,
    householdDisplayName: "Familjen Solgläntan",
  });
  assert.equal(getHouseholdSizeLabel(updated.householdProfile), "2 vuxna, 2 barn");
});

test("legacy child entries contribute only their count to the minimized profile", () => {
  assert.deepEqual(minimizeHouseholdProfile({
    adultCount: 1,
    children: [{ age: 7, birthYear: null, id: "child-1" }],
  }), {
    adultCount: 1,
    childCount: 1,
    householdDisplayName: null,
  });
});

test("runtime validation accepts legacy absence and rejects person-register fields", () => {
  assert.equal(isHouseholdProfile(undefined), true);
  assert.equal(isHouseholdProfile(completeHousehold), true);
  assert.equal(isCurrentHouseholdProfile(completeHousehold), false);
  assert.equal(isCurrentHouseholdProfile(minimizeHouseholdProfile(completeHousehold)), true);
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

test("only minimized household metadata survives a new PlanningData save", () => {
  const saved = updateHouseholdProfile(structuredClone(seedPlanningDataV3), completeHousehold);
  assert.equal(isPlanningData(saved), true);

  const reloaded: unknown = JSON.parse(JSON.stringify(saved));
  assert.equal(isPlanningData(reloaded), true);
  assert.deepEqual(
    getHouseholdProfile(reloaded as typeof saved),
    {
      adultCount: 2,
      childCount: 2,
      householdDisplayName: "Familjen Solgläntan",
    },
  );
});

test("legacy PlanningData is readable without retaining retired metadata", () => {
  const legacy = { ...structuredClone(seedPlanningDataV3), householdProfile: completeHousehold };
  assert.equal(isPlanningData(legacy), false);
  const current = readPlanningData(legacy);
  assert.ok(current);
  assert.deepEqual(current.householdProfile, {
    adultCount: 2,
    childCount: 2,
    householdDisplayName: "Familjen Solgläntan",
  });
});

test("BankReportModel reads shared household metadata automatically", () => {
  const data = updateHouseholdProfile(structuredClone(seedPlanningDataV3), completeHousehold);
  const report = buildBankReportModel(data, {
    generatedAt: "2026-09-05T10:00:00Z",
    planningYear: 2026,
  });

  assert.deepEqual(report.metadata, {
    adultCount: 2,
    childCount: 2,
    householdDisplayName: "Familjen Solgläntan",
    missing: report.metadata.missing,
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
