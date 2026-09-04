import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getSavingsGoalEditDraft,
  removeSavingsGoal,
  updateSavingsGoal,
  type SavingsPlanningData,
} from "./savings.ts";
import { hasUnsavedWorkspaceChanges } from "../workspace/save-experience.ts";

const monthIds = ["jan", "feb", "mar", "apr"];

function values(amount: number) {
  return Object.fromEntries(monthIds.map((monthId) => [monthId, amount]));
}

function planningData(): SavingsPlanningData {
  return {
    expenseItems: [
      {
        category: "sparande",
        frequency: "monthly",
        id: "sparmal-buffert",
        monthlyValues: values(1_000),
        name: "Buffert",
        recurring: true,
      },
      {
        category: "sparande",
        frequency: "monthly",
        id: "sparmal-resa",
        monthlyValues: values(500),
        name: "Resa",
        recurring: true,
        source: "custom-metadata",
      },
      {
        category: "sparande",
        id: "sparmal-cykel",
        monthlyValues: values(250),
        name: "Cykel",
        recurring: true,
      },
    ],
    labels: { expenseItems: { "sparmal-resa": "Japan 2030" } },
  };
}

test("savings goal edit draft is prefilled with identity, amount and schedule", () => {
  assert.deepEqual(getSavingsGoalEditDraft(planningData(), "sparmal-resa", monthIds), {
    amount: 500,
    frequency: "monthly",
    monthId: "jan",
    name: "Japan 2030",
  });
});

test("editing updates the same stable goal without duplicates and preserves metadata", () => {
  const original = planningData();
  const updated = updateSavingsGoal(
    original,
    "sparmal-resa",
    { amount: 900, frequency: "quarterly", monthId: "feb", name: "Japan 2032" },
    monthIds,
  );
  const goal = updated.expenseItems.find((item) => item.id === "sparmal-resa");

  assert.equal(updated.expenseItems.length, original.expenseItems.length);
  assert.equal(updated.expenseItems.filter((item) => item.id === "sparmal-resa").length, 1);
  assert.equal(goal?.id, "sparmal-resa");
  assert.equal(goal?.name, "Japan 2032");
  assert.equal(goal?.frequency, "quarterly");
  assert.deepEqual(goal?.monthlyValues, { jan: 0, feb: 900, mar: 0, apr: 0 });
  assert.equal((goal as typeof goal & { source?: string })?.source, "custom-metadata");
  assert.equal(updated.labels?.expenseItems?.["sparmal-resa"], "Japan 2032");
  assert.equal(
    hasUnsavedWorkspaceChanges(true, JSON.stringify(original), JSON.stringify(updated)),
    true,
  );
});

test("opening and cancelling an edit leaves PlanningData unchanged", () => {
  const original = planningData();
  const snapshot = JSON.stringify(original);
  const draft = getSavingsGoalEditDraft(original, "sparmal-resa", monthIds);

  assert.ok(draft);
  draft.name = "Avbruten ändring";
  assert.equal(JSON.stringify(original), snapshot);
});

test("deleting removes only the selected custom goal and marks PlanningData dirty", () => {
  const original = planningData();
  const updated = removeSavingsGoal(original, "sparmal-resa");

  assert.deepEqual(updated.expenseItems.map((item) => item.id), ["sparmal-buffert", "sparmal-cykel"]);
  assert.equal(updated.labels?.expenseItems?.["sparmal-resa"], undefined);
  assert.equal(
    hasUnsavedWorkspaceChanges(true, JSON.stringify(original), JSON.stringify(updated)),
    true,
  );
});

test("standard savings goals remain protected by the existing migration contract", () => {
  const original = planningData();
  assert.equal(removeSavingsGoal(original, "sparmal-buffert"), original);
});

test("desktop and mobile savings actions reuse AnchoredContextMenu", () => {
  const source = readFileSync(new URL("../../app/app/page.tsx", import.meta.url), "utf8");
  const menuStart = source.indexOf("function SavingsGoalActionsMenu");
  const menuEnd = source.indexOf("function YearOverview", menuStart);
  const menuSource = source.slice(menuStart, menuEnd);

  assert.match(menuSource, /<AnchoredContextMenu/);
  assert.match(menuSource, /label: "Ändra"/);
  assert.match(menuSource, /label: "Ta bort"/);
  assert.match(menuSource, /disabled: standardGoal/);
  assert.match(source, /function DesktopSavingsGoalRow[\s\S]*?<SavingsGoalActionsMenu/);
  assert.match(source, /function MobileSavingsGoalLine[\s\S]*?<SavingsGoalActionsMenu/);
});
