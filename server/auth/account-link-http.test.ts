import assert from "node:assert/strict";
import test from "node:test";

import { accountLinkGate, completeAccountLink } from "./account-link-http.ts";

const environment = {
  CF_ACCESS_AUD: "access-audience",
  CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
  FAMEKO_AUTH_MODE: "workos_production_transition",
  NEXT_PUBLIC_WORKOS_REDIRECT_URI: "https://fameko.example.test/auth/callback",
  WORKOS_API_KEY: "test-api-key",
  WORKOS_CLIENT_ID: "client_prod_test",
  WORKOS_COOKIE_PASSWORD: "x".repeat(32),
  WORKOS_ISSUER: "https://api.workos.com/user_management/client_prod_test",
};

const unreachableDependencies = {
  database: new Proxy({} as D1Database, {
    get() {
      throw new Error("D1 must not be touched before confirmation and CSRF checks.");
    },
  }),
  workosUserResolver: async () => {
    throw new Error("WorkOS must not be touched before confirmation and CSRF checks.");
  },
};

function formRequest(body: URLSearchParams, origin = "https://fameko.example.test") {
  return new Request("https://fameko.example.test/account-link/confirm", {
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: origin,
      "Sec-Fetch-Site": "same-origin",
    },
    method: "POST",
  });
}

test("unconfirmed account linking cannot touch D1 or an existing household", async () => {
  const response = await completeAccountLink(
    formRequest(new URLSearchParams({ "account-link-state": "not-used" })),
    environment,
    unreachableDependencies,
  );
  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "https://fameko.example.test/account-link/confirm?error=confirmation-required",
  );
});

test("cross-origin account-link confirmation is rejected before state or D1 access", async () => {
  const response = await completeAccountLink(
    formRequest(
      new URLSearchParams({
        "account-link-confirmation": "confirmed",
        "account-link-state": "not-used",
      }),
      "https://attacker.example",
    ),
    environment,
    unreachableDependencies,
  );
  assert.equal(response.status, 404);
});

test("account linking is exposed only in the explicit transition mode", () => {
  assert.deepEqual(accountLinkGate(environment), {
    ok: true,
    publicOrigin: "https://fameko.example.test",
  });
  assert.deepEqual(
    accountLinkGate({ ...environment, FAMEKO_AUTH_MODE: "cloudflare_access" }),
    { ok: false, status: 404 },
  );
  assert.deepEqual(
    accountLinkGate({ ...environment, FAMEKO_AUTH_MODE: "workos_production" }),
    { ok: false, status: 404 },
  );
  assert.deepEqual(
    accountLinkGate({ ...environment, FAMEKO_AUTH_MODE: "workos_staging" }),
    { ok: false, status: 404 },
  );
});
