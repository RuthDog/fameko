import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { workosStagingAuthMode } from "./auth-mode.ts";
import { adultRegistrationAttestation } from "./registration.ts";
import { startWorkosSignUp } from "./workos-sign-up.ts";

const middlewareUrl = new URL("../../middleware.ts", import.meta.url);
const callbackUrl = new URL("../../app/auth/callback/route.ts", import.meta.url);
const signUpUrl = new URL("../../app/sign-up/route.ts", import.meta.url);
const signUpHandlerUrl = new URL("./workos-sign-up.ts", import.meta.url);
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
  const signUpHandler = await readFile(signUpHandlerUrl, "utf8");
  assert.match(callback, /onSuccess:\s*async/);
  assert.match(callback, /provisionWorkosAccountAfterVerifiedCallback/);
  assert.match(callback, /mayProvisionWorkosIdentity/);
  assert.match(callback, /assertWorkosStagingEmailAllowed/);
  assert.ok(
    callback.indexOf("assertWorkosStagingEmailAllowed(authContext") <
      callback.indexOf("const database = await getFamekoDatabase"),
  );
  assert.match(signUp, /startWorkosSignUp/);
  assert.match(signUpHandler, /adultRegistrationAttestation/);
  assert.match(signUpHandler, /isSameOriginFormRequest/);
});

test("adult confirmation transitions a same-origin browser POST to WorkOS Hosted UI", async () => {
  const environment = {
    FAMEKO_AUTH_MODE: workosStagingAuthMode,
    NEXT_PUBLIC_WORKOS_REDIRECT_URI:
      "https://auth-staging.example.test/auth/callback",
    WORKOS_API_KEY: "test-api-key",
    WORKOS_CLIENT_ID: "client_test",
    WORKOS_COOKIE_PASSWORD: "x".repeat(32),
    WORKOS_ISSUER: "https://api.workos.com/",
    WORKOS_STAGING_ALLOWED_EMAILS:
      "allowed-a@example.test,allowed-b@example.test",
  };
  let receivedOptions: { returnTo: string; state: string } | undefined;
  const response = await startWorkosSignUp(
    new Request("https://auth-staging.example.test/sign-up", {
      body: "adult-confirmation=confirmed",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
      },
      method: "POST",
    }),
    environment,
    async (options) => {
      receivedOptions = options;
      return "https://api.workos.com/user_management/authorize?synthetic=1";
    },
  );

  assert.equal(response.status, 303);
  assert.equal(
    new URL(response.headers.get("location") ?? "").origin,
    "https://api.workos.com",
  );
  assert.deepEqual(receivedOptions, {
    returnTo: "/app",
    state: adultRegistrationAttestation,
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
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
