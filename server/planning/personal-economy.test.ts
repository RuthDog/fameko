import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateSavingsPreview,
  getCarPreviewSummary,
  getSavingsPreviewSummary,
} from "../../shared/planning/personal-economy.ts";
import { emptyCarData } from "../../shared/planning/car.ts";
import {
  getAnnualCarOperatingCost,
  getCarPreviewStatus,
  getHousingPreviewStatus,
  getSavingsPreviewStatus,
} from "../../shared/planning/personal-economy-status.ts";

test("savings preview derives annual values without a second data source", () => {
  const economics = calculateSavingsPreview(
    [1_000, 2_000, 3_000],
    [10_000, 10_000, 10_000],
  );

  assert.deepEqual(economics, {
    averageMonthlySavings: 2_000,
    monthsWithSavings: 3,
    savingsRate: 20,
    totalPlannedSavings: 6_000,
  });
  assert.equal(getSavingsPreviewSummary(economics, 3), "Du sparar regelbundet varje månad.");
});

test("preview summaries are deterministic and fail calmly when values are missing", () => {
  assert.equal(
    getCarPreviewSummary({ loanPayment: 0, monthlyCost: 0, monthlyIncome: 0 }),
    "Det finns inga planerade bilkostnader den här månaden.",
  );

  const savings = calculateSavingsPreview([], []);
  assert.equal(savings.savingsRate, null);
  assert.equal(getSavingsPreviewSummary(savings, 0), "Det finns inget planerat sparande ännu.");
});

test("housing status uses loan-to-value, interest and amortization rules", () => {
  const base = {
    averageInterestRate: 3.5,
    monthlyAmortization: 2_500,
    propertyValue: 4_000_000,
    totalMortgage: 2_000_000,
    valuationDate: null,
  };

  assert.equal(getHousingPreviewStatus(undefined).tone, "unknown");
  assert.equal(getHousingPreviewStatus(base).label, "Stabilt");
  assert.equal(
    getHousingPreviewStatus({ ...base, totalMortgage: 3_304_000 }).label,
    "Behöver lite uppmärksamhet",
  );
  assert.equal(
    getHousingPreviewStatus({ ...base, totalMortgage: 3_500_000 }).label,
    "Bör ses över",
  );
  assert.equal(
    getHousingPreviewStatus({ ...base, averageInterestRate: 6 }).label,
    "Bör ses över",
  );
});

test("car status distinguishes unknown, loan-free, active loan and review", () => {
  assert.equal(getCarPreviewStatus(undefined).tone, "unknown");
  assert.equal(
    getCarPreviewStatus({ ...emptyCarData, currentLoanBalance: 0 }).label,
    "Lånefri",
  );
  assert.equal(
    getCarPreviewStatus({ ...emptyCarData, currentLoanBalance: 150_000 }).label,
    "Billån",
  );
  assert.equal(
    getCarPreviewStatus({
      ...emptyCarData,
      averageInterestRate: 7,
      currentLoanBalance: 150_000,
    }).label,
    "Bör ses över",
  );
  assert.equal(
    getAnnualCarOperatingCost({
      ...emptyCarData,
      annualInsurance: 7_200,
      annualService: 6_000,
    }),
    13_200,
  );
});

test("savings status follows the shared savings rate", () => {
  const economics = (savingsRate: number | null) => ({
    averageMonthlySavings: 2_000,
    monthsWithSavings: 12,
    savingsRate,
    totalPlannedSavings: 24_000,
  });

  assert.equal(getSavingsPreviewStatus(economics(null)).tone, "unknown");
  assert.equal(getSavingsPreviewStatus(economics(20)).label, "Fortsätt så");
  assert.equal(getSavingsPreviewStatus(economics(17.7)).label, "Stabilt");
  assert.equal(
    getSavingsPreviewStatus(economics(5)).label,
    "Behöver lite uppmärksamhet",
  );
  assert.equal(getSavingsPreviewStatus(economics(0)).label, "Bör ses över");
});
