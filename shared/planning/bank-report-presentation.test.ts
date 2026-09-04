import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { BankReportModel } from "./bank-report.ts";
import {
  getExecutiveSnapshot,
  getExecutiveSummaryParagraphs,
} from "./bank-report-presentation.ts";

function reportWithObservations({
  strengthCodes = [],
  watchCodes = [],
}: {
  strengthCodes?: string[];
  watchCodes?: string[];
}) {
  return {
    financialHealth: {
      strengths: strengthCodes.map((code) => ({ code })),
      summary: "Befintlig strukturerad sammanfattning.",
      watchItems: watchCodes.map((code) => ({ code })),
    },
    summary: {
      financialHealthSummary: "Befintlig strukturerad sammanfattning.",
    },
  } as BankReportModel;
}

test("Executive Summary tells the household story from classified observations", () => {
  const report = reportWithObservations({
    strengthCodes: [
      "POSITIVE_ANNUAL_MARGIN",
      "REGULAR_PLANNED_SAVINGS",
      "PRIVATE_INVESTMENTS",
    ],
    watchCodes: ["HIGH_HOUSING_LTV"],
  });

  assert.deepEqual(getExecutiveSummaryParagraphs(report), [
    "Hushållets planering visar positiv årsmarginal och regelbundet sparande.",
    "Boendets belåningsgrad är relativt hög.",
    "Hushållet har privata finansiella tillgångar som bidrar till den långsiktiga ekonomiska grunden.",
  ]);
});

test("Executive Snapshot uses existing classifications and a fixed presentation priority", () => {
  const report = reportWithObservations({
    strengthCodes: [
      "PRIVATE_INVESTMENTS",
      "REGULAR_PLANNED_SAVINGS",
      "POSITIVE_ANNUAL_MARGIN",
    ],
    watchCodes: ["HIGH_HOUSING_LTV"],
  });

  assert.deepEqual(getExecutiveSnapshot(report), [
    { code: "POSITIVE_ANNUAL_MARGIN", label: "Positiv årsmarginal", tone: "positive" },
    { code: "REGULAR_PLANNED_SAVINGS", label: "Regelbundet sparande", tone: "positive" },
    { code: "HIGH_HOUSING_LTV", label: "Relativt hög belåningsgrad", tone: "watch" },
    { code: "PRIVATE_INVESTMENTS", label: "Privata investeringar", tone: "positive" },
  ]);
});

test("limited input falls back to the existing BankReportModel summary", () => {
  const report = reportWithObservations({});

  assert.deepEqual(getExecutiveSummaryParagraphs(report), [
    "Befintlig strukturerad sammanfattning.",
  ]);
  assert.deepEqual(getExecutiveSnapshot(report), []);
});

test("the presentation layer contains no selectors, thresholds, or economic calculations", () => {
  const source = readFileSync(
    new URL("./bank-report-presentation.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /PlanningData|HousingData|CarData/);
  assert.doesNotMatch(
    source,
    /evaluateFinancialHealth|getMajorHouseholdExpenses|getSavingsOverview|calculateHousing|calculateCar/,
  );
  assert.doesNotMatch(source, /annualMargin\s*[<>]=?|loanToValue\s*[<>]=?/);
});
