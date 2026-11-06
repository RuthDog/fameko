import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { unstable_splitSqlQuery } from "wrangler";

import { provisionWorkosAccountAfterVerifiedCallback } from "../identity/first-login-provisioning.ts";
import { authorizeRequest } from "./authorize-request.ts";

const migrationUrls = [
  new URL("../../migrations/0001_identity_foundation.sql", import.meta.url),
  new URL("../../migrations/0002_account_data_control.sql", import.meta.url),
];
const environment = {
  FAMEKO_AUTH_MODE: "workos_staging",
  NEXT_PUBLIC_WORKOS_REDIRECT_URI: "https://auth-staging.example.test/auth/callback",
  WORKOS_API_KEY: "test-api-key",
  WORKOS_CLIENT_ID: "client_test",
  WORKOS_COOKIE_PASSWORD: "x".repeat(32),
  WORKOS_ISSUER: "https://api.workos.com/",
  WORKOS_STAGING_ALLOWED_EMAILS: "adult@example.test,second-adult@example.test",
};
const productionEnvironment = {
  FAMEKO_AUTH_MODE: "workos_production",
  NEXT_PUBLIC_WORKOS_REDIRECT_URI: "https://fameko.example.test/auth/callback",
  WORKOS_API_KEY: "test-api-key",
  WORKOS_CLIENT_ID: "client_prod_test",
  WORKOS_COOKIE_PASSWORD: "x".repeat(32),
  WORKOS_ISSUER: "https://api.workos.com/user_management/client_prod_test",
};

async function createDatabase() {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      d1Databases: { FAMEKO_DB: "workos-authorization-test" },
      modules: true,
      script: "export default { fetch() { return new Response('ok'); } }",
    }),
  );
  const database = await miniflare.getD1Database("FAMEKO_DB");
  for (const migrationUrl of migrationUrls) {
    const migration = await readFile(migrationUrl, "utf8");
    await database.batch(
      unstable_splitSqlQuery(migration)
        .map((statement) => statement.trim())
        .filter(Boolean)
        .map((statement) => database.prepare(statement)),
    );
  }
  return { database, miniflare };
}

async function counts(database: D1Database) {
  return database
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM households) AS households,
         (SELECT COUNT(*) FROM auth_identities) AS identities,
         (SELECT COUNT(*) FROM planning_years) AS planning_years`,
    )
    .first<{
      households: number;
      identities: number;
      planning_years: number;
      users: number;
    }>();
}

test("WorkOS requests resolve only identities provisioned by a verified callback", async () => {
  const { database, miniflare } = await createDatabase();
  const user = {
    email: "adult@example.test",
    emailVerified: true,
    id: "workos-user-known",
  };

  try {
    const provisioned = await provisionWorkosAccountAfterVerifiedCallback(
      database,
      {
        provider: "workos",
        providerSubject: user.id,
        verifiedEmail: user.email,
      },
      {
        acceptedAt: "2026-11-01T10:00:00.000Z",
        privacyVersion: "privacy-1.0-draft",
        termsVersion: "terms-1.0-draft",
      },
    );
    const authorized = await authorizeRequest(
      new Request("https://auth-staging.example.test/app"),
      { database, environment, workosUserResolver: async () => user },
    );

    assert.equal(authorized.ok, true);
    if (authorized.ok) {
      assert.equal(authorized.mode, "workos");
      assert.equal(authorized.context.user.id, provisioned.user.id);
      assert.equal(authorized.context.household.id, provisioned.household.id);
    }
  } finally {
    await miniflare.dispose();
  }
});

test("ordinary WorkOS GET cannot provision an unknown subject", async () => {
  const { database, miniflare } = await createDatabase();

  try {
    const unauthorized = await authorizeRequest(
      new Request("https://auth-staging.example.test/app"),
      {
        database,
        environment,
        workosUserResolver: async () => ({
          email: "second-adult@example.test",
          emailVerified: true,
          id: "unknown-workos-user",
        }),
      },
    );

    assert.deepEqual(unauthorized, { code: "identity_missing", ok: false });
    assert.deepEqual(await counts(database), {
      households: 0,
      identities: 0,
      planning_years: 0,
      users: 0,
    });
  } finally {
    await miniflare.dispose();
  }
});

test("a verified email outside the staging allowlist is rejected before D1 access", async () => {
  let databaseTouched = false;
  const database = new Proxy({} as D1Database, {
    get() {
      databaseTouched = true;
      throw new Error("D1 must not be touched for a denied identity.");
    },
  });

  const unauthorized = await authorizeRequest(
    new Request("https://auth-staging.example.test/app"),
    {
      database,
      environment,
      workosUserResolver: async () => ({
        email: "not-allowed@example.test",
        emailVerified: true,
        id: "disallowed-workos-user",
      }),
    },
  );

  assert.deepEqual(unauthorized, { code: "identity_missing", ok: false });
  assert.equal(databaseTouched, false);
});

test("missing, unverified and misconfigured WorkOS sessions fail closed", async () => {
  const { database, miniflare } = await createDatabase();

  try {
    assert.deepEqual(
      await authorizeRequest(new Request("https://auth-staging.example.test/app"), {
        database,
        environment,
        workosUserResolver: async () => null,
      }),
      { code: "token_missing", ok: false },
    );
    assert.deepEqual(
      await authorizeRequest(new Request("https://auth-staging.example.test/app"), {
        database,
        environment,
        workosUserResolver: async () => ({
          email: "adult@example.test",
          emailVerified: false,
          id: "unverified-workos-user",
        }),
      }),
      { code: "token_invalid", ok: false },
    );
    assert.deepEqual(
      await authorizeRequest(new Request("https://auth-staging.example.test/app"), {
        database,
        environment: { FAMEKO_AUTH_MODE: "workos_staging" },
        workosUserResolver: async () => null,
      }),
      { code: "configuration_missing", ok: false },
    );
  } finally {
    await miniflare.dispose();
  }
});

test("WorkOS production authorizes only an already-linked subject and never provisions", async () => {
  const { database, miniflare } = await createDatabase();
  try {
    const known = {
      email: "production@example.test",
      emailVerified: true,
      id: "workos-production-known",
    };
    await provisionWorkosAccountAfterVerifiedCallback(
      database,
      {
        provider: "workos",
        providerSubject: known.id,
        verifiedEmail: known.email,
      },
      {
        acceptedAt: "2026-11-06T10:00:00.000Z",
        privacyVersion: "privacy-1.0-draft",
        termsVersion: "terms-1.0-draft",
      },
    );
    const authorized = await authorizeRequest(
      new Request("https://fameko.example.test/app"),
      { database, environment: productionEnvironment, workosUserResolver: async () => known },
    );
    assert.equal(authorized.ok, true);
    assert.deepEqual(
      await authorizeRequest(new Request("https://fameko.example.test/app"), {
        database,
        environment: productionEnvironment,
        workosUserResolver: async () => ({
          email: "unknown@example.test",
          emailVerified: true,
          id: "workos-production-unknown",
        }),
      }),
      { code: "identity_missing", ok: false },
    );
    assert.deepEqual(await counts(database), {
      households: 1,
      identities: 1,
      planning_years: 1,
      users: 1,
    });
  } finally {
    await miniflare.dispose();
  }
});

test("production and transition modes fail closed on incomplete configuration", async () => {
  for (const mode of ["workos_production", "workos_production_transition"]) {
    assert.deepEqual(
      await authorizeRequest(new Request("https://fameko.example.test/app"), {
        environment: { FAMEKO_AUTH_MODE: mode },
        workosUserResolver: async () => null,
      }),
      { code: "configuration_missing", ok: false },
    );
  }
});
