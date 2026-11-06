import assert from "node:assert/strict";
import test from "node:test";

import {
  accountLinkStateCookieName,
  accountLinkStateDeleteCookie,
  accountLinkStateSetCookie,
  issueAccountLinkState,
  validateAccountLinkState,
} from "./account-link-state.ts";

const environment = { WORKOS_COOKIE_PASSWORD: "state-test-secret".repeat(3) };
const now = Date.parse("2026-11-06T12:00:00.000Z");

test("account-link state is signed, browser-bound and short-lived", async () => {
  const state = await issueAccountLinkState(environment, {
    grantId: "10000000-0000-4000-8000-000000000001",
    nonce: "20000000-0000-4000-8000-000000000002",
    now,
  });
  assert.deepEqual(
    await validateAccountLinkState(state.token, state.token, environment, now + 1_000),
    { ok: true, state },
  );
  assert.deepEqual(
    await validateAccountLinkState(state.token, undefined, environment, now + 1_000),
    { code: "missing", ok: false },
  );
  const otherBrowser = await issueAccountLinkState(environment, { now });
  assert.deepEqual(
    await validateAccountLinkState(state.token, otherBrowser.token, environment, now + 1_000),
    { code: "mismatch", ok: false },
  );
  assert.deepEqual(
    await validateAccountLinkState(
      `${state.token.slice(0, -1)}x`,
      `${state.token.slice(0, -1)}x`,
      environment,
      now + 1_000,
    ),
    { code: "invalid", ok: false },
  );
  assert.deepEqual(
    await validateAccountLinkState(state.token, state.token, environment, now + 601_000),
    { code: "expired", ok: false },
  );
});

test("account-link cookie is host-only, HttpOnly, Secure and removable", async () => {
  const state = await issueAccountLinkState(environment, { now });
  const cookie = accountLinkStateSetCookie(state.token, state.expiresAt, now);
  assert.match(cookie, new RegExp(`^${accountLinkStateCookieName}=`));
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=600/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.doesNotMatch(cookie, /Domain=/i);
  assert.match(accountLinkStateDeleteCookie(), /Max-Age=0/);
});
