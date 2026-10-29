import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { unstable_splitSqlQuery } from "wrangler";

import { provisionWorkosAccountAfterVerifiedCallback } from "../identity/first-login-provisioning.ts";
import { authorizeRequest } from "./authorize-request.ts";

const migrationUrl = new URL("../../migrations/0001_identity_foundation.sql", import.meta.url);
const environment = {
  FAMEKO_AUTH_MODE: "workos_staging",
  NEXT_PUBLIC_WORKOS_REDIRECT_URI: "https://auth-staging.example.test/auth/callback",
  WORKOS_API_KEY: "test-api-key",
  WORKOS_CLIENT_ID: "client_test",
  WORKOS_COOKIE_PASSWORD: "x".repeat(32),
  WORKOS_ISSUER: "https://api.workos.com/",
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
  const migration = await readFile(migrationUrl, "utf8");
  await database.batch(
    unstable_splitSqlQuery(migration)
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => database.prepare(statement)),
  );
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
    const provisioned = await provisionWorkosAccountAfterVerifiedCallback(database, {
      provider: "workos",
      providerSubject: user.id,
      verifiedEmail: user.email,
    });
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
          email: "unknown@example.test",
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
