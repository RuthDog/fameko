import assert from "node:assert/strict";
import test from "node:test";

import { AuthFlowFailure, reportAuthFlowFailure } from "./auth-diagnostics.ts";
import {
  issueRegistrationAttestation,
  mayProvisionWorkosIdentity,
  readRegistrationAttestationCookie,
  registrationAttestationCookieName,
  registrationAttestationDeleteCookie,
  registrationAttestationSetCookie,
  registrationAttestationTtlSeconds,
  startRegistrationAttestation,
  validateRegistrationCallbackAttestation,
  verifyRegistrationCallbackAttestation,
} from "./registration.ts";

const environment = {
  WORKOS_COOKIE_PASSWORD: "test-cookie-password-that-is-at-least-32-chars",
};
const now = Date.UTC(2026, 9, 31, 10, 0, 0);
const nonce = "018f85c8-9c77-7d8e-9a1c-0123456789ab";

test("adult registration attestation rotates from issued to callback-bound started state", async () => {
  const issued = await issueRegistrationAttestation(environment, "create", { nonce, now });
  assert.equal(issued.intent, "create");
  const issuedCookie = registrationAttestationSetCookie(issued.token, issued.expiresAt, now);
  const request = new Request("https://auth-staging.example.test/auth/start-sign-up", {
    headers: { Cookie: issuedCookie.split(";", 1)[0] },
  });
  assert.equal(readRegistrationAttestationCookie(request), issued.token);

  const started = await startRegistrationAttestation(issued.token, environment, now);
  assert.ok(started);
  assert.equal(started.intent, "create");
  assert.notEqual(started.token, issued.token);
  assert.equal(
    await verifyRegistrationCallbackAttestation(
      started.token,
      started.token,
      environment,
      now,
    ),
    true,
  );

  assert.equal(await startRegistrationAttestation(started.token, environment, now), null);
  assert.equal(
    await verifyRegistrationCallbackAttestation(
      started.token,
      `${started.token}tampered`,
      environment,
      now,
    ),
    false,
  );
});

test("registration attestation is tamper-evident, secret-bound, and expires after five minutes", async () => {
  const issued = await issueRegistrationAttestation(environment, "create", { nonce, now });
  const tampered = `${issued.token.slice(0, -1)}${issued.token.endsWith("a") ? "b" : "a"}`;
  assert.equal(await startRegistrationAttestation(tampered, environment, now), null);
  assert.equal(
    await startRegistrationAttestation(
      issued.token,
      { WORKOS_COOKIE_PASSWORD: "different-password-that-is-at-least-32-chars" },
      now,
    ),
    null,
  );
  assert.ok(
    await startRegistrationAttestation(
      issued.token,
      environment,
      now + (registrationAttestationTtlSeconds - 1) * 1000,
    ),
  );
  assert.equal(
    await startRegistrationAttestation(
      issued.token,
      environment,
      now + registrationAttestationTtlSeconds * 1000,
    ),
    null,
  );
});

test("an abandoned registration can restart only with the newly issued attestation", async () => {
  const abandoned = await issueRegistrationAttestation(environment, "create", { nonce, now });
  const restarted = await issueRegistrationAttestation(environment, "recover", {
    nonce: "128f85c8-9c77-7d8e-9a1c-0123456789ab",
    now: now + 1_000,
  });
  const abandonedStarted = await startRegistrationAttestation(abandoned.token, environment, now);
  const restartedStarted = await startRegistrationAttestation(
    restarted.token,
    environment,
    now + 1_000,
  );
  assert.ok(abandonedStarted);
  assert.ok(restartedStarted);
  assert.equal(restartedStarted.intent, "recover");
  assert.equal(
    await validateRegistrationCallbackAttestation(
      abandonedStarted.token,
      restartedStarted.token,
      environment,
      now + 1_000,
    ),
    "state_mismatch",
  );
  assert.equal(
    await validateRegistrationCallbackAttestation(
      restartedStarted.token,
      restartedStarted.token,
      environment,
      now + 1_000,
    ),
    "valid",
  );
});

test("callback attestation reports a bounded fail-closed validation reason", async () => {
  const issued = await issueRegistrationAttestation(environment, "recover", { nonce, now });
  const started = await startRegistrationAttestation(issued.token, environment, now);
  assert.ok(started);
  assert.equal(started.intent, "recover");

  assert.equal(
    await validateRegistrationCallbackAttestation(undefined, undefined, environment, now),
    "missing",
  );
  assert.equal(
    await validateRegistrationCallbackAttestation(started.token, undefined, environment, now),
    "missing",
  );
  assert.equal(
    await validateRegistrationCallbackAttestation(
      started.token,
      undefined,
      environment,
      now + registrationAttestationTtlSeconds * 1000,
    ),
    "expired",
  );
  assert.equal(
    await validateRegistrationCallbackAttestation(
      started.token,
      issued.token,
      environment,
      now,
    ),
    "state_mismatch",
  );
  assert.equal(
    await validateRegistrationCallbackAttestation(
      issued.token,
      issued.token,
      environment,
      now,
    ),
    "wrong_phase",
  );

  const tampered = `${started.token.slice(0, -1)}${started.token.endsWith("a") ? "b" : "a"}`;
  assert.equal(
    await validateRegistrationCallbackAttestation(tampered, tampered, environment, now),
    "invalid_signature",
  );
  assert.equal(
    await validateRegistrationCallbackAttestation(tampered, undefined, environment, now),
    "invalid_signature",
  );
  assert.equal(
    await validateRegistrationCallbackAttestation(
      started.token,
      started.token,
      { WORKOS_COOKIE_PASSWORD: "too-short" },
      now,
    ),
    "configuration_error",
  );
  assert.equal(
    await validateRegistrationCallbackAttestation(
      started.token,
      started.token,
      environment,
      now,
    ),
    "valid",
  );
});

test("callback diagnostics emit only the bounded attestation reason", () => {
  const messages: string[] = [];
  const originalError = console.error;
  console.error = (message?: unknown) => {
    messages.push(String(message));
  };
  try {
    reportAuthFlowFailure(new AuthFlowFailure("callback_attestation", "expired"));
  } finally {
    console.error = originalError;
  }

  assert.equal(messages.length, 1);
  const event = JSON.parse(messages[0]) as Record<string, unknown>;
  assert.deepEqual(Object.keys(event).sort(), [
    "correlationId",
    "event",
    "reason",
    "step",
  ]);
  assert.equal(event.event, "fameko_auth_failure");
  assert.equal(event.reason, "expired");
  assert.equal(event.step, "callback_attestation");
  assert.match(String(event.correlationId), /^[0-9a-f-]{36}$/iu);
});

test("registration cookie is host-only, short-lived, secure, HttpOnly, and SameSite Lax", async () => {
  const issued = await issueRegistrationAttestation(environment, "create", { nonce, now });
  const setCookie = registrationAttestationSetCookie(issued.token, issued.expiresAt, now);
  assert.match(setCookie, new RegExp(`^${registrationAttestationCookieName}=`));
  assert.match(setCookie, /; Path=\//u);
  assert.match(setCookie, /; HttpOnly/u);
  assert.match(setCookie, /; Secure/u);
  assert.match(setCookie, /; SameSite=Lax/u);
  assert.match(setCookie, /; Max-Age=300$/u);
  assert.doesNotMatch(setCookie, /Domain=/iu);

  const deletion = registrationAttestationDeleteCookie();
  assert.match(deletion, /Max-Age=0/u);
  assert.match(deletion, /Expires=Thu, 01 Jan 1970/u);
  assert.doesNotMatch(deletion, /Domain=/iu);
});

test("new WorkOS account requires a verified callback attestation", () => {
  assert.equal(mayProvisionWorkosIdentity(false, true), true);
  assert.equal(mayProvisionWorkosIdentity(false, false), false);
});

test("every bounded attestation failure denies provisioning for an unknown WorkOS identity", () => {
  const attestationIsValid = (result: string) => result === "valid";
  for (const reason of [
    "configuration_error",
    "expired",
    "invalid_payload",
    "invalid_signature",
    "missing",
    "state_mismatch",
    "wrong_phase",
  ] as const) {
    assert.equal(mayProvisionWorkosIdentity(false, attestationIsValid(reason)), false);
  }
});

test("an existing WorkOS identity can sign in without repeating registration attestation", () => {
  assert.equal(mayProvisionWorkosIdentity(true, false), true);
});
