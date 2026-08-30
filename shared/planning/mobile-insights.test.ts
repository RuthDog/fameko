import assert from "node:assert/strict";
import test from "node:test";

import { buildMobileUpcomingInsights } from "./mobile-insights.ts";

const monthIds = ["jan", "feb", "mar", "apr", "maj"];

test("mobile insights identify new, annual, one-off, ending, unusual and negative events", () => {
  const insights = buildMobileUpcomingInsights({
    currentMonthId: "jan",
    monthIds,
    months: [
      { costTotal: 10_000, id: "jan", income: 30_000, name: "Januari", remaining: 4_000 },
      { costTotal: 12_000, id: "feb", income: 30_000, name: "Februari", remaining: 3_000 },
      { costTotal: 18_000, id: "mar", income: 30_000, name: "Mars", remaining: -2_000 },
      { costTotal: 30_000, id: "apr", income: 30_000, name: "April", remaining: 1_000 },
      { costTotal: 10_000, id: "maj", income: 30_000, name: "Maj", remaining: 4_000 },
    ],
    planningData: {
      expenseItems: [
        {
          frequency: "monthly",
          id: "new-loan",
          monthlyValues: { jan: 0, feb: 1_200, mar: 1_200, apr: 1_200, maj: 1_200 },
          name: "Nytt lån",
          recurring: true,
        },
        {
          frequency: "yearly",
          id: "insurance",
          monthlyValues: { jan: 0, feb: 0, mar: 4_000, apr: 0, maj: 0 },
          name: "Hemförsäkring",
          recurring: true,
        },
        {
          frequency: "once",
          id: "repair",
          monthlyValues: { jan: 0, feb: 0, mar: 0, apr: 8_000, maj: 0 },
          name: "Reparation",
          recurring: false,
        },
        {
          frequency: "monthly",
          id: "old-subscription",
          monthlyValues: { jan: 800, feb: 0, mar: 0, apr: 0, maj: 0 },
          name: "Gammalt abonnemang",
          recurring: true,
        },
      ],
    },
  });

  assert.equal(insights.length, 3);
  assert.equal(insights[0].events.some((event) => event.kind === "new"), true);
  assert.equal(insights[0].events.some((event) => event.kind === "ending"), true);
  assert.equal(insights[1].events.some((event) => event.kind === "negative"), true);
  assert.equal(insights[1].events.some((event) => event.kind === "annual"), true);
  assert.equal(insights[2].events.some((event) => event.kind === "oneOff"), true);
  assert.equal(insights[2].events.some((event) => event.kind === "unusual"), true);
});

test("mobile insights stay calm when upcoming months have no notable changes", () => {
  const insights = buildMobileUpcomingInsights({
    currentMonthId: "jan",
    monthIds,
    months: monthIds.map((id, index) => ({
      costTotal: 10_000,
      id,
      income: 30_000,
      name: `Månad ${index + 1}`,
      remaining: 5_000,
    })),
    planningData: {
      expenseItems: [
        {
          frequency: "monthly",
          id: "rent",
          monthlyValues: { jan: 8_000, feb: 8_000, mar: 8_000, apr: 8_000, maj: 8_000 },
          name: "Hyra",
          recurring: true,
        },
      ],
    },
  });

  assert.equal(insights[0].headline, "Stabil månad");
  assert.deepEqual(insights[0].events.map((event) => event.kind), ["stable"]);
});
