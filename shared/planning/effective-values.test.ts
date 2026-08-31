import assert from "node:assert/strict";
import test from "node:test";

import {
  applyScopedMonthValue,
  getEffectiveExpenseCategoryAmount,
  getEffectiveExpenseCategoryTotals,
  getEffectiveExpenseItemAmount,
  type PlanningEditScope,
} from "./effective-values.ts";
import {
  buildMobileUpcomingInsights,
  type MobileInsightsPlanningSource,
} from "./mobile-insights.ts";
import { seedPlanningDataV3 } from "./seed-planning-data.ts";

const monthIds = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
] as const;

function monthSources(data: MobileInsightsPlanningSource) {
  return monthIds.map((id) => {
    const costTotal = getEffectiveExpenseCategoryTotals(data, [id])
      .filter((category) => category.id !== "sparande")
      .reduce((total, category) => total + category.total, 0);

    return {
      costTotal,
      id,
      income: 54_800,
      name: id,
      remaining: 54_800 - costTotal,
    };
  });
}

function insightAmounts(
  data: MobileInsightsPlanningSource,
  eventMatches: (event: { id: string; title: string }) => boolean,
) {
  return buildMobileUpcomingInsights({
    currentMonthId: "aug",
    monthIds: [...monthIds],
    months: monthSources(data),
    planningData: data,
  }).map((insight) => {
    const detail = insight.events.find(eventMatches)?.detail;
    return detail ? Number(detail.replace(/\D/g, "")) : null;
  });
}

function foodData(
  targetMonthId: string,
  scope: PlanningEditScope,
): MobileInsightsPlanningSource {
  const data = structuredClone(seedPlanningDataV3) as MobileInsightsPlanningSource;
  data.allocationOverrides = {
    food: applyScopedMonthValue(undefined, monthIds, targetMonthId, 10_000, scope),
  };
  return data;
}

function onlyFood(data: MobileInsightsPlanningSource): MobileInsightsPlanningSource {
  return {
    allocationOverrides: data.allocationOverrides,
    expenseCategories: data.expenseCategories?.filter((category) => category.id === "mat"),
    expenseItems: data.expenseItems.filter((item) => item.category === "mat"),
    labels: data.labels,
  };
}

test("effective food values replace the old seed values in annual planning, insights and largest costs", () => {
  const data = foodData("sep", "future");
  const foodItem = data.expenseItems.find((item) => item.id === "mat-mat");
  assert.ok(foodItem);

  assert.deepEqual(
    ["sep", "okt", "nov"].map((monthId) => foodItem.monthlyValues[monthId]),
    [7_800, 7_900, 8_700],
  );
  assert.deepEqual(
    ["sep", "okt", "nov"].map((monthId) =>
      getEffectiveExpenseCategoryAmount(data, "mat", monthId),
    ),
    [10_000, 10_000, 10_000],
  );
  assert.deepEqual(
    ["sep", "okt", "nov"].map((monthId) =>
      getEffectiveExpenseItemAmount(data, foodItem, monthId),
    ),
    [10_000, 10_000, 10_000],
  );
  assert.deepEqual(
    insightAmounts(
      onlyFood(data),
      (event) => event.title === "Mat" || event.id.includes("mat-mat"),
    ),
    [10_000, 10_000, 10_000],
  );
  assert.equal(
    getEffectiveExpenseCategoryTotals(data, monthIds).find(
      (category) => category.id === "mat",
    )?.total,
    107_100,
  );
});

test("food effective values respect one month, this and following, and all months", () => {
  const cases: Array<{
    data: MobileInsightsPlanningSource;
    expected: number[];
    expectedYearTotal: number;
    name: string;
  }> = [
    {
      data: foodData("sep", "single"),
      expected: [10_000, 7_900, 8_700],
      expectedYearTotal: 104_500,
      name: "only this month",
    },
    {
      data: foodData("sep", "future"),
      expected: [10_000, 10_000, 10_000],
      expectedYearTotal: 107_100,
      name: "this and following months",
    },
    {
      data: foodData("jan", "future"),
      expected: [10_000, 10_000, 10_000],
      expectedYearTotal: 120_000,
      name: "all months",
    },
  ];

  for (const currentCase of cases) {
    assert.deepEqual(
      ["sep", "okt", "nov"].map((monthId) =>
        getEffectiveExpenseCategoryAmount(currentCase.data, "mat", monthId),
      ),
      currentCase.expected,
      currentCase.name,
    );
    assert.deepEqual(
      insightAmounts(
        onlyFood(currentCase.data),
        (event) => event.title === "Mat" || event.id.includes("mat-mat"),
      ),
      currentCase.expected,
      currentCase.name,
    );
    assert.equal(
      getEffectiveExpenseCategoryTotals(currentCase.data, monthIds).find(
        (category) => category.id === "mat",
      )?.total,
      currentCase.expectedYearTotal,
      currentCase.name,
    );
  }
});

test("ordinary expense items use the same three scope results in mobile insights", () => {
  const cases: Array<{
    expected: number[];
    scope: PlanningEditScope;
    targetMonthId: string;
  }> = [
    { expected: [12_000, 4_000, 4_000], scope: "single", targetMonthId: "sep" },
    { expected: [12_000, 12_000, 12_000], scope: "future", targetMonthId: "sep" },
    { expected: [12_000, 12_000, 12_000], scope: "future", targetMonthId: "jan" },
  ];

  for (const currentCase of cases) {
    const item = {
      category: "ovrigt",
      id: "ovrigt-test",
      monthlyValues: applyScopedMonthValue(
        Object.fromEntries(monthIds.map((monthId) => [monthId, 4_000])),
        monthIds,
        currentCase.targetMonthId,
        12_000,
        currentCase.scope,
      ),
      name: "Övrigt",
      recurring: true,
    };
    const data: MobileInsightsPlanningSource = {
      expenseCategories: [{ id: "ovrigt", name: "Övrigt" }],
      expenseItems: [item],
    };

    assert.deepEqual(
      insightAmounts(
        data,
        (event) => event.title === "Övrigt" || event.id.includes(item.id),
      ),
      currentCase.expected,
    );
  }
});
