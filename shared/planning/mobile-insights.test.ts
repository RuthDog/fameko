import assert from "node:assert/strict";
import test from "node:test";

import { buildMobileUpcomingInsights } from "./mobile-insights.ts";

const monthIds = ["jan", "feb", "mar", "apr", "maj"];
const steadyMonths = monthIds.map((id, index) => ({
  costTotal: 34_000,
  id,
  income: 50_000,
  name: `Månad ${index + 1}`,
  remaining: 8_000,
}));

test("mobile insights follow the product priority from new costs to unusual costs", () => {
  const insights = buildMobileUpcomingInsights({
    currentMonthId: "jan",
    monthIds,
    months: steadyMonths.map((month) =>
      month.id === "feb" ? { ...month, remaining: -1_500 } : month,
    ),
    planningData: {
      expenseItems: [
        {
          frequency: "monthly",
          id: "new-loan",
          monthlyValues: { jan: 0, feb: 2_350, mar: 2_350, apr: 2_350, maj: 2_350 },
          name: "Billån",
          recurring: true,
        },
        {
          frequency: "monthly",
          id: "ending-subscription",
          monthlyValues: { jan: 800, feb: 0, mar: 0, apr: 0, maj: 0 },
          name: "Gammalt abonnemang",
          recurring: true,
        },
        {
          frequency: "yearly",
          id: "annual-insurance",
          monthlyValues: { jan: 0, feb: 1_280, mar: 0, apr: 0, maj: 0 },
          name: "Bilförsäkring",
          recurring: true,
        },
        {
          id: "unusual-electricity",
          monthlyValues: { jan: 1_000, feb: 3_000, mar: 1_000, apr: 1_000, maj: 1_000 },
          name: "El",
          recurring: true,
        },
      ],
    },
  });

  assert.deepEqual(
    insights[0].events.map((event) => event.kind),
    ["new", "ending", "annual", "negative", "unusual"],
  );
  assert.equal(insights[0].headline, "Behöver uppmärksamhet");
  assert.equal(insights[0].events[0].title, "Billån börjar.");
  assert.equal(insights[0].events[0].detail, "2 350 kr/mån");
  assert.match(insights[0].events[2].detail ?? "", /Dags att se över priset/);
});

test("calm months show the four largest planned cost categories instead of a stable message", () => {
  const insights = buildMobileUpcomingInsights({
    currentMonthId: "jan",
    monthIds,
    months: steadyMonths,
    planningData: {
      expenseCategories: [
        { id: "boende", name: "Boende" },
        { id: "mat", name: "Mat" },
        { id: "bil", name: "Bil" },
        { id: "ovrigt", name: "Övrigt" },
        { id: "sparande", name: "Sparande" },
      ],
      expenseItems: [
        {
          category: "boende",
          id: "rent",
          monthlyValues: { jan: 13_900, feb: 13_900, mar: 13_900, apr: 13_900, maj: 13_900 },
          name: "Hyra",
          recurring: true,
        },
        {
          category: "boende",
          id: "electricity",
          monthlyValues: { jan: 1_450, feb: 1_450, mar: 1_450, apr: 1_450, maj: 1_450 },
          name: "El",
          recurring: true,
        },
        {
          category: "boende",
          id: "internet",
          monthlyValues: { jan: 1_050, feb: 1_050, mar: 1_050, apr: 1_050, maj: 1_050 },
          name: "Internet",
          recurring: true,
        },
        {
          category: "mat",
          id: "food",
          monthlyValues: { jan: 8_500, feb: 8_500, mar: 8_500, apr: 8_500, maj: 8_500 },
          name: "Mat",
          recurring: true,
        },
        {
          category: "bil",
          id: "car-loan",
          monthlyValues: { jan: 3_850, feb: 3_850, mar: 3_850, apr: 3_850, maj: 3_850 },
          name: "Billån",
          recurring: true,
        },
        {
          category: "bil",
          id: "car-insurance",
          monthlyValues: { jan: 1_250, feb: 1_250, mar: 1_250, apr: 1_250, maj: 1_250 },
          name: "Bilförsäkring",
          recurring: true,
        },
        {
          category: "ovrigt",
          id: "other",
          monthlyValues: { jan: 4_000, feb: 4_000, mar: 4_000, apr: 4_000, maj: 4_000 },
          name: "Övrigt",
          recurring: true,
        },
        {
          category: "sparande",
          id: "buffer",
          monthlyValues: { jan: 9_000, feb: 9_000, mar: 9_000, apr: 9_000, maj: 9_000 },
          name: "Buffert",
          recurring: true,
        },
      ],
    },
  });

  for (const insight of insights) {
    assert.equal(insight.headline, "Det viktigaste att känna till");
    assert.deepEqual(insight.events.map((event) => event.kind), [
      "planned",
      "planned",
      "planned",
      "planned",
    ]);
    assert.deepEqual(
      insight.events.map((event) => [event.title, event.detail]),
      [
        ["Boende", "16 400 kr"],
        ["Mat", "8 500 kr"],
        ["Bil", "5 100 kr"],
        ["Övrigt", "4 000 kr"],
      ],
    );
  }

  const renderedContent = JSON.stringify(insights);
  assert.equal(renderedContent.includes("Stabil månad"), false);
  assert.equal(renderedContent.includes("Inga större förändringar"), false);
  assert.equal(renderedContent.includes("Sparande"), false);
});

test("every upcoming month still gives a concrete action when no costs are planned", () => {
  const insights = buildMobileUpcomingInsights({
    currentMonthId: "jan",
    monthIds,
    months: steadyMonths.map((month) => ({ ...month, costTotal: 0 })),
    planningData: { expenseItems: [] },
  });

  assert.equal(insights.length, 3);
  for (const insight of insights) {
    assert.equal(insight.events.length, 1);
    assert.equal(insight.events[0].title, "Inga kostnader är planerade den här månaden.");
    assert.equal(insight.events[0].detail, "Kontrollera att månadens planering är komplett.");
  }
});
