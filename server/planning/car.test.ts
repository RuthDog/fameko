import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCarEconomics,
  emptyCarData,
  getCarLoanMode,
  getCarPlanningEconomics,
  isCarData,
  type CarData,
} from "../../shared/planning/car.ts";
import { seedPlanningDataV3 } from "../../shared/planning/seed-planning-data.ts";

const carWithLoan: CarData = {
  annualInsurance: 7_200,
  annualService: 6_000,
  averageInterestRate: 4.2,
  carName: "Familjebilen",
  carValue: 285_000,
  currentLoanBalance: 185_000,
  monthlyAmortization: 2_500,
};

test("CarData validation accepts the minimal bounded optional module", () => {
  assert.equal(isCarData(carWithLoan), true);
  assert.equal(isCarData(emptyCarData), true);
  assert.equal(isCarData({ ...carWithLoan, averageInterestRate: 101 }), false);
  assert.equal(isCarData({ ...carWithLoan, extra: true }), false);
});

test("car with loan derives interest, loan cost, insurance and service", () => {
  const economics = calculateCarEconomics(carWithLoan);

  assert.equal(getCarLoanMode(carWithLoan), "withLoan");
  assert.equal(Math.round(economics.annualInterestCost ?? 0), 7_770);
  assert.equal(Math.round(economics.monthlyInterestCost ?? 0), 648);
  assert.equal(Math.round(economics.monthlyLoanCost ?? 0), 3_148);
  assert.equal(economics.monthlyInsurance, 600);
  assert.equal(economics.monthlyService, 500);
});

test("loan-free is shown only for an explicitly saved zero balance", () => {
  assert.equal(getCarLoanMode(undefined), "unknown");
  assert.equal(getCarLoanMode(emptyCarData), "unknown");
  assert.equal(getCarLoanMode({ ...emptyCarData, currentLoanBalance: 0 }), "loanFree");
  assert.equal(calculateCarEconomics({ ...emptyCarData, currentLoanBalance: 0 }).monthlyLoanCost, 0);
  assert.equal(
    calculateCarEconomics({
      ...emptyCarData,
      currentLoanBalance: 0,
      monthlyAmortization: 2_500,
    }).monthlyLoanCost,
    0,
  );
});

test("planned car costs stay in PlanningData and are never copied into CarData", () => {
  const economics = getCarPlanningEconomics(seedPlanningDataV3, "apr");

  assert.equal(economics.monthlyPlannedCost, 13_800);
  assert.equal(economics.monthlyPlannedLoanPayment, 3_850);
  assert.equal(economics.annualPlannedCost, 77_950);
  assert.equal(economics.hasPlannedLoan, true);
  assert.equal("monthlyPlannedCost" in carWithLoan, false);
});
