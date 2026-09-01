import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const guidedSetupSource = readFileSync(
  new URL("../../app/app/guided-setup.tsx", import.meta.url),
  "utf8",
);
const workspaceSource = readFileSync(
  new URL("../../app/app/page.tsx", import.meta.url),
  "utf8",
);
const onboardingSource = readFileSync(
  new URL("../../app/app/onboarding.tsx", import.meta.url),
  "utf8",
);

test("the recommended income action opens its guide directly", () => {
  assert.match(guidedSetupSource, /onClick=\{\(\) => onStart\(suggestion\?\.guideId\)\}/);
  assert.match(workspaceSource, /setGuidedSetupInitialGuide\(guideId \?\? null\)/);
  assert.match(
    workspaceSource,
    /initialGuideId=\{guidedSetupInitialGuide \?\? undefined\}/,
  );
});

test("the complete recommendation card is one direct action", () => {
  assert.match(onboardingSource, /className="group flex w-full/);
  assert.match(onboardingSource, /onClick=\{onAction\}/);
  assert.match(onboardingSource, /<span className="shrink-0[^"]*">\s*\{suggestion\.actionLabel\}/);
});

test("the annual table renders symbols only on approved main rows", () => {
  for (const symbol of ["income", "allocations", "billAccount", "mortgage", "savings"]) {
    assert.match(workspaceSource, new RegExp(`symbol="${symbol}"`));
  }
  assert.match(workspaceSource, /getExpenseCategoryMainSectionId\(categoryId\)/);
  assert.match(workspaceSource, /famekoMainSectionSymbols\[mainSectionId\]/);
});

test("non-monthly questions always request the next payment month", () => {
  assert.match(guidedSetupSource, /frequency === "monthly" \? applyAndFinish\(\) : setEditStage\("month"\)/);
  assert.match(guidedSetupSource, /När kommer den första betalningen\?/);
  assert.match(guidedSetupSource, /Betalningsmånad/);
});

test("the year display has no false interactive controls", () => {
  assert.match(workspaceSource, /aria-label="Aktivt planeringsår"/);
  assert.doesNotMatch(workspaceSource, /const planningYears/);
  assert.doesNotMatch(workspaceSource, /Uppdatera från föregående år/);
  assert.doesNotMatch(workspaceSource, /\+ Nytt år/);
});
