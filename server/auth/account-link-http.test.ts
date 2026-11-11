import assert from "node:assert/strict";
import test from "node:test";

import {
  accountLinkGate,
  completeAccountLink,
  getAccountLinkConfirmation,
  startAccountLink,
} from "./account-link-http.ts";
import {
  accountLinkStateCookieName,
  issueAccountLinkState,
  type VerifiedAccountLinkState,
} from "./account-link-state.ts";

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

function formRequest(
  body: URLSearchParams,
  origin = "https://fameko.example.test",
  path = "/account-link/confirm",
  fetchSite = "same-origin",
) {
  return new Request(`https://fameko.example.test${path}`, {
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: origin,
      "Sec-Fetch-Site": fetchSite,
    },
    method: "POST",
  });
}

const confirmedBody = new URLSearchParams({
  "account-link-confirmation": "confirmed",
});

function existingAccessContext() {
  const timestamp = "2026-11-09T12:00:00.000Z";
  const userId = "user-existing";
  const householdId = "household-existing";
  return {
    authContext: {
      provider: "cloudflare_access",
      providerSubject: "access-subject-existing",
      verifiedEmail: "pilot@example.test",
    },
    context: {
      household: {
        created_at: timestamp,
        id: householdId,
        name: "Existing household",
        updated_at: timestamp,
      },
      identity: {
        created_at: timestamp,
        email: "pilot@example.test",
        id: "identity-existing",
        provider: "cloudflare_access",
        provider_subject: "access-subject-existing",
        updated_at: timestamp,
        user_id: userId,
      },
      membership: {
        created_at: timestamp,
        household_id: householdId,
        role: "owner" as const,
        user_id: userId,
      },
      user: {
        created_at: timestamp,
        display_name: null,
        id: userId,
        status: "active" as const,
        updated_at: timestamp,
      },
    },
    ok: true as const,
  };
}

function grantRecordingDatabase() {
  let batches = 0;
  const statement = {
    bind() {
      return statement;
    },
  };
  const database = {
    batch: async () => {
      batches += 1;
      return [
        { meta: { changes: 0 } },
        { meta: { changes: 1 } },
      ];
    },
    prepare: () => statement,
  } as unknown as D1Database;
  return { database, grantBatches: () => batches };
}

function confirmationRequest(state: VerifiedAccountLinkState) {
  return new Request("https://fameko.example.test/account-link/confirm", {
    headers: {
      Cookie: `${accountLinkStateCookieName}=${state.token}`,
    },
  });
}

function confirmationDatabase(
  state: VerifiedAccountLinkState,
  overrides: Partial<{
    consumed_at: string | null;
    expires_at: string;
    revoked_at: string | null;
    source_provider_subject: string;
    state_hash: string;
    target_provider_subject: string;
  }> = {},
) {
  let reads = 0;
  const row = {
    consumed_at: null,
    existing_user_id: "user-existing",
    expires_at: "2026-11-09T12:10:00.000Z",
    id: state.grantId,
    revoked_at: null,
    source_provider: "cloudflare_access",
    source_provider_subject: "access-subject-existing",
    state_hash: state.stateHash,
    target_provider: "workos",
    target_provider_subject: "workos-subject-existing",
    ...overrides,
  };
  const statement = {
    bind() {
      return statement;
    },
    async first() {
      reads += 1;
      return row;
    },
  };
  const database = {
    prepare() {
      return statement;
    },
  } as unknown as D1Database;
  return { database, reads: () => reads };
}

const verifiedWorkosUser = {
  email: "pilot@example.test",
  emailVerified: true,
  id: "workos-subject-existing",
};

test("account-link confirmation requires and preserves both verified identities without writing", async () => {
  const now = Date.parse("2026-11-09T12:00:00.000Z");
  const state = await issueAccountLinkState(environment, { now });
  const recorded = confirmationDatabase(state);
  const result = await getAccountLinkConfirmation(
    confirmationRequest(state),
    environment,
    {
      accessResolver: async () => existingAccessContext(),
      database: recorded.database,
      workosUserResolver: async () => verifiedWorkosUser,
    },
    new Date(now + 1_000),
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.context.source.user.id, "user-existing");
    assert.equal(result.context.source.household.id, "household-existing");
    assert.equal(result.context.sourceIdentity.providerSubject, "access-subject-existing");
    assert.equal(result.context.targetIdentity.providerSubject, "workos-subject-existing");
    assert.equal(result.context.state.grantId, state.grantId);
  }
  assert.equal(recorded.reads(), 1);
});

test("account-link confirmation rejects a missing WorkOS session before reading the grant", async () => {
  const now = Date.parse("2026-11-09T12:00:00.000Z");
  const state = await issueAccountLinkState(environment, { now });
  const recorded = confirmationDatabase(state);
  const result = await getAccountLinkConfirmation(
    confirmationRequest(state),
    environment,
    {
      accessResolver: async () => existingAccessContext(),
      database: recorded.database,
      workosUserResolver: async () => null,
    },
    new Date(now + 1_000),
  );

  assert.deepEqual(result, { code: "workos_identity_missing", ok: false });
  assert.equal(recorded.reads(), 0);
});

test("account-link confirmation rejects an invalid Access JWT before WorkOS or grant access", async () => {
  const now = Date.parse("2026-11-09T12:00:00.000Z");
  const state = await issueAccountLinkState(environment, { now });
  const recorded = confirmationDatabase(state);
  let workosCalls = 0;
  const result = await getAccountLinkConfirmation(
    confirmationRequest(state),
    environment,
    {
      accessResolver: async () => ({ code: "token_invalid" as const, ok: false as const }),
      database: recorded.database,
      workosUserResolver: async () => {
        workosCalls += 1;
        return verifiedWorkosUser;
      },
    },
    new Date(now + 1_000),
  );

  assert.deepEqual(result, { code: "token_invalid", ok: false });
  assert.equal(workosCalls, 0);
  assert.equal(recorded.reads(), 0);
});

test("account-link confirmation rejects expired state and mismatched grant subjects", async () => {
  const now = Date.parse("2026-11-09T12:00:00.000Z");
  const state = await issueAccountLinkState(environment, { now });
  const recorded = confirmationDatabase(state, {
    target_provider_subject: "different-workos-subject",
  });
  let accessCalls = 0;
  const expired = await getAccountLinkConfirmation(
    confirmationRequest(state),
    environment,
    {
      accessResolver: async () => {
        accessCalls += 1;
        return existingAccessContext();
      },
      database: recorded.database,
      workosUserResolver: async () => verifiedWorkosUser,
    },
    new Date(now + 601_000),
  );
  assert.deepEqual(expired, { code: "grant_invalid", ok: false });
  assert.equal(accessCalls, 0);
  assert.equal(recorded.reads(), 0);

  const mismatched = await getAccountLinkConfirmation(
    confirmationRequest(state),
    environment,
    {
      accessResolver: async () => existingAccessContext(),
      database: recorded.database,
      workosUserResolver: async () => verifiedWorkosUser,
    },
    new Date(now + 1_000),
  );
  assert.deepEqual(mismatched, { code: "grant_invalid", ok: false });
  assert.equal(recorded.reads(), 1);
});

test("trusted account-link Origin creates one grant and starts only the verified WorkOS redirect", async () => {
  const recorded = grantRecordingDatabase();
  let receivedOptions: { returnTo: string; state: string } | undefined;
  const response = await startAccountLink(
    formRequest(
      confirmedBody,
      "https://fameko.example.test",
      "/account-link?utm_source=browser-test",
    ),
    environment,
    {
      accessResolver: async () => existingAccessContext(),
      createSignInUrl: async (options) => {
        receivedOptions = options;
        return "https://api.workos.com/user_management/authorize?synthetic=1";
      },
      database: recorded.database,
      workosUserResolver: async () => null,
    },
  );

  assert.equal(response.status, 303);
  assert.equal(
    new URL(response.headers.get("location") ?? "").origin,
    "https://api.workos.com",
  );
  assert.equal(receivedOptions?.returnTo, "/account-link/confirm");
  assert.ok(receivedOptions?.state);
  assert.equal(recorded.grantBatches(), 1);
});

test("opaque and cross-origin account-link starts are rejected before Access or D1", async () => {
  let accessCalls = 0;
  const dependencies = {
    accessResolver: async () => {
      accessCalls += 1;
      throw new Error("Access must not be evaluated after failed CSRF validation.");
    },
    createSignInUrl: async () => {
      throw new Error("WorkOS must not be evaluated after failed CSRF validation.");
    },
    ...unreachableDependencies,
  };

  for (const [origin, fetchSite] of [
    ["null", "same-origin"],
    ["https://attacker.example", "cross-site"],
    ["https://fameko.example.test", "cross-site"],
  ]) {
    const response = await startAccountLink(
      formRequest(confirmedBody, origin, "/account-link", fetchSite),
      environment,
      dependencies,
    );
    assert.equal(response.status, 404);
  }
  assert.equal(accessCalls, 0);
});

test("invalid Access JWT cannot create a grant after valid account-link CSRF validation", async () => {
  let signInCalls = 0;
  const response = await startAccountLink(
    formRequest(confirmedBody, "https://fameko.example.test", "/account-link"),
    environment,
    {
      accessResolver: async () => ({ code: "token_invalid" as const, ok: false as const }),
      createSignInUrl: async () => {
        signInCalls += 1;
        return "https://api.workos.com/should-not-run";
      },
      ...unreachableDependencies,
    },
  );

  assert.equal(response.status, 503);
  assert.equal(signInCalls, 0);
});

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

test("opaque account-link confirmation Origin is rejected before state or D1 access", async () => {
  const response = await completeAccountLink(
    formRequest(
      new URLSearchParams({
        "account-link-confirmation": "confirmed",
        "account-link-state": "not-used",
      }),
      "null",
    ),
    environment,
    unreachableDependencies,
  );
  assert.equal(response.status, 404);
});

test("account linking is exposed only in transition or explicitly enabled production", () => {
  assert.deepEqual(accountLinkGate(environment), {
    ok: true,
    publicOrigin: "https://fameko.example.test",
  });
  assert.deepEqual(
    accountLinkGate({ ...environment, FAMEKO_AUTH_MODE: "cloudflare_access" }),
    { ok: false, status: 404 },
  );
  assert.deepEqual(
    accountLinkGate({
      ...environment,
      FAMEKO_AUTH_MODE: "workos_production",
      FAMEKO_LEGACY_ACCOUNT_LINK: "enabled",
    }),
    { ok: true, publicOrigin: "https://fameko.example.test" },
  );
  assert.deepEqual(
    accountLinkGate({
      ...environment,
      FAMEKO_AUTH_MODE: "workos_production",
    }),
    { ok: false, status: 404 },
  );
  assert.deepEqual(
    accountLinkGate({ ...environment, FAMEKO_AUTH_MODE: "workos_staging" }),
    { ok: false, status: 404 },
  );
});

test("production legacy account linking fails closed on incomplete Access configuration", () => {
  assert.deepEqual(
    accountLinkGate({
      ...environment,
      CF_ACCESS_AUD: undefined,
      FAMEKO_AUTH_MODE: "workos_production",
      FAMEKO_LEGACY_ACCOUNT_LINK: "enabled",
    }),
    { ok: false, status: 503 },
  );
});
