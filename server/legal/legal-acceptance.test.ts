import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { unstable_splitSqlQuery } from "wrangler";

import type { AuthorizedPilotContext } from "../identity/identity-types.ts";
import { acceptCurrentLegalTerms } from "./legal-acceptance-http.ts";
import {
  hasAcceptedCurrentTerms,
  mayUseAppWithoutCurrentTerms,
  recordCurrentTermsAcceptance,
  safePostAcceptancePath,
} from "./legal-acceptance.ts";
import {
  currentPrivacyDocumentVersion,
  currentTermsDocumentVersion,
} from "./legal-versions.ts";

const migrationUrls = [
  new URL("../../migrations/0001_identity_foundation.sql", import.meta.url),
  new URL("../../migrations/0002_account_data_control.sql", import.meta.url),
];
const environment = {
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
      d1Databases: { FAMEKO_DB: "legal-acceptance-test" },
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

async function seedContext(
  database: D1Database,
  suffix: string,
): Promise<AuthorizedPilotContext> {
  const timestamp = "2026-11-15T12:00:00.000Z";
  const userId = `user-${suffix}`;
  const householdId = `household-${suffix}`;
  const identityId = `identity-${suffix}`;
  await database.batch([
    database.prepare(
      "INSERT INTO users (id, display_name, status, created_at, updated_at) VALUES (?, NULL, 'active', ?, ?)",
    ).bind(userId, timestamp, timestamp),
    database.prepare(
      "INSERT INTO households (id, name, created_at, updated_at) VALUES (?, 'Mitt hushåll', ?, ?)",
    ).bind(householdId, timestamp, timestamp),
    database.prepare(
      "INSERT INTO household_members (household_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)",
    ).bind(householdId, userId, timestamp),
    database.prepare(
      `INSERT INTO auth_identities
         (id, user_id, provider, provider_subject, email, created_at, updated_at)
       VALUES (?, ?, 'workos', ?, ?, ?, ?)`,
    ).bind(
      identityId,
      userId,
      `workos-${suffix}`,
      `${suffix}@example.test`,
      timestamp,
      timestamp,
    ),
  ]);
  return {
    household: {
      created_at: timestamp,
      id: householdId,
      name: "Mitt hushåll",
      updated_at: timestamp,
    },
    identity: {
      created_at: timestamp,
      email: `${suffix}@example.test`,
      id: identityId,
      provider: "workos",
      provider_subject: `workos-${suffix}`,
      updated_at: timestamp,
      user_id: userId,
    },
    membership: {
      created_at: timestamp,
      household_id: householdId,
      role: "owner",
      user_id: userId,
    },
    user: {
      created_at: timestamp,
      display_name: null,
      id: userId,
      status: "active",
      updated_at: timestamp,
    },
  };
}

function acceptanceRequest(body: URLSearchParams): Request {
  return new Request("https://fameko.example.test/app/api/legal/accept", {
    body,
    headers: {
      Origin: "https://fameko.example.test",
      "Sec-Fetch-Site": "same-origin",
    },
    method: "POST",
  });
}

test("current legal acceptance is exact and idempotent", async () => {
  const { database, miniflare } = await createDatabase();
  try {
    const context = await seedContext(database, "one");
    assert.equal(await hasAcceptedCurrentTerms(database, context.user.id), false);
    await recordCurrentTermsAcceptance(
      database,
      context,
      new Date("2026-11-15T13:00:00.000Z"),
    );
    await recordCurrentTermsAcceptance(
      database,
      context,
      new Date("2026-11-15T14:00:00.000Z"),
    );
    assert.equal(await hasAcceptedCurrentTerms(database, context.user.id), true);
    assert.deepEqual(
      await database.prepare(
        `SELECT user_id, terms_version, privacy_version, accepted_at
         FROM legal_acceptances`,
      ).first(),
      {
        accepted_at: "2026-11-15T13:00:00.000Z",
        privacy_version: currentPrivacyDocumentVersion,
        terms_version: currentTermsDocumentVersion,
        user_id: context.user.id,
      },
    );
  } finally {
    await miniflare.dispose();
  }
});

test("acceptance HTTP binds the current versions to the server-authorized user only", async () => {
  const { database, miniflare } = await createDatabase();
  try {
    const context = await seedContext(database, "authorized");
    const other = await seedContext(database, "other");
    const authorize = async () => ({ context, mode: "workos" as const, ok: true as const });

    const denied = await acceptCurrentLegalTerms(
      acceptanceRequest(new URLSearchParams({
        "privacy-version": currentPrivacyDocumentVersion,
        "return-to": "/app/boende",
      })),
      environment,
      { authorize, database },
    );
    assert.equal(denied.status, 303);
    assert.match(denied.headers.get("location") ?? "", /error=terms-required/);
    assert.equal(await hasAcceptedCurrentTerms(database, context.user.id), false);

    const body = new URLSearchParams({
      "privacy-version": currentPrivacyDocumentVersion,
      "return-to": "/app/boende",
      "terms-confirmation": currentTermsDocumentVersion,
      "user-id": other.user.id,
    });
    const accepted = await acceptCurrentLegalTerms(
      acceptanceRequest(body),
      environment,
      {
        authorize,
        database,
        now: new Date("2026-11-15T15:00:00.000Z"),
      },
    );
    assert.equal(accepted.status, 303);
    assert.equal(accepted.headers.get("location"), "https://fameko.example.test/app/boende");
    assert.equal(await hasAcceptedCurrentTerms(database, context.user.id), true);
    assert.equal(await hasAcceptedCurrentTerms(database, other.user.id), false);

    const repeated = await acceptCurrentLegalTerms(
      acceptanceRequest(body),
      environment,
      {
        authorize,
        database,
        now: new Date("2026-11-15T16:00:00.000Z"),
      },
    );
    assert.equal(repeated.status, 303);
    const count = await database.prepare(
      "SELECT COUNT(*) AS count FROM legal_acceptances WHERE user_id = ?",
    ).bind(context.user.id).first<{ count: number }>();
    assert.equal(count?.count, 1);
  } finally {
    await miniflare.dispose();
  }
});

test("only legal, account control and legacy paths bypass the current-terms gate", () => {
  for (const path of [
    "/account-link/confirm",
    "/app/legal/accept",
    "/app/api/legal/accept",
    "/app/account/export",
    "/app/api/account/export",
    "/app/account/delete",
    "/app/api/account/delete",
    "/app/api/session",
  ]) {
    assert.equal(mayUseAppWithoutCurrentTerms(path), true, path);
  }
  for (const path of [
    "/app",
    "/app/boende",
    "/app/api/planning-years",
    "/app/api/planning-years/2026",
  ]) {
    assert.equal(mayUseAppWithoutCurrentTerms(path), false, path);
  }
  assert.equal(safePostAcceptancePath("https://evil.example/app"), "/app");
  assert.equal(safePostAcceptancePath("//evil.example/app"), "/app");
  assert.equal(safePostAcceptancePath("/application"), "/app");
  assert.equal(safePostAcceptancePath("/app/api/account/export"), "/app");
  assert.equal(safePostAcceptancePath("/app/boende?year=2026"), "/app/boende?year=2026");
});
