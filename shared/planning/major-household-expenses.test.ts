import assert from "node:assert/strict";
import test from "node:test";

import { resolveBrand } from "../brand/brand-recognition.ts";
import {
  getMajorHouseholdExpenses,
  type MajorHouseholdExpensePlanningData,
} from "./major-household-expenses.ts";

const monthIds = ["jan", "feb", "mar"] as const;

function values(amount: number) {
  return Object.fromEntries(monthIds.map((monthId) => [monthId, amount]));
}

function createPlanningData(): MajorHouseholdExpensePlanningData {
  return {
    expenseCategories: [
      { id: "boende", name: "Boende" },
      { id: "mat", name: "Mat" },
      { id: "bil", name: "Bil" },
      { id: "streaming", name: "Streaming" },
      { id: "sparande", name: "Sparande" },
    ],
    expenseItems: [
      {
        category: "boende",
        id: "boende-hyra",
        monthlyValues: values(8_000),
        name: "Hyra",
      },
      {
        category: "mat",
        id: "mat-mat",
        monthlyValues: values(5_000),
        name: "Mat",
      },
      {
        category: "bil",
        id: "bil-service",
        monthlyValues: values(2_000),
        name: "Service",
      },
      {
        category: "streaming",
        company: "Spotify",
        description: "Premium Family",
        id: "streaming-spotify",
        monthlyValues: values(200),
        name: "Spotify Premium Family",
      },
      {
        category: "sparande",
        id: "sparande-buffert",
        monthlyValues: values(20_000),
        name: "Buffert",
      },
    ],
    housingData: {
      averageInterestRate: 4,
      monthlyAmortization: 12_000,
      propertyValue: 4_000_000,
      totalMortgage: 1_500_000,
      valuationDate: "2026-01-01",
    },
  };
}

test("planned mortgage interest prevents a duplicate HousingData interest cost", () => {
  const planningData = createPlanningData();
  planningData.expenseItems.push({
    category: "boende",
    id: "boende-bolaneranta",
    monthlyValues: values(4_000),
    name: "Bolåneränta",
  });

  const expenses = getMajorHouseholdExpenses({
    limit: 10,
    monthIds,
    planningData,
  });

  assert.equal(
    expenses.some((expense) => expense.source.type === "housingData"),
    false,
  );
  assert.equal(
    expenses.find(
      (expense) =>
        expense.source.type === "planningData" &&
        expense.source.categoryId === "boende",
    )?.annualAmount,
    36_000,
  );
});

test("missing planned interest supplements effective PlanningData with HousingData interest", () => {
  const expenses = getMajorHouseholdExpenses({
    limit: 10,
    monthIds,
    planningData: createPlanningData(),
  });
  const mortgageInterest = expenses.find(
    (expense) => expense.source.type === "housingData",
  );

  assert.deepEqual(mortgageInterest, {
    annualAmount: 60_000,
    id: "housing-mortgage-interest",
    name: "Bolåneränta",
    percentage: 57,
    source: { field: "annualInterestCost", type: "housingData" },
  });
});

test("PlanningData mortgage interest takes precedence over HousingData", () => {
  const planningData = createPlanningData();
  planningData.areaItemValues = {
    mortgageInterest: values(3_000),
  };

  const expenses = getMajorHouseholdExpenses({
    limit: 10,
    monthIds,
    planningData,
  });

  assert.equal(
    expenses.some((expense) => expense.source.type === "housingData"),
    false,
  );
  assert.equal(
    expenses.find((expense) => expense.id === "planning-mortgage-interest")
      ?.annualAmount,
    9_000,
  );
});

test("amortization never contributes to the household cost picture", () => {
  const planningData = createPlanningData();
  planningData.areaItemValues = {
    mortgageAmortization: values(25_000),
  };
  planningData.expenseItems.push({
    category: "boende",
    id: "boende-amortering",
    monthlyValues: values(7_000),
    name: "Amortering",
  });

  const expenses = getMajorHouseholdExpenses({
    limit: 10,
    monthIds,
    planningData,
  });
  const housingCategory = expenses.find(
    (expense) =>
      expense.source.type === "planningData" &&
      expense.source.categoryId === "boende",
  );

  assert.equal(housingCategory?.annualAmount, 24_000);
  assert.equal(
    expenses.some((expense) => expense.name.toLocaleLowerCase("sv-SE").includes("amort")),
    false,
  );
  assert.equal(
    expenses.find((expense) => expense.source.type === "housingData")?.annualAmount,
    60_000,
  );
});

test("sorts by true annual cost and returns no more than the requested top three", () => {
  const expenses = getMajorHouseholdExpenses({
    monthIds,
    planningData: createPlanningData(),
  });

  assert.deepEqual(
    expenses.map((expense) => [expense.name, expense.annualAmount]),
    [
      ["Bolåneränta", 60_000],
      ["Boende", 24_000],
      ["Mat", 15_000],
    ],
  );
});

test("effective category overrides remain the PlanningData source of truth", () => {
  const planningData = createPlanningData();
  planningData.allocationOverrides = {
    food: { feb: 10_000, mar: 12_000 },
  };

  const expenses = getMajorHouseholdExpenses({
    limit: 10,
    monthIds,
    planningData,
  });

  assert.equal(
    expenses.find(
      (expense) =>
        expense.source.type === "planningData" &&
        expense.source.categoryId === "mat",
    )?.annualAmount,
    27_000,
  );
});

test("selector is read-only and leaves Brand Recognition inputs unchanged", () => {
  const planningData = createPlanningData();
  const snapshot = structuredClone(planningData);
  const spotify = planningData.expenseItems.find(
    (item) => item.id === "streaming-spotify",
  );

  getMajorHouseholdExpenses({ monthIds, planningData });

  assert.deepEqual(planningData, snapshot);
  assert.equal(resolveBrand(spotify?.company ?? spotify?.name ?? "").recognized, true);
});

test("legacy PlanningData without HousingData or area values still works", () => {
  const planningData = createPlanningData();
  delete planningData.housingData;

  const expenses = getMajorHouseholdExpenses({ monthIds, planningData });

  assert.deepEqual(
    expenses.map((expense) => expense.name),
    ["Boende", "Mat", "Bil"],
  );
});
