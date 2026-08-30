import assert from "node:assert/strict";
import test from "node:test";

import { seedPlanningDataV3 } from "../../shared/planning/seed-planning-data.ts";
import { calculateSavingsPreview } from "../../shared/planning/personal-economy.ts";
import {
  calculateSavingsRate,
  createSavingsGoal,
  getSavingsGoals,
  getSavingsOverview,
  migrateLegacySavingsStructure,
  renameSavingsGoal,
  selectMonthlySavingsMetrics,
  sumSavingsGoalsForMonth,
} from "../../shared/planning/savings.ts";

const months = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const values = (amount: number) => Object.fromEntries(months.map((month) => [month, amount]));

test("one shared savings rate returns 17.7 percent and is null-safe", () => {
  assert.equal(calculateSavingsRate(14_000, 79_200)?.toFixed(1), "17.7");
  assert.equal(calculateSavingsRate(14_000, 0), null);
});

test("Hero and Dashboard receive the same monthly savings metrics", () => {
  const heroMetrics = selectMonthlySavingsMetrics(14_000, 79_200);
  const dashboardMetrics = selectMonthlySavingsMetrics(14_000, 79_200);

  assert.deepEqual(heroMetrics, dashboardMetrics);
  assert.equal(heroMetrics.savingsRate?.toFixed(1), "17.7");
});

test("standard seed has only Buffert, Pension and Investeringar as saving goals", () => {
  assert.deepEqual(
    getSavingsGoals(seedPlanningDataV3).map((goal) => goal.name),
    ["Buffert", "Pension", "Investeringar"],
  );
  assert.equal(seedPlanningDataV3.expenseItems.some((item) => item.name === "Semester"), false);
  assert.equal(seedPlanningDataV3.expenseItems.some((item) => item.name === "ISK"), false);
});

test("a custom goal keeps its stable id and values when renamed", () => {
  const created = createSavingsGoal(seedPlanningDataV3, "Semester", () => "stable-id");
  const goal = getSavingsGoals(created).find((item) => item.id === "sparmal-stable-id");
  assert.ok(goal);

  const renamed = renameSavingsGoal(created, goal.id, "Japan 2030");
  const renamedGoal = getSavingsGoals(renamed).find((item) => item.id === goal.id);
  assert.equal(renamed.labels?.expenseItems?.[goal.id], "Japan 2030");
  assert.deepEqual(renamedGoal?.monthlyValues, goal.monthlyValues);
});

test("legacy Semester and ISK values migrate without loss", () => {
  const legacy = {
    ...seedPlanningDataV3,
    expenseItems: [
      ...seedPlanningDataV3.expenseItems.filter((item) => item.category !== "sparande"),
      {
        id: "sparande-sparande",
        category: "sparande",
        name: "Sparande",
        monthlyValues: values(3_000),
        recurring: true,
      },
    ],
    areaItemValues: {
      savingsBuffer: values(1_000),
      savingsVacation: values(500),
      savingsIsk: values(750),
      savingsPension: values(750),
    },
  };

  const migrated = migrateLegacySavingsStructure(legacy);
  const goals = getSavingsGoals(migrated);
  assert.equal(goals.find((goal) => goal.id === "sparmal-semester-legacy")?.monthlyValues.jan, 500);
  assert.equal(goals.find((goal) => goal.id === "sparmal-investeringar")?.monthlyValues.jan, 750);
  assert.equal(sumSavingsGoalsForMonth(migrated, "jan"), 3_000);
  assert.equal(migrated.allocationOverrides?.savings?.jan, 3_000);
});

test("empty legacy Semester is omitted while the old total remains intact", () => {
  const legacy = {
    ...seedPlanningDataV3,
    expenseItems: [
      ...seedPlanningDataV3.expenseItems.filter((item) => item.category !== "sparande"),
      {
        id: "sparande-sparande",
        category: "sparande",
        name: "Sparande",
        monthlyValues: values(4_000),
        recurring: true,
      },
    ],
  };

  const migrated = migrateLegacySavingsStructure(legacy);
  assert.equal(getSavingsGoals(migrated).some((goal) => goal.name === "Semester"), false);
  assert.equal(sumSavingsGoalsForMonth(migrated, "jan"), 4_000);
});

test("Savings Preview includes every standard and custom saving goal", () => {
  const withCustomGoal = createSavingsGoal(seedPlanningDataV3, "Renovering", () => "renovering");
  const withCustomValues = {
    ...withCustomGoal,
    expenseItems: withCustomGoal.expenseItems.map((item) =>
      item.id === "sparmal-renovering"
        ? { ...item, monthlyValues: values(500) }
        : item,
    ),
  };
  const monthlySavings = months.map((monthId) =>
    sumSavingsGoalsForMonth(withCustomValues, monthId),
  );
  const preview = calculateSavingsPreview(monthlySavings, months.map(() => 10_000));

  assert.equal(preview.totalPlannedSavings, 77_000);
  assert.equal(preview.averageMonthlySavings, 77_000 / 12);

  const overview = getSavingsOverview(withCustomValues);
  assert.equal(overview.totalPlannedSavings, 77_000);
  assert.equal(overview.averageMonthlySavings, 77_000 / 12);
  assert.equal(overview.savingsRate?.toFixed(1), "11.7");
  assert.equal(overview.goals.some((goal) => goal.name === "Renovering"), true);
});
