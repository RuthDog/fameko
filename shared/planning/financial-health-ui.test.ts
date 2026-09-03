import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const workspaceSource = await readFile(
  new URL("../../app/app/page.tsx", import.meta.url),
  "utf8",
);
const cardSource = await readFile(
  new URL("../../app/app/financial-health-card.tsx", import.meta.url),
  "utf8",
);
const viewSource = await readFile(
  new URL("../../app/app/financial-health-view.tsx", import.meta.url),
  "utf8",
);
const savingsSource = await readFile(
  new URL("../../app/app/savings-overview.tsx", import.meta.url),
  "utf8",
);
const detailSource = await readFile(
  new URL("../../app/app/ekonomisk-halsa/page.tsx", import.meta.url),
  "utf8",
);

test("Workspace evaluates the currently loaded PlanningYear through the shared engine", () => {
  assert.match(workspaceSource, /evaluateFinancialHealth\(planningData, monthIds\)/);
  assert.match(workspaceSource, /<FinancialHealthCard result=\{financialHealth\}/);
  assert.match(detailSource, /usePlanningDetail\(\)/);
  assert.match(detailSource, /evaluateFinancialHealth\(planning\.data, savingsMonthIds\)/);
});

test("the mobile preview stays compact and opens the explainable detail view", async () => {
  await assert.doesNotReject(
    access(new URL("../../app/app/ekonomisk-halsa/page.tsx", import.meta.url)),
  );
  assert.match(cardSource, /Visa analys/);
  assert.match(cardSource, /hidden w-full max-w-xl grid-cols-2/);
  assert.match(cardSource, /result\.summary/);
  assert.match(viewSource, /Styrkor/);
  assert.match(viewSource, /Att hålla koll på/);
  assert.match(viewSource, /Underlag som saknas/);
  assert.doesNotMatch(cardSource, /\/100|score|betyg/i);
});

test("optional financial assets reuse CurrencyInput and the shared save document", () => {
  assert.match(savingsSource, /Din ekonomiska grund/);
  assert.match(savingsSource, /<CurrencyInput/g);
  assert.match(savingsSource, /financialAssetsData/);
  assert.doesNotMatch(savingsSource, /fetch\(|\/api\//);
});

test("UI contains no financial-health threshold logic", () => {
  for (const source of [workspaceSource, cardSource, viewSource, savingsSource]) {
    assert.doesNotMatch(source, /negativeMonthsWatchAtLeast|resilientAtLeast|watchAbove/);
  }
});
