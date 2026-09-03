import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveBrand } from "../brand/brand-recognition.ts";
import { getExpenseItemPresentation } from "./expense-item-identity.ts";
import {
  getExpenseItemEditDraft,
  updateExpenseItemInPlanningData,
  type EditableExpenseItem,
  type ExpenseItemEditDraft,
} from "./expense-item-edit.ts";
import { hasUnsavedWorkspaceChanges } from "../workspace/save-experience.ts";

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

const monthlyValues = Object.fromEntries(monthIds.map((monthId) => [monthId, 500]));

function makeItem(overrides: Partial<EditableExpenseItem> = {}): EditableExpenseItem {
  return {
    category: "streaming",
    company: "Telia",
    description: "Total",
    frequency: "monthly",
    id: "subscription-telia",
    monthlyValues,
    name: "Telia",
    recurring: true,
    ...overrides,
  };
}

function makeData(item = makeItem()) {
  return {
    expenseCategories: [{ id: "streaming" }, { id: "tv-bredband" }],
    expenseItems: [item],
  };
}

function makeDraft(overrides: Partial<ExpenseItemEditDraft> = {}): ExpenseItemEditDraft {
  return {
    amount: 500,
    categoryId: "streaming",
    company: "Telia",
    description: "Total",
    frequency: "monthly",
    monthId: "jan",
    ...overrides,
  };
}

test("amount edit updates the same stable item without a duplicate", () => {
  const updated = updateExpenseItemInPlanningData(
    makeData(),
    "subscription-telia",
    makeDraft({ amount: 600 }),
    monthIds,
  );

  assert.equal(updated.expenseItems.length, 1);
  assert.equal(updated.expenseItems[0].id, "subscription-telia");
  assert.deepEqual(Object.values(updated.expenseItems[0].monthlyValues), Array(12).fill(600));
});

test("description edit preserves company as the only brand input", () => {
  const updated = updateExpenseItemInPlanningData(
    makeData(),
    "subscription-telia",
    makeDraft({ description: "Familj" }),
    monthIds,
  );
  const presentation = getExpenseItemPresentation(updated.expenseItems[0]);

  assert.equal(updated.expenseItems[0].company, "Telia");
  assert.equal(presentation.primaryLabel, "Telia Familj");
  assert.equal(presentation.brandLabel, "Telia");
  assert.equal(resolveBrand(presentation.brandLabel).recognized, true);
});

test("company edit changes Brand Recognition from Telia to Tele2", () => {
  const updated = updateExpenseItemInPlanningData(
    makeData(),
    "subscription-telia",
    makeDraft({ company: "Tele2" }),
    monthIds,
  );
  const presentation = getExpenseItemPresentation(updated.expenseItems[0]);
  const brand = resolveBrand(presentation.brandLabel);

  assert.equal(presentation.brandLabel, "Tele2");
  assert.equal(brand.recognized && brand.brandKey, "tele2");
});

test("category edit moves the same item and leaves no old-category copy", () => {
  const updated = updateExpenseItemInPlanningData(
    makeData(),
    "subscription-telia",
    makeDraft({ categoryId: "tv-bredband" }),
    monthIds,
  );

  assert.equal(updated.expenseItems.length, 1);
  assert.equal(updated.expenseItems[0].category, "tv-bredband");
  assert.equal(updated.expenseItems.filter((item) => item.category === "streaming").length, 0);
});

test("monthly to quarterly replaces the whole schedule with the create pattern", () => {
  const updated = updateExpenseItemInPlanningData(
    makeData(),
    "subscription-telia",
    makeDraft({ amount: 1_500, frequency: "quarterly", monthId: "mar" }),
    monthIds,
  );

  assert.deepEqual(
    monthIds.filter((monthId) => updated.expenseItems[0].monthlyValues[monthId] > 0),
    ["mar", "jun", "sep", "dec"],
  );
  assert.equal(updated.expenseItems[0].monthlyValues.mar, 1_500);
  assert.equal(updated.expenseItems[0].monthlyValues.apr, 0);
});

test("changing start month creates a new deterministic schedule", () => {
  const updated = updateExpenseItemInPlanningData(
    makeData(),
    "subscription-telia",
    makeDraft({ monthId: "apr" }),
    monthIds,
  );

  assert.deepEqual(
    monthIds.filter((monthId) => updated.expenseItems[0].monthlyValues[monthId] > 0),
    ["apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"],
  );
});

test("opening and cancelling edit does not mutate PlanningData", () => {
  const data = makeData();
  const before = JSON.stringify(data);
  const draft = getExpenseItemEditDraft(data.expenseItems[0], monthIds);

  draft.amount = 900;
  draft.description = "Ej sparad";

  assert.equal(JSON.stringify(data), before);
});

test("legacy name-only item prefills and saves into the compatible identity fields", () => {
  const item = makeItem({ company: undefined, description: undefined, name: "Netflix" });
  const data = makeData(item);
  const draft = getExpenseItemEditDraft(item, monthIds);
  const updated = updateExpenseItemInPlanningData(data, item.id, draft, monthIds);

  assert.equal(draft.company, "Netflix");
  assert.equal(draft.description, "");
  assert.equal(updated.expenseItems[0].id, item.id);
  assert.equal(updated.expenseItems[0].company, "Netflix");
  assert.equal(resolveBrand(getExpenseItemPresentation(updated.expenseItems[0]).brandLabel).recognized, true);
});

test("saved edit activates the existing snapshot-based dirty state", () => {
  const data = makeData();
  const savedSnapshot = JSON.stringify(data);
  const updated = updateExpenseItemInPlanningData(
    data,
    "subscription-telia",
    makeDraft({ amount: 600 }),
    monthIds,
  );

  assert.equal(hasUnsavedWorkspaceChanges(true, savedSnapshot, JSON.stringify(updated)), true);
});

test("workspace reuses one create/edit dialog and one menu on desktop and mobile", () => {
  const workspaceSource = readFileSync(new URL("../../app/app/page.tsx", import.meta.url), "utf8");

  assert.match(workspaceSource, /mode: "create" \| "edit"/);
  assert.match(workspaceSource, /mode === "edit" \? "Ändra post" : "Lägg till post"/);
  assert.match(workspaceSource, /mode === "edit" \? "Spara ändringar" : "Spara"/);
  assert.equal(workspaceSource.match(/<ExpenseItemActionsMenu/g)?.length, 2);
  assert.match(workspaceSource, /onEditExpense=\{openEditExpenseDialog\}/);
});
