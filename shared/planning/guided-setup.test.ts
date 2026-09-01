import assert from "node:assert/strict";
import test from "node:test";

import { hasUnsavedWorkspaceChanges } from "../workspace/save-experience.ts";
import { emptyPlanningDataV3 } from "./seed-planning-data.ts";
import {
  getGuidedSetupCurrentMonthId,
  getGuidedSetupExpense,
  guidedSetupFrequencyOptions,
  guidedSetupMonthIds,
  guidedSetupTemplates,
  skipGuidedSetupQuestion,
  upsertGuidedSetupExpense,
} from "./guided-setup.ts";

test("frequency choices use the approved labels", () => {
  assert.deepEqual(
    guidedSetupFrequencyOptions.map((option) => option.label),
    [
      "Varje månad",
      "Var tredje månad",
      "Var sjätte månad",
      "En gång per år",
    ],
  );
});

test("a new monthly cost starts in the current month without retroactive values", () => {
  const currentMonth = getGuidedSetupCurrentMonthId();
  const currentIndex = guidedSetupMonthIds.indexOf(currentMonth);
  const data = upsertGuidedSetupExpense(emptyPlanningDataV3, "subscription.mobile", {
    amount: 499,
  });
  const item = data.expenseItems.find((expense) => expense.id === "streaming-guided-mobile");

  guidedSetupMonthIds.forEach((monthId, monthIndex) => {
    assert.equal(item?.monthlyValues[monthId], monthIndex < currentIndex ? 0 : 499);
  });
});

test("template library has unique stable identities, existing categories and no amounts", () => {
  const categoryIds = new Set(emptyPlanningDataV3.expenseCategories.map((category) => category.id));
  const templateIds = guidedSetupTemplates.map((template) => template.id);
  const itemIds = guidedSetupTemplates.map((template) => template.itemId);

  assert.equal(new Set(templateIds).size, templateIds.length);
  assert.equal(new Set(itemIds).size, itemIds.length);
  assert.equal(guidedSetupTemplates.every((template) => categoryIds.has(template.categoryId)), true);
  assert.equal(
    guidedSetupTemplates.every((template) => !("amount" in template)),
    true,
  );
});

test("mobile subscription creates the mapped monthly PlanningData item", () => {
  const data = upsertGuidedSetupExpense(emptyPlanningDataV3, "subscription.mobile", {
    amount: 499,
    paymentMonth: "sep",
  });
  const item = data.expenseItems.find((expense) => expense.id === "streaming-guided-mobile");

  assert.equal(item?.category, "streaming");
  assert.equal(item?.name, "Mobilabonnemang");
  assert.equal(item?.frequency, "monthly");
  assert.deepEqual(Object.values(item?.monthlyValues ?? {}), [0, 0, 0, 0, 0, 0, 0, 0, 499, 499, 499, 499]);
});

test("running a guide again updates one stable item without a duplicate", () => {
  const first = upsertGuidedSetupExpense(emptyPlanningDataV3, "subscription.mobile", {
    amount: 499,
    paymentMonth: "sep",
  });
  const second = upsertGuidedSetupExpense(first, "subscription.mobile", {
    amount: 699,
    paymentMonth: "sep",
  });
  const matching = second.expenseItems.filter(
    (expense) => expense.id === "streaming-guided-mobile",
  );

  assert.equal(matching.length, 1);
  assert.equal(matching[0]?.monthlyValues.sep, 699);
  assert.equal(matching[0]?.monthlyValues.aug, 0);
});

test("a manually renamed item remains linked through stable identity", () => {
  const first = upsertGuidedSetupExpense(emptyPlanningDataV3, "subscription.mobile", {
    amount: 499,
    paymentMonth: "sep",
  });
  const renamed = {
    ...first,
    labels: {
      ...first.labels,
      expenseItems: {
        ...first.labels?.expenseItems,
        "streaming-guided-mobile": "Familjens mobiler",
      },
    },
  };
  const updated = upsertGuidedSetupExpense(renamed, "subscription.mobile", {
    amount: 599,
    paymentMonth: "sep",
  });

  assert.equal(getGuidedSetupExpense(updated, "subscription.mobile")?.label, "Familjens mobiler");
  assert.equal(
    updated.expenseItems.filter((item) => item.id === "streaming-guided-mobile").length,
    1,
  );
});

test("Netflix and Spotify create exactly their two existing stable rows", () => {
  assert.equal(getGuidedSetupExpense(emptyPlanningDataV3, "subscription.netflix"), null);
  assert.equal(getGuidedSetupExpense(emptyPlanningDataV3, "subscription.spotify"), null);

  const netflix = upsertGuidedSetupExpense(emptyPlanningDataV3, "subscription.netflix", {
    amount: 179,
    paymentMonth: "sep",
  });
  const data = upsertGuidedSetupExpense(netflix, "subscription.spotify", {
    amount: 119,
    paymentMonth: "sep",
  });

  assert.equal(data.expenseItems.find((item) => item.id === "streaming-netflix")?.monthlyValues.sep, 179);
  assert.equal(data.expenseItems.find((item) => item.id === "streaming-spotify")?.monthlyValues.sep, 119);
  assert.equal(data.expenseItems.filter((item) => ["streaming-netflix", "streaming-spotify"].includes(item.id)).length, 2);
});

test("answering no to pets and skipping a question leave PlanningData untouched", () => {
  const before = JSON.stringify(emptyPlanningDataV3);
  const skipped = skipGuidedSetupQuestion(emptyPlanningDataV3);

  assert.equal(skipped, emptyPlanningDataV3);
  assert.equal(JSON.stringify(skipped), before);
  assert.equal(getGuidedSetupExpense(skipped, "insurance.pet"), null);
  assert.equal(getGuidedSetupExpense(skipped, "pet.food"), null);
});

test("yearly pet insurance is placed only in the selected payment month", () => {
  const data = upsertGuidedSetupExpense(emptyPlanningDataV3, "insurance.pet", {
    amount: 3_600,
    frequency: "yearly",
    paymentMonth: "sep",
  });
  const item = data.expenseItems.find((expense) => expense.id === "husdjur-guided-insurance");

  assert.equal(item?.monthlyValues.sep, 3_600);
  assert.equal(
    Object.entries(item?.monthlyValues ?? {}).filter(([, amount]) => amount > 0).length,
    1,
  );
  assert.equal(item?.monthlyValues.jan, 0);
});

test("quarterly insurance follows the existing frequency model from its first payment month", () => {
  const data = upsertGuidedSetupExpense(emptyPlanningDataV3, "insurance.home", {
    amount: 1_200,
    frequency: "quarterly",
    paymentMonth: "feb",
  });
  const item = data.expenseItems.find((expense) => expense.id === "forsakringar-guided-home");

  assert.deepEqual(
    guidedSetupMonthIds.filter((monthId) => (item?.monthlyValues[monthId] ?? 0) > 0),
    ["feb", "maj", "aug", "nov"],
  );
});

test("half-yearly insurance starts at the selected next payment without retroactive values", () => {
  const data = upsertGuidedSetupExpense(emptyPlanningDataV3, "insurance.home", {
    amount: 2_400,
    frequency: "twiceYearly",
    paymentMonth: "maj",
  });
  const item = data.expenseItems.find((expense) => expense.id === "forsakringar-guided-home");

  assert.deepEqual(
    guidedSetupMonthIds.filter((monthId) => (item?.monthlyValues[monthId] ?? 0) > 0),
    ["maj", "nov"],
  );
  assert.equal(item?.monthlyValues.apr, 0);
});

test("updating an existing item preserves passed months and changes current months forward", () => {
  const existing = upsertGuidedSetupExpense(emptyPlanningDataV3, "subscription.mobile", {
    amount: 499,
    paymentMonth: "jan",
  });
  const updated = upsertGuidedSetupExpense(existing, "subscription.mobile", {
    amount: 699,
    paymentMonth: "sep",
  });
  const item = updated.expenseItems.find((expense) => expense.id === "streaming-guided-mobile");

  assert.equal(item?.monthlyValues.aug, 499);
  assert.equal(item?.monthlyValues.sep, 699);
  assert.equal(item?.monthlyValues.dec, 699);
});

test("CSN uses Lån och krediter while mortgage and car loan keep their categories", () => {
  const data = upsertGuidedSetupExpense(emptyPlanningDataV3, "debt.csn", {
    amount: 1_250,
    paymentMonth: "sep",
  });

  assert.equal(
    data.expenseItems.find((item) => item.id === "lan-och-krediter-guided-csn")?.category,
    "lan-och-krediter",
  );
  assert.equal(data.expenseItems.find((item) => item.id === "boende-hyra")?.category, "boende");
  assert.equal(data.expenseItems.find((item) => item.id === "bil-billan")?.category, "bil");
});

test("an older PlanningData document receives the debt category only when the guide needs it", () => {
  const legacy = {
    ...emptyPlanningDataV3,
    expenseCategories: emptyPlanningDataV3.expenseCategories.filter(
      (category) => category.id !== "lan-och-krediter",
    ),
  };
  const data = upsertGuidedSetupExpense(legacy, "debt.csn", {
    amount: 1_250,
    paymentMonth: "sep",
  });

  assert.equal(
    data.expenseCategories.find((category) => category.id === "lan-och-krediter")?.name,
    "Lån och krediter",
  );
});

test("Guided Setup preserves unrelated PlanningData values", () => {
  const existingFood = emptyPlanningDataV3.expenseItems.find((item) => item.id === "mat-mat");
  const data = upsertGuidedSetupExpense(emptyPlanningDataV3, "debt.csn", { amount: 1_250 });

  assert.deepEqual(data.expenseItems.find((item) => item.id === "mat-mat"), existingFood);
  assert.equal(data.openingBalance, emptyPlanningDataV3.openingBalance);
  assert.equal(data.expenseCategories, emptyPlanningDataV3.expenseCategories);
});

test("a Guided Setup edit activates the shared Workspace dirty-state", () => {
  const before = JSON.stringify(emptyPlanningDataV3);
  const data = upsertGuidedSetupExpense(emptyPlanningDataV3, "subscription.mobile", {
    amount: 499,
  });

  assert.equal(hasUnsavedWorkspaceChanges(true, before, JSON.stringify(data)), true);
});
