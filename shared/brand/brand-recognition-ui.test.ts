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
  assert.equal(workspaceSource.match(/\s+wrap\n/g)?.length, 2);
  assert.match(workspaceSource, /wrap \? "break-words whitespace-normal" : "truncate"/);
});

test("missing configuration and failed Logo.dev images have silent fallbacks", () => {
  assert.match(logoSource, /if \(!src \|\| failedSrc === src\) \{\s+return fallback;/);
  assert.match(logoSource, /fallback = null/);
  assert.match(logoSource, /onError=\{\(\) => setFailedSrc\(src\)\}/);
  assert.doesNotMatch(logoSource, /alt=""/);
});

test("the browser receives only the configured domain through Logo.dev", () => {
  assert.match(
    logoSource,
    /buildLogoDevUrl\(domain, logoDevPublishableKey, size\)/,
  );
  assert.doesNotMatch(logoSource, /PlanningData|amount|income|expense/);
});

test("Next builds expose only the publishable Logo.dev key from .dev.vars", () => {
  assert.match(nextConfigSource, /Object\.hasOwn\(process\.env, logoDevVariableName\)/);
  assert.match(nextConfigSource, /readFileSync\("\.dev\.vars", "utf8"\)/);
  assert.match(nextConfigSource, /normalized\?\.startsWith\("pk_"\)/);
  assert.doesNotMatch(nextConfigSource, /process\.env\.NODE_ENV/);
  assert.doesNotMatch(nextConfigSource, /CF_ACCESS_(?:AUD|TEAM_DOMAIN)/);
});
