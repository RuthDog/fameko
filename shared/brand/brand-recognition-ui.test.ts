import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceSource = readFileSync("app/app/page.tsx", "utf8");
const guidedSetupSource = readFileSync("app/app/guided-setup.tsx", "utf8");
const logoSource = readFileSync("app/components/brand-logo.tsx", "utf8");
const nextConfigSource = readFileSync("next.config.ts", "utf8");

test("annual planning and mobile underposts use the shared recognized brand component", () => {
  const itemUsages = workspaceSource.match(
    /<RecognizedBrandLogo name=\{item\.brandLabel \?\? item\.name\} size=\{18\} \/>/g,
  );

  assert.equal(itemUsages?.length, 2);
  assert.doesNotMatch(
    workspaceSource,
    /<RecognizedBrandLogo name=\{category\.(?:name|label)\}/,
  );
});

test("concrete upcoming insight items use BrandLogo while category insights keep Fameko markers", () => {
  assert.match(
    workspaceSource,
    /name=\{event\.brandLabel\}[\s\S]*?size=\{18\}/,
  );
  assert.match(workspaceSource, /return event\.brandLabel \? \(/);
  assert.match(workspaceSource, /<MobileInsightEventMarker event=\{event\} \/>/);
});

test("Guided Setup known brand choices use the same resolver-backed component", () => {
  assert.match(
    guidedSetupSource,
    /<RecognizedBrandLogo name=\{template\.displayName\} \/>/,
  );
  assert.match(
    guidedSetupSource,
    /<RecognizedBrandLogo name=\{existing\.brandLabel\} \/>/,
  );
});

test("add expense keeps separate fields while table rendering uses one text row", () => {
  const companyPosition = workspaceSource.indexOf("Företag");
  const descriptionPosition = workspaceSource.indexOf("Beskrivning", companyPosition);
  const amountPosition = workspaceSource.indexOf("Belopp", descriptionPosition);

  assert.ok(companyPosition > 0);
  assert.ok(descriptionPosition > companyPosition);
  assert.ok(amountPosition > descriptionPosition);
  assert.match(workspaceSource, /createExpenseItemIdentity\(draft\.company, draft\.description\)/);
  assert.doesNotMatch(workspaceSource, /item\.description \? \(/);
  assert.doesNotMatch(guidedSetupSource, /existing\.secondaryLabel/);
  assert.equal(workspaceSource.match(/^\s+wrap\s*$/gm)?.length, 2);
  assert.match(workspaceSource, /wrap \? "break-words whitespace-normal" : "truncate"/);
});

test("recognized brands use only a local neutral fallback", () => {
  assert.match(logoSource, /if \(fallback !== null\) \{\s+return fallback;/);
  assert.match(logoSource, /fallback = null/);
  assert.match(logoSource, /bg-stone-200/);
  assert.doesNotMatch(logoSource, /<img|https?:\/\/|process\.env/);
});

test("Next builds no longer expose a Logo.dev key", () => {
  assert.doesNotMatch(nextConfigSource, /LOGO_DEV|logoDev|readFileSync/);
});
