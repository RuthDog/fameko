import assert from "node:assert/strict";
import test from "node:test";

import { getFinancialHealthMetricPresentation } from "./financial-health-explainability.ts";
import { evaluateFinancialHealth } from "./financial-health.ts";
import type {
  FinancialHealthMetric,
  FinancialHealthResult,
} from "./financial-health-types.ts";
import { savingsMonthIds } from "./savings.ts";

function metric(
  code: string,
  label: string,
  value: number | null,
  unit: FinancialHealthMetric["unit"] = "percent",
): FinancialHealthMetric {
  return { code, label, source: "cashFlow", unit, value };
}

function result(overrides: Partial<FinancialHealthResult> = {}): FinancialHealthResult {
  return {
    dataCompleteness: {
      availableSources: ["cashFlow"],
      level: "LOW",
      message: "Begränsat underlag",
    },
    metrics: [],
    missingInputs: [],
    status: "GOOD_FOUNDATION",
    statusLabel: "God grund",
    strengths: [],
    summary: "Sammanfattning",
    watchItems: [],
    ...overrides,
  };
}

test("central presentation rules give the approved short metric statuses", () => {
  assert.equal(
    getFinancialHealthMetricPresentation(
      metric("HOUSING_LTV", "Belåningsgrad", 79.4),
      result(),
    ).status.label,
    "Relativt hög",
  );
  assert.equal(
    getFinancialHealthMetricPresentation(
      metric("BUFFER_MONTHS", "Buffert", 0.7, "months"),
      result(),
    ).status.label,
    "Begränsad buffert",
  );
  assert.equal(
    getFinancialHealthMetricPresentation(
      metric("ANNUAL_MARGIN", "Planerad årsmarginal", 238_322, "currency"),
      result(),
    ).status.label,
    "Positiv marginal",
  );
  assert.equal(
    getFinancialHealthMetricPresentation(
      metric("SAVINGS_RATE", "Sparkvot", 17.5),
      result({
        strengths: [
          {
            code: "REGULAR_PLANNED_SAVINGS",
            condition: "monthsWithSavings >= 9",
            message: "Regelbundet sparande",
            metric: "monthsWithSavings",
            source: "savings",
            value: 12,
          },
        ],
      }),
    ).status.label,
    "Regelbundet sparande",
  );
});

test("metric explanations cover meaning, importance and Fameko usage", () => {
  const presentation = getFinancialHealthMetricPresentation(
    metric("HOUSING_LTV", "Belåningsgrad", 79.4),
    result(),
  );

  assert.equal(presentation.explanation.title, "Belåningsgrad");
  assert.match(presentation.explanation.description, /del av bostadens/);
  assert.match(presentation.explanation.importance, /motståndskraft/);
  assert.match(presentation.explanation.usage, /Fameko använder/);
  assert.doesNotMatch(
    Object.values(presentation.explanation).join(" "),
    /du ska|man måste|rätt nivå är/i,
  );
});

test("explainability is read-only and leaves the engine result identical", () => {
  const planningData = {
    expenseCategories: [
      { id: "mat", name: "Mat" },
      { id: "sparande", name: "Sparande" },
    ],
    expenseItems: [
      {
        category: "mat",
        id: "mat",
        monthlyValues: Object.fromEntries(
          savingsMonthIds.map((monthId) => [monthId, 8_000]),
        ),
        name: "Mat",
      },
    ],
    incomes: [
      {
        monthlyValues: Object.fromEntries(
          savingsMonthIds.map((monthId) => [monthId, 45_000]),
        ),
      },
    ],
  };
  const before = evaluateFinancialHealth(planningData, savingsMonthIds);
  const snapshot = structuredClone(before);

  for (const candidate of before.metrics) {
    getFinancialHealthMetricPresentation(candidate, before);
  }

  assert.deepEqual(before, snapshot);
  assert.deepEqual(
    evaluateFinancialHealth(planningData, savingsMonthIds),
    snapshot,
  );
});
