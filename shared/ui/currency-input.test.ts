import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultCurrencyInputStep,
  formatCurrencyInput,
  parseCurrencyInput,
} from "./currency-input.ts";

test("CurrencyInput formats Swedish thousands and stores a numeric value", () => {
  assert.equal(parseCurrencyInput("200000"), 200_000);
  assert.equal(formatCurrencyInput(200_000), "200 000");
  assert.equal(parseCurrencyInput("200 000"), 200_000);
});

test("an empty CurrencyInput accepts the first digit without a leading zero", () => {
  assert.equal(parseCurrencyInput(""), null);
  assert.equal(parseCurrencyInput("0005"), 5);
  assert.equal(formatCurrencyInput(parseCurrencyInput("5")), "5");
});

test("normal CurrencyInput amounts use a 100 kronor step", () => {
  assert.equal(defaultCurrencyInputStep, 100);
});
