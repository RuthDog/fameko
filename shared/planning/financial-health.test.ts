import assert from "node:assert/strict";
import test from "node:test";

import { isPlanningData } from "../../server/planning/planning-schema.ts";
import {
  emptyFinancialAssetsData,
  isFinancialAssetsData,
} from "./financial-assets.ts";
import {
  evaluateFinancialHealth,
  type FinancialHealthPlanningData,
} from "./financial-health.ts";
import { savingsMonthIds } from "./savings.ts";

function values(amount: number) {
  return Object.fromEntries(savingsMonthIds.map((monthId) => [monthId, amount]));
}

function createPlanningData(): FinancialHealthPlanningData & {
  openingBalance: number;
  version: 3;
} {
  return {
    version: 3,
    openingBalance: 0,
    incomes: [
      {
        monthlyValues: values(50_000),
      },
    ],
    expenseCategories: [
      { id: "boende", name: "Boende" },
      { id: "mat", name: "Mat" },
      { id: "sparande", name: "Sparande" },
      { id: "lan-och-krediter", name: "Lån och krediter" },
    ],
    expenseItems: [
      {
        category: "boende",
        id: "boende-hyra",
        monthlyValues: values(15_000),
        name: "Hyra",
        recurring: true,
      },
      {
        category: "mat",
        id: "mat-mat",
        monthlyValues: values(8_000),
        name: "Mat",
        recurring: true,
      },
      {
        category: "sparande",
        id: "sparmal-buffert",
        monthlyValues: values(5_000),
        name: "Buffert",
        recurring: true,
      },
    ],
  };
}

function metric(
  result: ReturnType<typeof evaluateFinancialHealth>,
  code: string,
) {
  return result.metrics.find((candidate) => candidate.code === code)?.value;
}

test("FinancialAssetsData is optional, nullable and rejects malformed amounts", () => {
  assert.equal(isFinancialAssetsData(emptyFinancialAssetsData), true);
  assert.equal(
    isFinancialAssetsData({
      ...emptyFinancialAssetsData,
      liquidSavings: 200_000,
    }),
    true,
  );
  assert.equal(
    isFinancialAssetsData({ ...emptyFinancialAssetsData, liquidSavings: -1 }),
    false,
  );
  assert.equal(
    isFinancialAssetsData({ ...emptyFinancialAssetsData, extra: 1 }),
    false,
  );
});

test("PlanningData validation accepts FinancialAssetsData in the existing document", () => {
  const data = {
    ...createPlanningData(),
    expenseCategories: createPlanningData().expenseCategories?.map(
      (category, order) => ({ ...category, order }),
    ),
    financialAssetsData: {
      investments: 150_000,
      liquidSavings: 200_000,
      otherFinancialAssets: null,
      privatePension: 80_000,
    },
    incomes: [
      {
        id: "income",
        monthlyValues: values(50_000),
        name: "Inkomst",
        recurring: true,
      },
    ],
  };

  assert.equal(isPlanningData(data), true);
  assert.equal(isPlanningData({ ...data, financialAssetsData: {} }), false);
});

test("positive cash flow, regular savings and low debt produce a positive stable assessment", () => {
  const data = createPlanningData();
  data.financialAssetsData = {
    investments: 100_000,
    liquidSavings: 300_000,
    otherFinancialAssets: null,
    privatePension: 150_000,
  };
  data.housingData = {
    averageInterestRate: 3,
    monthlyAmortization: 5_000,
    propertyValue: 4_000_000,
    totalMortgage: 1_000_000,
    valuationDate: "2026-01-01",
  };
  data.carData = {
    annualInsurance: 6_000,
    annualService: 4_000,
    averageInterestRate: null,
    carName: "Familjebil",
    carValue: 200_000,
    currentLoanBalance: 0,
    monthlyAmortization: null,
  };

  const result = evaluateFinancialHealth(data, savingsMonthIds);

  assert.equal(result.status, "STABLE");
  assert.ok(result.strengths.some((item) => item.code === "POSITIVE_ANNUAL_MARGIN"));
  assert.ok(result.strengths.some((item) => item.code === "REGULAR_PLANNED_SAVINGS"));
  assert.ok(result.strengths.some((item) => item.code === "LOW_HOUSING_LTV"));
});

test("several negative months create a cash-flow watch item", () => {
  const data = createPlanningData();
  const rent = data.expenseItems.find((item) => item.id === "boende-hyra");
  if (!rent) throw new Error("Missing test rent");
  rent.monthlyValues.jan = 60_000;
  rent.monthlyValues.feb = 60_000;

  const result = evaluateFinancialHealth(data, savingsMonthIds);

  assert.ok(result.watchItems.some((item) => item.code === "SEVERAL_NEGATIVE_MONTHS"));
  assert.equal(metric(result, "NEGATIVE_MONTHS"), 2);
});

test("high housing loan-to-value creates an explainable housing watch item", () => {
  const data = createPlanningData();
  data.housingData = {
    averageInterestRate: 3,
    monthlyAmortization: 3_000,
    propertyValue: 1_000_000,
    totalMortgage: 850_000,
    valuationDate: "2026-01-01",
  };

  const result = evaluateFinancialHealth(data, savingsMonthIds);
  const watch = result.watchItems.find((item) => item.code === "HIGH_HOUSING_LTV");

  assert.equal(watch?.source, "housing");
  assert.equal(watch?.metric, "loanToValue");
  assert.equal(watch?.value, 85);
});

test("an explicitly loan-free car is a strength", () => {
  const data = createPlanningData();
  data.carData = {
    annualInsurance: null,
    annualService: null,
    averageInterestRate: null,
    carName: "Bil",
    carValue: 150_000,
    currentLoanBalance: 0,
    monthlyAmortization: null,
  };

  const result = evaluateFinancialHealth(data, savingsMonthIds);

  assert.ok(result.strengths.some((item) => item.code === "LOAN_FREE_CAR"));
});

test("car debt above the known car value creates a watch item", () => {
  const data = createPlanningData();
  data.carData = {
    annualInsurance: null,
    annualService: null,
    averageInterestRate: 5,
    carName: "Bil",
    carValue: 100_000,
    currentLoanBalance: 130_000,
    monthlyAmortization: 2_000,
  };

  const result = evaluateFinancialHealth(data, savingsMonthIds);

  assert.ok(result.watchItems.some((item) => item.code === "CAR_LOAN_ABOVE_VALUE"));
  assert.equal(metric(result, "CAR_LOAN_TO_VALUE"), 130);
});

test("a large liquid buffer creates a buffer strength", () => {
  const data = createPlanningData();
  data.financialAssetsData = {
    ...emptyFinancialAssetsData,
    liquidSavings: 150_000,
  };

  const result = evaluateFinancialHealth(data, savingsMonthIds);

  assert.ok(result.strengths.some((item) => item.code === "RESILIENT_LIQUID_BUFFER"));
  assert.ok((metric(result, "BUFFER_MONTHS") ?? 0) > 3);
});

test("private pension strengthens the long-term picture but never the liquid buffer", () => {
  const data = createPlanningData();
  data.financialAssetsData = {
    ...emptyFinancialAssetsData,
    privatePension: 500_000,
  };

  const result = evaluateFinancialHealth(data, savingsMonthIds);

  assert.ok(result.strengths.some((item) => item.code === "PRIVATE_PENSION_SAVINGS"));
  assert.equal(metric(result, "BUFFER_MONTHS"), null);
  assert.ok(result.missingInputs.some((item) => item.code === "MISSING_LIQUID_SAVINGS"));
});

test("planned savings is excluded from the household-cost denominator", () => {
  const data = createPlanningData();
  const savings = data.expenseItems.find((item) => item.category === "sparande");
  if (!savings) throw new Error("Missing test savings");
  savings.monthlyValues = values(20_000);
  data.financialAssetsData = {
    ...emptyFinancialAssetsData,
    liquidSavings: 276_000,
  };

  const result = evaluateFinancialHealth(data, savingsMonthIds);

  assert.equal(metric(result, "ANNUAL_HOUSEHOLD_COSTS"), 276_000);
  assert.equal(metric(result, "BUFFER_MONTHS"), 12);
});

test("amortization is never counted as a household cost", () => {
  const data = createPlanningData();
  data.areaItemValues = { mortgageAmortization: values(10_000) };
  data.expenseItems.push({
    category: "boende",
    id: "boende-amortering",
    monthlyValues: values(7_000),
    name: "Amortering",
    recurring: true,
  });

  const result = evaluateFinancialHealth(data, savingsMonthIds);

  assert.equal(metric(result, "ANNUAL_HOUSEHOLD_COSTS"), 276_000);
});

test("CSN is not automatically classified as consumer credit", () => {
  const data = createPlanningData();
  data.expenseItems.push({
    category: "lan-och-krediter",
    id: "debt-csn",
    monthlyValues: values(1_000),
    name: "CSN",
    recurring: true,
  });

  const result = evaluateFinancialHealth(data, savingsMonthIds);

  assert.equal(
    result.watchItems.some((item) => item.code === "PLANNED_CONSUMER_CREDIT_PAYMENTS"),
    false,
  );
});

test("explicit consumer credit is classified conservatively and explainably", () => {
  const data = createPlanningData();
  data.expenseItems.push({
    category: "lan-och-krediter",
    id: "debt-credit-card",
    monthlyValues: values(1_000),
    name: "Kreditkort",
    recurring: true,
  });

  const result = evaluateFinancialHealth(data, savingsMonthIds);
  const watch = result.watchItems.find(
    (item) => item.code === "PLANNED_CONSUMER_CREDIT_PAYMENTS",
  );

  assert.equal(watch?.source, "debts");
  assert.equal(watch?.value, 12_000);
});

test("effective scoped values drive financial-health costs", () => {
  const data = createPlanningData();
  data.allocationOverrides = {
    food: {
      sep: 10_000,
      okt: 10_000,
      nov: 10_000,
      dec: 10_000,
    },
  };

  const result = evaluateFinancialHealth(data, savingsMonthIds);

  assert.equal(metric(result, "ANNUAL_HOUSEHOLD_COSTS"), 284_000);
});

test("missing asset values remain unknown rather than becoming zero", () => {
  const result = evaluateFinancialHealth(createPlanningData(), savingsMonthIds);

  assert.equal(metric(result, "BUFFER_MONTHS"), null);
  assert.ok(result.missingInputs.some((item) => item.code === "MISSING_LIQUID_SAVINGS"));
});

test("very little data returns INSUFFICIENT_DATA", () => {
  const data = createPlanningData();
  data.incomes[0].monthlyValues = values(0);
  data.expenseItems = [];

  const result = evaluateFinancialHealth(data, savingsMonthIds);

  assert.equal(result.status, "INSUFFICIENT_DATA");
  assert.equal(result.dataCompleteness.level, "LOW");
});

test("labels and dates alone do not overstate data completeness", () => {
  const data = createPlanningData();
  data.incomes[0].monthlyValues = values(0);
  data.expenseItems = [];
  data.housingData = {
    averageInterestRate: null,
    monthlyAmortization: null,
    propertyValue: null,
    totalMortgage: null,
    valuationDate: "2026-01-01",
  };
  data.carData = {
    annualInsurance: null,
    annualService: null,
    averageInterestRate: null,
    carName: "Familjebil",
    carValue: null,
    currentLoanBalance: null,
    monthlyAmortization: null,
  };

  const result = evaluateFinancialHealth(data, savingsMonthIds);

  assert.equal(result.dataCompleteness.level, "LOW");
  assert.deepEqual(result.dataCompleteness.availableSources, []);
});

test("the caller-selected active PlanningYear fully controls the analysis", () => {
  const stableYear = createPlanningData();
  const vulnerableYear = createPlanningData();
  vulnerableYear.incomes[0].monthlyValues = values(10_000);

  assert.notEqual(
    evaluateFinancialHealth(stableYear, savingsMonthIds).status,
    evaluateFinancialHealth(vulnerableYear, savingsMonthIds).status,
  );
});

test("the engine is read-only and deterministic", () => {
  const data = createPlanningData();
  const snapshot = structuredClone(data);

  const first = evaluateFinancialHealth(data, savingsMonthIds);
  const second = evaluateFinancialHealth(data, savingsMonthIds);

  assert.deepEqual(data, snapshot);
  assert.deepEqual(first, second);
});
