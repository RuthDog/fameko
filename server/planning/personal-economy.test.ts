import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateSavingsPreview,
  getCarPreviewSummary,
  getSavingsPreviewSummary,
} from "../../shared/planning/personal-economy.ts";

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
