import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthConfigurationError,
  WorkosEmailNotAllowedError,
  assertWorkosStagingEmailAllowed,
  cloudflareAccessAuthMode,
  getAuthMode,
  validateWorkosConfiguration,
  workosStagingAuthMode,
} from "./auth-mode.ts";
import { isSameOriginFormRequest, publicWorkosAuthGate } from "./public-auth-http.ts";

const workosEnvironment = {
  FAMEKO_AUTH_MODE: workosStagingAuthMode,
  NEXT_PUBLIC_WORKOS_REDIRECT_URI: "https://auth-staging.example.test/auth/callback",
  WORKOS_API_KEY: "test-api-key",
  WORKOS_CLIENT_ID: "client_test",
  WORKOS_COOKIE_PASSWORD: "x".repeat(32),
  WORKOS_ISSUER: "https://api.workos.com/",
  WORKOS_STAGING_ALLOWED_EMAILS: "allowed-a@example.test,allowed-b@example.test",
};
const trustedPublicOrigin = "https://auth-staging.example.test";

test("auth mode is explicit and unknown or missing values fail closed", () => {
  assert.equal(
    getAuthMode({ FAMEKO_AUTH_MODE: cloudflareAccessAuthMode }),
    cloudflareAccessAuthMode,
  );
  assert.equal(getAuthMode(workosEnvironment), workosStagingAuthMode);
  assert.throws(() => getAuthMode({}), AuthConfigurationError);
  assert.throws(() => getAuthMode({ FAMEKO_AUTH_MODE: "workos" }), AuthConfigurationError);
});

test("WorkOS mode requires complete secrets and a safe callback URL", () => {
  assert.deepEqual(validateWorkosConfiguration(workosEnvironment), {
    publicOrigin: trustedPublicOrigin,
    redirectUri: "https://auth-staging.example.test/auth/callback",
  });
  assert.throws(
    () => validateWorkosConfiguration({ ...workosEnvironment, WORKOS_API_KEY: undefined }),
    AuthConfigurationError,
  );
  assert.throws(
    () =>
      validateWorkosConfiguration({
        ...workosEnvironment,
        WORKOS_STAGING_ALLOWED_EMAILS: undefined,
      }),
    AuthConfigurationError,
  );
  assert.throws(
    () =>
      validateWorkosConfiguration({
        ...workosEnvironment,
        WORKOS_STAGING_ALLOWED_EMAILS: "allowed-a@example.test,allowed-a@example.test",
      }),
    AuthConfigurationError,
  );
  assert.throws(
    () =>
      validateWorkosConfiguration({
        ...workosEnvironment,
        NEXT_PUBLIC_WORKOS_REDIRECT_URI: "http://auth-staging.example.test/auth/callback",
      }),
    AuthConfigurationError,
  );
  assert.throws(
    () =>
      validateWorkosConfiguration({
        ...workosEnvironment,
        NEXT_PUBLIC_WORKOS_REDIRECT_URI:
          "https://auth-staging.example.test/wrong-callback",
      }),
    AuthConfigurationError,
  );
  assert.throws(
    () =>
      validateWorkosConfiguration({
        ...workosEnvironment,
        NEXT_PUBLIC_WORKOS_REDIRECT_URI:
          "https://auth-staging.example.test/auth/callback?untrusted=1",
      }),
    AuthConfigurationError,
  );
});

test("WorkOS staging allowlist accepts exactly two or three unique normalized addresses", () => {
  const twoAllowedEmails = "allowed-a@example.test, Allowed-B@Example.Test ";
  const threeAllowedEmails = `${twoAllowedEmails},allowed-c@example.test`;

  assert.doesNotThrow(() =>
    validateWorkosConfiguration({
      ...workosEnvironment,
      WORKOS_STAGING_ALLOWED_EMAILS: twoAllowedEmails,
    }),
  );
  assert.doesNotThrow(() =>
    validateWorkosConfiguration({
      ...workosEnvironment,
      WORKOS_STAGING_ALLOWED_EMAILS: threeAllowedEmails,
    }),
  );
  assert.doesNotThrow(() =>
    assertWorkosStagingEmailAllowed(" ALLOWED-C@EXAMPLE.TEST ", {
      WORKOS_STAGING_ALLOWED_EMAILS: threeAllowedEmails,
    }),
  );
});

test("WorkOS staging allowlist fails closed for invalid, duplicate or oversized lists", () => {
  for (const allowedEmails of [
    "",
    "allowed-a@example.test",
    "not-an-email,allowed-b@example.test",
    "allowed-a@example.test,Allowed-A@Example.Test",
    "allowed-a@example.test,allowed-b@example.test,allowed-c@example.test,allowed-d@example.test",
  ]) {
    assert.throws(
      () =>
        validateWorkosConfiguration({
          ...workosEnvironment,
          WORKOS_STAGING_ALLOWED_EMAILS: allowedEmails,
        }),
      AuthConfigurationError,
    );
  }
});

test("WorkOS staging allowlist denies an address that is not explicitly listed", () => {
  assert.throws(
    () =>
      assertWorkosStagingEmailAllowed("not-allowed@example.test", {
        WORKOS_STAGING_ALLOWED_EMAILS:
          "allowed-a@example.test,allowed-b@example.test,allowed-c@example.test",
      }),
    WorkosEmailNotAllowedError,
  );
});

test("public WorkOS routes stay hidden in legacy mode and fail closed on missing secrets", () => {
  assert.deepEqual(
    publicWorkosAuthGate({ FAMEKO_AUTH_MODE: cloudflareAccessAuthMode }),
    { ok: false, status: 404 },
  );
  assert.deepEqual(publicWorkosAuthGate({ FAMEKO_AUTH_MODE: workosStagingAuthMode }), {
    ok: false,
    status: 503,
  });
  assert.deepEqual(
    publicWorkosAuthGate({
      ...workosEnvironment,
      NEXT_PUBLIC_WORKOS_REDIRECT_URI:
        "https://auth-staging.example.test/not-the-callback",
    }),
    { ok: false, status: 503 },
  );
  assert.deepEqual(publicWorkosAuthGate(workosEnvironment), {
    ok: true,
    publicOrigin: trustedPublicOrigin,
  });
});

test("registration POST trusts configured public Origin instead of runtime or proxy hosts", () => {
  assert.equal(
    isSameOriginFormRequest(
      new Request("https://internal-worker.invalid/sign-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Host: "attacker.example",
          Origin: trustedPublicOrigin,
          "Sec-Fetch-Site": "same-origin",
          "X-Forwarded-Host": "attacker.example",
        },
      }),
      trustedPublicOrigin,
    ),
    true,
  );
  assert.equal(
    isSameOriginFormRequest(
      new Request("https://internal-worker.invalid/sign-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: trustedPublicOrigin,
          "Sec-Fetch-Site": "none",
        },
      }),
      trustedPublicOrigin,
    ),
    true,
  );
  assert.equal(
    isSameOriginFormRequest(
      new Request("https://internal-worker.invalid/sign-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: trustedPublicOrigin,
          "Sec-Fetch-Site": "same-site",
        },
      }),
      trustedPublicOrigin,
    ),
    true,
  );
});

test("registration POST rejects false Origin, cross-site and unsafe headerless requests", () => {
  assert.equal(
    isSameOriginFormRequest(
      new Request("https://internal-worker.invalid/sign-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-origin",
        },
      }),
      trustedPublicOrigin,
    ),
    true,
  );
  assert.equal(
    isSameOriginFormRequest(
      new Request("https://internal-worker.invalid/sign-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "https://attacker.example",
          "Sec-Fetch-Site": "same-origin",
        },
      }),
      trustedPublicOrigin,
    ),
    false,
  );
  assert.equal(
    isSameOriginFormRequest(
      new Request("https://internal-worker.invalid/sign-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: trustedPublicOrigin,
          "Sec-Fetch-Site": "cross-site",
        },
      }),
      trustedPublicOrigin,
    ),
    false,
  );
  assert.equal(
    isSameOriginFormRequest(
      new Request("https://internal-worker.invalid/sign-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Sec-Fetch-Site": "none",
        },
      }),
      trustedPublicOrigin,
    ),
    false,
  );
  assert.equal(
    isSameOriginFormRequest(
      new Request("https://internal-worker.invalid/sign-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }),
      trustedPublicOrigin,
    ),
    false,
  );
});
