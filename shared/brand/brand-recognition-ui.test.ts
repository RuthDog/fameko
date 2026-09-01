import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceSource = readFileSync("app/app/page.tsx", "utf8");
const guidedSetupSource = readFileSync("app/app/guided-setup.tsx", "utf8");
const logoSource = readFileSync("app/components/brand-logo.tsx", "utf8");
const nextConfigSource = readFileSync("next.config.ts", "utf8");

test("annual planning and mobile underposts use the shared recognized brand component", () => {
  const itemUsages = workspaceSource.match(
    /<RecognizedBrandLogo name=\{item\.name\} size=\{18\} \/>/g,
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
    /name=\{event\.itemLabel\}[\s\S]*?size=\{18\}/,
  );
  assert.match(workspaceSource, /return event\.itemLabel \? \(/);
  assert.match(workspaceSource, /<MobileInsightEventMarker event=\{event\} \/>/);
});

test("Guided Setup known brand choices use the same resolver-backed component", () => {
  assert.match(
    guidedSetupSource,
    /<RecognizedBrandLogo name=\{template\.displayName\} \/>/,
  );
  assert.match(
    guidedSetupSource,
    /<RecognizedBrandLogo name=\{existing\.label\} \/>/,
  );
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

test("Next development exposes only the publishable Logo.dev key from .dev.vars", () => {
  assert.match(nextConfigSource, /process\.env\.NODE_ENV !== "development"/);
  assert.match(nextConfigSource, /readFileSync\("\.dev\.vars", "utf8"\)/);
  assert.match(nextConfigSource, /normalized\?\.startsWith\("pk_"\)/);
  assert.doesNotMatch(nextConfigSource, /CF_ACCESS_(?:AUD|TEAM_DOMAIN)/);
});
