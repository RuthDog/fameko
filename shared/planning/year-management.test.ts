import assert from "node:assert/strict";
import test from "node:test";

import { emptyPlanningDataV3, seedPlanningDataV3 } from "./seed-planning-data.ts";
import {
  activePlanningYearStorageKey,
  clonePlanningYearData,
  getNextPlanningYear,
  normalizePlanningYears,
  readStoredActivePlanningYear,
  storeActivePlanningYear,
  transferPlanningYearData,
} from "./year-management.ts";

test("creates an independent empty planning year", () => {
  const empty = clonePlanningYearData(emptyPlanningDataV3);

  assert.deepEqual(empty, emptyPlanningDataV3);
  assert.notEqual(empty, emptyPlanningDataV3);
  assert.notEqual(empty.expenseCategories, emptyPlanningDataV3.expenseCategories);
});

test("copies the complete year including HousingData, CarData and brand labels", () => {
  const source = {
    ...seedPlanningDataV3,
    carData: {
      annualInsurance: 7_200,
      annualService: 4_000,
      currentLoanBalance: 0,
      monthlyLoanPayment: 0,
      yearlyTax: 2_200,
    },
    housingData: {
      averageInterestRate: 3.4,
      monthlyAmortization: 4_000,
      propertyValue: 4_500_000,
      totalMortgage: 2_900_000,
      valuationDate: "2026-08-01",
    },
    financialAssetsData: {
      investments: 100_000,
      liquidSavings: 150_000,
      otherFinancialAssets: null,
      privatePension: 80_000,
    },
    labels: {
      expenseItems: { "streaming-spotify": "Spotify Premium Family" },
    },
  };
  const copy = clonePlanningYearData(source);

  assert.deepEqual(copy, source);
  assert.notEqual(copy, source);
  assert.notEqual(copy.housingData, source.housingData);
  assert.notEqual(copy.carData, source.carData);
  assert.notEqual(copy.financialAssetsData, source.financialAssetsData);
  assert.equal(copy.labels.expenseItems["streaming-spotify"], "Spotify Premium Family");
});

test("missing transfer adds absent IDs and fills absent module values without duplicates", () => {
  const source = {
    version: 3,
    openingBalance: 10,
    incomes: [
      { id: "salary", name: "Lön", monthlyValues: { jan: 30_000 }, recurring: true },
      { id: "benefit", name: "Bidrag", monthlyValues: { jan: 1_000 }, recurring: true },
    ],
    expenseCategories: [{ id: "home", name: "Boende", order: 0 }],
    expenseItems: [
      { id: "rent", category: "home", name: "Hyra", monthlyValues: { jan: 9_000 }, recurring: true },
      { id: "electricity", category: "home", name: "El", monthlyValues: { jan: 800 }, recurring: true },
    ],
    housingData: { propertyValue: 4_000_000, averageInterestRate: 3.5 },
    labels: { expenseItems: { electricity: "Elbolaget" } },
  };
  const target = {
    ...source,
    openingBalance: 99,
    incomes: [
      { id: "salary", name: "Ny lön", monthlyValues: { jan: 35_000 }, recurring: true },
    ],
    expenseItems: [
      { id: "rent", category: "home", name: "Ny hyra", monthlyValues: { jan: 10_000 }, recurring: true },
    ],
    housingData: { propertyValue: 4_500_000, averageInterestRate: null },
    labels: { expenseItems: { rent: "Hyresvärden" } },
  };
  const merged = transferPlanningYearData(source, target, "missing");

  assert.equal(merged.openingBalance, 99);
  assert.deepEqual(merged.incomes.map((item) => item.id), ["salary", "benefit"]);
  assert.equal(merged.incomes[0].name, "Ny lön");
  assert.deepEqual(merged.expenseItems.map((item) => item.id), ["rent", "electricity"]);
  assert.equal(merged.expenseItems[0].name, "Ny hyra");
  assert.deepEqual(merged.housingData, {
    propertyValue: 4_500_000,
    averageInterestRate: 3.5,
  });
  assert.deepEqual(merged.labels.expenseItems, {
    rent: "Hyresvärden",
    electricity: "Elbolaget",
  });
});

test("overwrite replaces corresponding data and never mutates either year", () => {
  const source = { version: 3, openingBalance: 10, expenseItems: [{ id: "source" }] };
  const target = { version: 3, openingBalance: 20, expenseItems: [{ id: "target" }] };
  const sourceBefore = clonePlanningYearData(source);
  const targetBefore = clonePlanningYearData(target);
  const overwritten = transferPlanningYearData(source, target, "overwrite");

  assert.deepEqual(overwritten, source);
  assert.notEqual(overwritten, source);
  assert.deepEqual(source, sourceBefore);
  assert.deepEqual(target, targetBefore);
});

test("year lists contain only real unique supported years", () => {
  assert.deepEqual(normalizePlanningYears([2028, 2026, 2027, 2027, 1999, 2201]), [
    2026,
    2027,
    2028,
  ]);
  assert.equal(getNextPlanningYear(2026), 2027);
});

test("the active year preference is bounded and reusable by detail pages", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };

  assert.equal(readStoredActivePlanningYear(storage, 2026), 2026);
  storeActivePlanningYear(storage, 2028);
  assert.equal(values.get(activePlanningYearStorageKey), "2028");
  assert.equal(readStoredActivePlanningYear(storage, 2026), 2028);
  values.set(activePlanningYearStorageKey, "9999");
  assert.equal(readStoredActivePlanningYear(storage, 2026), 2026);
});
