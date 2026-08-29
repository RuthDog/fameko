import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateHousingEconomics,
  getHousingSummary,
  getLoanToValueBand,
  isHousingData,
  type HousingData,
} from "../../shared/planning/housing.ts";

const completeHousingData: HousingData = {
  propertyValue: 4_200_000,
  valuationDate: "2026-08-29",
  totalMortgage: 2_450_000,
  averageInterestRate: 3.68,
  monthlyAmortization: 2_400,
};

test("housing economics derives loan-to-value and mortgage costs", () => {
  const economics = calculateHousingEconomics(completeHousingData);

  assert.ok(economics.loanToValue !== null);
  assert.ok(economics.annualInterestCost !== null);
  assert.ok(economics.monthlyInterestCost !== null);
  assert.ok(economics.monthlyMortgageCost !== null);
  assert.equal(Math.round(economics.loanToValue * 10) / 10, 58.3);
  assert.equal(Math.round(economics.annualInterestCost), 90_160);
  assert.equal(Math.round(economics.monthlyInterestCost), 7_513);
  assert.equal(Math.round(economics.monthlyMortgageCost), 9_913);
});

test("housing economics stays empty until the required source values exist", () => {
  const economics = calculateHousingEconomics({
    propertyValue: 0,
    valuationDate: null,
    totalMortgage: null,
    averageInterestRate: null,
    monthlyAmortization: null,
  });

  assert.equal(economics.loanToValue, null);
  assert.equal(economics.annualInterestCost, null);
  assert.equal(economics.monthlyInterestCost, null);
  assert.equal(economics.monthlyMortgageCost, null);
});

test("loan-to-value bands use the approved thresholds", () => {
  assert.equal(getLoanToValueBand(59.9), "green");
  assert.equal(getLoanToValueBand(60), "yellow");
  assert.equal(getLoanToValueBand(75), "yellow");
  assert.equal(getLoanToValueBand(75.1), "orange");
  assert.equal(getLoanToValueBand(85), "orange");
  assert.equal(getLoanToValueBand(85.1), "red");
  assert.match(getHousingSummary(75.1), /Ökad amortering/);
});

test("HousingData validation accepts only the bounded module shape", () => {
  assert.equal(isHousingData(completeHousingData), true);
  assert.equal(isHousingData({ ...completeHousingData, averageInterestRate: 101 }), false);
  assert.equal(isHousingData({ ...completeHousingData, valuationDate: "2026-02-30" }), false);
  assert.equal(isHousingData({ ...completeHousingData, extra: true }), false);
});
