import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const middlewareUrl = new URL("../../middleware.ts", import.meta.url);
const callbackUrl = new URL("../../app/auth/callback/route.ts", import.meta.url);
const signUpUrl = new URL("../../app/sign-up/route.ts", import.meta.url);
const signOutUrl = new URL("../../app/auth/sign-out/actions.ts", import.meta.url);
const accountMenuUrl = new URL("../../app/app/account-menu.tsx", import.meta.url);
const sessionRouteUrl = new URL("../../app/app/api/session/route.ts", import.meta.url);

test("WorkOS session refresh composes inside the existing /app middleware perimeter", async () => {
  const source = await readFile(middlewareUrl, "utf8");
  assert.match(source, /authkit\(request/);
  assert.match(source, /refreshBufferSeconds:\s*60/);
  assert.match(source, /partitionAuthkitHeaders/);
  assert.match(source, /requestHeaders\.delete\("x-fameko-household-id"\)/);
  assert.match(source, /matcher:\s*\["\/app\/:path\*"\]/);
  assert.doesNotMatch(source, /proxy\.ts/);
});

test("new account writes exist only in the verified callback path", async () => {
  const callback = await readFile(callbackUrl, "utf8");
  const signUp = await readFile(signUpUrl, "utf8");
  assert.match(callback, /onSuccess:\s*async/);
  assert.match(callback, /provisionWorkosAccountAfterVerifiedCallback/);
  assert.match(callback, /mayProvisionWorkosIdentity/);
  assert.match(signUp, /adultRegistrationAttestation/);
  assert.match(signUp, /isSameOriginFormRequest/);
});

test("logout cookie mutation stays in a Server Action with all three UX choices", async () => {
  const signOut = await readFile(signOutUrl, "utf8");
  const menu = await readFile(accountMenuUrl, "utf8");
  assert.match(signOut, /^"use server";/);
  assert.match(signOut, /await signOut\(\{ returnTo: "\/" \}\)/);
  assert.match(menu, /Spara och logga ut/);
  assert.match(menu, /Fortsätt redigera/);
  assert.match(menu, /Logga ut utan att spara/);
  assert.doesNotMatch(menu, /@workos-inc/);
  assert.doesNotMatch(menu, /WORKOS_(?:API_KEY|COOKIE_PASSWORD)/);
});

test("session summary exposes no internal ids or tokens and is never cacheable", async () => {
  const source = await readFile(sessionRouteUrl, "utf8");
  assert.match(source, /"Cache-Control": "private, no-store, max-age=0"/);
  assert.doesNotMatch(source, /accessToken|refreshToken|household\.id|user\.id/);
});
