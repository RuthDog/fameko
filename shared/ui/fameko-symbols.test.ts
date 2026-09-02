import assert from "node:assert/strict";
import test from "node:test";

import {
  famekoSymbols,
  getExpenseCategorySymbolId,
} from "./fameko-symbols.ts";

test("Fameko uses the mobile illustrations for every primary planning section", () => {
  assert.equal(famekoSymbols.income.illustrationSrc, "/images/mobile-insights/income.webp");
  assert.equal(
    famekoSymbols.allocations.illustrationSrc,
    "/images/mobile-insights/allocations.png",
  );
  assert.equal(famekoSymbols.billAccount.illustrationSrc, "/images/mobile-insights/bills.webp");
  assert.equal(famekoSymbols.mortgage.illustrationSrc, "/images/mobile-insights/mortgage.png");
  assert.equal(famekoSymbols.savings.illustrationSrc, "/images/mobile-insights/savings.webp");
});

test("every expense main category resolves through the same symbol system", () => {
  assert.deepEqual(
    {
      bil: getExpenseCategorySymbolId("bil"),
      boende: getExpenseCategorySymbolId("boende"),
      forsakringar: getExpenseCategorySymbolId("forsakringar"),
      husdjur: getExpenseCategorySymbolId("husdjur"),
      lan: getExpenseCategorySymbolId("lan-och-krediter"),
      mat: getExpenseCategorySymbolId("mat"),
      ovrigt: getExpenseCategorySymbolId("ovrigt"),
      streaming: getExpenseCategorySymbolId("streaming"),
    },
    {
      bil: "car",
      boende: "housing",
      forsakringar: "insurance",
      husdjur: "pets",
      lan: "debts",
      mat: "food",
      ovrigt: "other",
      streaming: "broadband",
    },
  );
  assert.equal(getExpenseCategorySymbolId("ny-kategori"), "other");
});
