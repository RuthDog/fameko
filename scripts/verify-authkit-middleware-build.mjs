import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(
  await readFile(new URL("../.next/server/middleware-manifest.json", import.meta.url), "utf8"),
);
const matchers = manifest.middleware?.["/"]?.matchers;

assert.ok(Array.isArray(matchers), "The production middleware manifest is missing.");
assert.deepEqual(
  matchers.map(({ originalSource }) => originalSource),
  ["/app/:path*", "/account-link/confirm"],
  "AuthKit middleware must cover only the app and account-link confirmation routes.",
);

const compiledMatchers = matchers.map(({ regexp }) => new RegExp(regexp));
const isCovered = (pathname) => compiledMatchers.some((matcher) => matcher.test(pathname));

for (const pathname of [
  "/app",
  "/app/2026",
  "/account-link/confirm",
]) {
  assert.equal(isCovered(pathname), true, `${pathname} must run through AuthKit middleware.`);
}

for (const pathname of [
  "/account-link",
  "/auth/callback",
  "/sign-in",
]) {
  assert.equal(isCovered(pathname), false, `${pathname} must remain outside AuthKit middleware.`);
}

console.log("Verified compiled AuthKit middleware route coverage.");
