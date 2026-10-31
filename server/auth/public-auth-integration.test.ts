import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { GET as getSignUpDocument } from "../../app/sign-up/route.ts";
import { workosStagingAuthMode } from "./auth-mode.ts";
import {
  registrationAttestationCookieName,
  verifyRegistrationCallbackAttestation,
} from "./registration.ts";
import { acceptWorkosSignUp, continueWorkosSignUp } from "./workos-sign-up.ts";

const middlewareUrl = new URL("../../middleware.ts", import.meta.url);
const callbackUrl = new URL("../../app/auth/callback/route.ts", import.meta.url);
const signUpUrl = new URL("../../app/sign-up/route.ts", import.meta.url);
const startSignUpUrl = new URL("../../app/auth/start-sign-up/route.ts", import.meta.url);
const signInUrl = new URL("../../app/sign-in/route.ts", import.meta.url);
const signUpHandlerUrl = new URL("./workos-sign-up.ts", import.meta.url);
const signOutUrl = new URL("../../app/auth/sign-out/actions.ts", import.meta.url);
const accountMenuUrl = new URL("../../app/app/account-menu.tsx", import.meta.url);
const sessionRouteUrl = new URL("../../app/app/api/session/route.ts", import.meta.url);

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

function cookieValue(setCookie: string | null, name: string): string | undefined {
  if (!setCookie) {
    return undefined;
  }
  const match = new RegExp(`(?:^|,\\s*)${name}=([^;]+)`).exec(setCookie);
  return match?.[1];
}

test("registration document preserves Origin without leaking URL details", async () => {
  const previousEnvironment = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(environment)) {
    previousEnvironment.set(name, process.env[name]);
    process.env[name] = value;
  }

  try {
    const response = getSignUpDocument(
      new Request("https://auth-staging.example.test/sign-up?error=adult-required"),
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("referrer-policy"), "strict-origin");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(
      response.headers.get("content-security-policy"),
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    );
    assert.match(await response.text(), /<form action="\/sign-up" method="post">/);
  } finally {
    for (const [name, value] of previousEnvironment) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});

test("registration rejects an opaque null Origin and accepts only the trusted Origin", async () => {
  const opaqueOrigin = await acceptWorkosSignUp(
    new Request("https://internal-worker.example.test/sign-up", {
      body: "adult-confirmation=confirmed",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "null",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
      },
      method: "POST",
    }),
    environment,
  );
  assert.equal(opaqueOrigin.status, 404);
  assert.equal(await opaqueOrigin.text(), "Not found");

  const trustedOrigin = await acceptWorkosSignUp(
    new Request("https://internal-worker.example.test/sign-up", {
      body: "adult-confirmation=confirmed",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://auth-staging.example.test",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
      },
      method: "POST",
    }),
    environment,
  );
  assert.equal(trustedOrigin.status, 303);
  assert.equal(
    trustedOrigin.headers.get("location"),
    "https://auth-staging.example.test/auth/start-sign-up",
  );
});

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
  const startSignUp = await readFile(startSignUpUrl, "utf8");
  const signIn = await readFile(signInUrl, "utf8");
  const signUpHandler = await readFile(signUpHandlerUrl, "utf8");
  assert.match(callback, /onSuccess:\s*async/);
  assert.match(callback, /provisionWorkosAccountAfterVerifiedCallback/);
  assert.match(callback, /mayProvisionWorkosIdentity/);
  assert.match(callback, /verifyRegistrationCallbackAttestation/);
  assert.match(callback, /assertWorkosStagingEmailAllowed/);
  assert.ok(
    callback.indexOf("assertWorkosStagingEmailAllowed(authContext") <
      callback.indexOf("const database = await getFamekoDatabase"),
  );
  assert.match(signUp, /acceptWorkosSignUp/);
  assert.match(signUp, /form-action 'self';/);
  assert.doesNotMatch(signUp, /form-action[^\n]+api\.workos\.com/);
  assert.match(startSignUp, /getSignUpUrl/);
  assert.match(startSignUp, /continueWorkosSignUp/);
  assert.match(signUpHandler, /issueRegistrationAttestation/);
  assert.match(signUpHandler, /isSameOriginFormRequest/);
  assert.match(signUpHandler, /\/auth\/start-sign-up/);
  assert.match(signIn, /getSignInUrl/);
  assert.doesNotMatch(signIn, /getSignUpUrl|acceptWorkosSignUp/);
});

test("adult confirmation redirects only to an internal GET before WorkOS starts", async () => {
  const response = await acceptWorkosSignUp(
    new Request("https://internal-worker.example.test/sign-up", {
      body: "adult-confirmation=confirmed",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://auth-staging.example.test",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
      },
      method: "POST",
    }),
    environment,
  );

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "https://auth-staging.example.test/auth/start-sign-up",
  );
  const issuedToken = cookieValue(
    response.headers.get("set-cookie"),
    registrationAttestationCookieName,
  );
  assert.ok(issuedToken);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("internal GET consumes issued attestation and starts a callback-bound WorkOS flow", async () => {
  const post = await acceptWorkosSignUp(
    new Request("https://internal-worker.example.test/sign-up", {
      body: "adult-confirmation=confirmed",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://auth-staging.example.test",
      },
      method: "POST",
    }),
    environment,
  );
  const issuedToken = cookieValue(
    post.headers.get("set-cookie"),
    registrationAttestationCookieName,
  );
  assert.ok(issuedToken);

  let receivedOptions: { returnTo: string; state: string } | undefined;
  const response = await continueWorkosSignUp(
    new Request("https://internal-worker.example.test/auth/start-sign-up", {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        Cookie: `${registrationAttestationCookieName}=${issuedToken}`,
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
      },
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
  assert.equal(receivedOptions?.returnTo, "/app");
  assert.ok(receivedOptions?.state);
  assert.notEqual(receivedOptions.state, issuedToken);
  const startedToken = cookieValue(
    response.headers.get("set-cookie"),
    registrationAttestationCookieName,
  );
  assert.equal(startedToken, receivedOptions.state);
  assert.equal(
    await verifyRegistrationCallbackAttestation(
      receivedOptions.state,
      startedToken,
      environment,
    ),
    true,
  );
  assert.equal(response.headers.get("cache-control"), "no-store");

  let replayFactoryCalled = false;
  const replay = await continueWorkosSignUp(
    new Request("https://auth-staging.example.test/auth/start-sign-up", {
      headers: {
        Accept: "text/html",
        Cookie: `${registrationAttestationCookieName}=${startedToken}`,
      },
    }),
    environment,
    async () => {
      replayFactoryCalled = true;
      return "https://api.workos.com/should-not-run";
    },
  );
  assert.equal(replay.status, 303);
  assert.equal(
    replay.headers.get("location"),
    "https://auth-staging.example.test/sign-up?error=attestation-expired",
  );
  assert.equal(replayFactoryCalled, false);
});

test("internal sign-up start fails closed without a valid document-navigation attestation", async () => {
  let factoryCalled = false;
  const missing = await continueWorkosSignUp(
    new Request("https://auth-staging.example.test/auth/start-sign-up", {
      headers: { Accept: "text/html" },
    }),
    environment,
    async () => {
      factoryCalled = true;
      return "https://api.workos.com/should-not-run";
    },
  );
  assert.equal(missing.status, 303);
  assert.equal(factoryCalled, false);

  const prefetch = await continueWorkosSignUp(
    new Request("https://auth-staging.example.test/auth/start-sign-up", {
      headers: { Accept: "text/html", Purpose: "prefetch" },
    }),
    environment,
    async () => "https://api.workos.com/should-not-run",
  );
  assert.equal(prefetch.status, 404);
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
