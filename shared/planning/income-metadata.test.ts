import assert from "node:assert/strict";
import test from "node:test";

import {
  employmentTypeLabels,
  getEmploymentTypeLabel,
  getIncomeMetadataDraft,
  isHouseholdProfile,
  isIncomeMetadataMap,
  updateHouseholdDisplayName,
  updateIncomeMetadata,
} from "./income-metadata.ts";

test("employment types use stable values and Swedish labels", () => {
  assert.deepEqual(employmentTypeLabels, {
    permanent: "Tillsvidare",
    temporary: "Visstid",
    hourly: "Timanställning",
    selfEmployed: "Egenföretagare",
    parentalLeave: "Föräldraledig",
    student: "Studerande",
    other: "Annat",
  });
  assert.equal(getEmploymentTypeLabel("permanent"), "Tillsvidare");
  assert.equal(getEmploymentTypeLabel(null), null);
});

test("income metadata is optional and normalized without an amount", () => {
  const original = {};
  assert.deepEqual(getIncomeMetadataDraft(original, "salaryOne"), {
    employer: "",
    employmentType: "",
    occupation: "",
    incomeComment: "",
  });

  const updated = updateIncomeMetadata(original, "salaryOne", {
    employer: " Halmstads kommun ",
    employmentType: "permanent",
    occupation: " Avdelningschef ",
    incomeComment: " Bonus kan tillkomma ",
  });

  assert.deepEqual(updated.incomeMetadata?.salaryOne, {
    employer: "Halmstads kommun",
    employmentType: "permanent",
    occupation: "Avdelningschef",
    incomeComment: "Bonus kan tillkomma",
  });
  assert.equal("amount" in (updated.incomeMetadata?.salaryOne ?? {}), false);
  assert.deepEqual(original, {});
});

test("editing a draft and cancelling cannot mutate stored metadata", () => {
  const data = {
    incomeMetadata: { salaryOne: { employer: "Region Halland" } },
  };
  const draft = getIncomeMetadataDraft(data, "salaryOne");
  draft.employer = "Volvo";

  assert.equal(data.incomeMetadata.salaryOne.employer, "Region Halland");
});

test("household display name is optional, trimmed and independently immutable", () => {
  const original = {};
  const named = updateHouseholdDisplayName(original, " Ola & Therese ");
  const cleared = updateHouseholdDisplayName(named, "  ");

  assert.equal(named.householdProfile?.householdDisplayName, "Ola & Therese");
  assert.equal(cleared.householdProfile?.householdDisplayName, null);
  assert.deepEqual(original, {});
});

test("runtime validators accept legacy absence and reject unknown metadata", () => {
  assert.equal(isIncomeMetadataMap(undefined), true);
  assert.equal(isHouseholdProfile(undefined), true);
  assert.equal(
    isIncomeMetadataMap({ salaryOne: { employer: null, employmentType: "hourly" } }),
    true,
  );
  assert.equal(isIncomeMetadataMap({ salaryOne: { salary: 68_500 } }), false);
  assert.equal(isIncomeMetadataMap({ salaryOne: { employmentType: "consultant" } }), false);
  assert.equal(isHouseholdProfile({ householdDisplayName: "Familjen Fischer" }), true);
  assert.equal(isHouseholdProfile({ personalNumber: "no" }), false);
});
