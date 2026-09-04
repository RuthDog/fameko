import assert from "node:assert/strict";
import test from "node:test";

import {
  bankReportSectionOrder,
  buildBankReportModel,
  type BankReportPlanningData,
} from "./bank-report.ts";
import { evaluateFinancialHealth } from "./financial-health.ts";
import { getMajorHouseholdExpenses } from "./major-household-expenses.ts";
import { savingsMonthIds } from "./savings.ts";

function values(amount: number) {
  return Object.fromEntries(
    savingsMonthIds.map((monthId) => [monthId, amount]),
  );
}

function createPlanningData(): BankReportPlanningData {
  return {
    allocationOverrides: { food: values(10_000) },
    carData: {
      annualInsurance: 12_000,
      annualService: 6_000,
      averageInterestRate: 5,
      carName: "Volvo XC40",
      carValue: 300_000,
      currentLoanBalance: 120_000,
      monthlyAmortization: 2_000,
    },
    expenseCategories: [
      { id: "boende", name: "Boende" },
      { id: "bil", name: "Bil" },
      { id: "mat", name: "Mat" },
      { id: "streaming", name: "Streaming" },
      { id: "sparande", name: "Sparande" },
    ],
    expenseItems: [
      {
        category: "boende",
        id: "boende-drift",
        monthlyValues: values(15_000),
        name: "Boende",
        recurring: true,
      },
      {
        category: "bil",
        id: "bil-forsakring",
        monthlyValues: values(1_000),
        name: "Bilförsäkring",
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
        category: "streaming",
        company: "Spotify",
        description: "Premium Family",
        id: "streaming-spotify",
        monthlyValues: values(200),
        name: "Spotify",
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
    financialAssetsData: {
      investments: 150_000,
      liquidSavings: 200_000,
      otherFinancialAssets: 25_000,
      privatePension: 80_000,
    },
    housingData: {
      averageInterestRate: 3,
      monthlyAmortization: 4_000,
      propertyValue: 4_000_000,
      totalMortgage: 2_000_000,
      valuationDate: "2026-08-15",
    },
    householdProfile: { householdDisplayName: "Familjen Fischer" },
    incomeMetadata: {
      salaryOne: {
        employer: "Halmstads kommun",
        employmentType: "permanent",
        occupation: "Avdelningschef",
        incomeComment: "Bonus ingår inte i planeringen",
      },
    },
    incomes: [{ monthlyValues: values(50_000) }],
    labels: { incomeLines: { salaryOne: "Lön Ola" } },
  };
}

test("bank report has the approved professional information hierarchy", () => {
  const report = buildBankReportModel(createPlanningData(), {
    generatedAt: "2026-09-04T10:15:00+02:00",
    planningYear: 2026,
  });

  assert.deepEqual(report.sectionOrder, bankReportSectionOrder);
  assert.deepEqual(report.document, {
    currency: "SEK",
    generatedAt: "2026-09-04T08:15:00.000Z",
    locale: "sv-SE",
    planningYear: 2026,
    reportVersion: 1,
    title: "Hushållets ekonomiska översikt",
  });
  assert.equal(report.summary.annualIncome, 600_000);
  assert.equal(report.summary.householdDisplayName, "Familjen Fischer");
  assert.equal(report.income.averageMonthlyAmount, 50_000);
  assert.deepEqual(report.income.items[0], {
    annualAmount: 600_000,
    comment: "Bonus ingår inte i planeringen",
    displayName: "Lön Ola",
    employer: "Halmstads kommun",
    employmentType: "permanent",
    employmentTypeLabel: "Tillsvidare",
    incomeLineKey: "salaryOne",
    monthlyAmount: 50_000,
    monthlyAmounts: savingsMonthIds.map((monthId) => ({ amount: 50_000, monthId })),
    occupation: "Avdelningschef",
  });
});

test("housing, car and savings reuse their existing source models", () => {
  const report = buildBankReportModel(createPlanningData(), {
    generatedAt: new Date("2026-09-04T08:15:00.000Z"),
    planningYear: 2026,
  });

  assert.equal(report.housing.propertyValue, 4_000_000);
  assert.equal(report.housing.hasData, true);
  assert.equal(report.housing.totalMortgage, 2_000_000);
  assert.equal(report.housing.loanToValue, 50);
  assert.equal(report.housing.annualInterestCost, 60_000);
  assert.equal(report.housing.monthlyAmortization, 4_000);
  assert.equal(report.housing.annualPlannedCosts, 240_000);

  assert.equal(report.car.carValue, 300_000);
  assert.equal(report.car.hasData, true);
  assert.equal(report.car.loanStatus, "withLoan");
  assert.equal(report.car.currentLoanBalance, 120_000);
  assert.equal(report.car.monthlyInterestCost, 500);
  assert.equal(report.car.monthlyLoanCost, 2_500);
  assert.equal(report.car.monthlyInsurance, 1_000);
  assert.equal(report.car.monthlyService, 500);
  assert.equal(report.car.annualPlannedCosts, 12_000);

  assert.equal(report.savings.plannedAnnualAmount, 60_000);
  assert.equal(report.savings.averageMonthlyAmount, 5_000);
  assert.equal(report.savings.assets.liquidBuffer, 200_000);
  assert.equal(report.savings.assets.investments, 150_000);
  assert.equal(report.savings.assets.privatePension, 80_000);
  assert.equal(report.savings.assets.otherFinancialAssets, 25_000);
  assert.equal(report.savings.financialAssetsTotal, 455_000);
  assert.equal(report.summary.financialAssetsTotal, 455_000);
  assert.equal(report.summary.liquidAssets, 200_000);
  assert.equal(report.summary.savingsRate, 10);
});

test("major expenses and Financial Health remain the shared source of truth", () => {
  const planningData = createPlanningData();
  const report = buildBankReportModel(planningData, {
    generatedAt: "2026-09-04",
    planningYear: 2026,
  });
  const majorExpenses = getMajorHouseholdExpenses({
    limit: Number.MAX_SAFE_INTEGER,
    monthIds: savingsMonthIds,
    planningData,
  });
  const health = evaluateFinancialHealth(planningData, savingsMonthIds);

  assert.deepEqual(report.majorExpenses, majorExpenses.slice(0, 3));
  assert.equal(report.summary.financialHealthStatus, health.status);
  assert.equal(report.financialHealth.summary, health.summary);
  assert.deepEqual(report.financialHealth.strengths, health.strengths);
  assert.deepEqual(report.financialHealth.watchItems, health.watchItems);
  assert.equal("score" in report.financialHealth, false);
});

test("effective values and Company/Description are preserved in source details", () => {
  const report = buildBankReportModel(createPlanningData(), {
    generatedAt: "2026-09-04",
    planningYear: 2026,
  });
  const food = report.sourceDetails.planningItems.find(
    (item) => item.id === "mat-mat",
  );
  const spotify = report.sourceDetails.planningItems.find(
    (item) => item.id === "streaming-spotify",
  );

  assert.equal(food?.annualAmount, 120_000);
  assert.equal(spotify?.company, "Spotify");
  assert.equal(spotify?.description, "Premium Family");
  assert.equal(spotify?.displayName, "Spotify Premium Family");
});

test("planned mortgage interest stays represented through Major Expenses", () => {
  const planningData = createPlanningData();
  planningData.areaItemValues = { mortgageInterest: values(3_500) };
  const report = buildBankReportModel(planningData, {
    generatedAt: "2026-09-04",
    planningYear: 2026,
  });

  assert.equal(report.housing.annualPlannedCosts, 222_000);
  assert.equal(
    report.majorExpenses.some(
      (expense) => expense.id === "planning-mortgage-interest",
    ),
    true,
  );
});

test("legacy planning data stays valid and missing report metadata is null", () => {
  const planningData: BankReportPlanningData = {
    expenseItems: [],
    incomes: [{ monthlyValues: values(0) }],
  };
  const report = buildBankReportModel(planningData, {
    generatedAt: "2026-09-04",
    planningYear: 2026,
  });

  assert.equal(report.housing.propertyValue, null);
  assert.equal(report.housing.hasData, false);
  assert.equal(report.housing.loanToValue, null);
  assert.equal(report.car.carValue, null);
  assert.equal(report.car.hasData, false);
  assert.equal(report.car.loanStatus, "unknown");
  assert.equal(report.savings.assets.liquidBuffer, null);
  assert.equal(report.metadata.householdDisplayName, null);
  assert.deepEqual(report.income.items, []);
  assert.deepEqual(
    report.metadata.missing.map((metadata) => metadata.field),
    [
      "householdDisplayName",
      "incomeEmployer",
      "incomeEmploymentType",
      "incomeOccupation",
      "incomeComment",
    ],
  );
});

test("an explicitly loan-free car is report-ready without UI interpretation", () => {
  const planningData = createPlanningData();
  planningData.carData = {
    ...planningData.carData!,
    averageInterestRate: null,
    currentLoanBalance: 0,
    monthlyAmortization: 0,
  };

  const report = buildBankReportModel(planningData, {
    generatedAt: "2026-09-04",
    planningYear: 2026,
  });

  assert.equal(report.car.hasData, true);
  assert.equal(report.car.loanStatus, "loanFree");
  assert.equal(report.car.currentLoanBalance, 0);
  assert.equal(report.car.monthlyLoanCost, 0);
});

test("income amount remains PlanningData truth while metadata is descriptive only", () => {
  const planningData = createPlanningData();
  planningData.incomeLineValues = {
    salaryOne: values(68_500),
    salaryTwo: values(24_000),
  };
  planningData.incomeMetadata = {
    ...planningData.incomeMetadata,
    salaryTwo: {
      employer: "Region Halland",
      employmentType: "temporary",
      occupation: "Sjuksköterska",
      incomeComment: null,
    },
  };
  planningData.labels = {
    ...planningData.labels,
    incomeLines: { salaryOne: "Lön Ola", salaryTwo: "Lön Therese" },
  };

  const report = buildBankReportModel(planningData, {
    generatedAt: "2026-09-04",
    planningYear: 2026,
  });
  const firstIncome = report.income.items.find((income) => income.incomeLineKey === "salaryOne");
  const secondIncome = report.income.items.find((income) => income.incomeLineKey === "salaryTwo");

  assert.equal(firstIncome?.annualAmount, 822_000);
  assert.equal(firstIncome?.monthlyAmount, 68_500);
  assert.equal(firstIncome?.employer, "Halmstads kommun");
  assert.equal(secondIncome?.annualAmount, 288_000);
  assert.equal(secondIncome?.monthlyAmount, 24_000);
  assert.equal(secondIncome?.employmentTypeLabel, "Visstid");
  assert.equal("salary" in (planningData.incomeMetadata?.salaryOne ?? {}), false);
});

test("variable income has annual truth but no invented fixed monthly amount", () => {
  const planningData = createPlanningData();
  planningData.incomeLineValues = {
    salaryOne: Object.fromEntries(
      savingsMonthIds.map((monthId, index) => [monthId, 50_000 + index * 100]),
    ),
  };

  const report = buildBankReportModel(planningData, {
    generatedAt: "2026-09-04",
    planningYear: 2026,
  });

  assert.equal(report.income.items[0]?.annualAmount, 606_600);
  assert.equal(report.income.items[0]?.monthlyAmount, null);
});

test("building a report is deterministic and never mutates PlanningData", () => {
  const planningData = createPlanningData();
  const snapshot = structuredClone(planningData);
  const options = { generatedAt: "2026-09-04", planningYear: 2026 };

  assert.deepEqual(
    buildBankReportModel(planningData, options),
    buildBankReportModel(planningData, options),
  );
  assert.deepEqual(planningData, snapshot);
  assert.throws(
    () => buildBankReportModel(planningData, { ...options, generatedAt: "invalid" }),
    RangeError,
  );
});
