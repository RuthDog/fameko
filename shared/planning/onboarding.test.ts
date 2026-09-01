import assert from "node:assert/strict";
import test from "node:test";

import { isPlanningData } from "../../server/planning/planning-schema.ts";
import { emptyPlanningDataV3, seedPlanningDataV3 } from "./seed-planning-data.ts";
import {
  finalizePlanningOnboarding,
  getOnboardingIncomeAmount,
  getOnboardingSavingsAmount,
  getPlanningCompletionSuggestion,
  hasMeaningfulPlanningInformation,
  setOnboardingIncomeAmount,
  setOnboardingSavingsAmount,
  shouldOfferPlanningOnboarding,
} from "./onboarding.ts";
import { savingsMonthIds } from "./savings.ts";

test("empty PlanningData uses the existing v3 schema without demo amounts", () => {
  assert.equal(isPlanningData(emptyPlanningDataV3), true);
  assert.equal(emptyPlanningDataV3.openingBalance, 0);
  assert.equal(
    emptyPlanningDataV3.incomes.every((income) =>
      Object.values(income.monthlyValues).every((amount) => amount === 0),
    ),
    true,
  );
  assert.equal(
    emptyPlanningDataV3.expenseItems.every((item) =>
      Object.values(item.monthlyValues).every((amount) => amount === 0),
    ),
    true,
  );
  assert.equal("housingData" in emptyPlanningDataV3, false);
  assert.equal("carData" in emptyPlanningDataV3, false);
});

test("onboarding is offered only for a genuinely untouched PlanningData", () => {
  assert.equal(shouldOfferPlanningOnboarding(emptyPlanningDataV3), true);
  assert.equal(hasMeaningfulPlanningInformation(seedPlanningDataV3), true);
  assert.equal(shouldOfferPlanningOnboarding(seedPlanningDataV3), false);

  const partial = setOnboardingIncomeAmount(emptyPlanningDataV3, "salaryOne", 31_500);
  assert.equal(hasMeaningfulPlanningInformation(partial), true);
  assert.equal(shouldOfferPlanningOnboarding(partial), false);
});

test("onboarding incomes use the existing income lines for every month", () => {
  const withSalary = setOnboardingIncomeAmount(emptyPlanningDataV3, "salaryOne", 32_000);
  const withAllIncome = setOnboardingIncomeAmount(withSalary, "other", 1_250);

  assert.equal(getOnboardingIncomeAmount(withAllIncome, "salaryOne"), 32_000);
  assert.equal(getOnboardingIncomeAmount(withAllIncome, "other"), 1_250);
  assert.deepEqual(
    savingsMonthIds.map((monthId) => withAllIncome.incomeLineValues?.salaryOne?.[monthId]),
    savingsMonthIds.map(() => 32_000),
  );
  assert.deepEqual(
    savingsMonthIds.map((monthId) => withAllIncome.incomeLineValues?.other?.[monthId]),
    savingsMonthIds.map(() => 1_250),
  );
});

test("onboarding savings update the standard PlanningData goals for every month", () => {
  const data = setOnboardingSavingsAmount(emptyPlanningDataV3, "sparmal-buffert", 2_500);

  assert.equal(getOnboardingSavingsAmount(data, "sparmal-buffert"), 2_500);
  assert.deepEqual(
    savingsMonthIds.map(
      (monthId) =>
        data.expenseItems.find((item) => item.id === "sparmal-buffert")?.monthlyValues[monthId],
    ),
    savingsMonthIds.map(() => 2_500),
  );
});

test("completion stays in PlanningData and does not overwrite entered module data", () => {
  const housingData = {
    averageInterestRate: 3.4,
    monthlyAmortization: 2_000,
    propertyValue: 4_200_000,
    totalMortgage: 2_800_000,
    valuationDate: null,
  };
  const completed = finalizePlanningOnboarding({ ...emptyPlanningDataV3, housingData });

  assert.deepEqual(completed.housingData, housingData);
  assert.deepEqual(completed.carData, {
    annualInsurance: null,
    annualService: null,
    averageInterestRate: null,
    carName: null,
    carValue: null,
    currentLoanBalance: null,
    monthlyAmortization: null,
  });
  assert.equal(shouldOfferPlanningOnboarding(completed), false);
  assert.equal(isPlanningData(completed), true);
});

test("Workspace gives one calm completion suggestion from actual PlanningData", () => {
  const emptySuggestion = getPlanningCompletionSuggestion(emptyPlanningDataV3);
  assert.equal(emptySuggestion?.guideId, "income");
  assert.equal(emptySuggestion?.actionLabel, "Lägg till dina inkomster");

  const incomeOnly = setOnboardingIncomeAmount(emptyPlanningDataV3, "salaryOne", 30_000);
  const savingsSuggestion = getPlanningCompletionSuggestion(incomeOnly);
  assert.match(savingsSuggestion?.title ?? "", /sparande/i);
  assert.equal(savingsSuggestion?.guideId, "savings");

  const withSavings = setOnboardingSavingsAmount(incomeOnly, "sparmal-buffert", 2_000);
  const insuranceSuggestion = getPlanningCompletionSuggestion(withSavings);
  assert.match(insuranceSuggestion?.title ?? "", /försäkringar/i);
  assert.equal(insuranceSuggestion?.guideId, "insurance");

  const withInsurance = {
    ...withSavings,
    expenseItems: withSavings.expenseItems.map((item) =>
      item.id === "forsakringar-forsakringar"
        ? {
            ...item,
            monthlyValues: Object.fromEntries(savingsMonthIds.map((monthId) => [monthId, 900])),
          }
        : item,
    ),
  };
  assert.equal(getPlanningCompletionSuggestion(withInsurance)?.guideId, "subscriptions");

  const withSubscriptions = {
    ...withInsurance,
    expenseItems: withInsurance.expenseItems.map((item) =>
      item.category === "streaming"
        ? {
            ...item,
            monthlyValues: Object.fromEntries(
              savingsMonthIds.map((monthId) => [monthId, 179]),
            ),
          }
        : item,
    ),
  };
  assert.equal(getPlanningCompletionSuggestion(withSubscriptions)?.guideId, "pets");

  const withPets = {
    ...withSubscriptions,
    expenseItems: withSubscriptions.expenseItems.map((item) =>
      item.category === "husdjur"
        ? {
            ...item,
            monthlyValues: Object.fromEntries(
              savingsMonthIds.map((monthId) => [monthId, 650]),
            ),
          }
        : item,
    ),
  };
  assert.equal(getPlanningCompletionSuggestion(withPets)?.guideId, "debts");

  const complete = {
    ...withPets,
    expenseItems: [
      ...withPets.expenseItems,
      {
        category: "lan-och-krediter",
        id: "lan-och-krediter-guided-csn",
        monthlyValues: Object.fromEntries(
          savingsMonthIds.map((monthId) => [monthId, 1_250]),
        ),
        name: "CSN",
      },
    ],
  };
  assert.equal(getPlanningCompletionSuggestion(complete), null);
});
