import assert from "node:assert/strict";
import test from "node:test";

import {
  famekoMainSectionSymbols,
  getExpenseCategoryMainSectionId,
} from "./fameko-symbols.ts";

test("Fameko uses one approved symbol for every main planning section", () => {
  assert.deepEqual(famekoMainSectionSymbols, {
    income: "💰",
    allocations: "🔄",
    billAccount: "📄",
    mortgage: "🏠",
    savings: "🌱",
    debts: "💳",
    insurance: "🛡",
    pets: "🐾",
  });
});

test("only the approved expense main sections receive table symbols", () => {
  assert.equal(getExpenseCategoryMainSectionId("lan-och-krediter"), "debts");
  assert.equal(getExpenseCategoryMainSectionId("forsakringar"), "insurance");
  assert.equal(getExpenseCategoryMainSectionId("husdjur"), "pets");
  assert.equal(getExpenseCategoryMainSectionId("mat"), null);
  assert.equal(getExpenseCategoryMainSectionId("streaming"), null);
});
