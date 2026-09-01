import assert from "node:assert/strict";
import test from "node:test";

import {
  brandLibrary,
  buildLogoDevUrl,
  resolveBrand,
} from "./brand-recognition.ts";
import { seedPlanningDataV3 } from "../planning/seed-planning-data.ts";

test("Brand Library stays within the approved 30-50 brand scope", () => {
  assert.equal(brandLibrary.length, 45);
});

test("Spotify resolves to its canonical domain", () => {
  assert.deepEqual(resolveBrand("Spotify"), {
    brandKey: "spotify",
    displayName: "Spotify",
    domain: "spotify.com",
    recognized: true,
  });
});

test("simple plan suffixes reuse the canonical Spotify brand", () => {
  assert.equal(resolveBrand("spotify premium").recognized, true);
  assert.equal(resolveBrand("Spotify Family").recognized, true);
  assert.equal(
    resolveBrand("spotify premium").recognized
      ? resolveBrand("spotify premium").displayName
      : null,
    "Spotify",
  );
});

test("Netflix resolves case-insensitively and trim-safe", () => {
  const result = resolveBrand("   nEtFlIx   ");
  assert.equal(result.recognized, true);
  assert.equal(result.recognized ? result.domain : null, "netflix.com");
});

test("Netflix accepts an unambiguous plan suffix", () => {
  const result = resolveBrand("Netflix Premium");
  assert.equal(result.recognized && result.domain, "netflix.com");
});

test("common Swedish telecom and insurance brands resolve", () => {
  assert.equal(resolveBrand("Telia").recognized ? resolveBrand("Telia").domain : null, "telia.se");
  assert.equal(resolveBrand("Agria").recognized ? resolveBrand("Agria").domain : null, "agria.se");
});

test("unknown or uncertain labels stay unrecognized", () => {
  assert.deepEqual(resolveBrand("Min egen försäkring"), { recognized: false });
  assert.deepEqual(resolveBrand("Max matbudget"), { recognized: false });
  assert.deepEqual(resolveBrand(""), { recognized: false });
});

test("Logo.dev URLs accept only publishable keys and contain only the canonical domain", () => {
  const url = buildLogoDevUrl("spotify.com", "pk_public-test", 20);
  assert.ok(url);
  assert.equal(url?.startsWith("https://img.logo.dev/spotify.com?"), true);
  assert.equal(url?.includes("fallback=404"), true);
  assert.equal(url?.includes("retina=true"), true);
  assert.equal(buildLogoDevUrl("spotify.com", "sk_secret", 20), null);
  assert.equal(buildLogoDevUrl("spotify.com/199kr-ola", "pk_public-test", 20), null);
});

test("Brand Resolver never changes PlanningData economics", () => {
  const planningItem = {
    id: "streaming-spotify",
    monthlyValues: { sep: 119, okt: 119 },
    name: "Spotify Family",
  };
  const before = structuredClone(planningItem);

  resolveBrand(planningItem.name);

  assert.deepEqual(planningItem, before);
});

test("existing PlanningData labels are resolved without a migration", () => {
  const planningData = structuredClone(seedPlanningDataV3);
  const before = structuredClone(planningData);

  for (const item of planningData.expenseItems) {
    resolveBrand(item.name);
  }

  assert.deepEqual(planningData, before);
});
