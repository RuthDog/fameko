import assert from "node:assert/strict";
import test from "node:test";

import {
  issueRegistrationAttestation,
  mayProvisionWorkosIdentity,
  readRegistrationAttestationCookie,
  registrationAttestationCookieName,
  registrationAttestationDeleteCookie,
  registrationAttestationSetCookie,
  registrationAttestationTtlSeconds,
  startRegistrationAttestation,
  verifyRegistrationCallbackAttestation,
} from "./registration.ts";

const environment = {
  WORKOS_COOKIE_PASSWORD: "test-cookie-password-that-is-at-least-32-chars",
};
const now = Date.UTC(2026, 9, 31, 10, 0, 0);
const nonce = "018f85c8-9c77-7d8e-9a1c-0123456789ab";

test("adult registration attestation rotates from issued to callback-bound started state", async () => {
  const issued = await issueRegistrationAttestation(environment, { nonce, now });
  const issuedCookie = registrationAttestationSetCookie(issued.token, issued.expiresAt, now);
  const request = new Request("https://auth-staging.example.test/auth/start-sign-up", {
    headers: { Cookie: issuedCookie.split(";", 1)[0] },
  });
  assert.equal(readRegistrationAttestationCookie(request), issued.token);

  const started = await startRegistrationAttestation(issued.token, environment, now);
  assert.ok(started);
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
  const issued = await issueRegistrationAttestation(environment, { nonce, now });
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

test("registration cookie is host-only, short-lived, secure, HttpOnly, and SameSite Lax", async () => {
  const issued = await issueRegistrationAttestation(environment, { nonce, now });
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

test("an existing WorkOS identity can sign in without repeating registration attestation", () => {
  assert.equal(mayProvisionWorkosIdentity(true, false), true);
});
