import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Miniflare } from "miniflare";
import { unstable_splitSqlQuery } from "wrangler";

import type { AccessClaims } from "../auth/access-token.ts";
import { IdentityRepository } from "./identity-repository.ts";
import type { VerifiedAuthContext } from "./identity-types.ts";
import { provisionPilotIdentity } from "./provision-pilot.ts";
import {
  IdentityAuthorizationError,
  resolveAuthorizedIdentity,
} from "./resolve-identity.ts";

const migrationUrl = new URL("../../migrations/0001_identity_foundation.sql", import.meta.url);
const baseClaims: AccessClaims & VerifiedAuthContext = {
  aud: "audience",
  email: "pilot-a@example.test",
  exp: 2_000_000_000,
  iat: 1_900_000_000,
  iss: "https://fameko.cloudflareaccess.com",
  nbf: 1_900_000_000,
  provider: "cloudflare_access",
  providerSubject: "subject-a",
  sub: "subject-a",
  type: "app",
  verifiedEmail: "pilot-a@example.test",
};

async function createDatabase() {
  const miniflare = new Miniflare({
    d1Databases: { FAMEKO_DB: "fameko-identity-test" },
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
  });
  const database = await miniflare.getD1Database("FAMEKO_DB");
  const migration = await readFile(migrationUrl, "utf8");
  const statements = unstable_splitSqlQuery(migration)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map((statement) => database.prepare(statement));
  await database.batch(statements);
  return { database, miniflare };
}

test("known auth identity resolves the correct User and Household", async () => {
  const { database, miniflare } = await createDatabase();

  try {
    const provisioned = await provisionPilotIdentity(database, {
      email: baseClaims.email,
      providerSubject: baseClaims.sub,
    });
    const context = await resolveAuthorizedIdentity(
      new IdentityRepository(database),
      baseClaims,
    );

    assert.equal(context.user.id, provisioned.userId);
    assert.equal(context.household.id, provisioned.householdId);
    assert.equal(context.membership.user_id, provisioned.userId);
    assert.equal(context.membership.household_id, provisioned.householdId);
  } finally {
    await miniflare.dispose();
  }
});

test("unknown auth identity is denied", async () => {
  const { database, miniflare } = await createDatabase();

  try {
    await assert.rejects(
      resolveAuthorizedIdentity(new IdentityRepository(database), baseClaims),
      (error) =>
        error instanceof IdentityAuthorizationError && error.code === "identity_missing",
    );
  } finally {
    await miniflare.dispose();
  }
});

test("disabled User is denied", async () => {
  const { database, miniflare } = await createDatabase();

  try {
    const provisioned = await provisionPilotIdentity(database, {
      email: baseClaims.email,
      providerSubject: baseClaims.sub,
    });
    await database
      .prepare("UPDATE users SET status = 'disabled' WHERE id = ?")
      .bind(provisioned.userId)
      .run();

    await assert.rejects(
      resolveAuthorizedIdentity(new IdentityRepository(database), baseClaims),
      (error) =>
        error instanceof IdentityAuthorizationError && error.code === "user_disabled",
    );
  } finally {
    await miniflare.dispose();
  }
});

test("invited User is denied until activation", async () => {
  const { database, miniflare } = await createDatabase();

  try {
    const provisioned = await provisionPilotIdentity(database, {
      email: baseClaims.email,
      providerSubject: baseClaims.sub,
    });
    await database
      .prepare("UPDATE users SET status = 'invited' WHERE id = ?")
      .bind(provisioned.userId)
      .run();

    await assert.rejects(
      resolveAuthorizedIdentity(new IdentityRepository(database), baseClaims),
      (error) =>
        error instanceof IdentityAuthorizationError && error.code === "user_inactive",
    );
  } finally {
    await miniflare.dispose();
  }
});

test("User without a membership is denied", async () => {
  const { database, miniflare } = await createDatabase();

  try {
    const provisioned = await provisionPilotIdentity(database, {
      email: baseClaims.email,
      providerSubject: baseClaims.sub,
    });
    await database
      .prepare("DELETE FROM household_members WHERE user_id = ?")
      .bind(provisioned.userId)
      .run();

    await assert.rejects(
      resolveAuthorizedIdentity(new IdentityRepository(database), baseClaims),
      (error) =>
        error instanceof IdentityAuthorizationError && error.code === "household_missing",
    );
  } finally {
    await miniflare.dispose();
  }
});

test("User A cannot resolve to Household B without membership", async () => {
  const { database, miniflare } = await createDatabase();

  try {
    const userA = await provisionPilotIdentity(database, {
      email: baseClaims.email,
      providerSubject: baseClaims.sub,
    });
    const userB = await provisionPilotIdentity(database, {
      email: "pilot-b@example.test",
      providerSubject: "subject-b",
    });

    await database
      .prepare("DELETE FROM household_members WHERE user_id = ?")
      .bind(userA.userId)
      .run();

    await assert.rejects(
      resolveAuthorizedIdentity(new IdentityRepository(database), baseClaims),
      (error) =>
        error instanceof IdentityAuthorizationError && error.code === "household_missing",
    );

    const householdB = await new IdentityRepository(database).getHousehold(userB.householdId);
    assert.equal(householdB?.id, userB.householdId);
  } finally {
    await miniflare.dispose();
  }
});

test("multiple memberships are denied deterministically in Pilot 1.0", async () => {
  const { database, miniflare } = await createDatabase();

  try {
    const userA = await provisionPilotIdentity(database, {
      email: baseClaims.email,
      providerSubject: baseClaims.sub,
    });
    const userB = await provisionPilotIdentity(database, {
      email: "pilot-b@example.test",
      providerSubject: "subject-b",
    });
    await database
      .prepare(
        `INSERT INTO household_members (household_id, user_id, role, created_at)
         VALUES (?, ?, 'member', ?)`,
      )
      .bind(userB.householdId, userA.userId, new Date().toISOString())
      .run();

    await assert.rejects(
      resolveAuthorizedIdentity(new IdentityRepository(database), baseClaims),
      (error) =>
        error instanceof IdentityAuthorizationError && error.code === "household_missing",
    );
  } finally {
    await miniflare.dispose();
  }
});

test("schema enforces unique auth subjects and membership foreign keys", async () => {
  const { database, miniflare } = await createDatabase();

  try {
    await provisionPilotIdentity(database, {
      email: baseClaims.email,
      providerSubject: baseClaims.sub,
    });

    await assert.rejects(
      provisionPilotIdentity(database, {
        email: "other@example.test",
        providerSubject: baseClaims.sub,
      }),
    );

    await assert.rejects(
      database
        .prepare(
          `INSERT INTO household_members (household_id, user_id, role, created_at)
           VALUES (?, ?, 'owner', ?)`,
        )
        .bind("missing-household", "missing-user", new Date().toISOString())
        .run(),
    );
  } finally {
    await miniflare.dispose();
  }
});
