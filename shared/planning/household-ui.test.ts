import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const detailPageSource = readFileSync(
  new URL("../../app/app/hushall/page.tsx", import.meta.url),
  "utf8",
);
const overviewSource = readFileSync(
  new URL("../../app/app/household-overview.tsx", import.meta.url),
  "utf8",
);
const workspaceSource = readFileSync(
  new URL("../../app/app/page.tsx", import.meta.url),
  "utf8",
);
const modulesSource = readFileSync(
  new URL("../../app/app/personal-economy-section.tsx", import.meta.url),
  "utf8",
);

test("Hushåll is a fourth detail module using the shared save experience", () => {
  assert.match(detailPageSource, /title="Hushåll"/);
  assert.match(detailPageSource, /usePlanningDetail\(\)/);
  assert.match(detailPageSource, /updateHouseholdProfile/);
  assert.match(modulesSource, /href="\/app\/hushall"/);
  assert.match(modulesSource, /title="Hushåll"/);
  assert.match(modulesSource, /xl:grid-cols-4/);
});

test("the detail page collects household identity and size without person profiles", () => {
  for (const label of [
    "Hushållsnamn",
    "Adress",
    "Postnummer",
    "Ort",
    "Antal vuxna",
    "Antal barn",
    "Ålder",
    "Födelseår",
  ]) {
    assert.match(overviewSource, new RegExp(label));
  }

  assert.doesNotMatch(overviewSource, /Telefonnummer|E-post|Personnummer|Civilstånd|Födelsedatum/);
  assert.match(overviewSource, /Inga namn eller andra identifierande uppgifter sparas/);
});

test("household editing no longer behaves like a year-navigation setting", () => {
  assert.doesNotMatch(workspaceSource, /HouseholdProfileDialog/);
  assert.doesNotMatch(workspaceSource, /onEditHousehold/);
  assert.match(modulesSource, /id: "household"/);
});
