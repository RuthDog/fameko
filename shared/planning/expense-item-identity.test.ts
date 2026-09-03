import assert from "node:assert/strict";
import test from "node:test";

import {
  createExpenseItemIdentity,
  getExpenseItemPresentation,
} from "./expense-item-identity.ts";

test("legacy ExpenseItems keep name and label fallback without a migration", () => {
  assert.deepEqual(getExpenseItemPresentation({ name: "Spotify" }), {
    brandLabel: "Spotify",
    company: null,
    description: null,
    primaryLabel: "Spotify",
  });
  assert.equal(
    getExpenseItemPresentation({ name: "Spotify" }, "Familjens musik").primaryLabel,
    "Familjens musik",
  );
});

test("company and description have separate machine and human roles", () => {
  assert.deepEqual(
    getExpenseItemPresentation({
      company: " Spotify ",
      description: " Premium Family ",
      name: "Legacy fallback",
    }),
    {
      brandLabel: "Spotify",
      company: "Spotify",
      description: "Premium Family",
      primaryLabel: "Spotify Premium Family",
    },
  );
});

test("company without description stays one line", () => {
  const presentation = getExpenseItemPresentation({ company: "Agria", name: "Fallback" });

  assert.equal(presentation.primaryLabel, "Agria");
  assert.equal(presentation.brandLabel, "Agria");
});

test("description without company is shown but never becomes the brand input", () => {
  const identity = createExpenseItemIdentity("", "Spotify Premium Family");
  const presentation = getExpenseItemPresentation(identity);

  assert.equal(presentation.primaryLabel, "Spotify Premium Family");
  assert.equal(presentation.brandLabel, "Ny kostnad");
});

test("company and description read naturally on one line", () => {
  assert.equal(
    getExpenseItemPresentation({
      company: "Agria",
      description: "Hundförsäkring",
      name: "Äldre namn",
    }).primaryLabel,
    "Agria Hundförsäkring",
  );
  assert.equal(
    getExpenseItemPresentation({
      company: "Telia",
      description: "Total",
      name: "Äldre namn",
    }).primaryLabel,
    "Telia Total",
  );
  assert.equal(
    getExpenseItemPresentation({
      company: "Viaplay",
      description: "Family",
      name: "Äldre namn",
    }).primaryLabel,
    "Viaplay Family",
  );
});

test("new item identity trims both optional inputs and keeps a neutral legacy fallback", () => {
  assert.deepEqual(createExpenseItemIdentity(" Spotify ", " Premium Family "), {
    company: "Spotify",
    description: "Premium Family",
    name: "Spotify",
  });
  assert.deepEqual(createExpenseItemIdentity("", " Hundförsäkring "), {
    company: "",
    description: "Hundförsäkring",
    name: "Ny kostnad",
  });
});
