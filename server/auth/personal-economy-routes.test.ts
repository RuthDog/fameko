import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const detailRoutes = ["boende", "bil", "sparande", "ekonomisk-halsa"] as const;

test("all Personal Economy detail routes exist as App Router pages", async () => {
  for (const route of detailRoutes) {
    const pageUrl = new URL(`../../app/app/${route}/page.tsx`, import.meta.url);
    await assert.doesNotReject(access(pageUrl));
    assert.match(await readFile(pageUrl, "utf8"), /export default function/);
  }
});

test("the existing app-wide auth matcher protects every detail route", async () => {
  const middleware = await readFile(new URL("../../middleware.ts", import.meta.url), "utf8");

  assert.match(middleware, /matcher:\s*\["\/app\/:path\*"\]/);
  for (const route of detailRoutes) {
    assert.match(`/app/${route}`, /^\/app(?:\/.*)?$/);
  }
});
