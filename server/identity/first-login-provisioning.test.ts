import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Miniflare } from "miniflare";
import { unstable_splitSqlQuery } from "wrangler";

import { currentPlanningYear, seedPlanningDataV3 } from "../../shared/planning/seed-planning-data.ts";
import { provisionPilotIdentity } from "./provision-pilot.ts";
import { resolveOrProvisionAuthorizedIdentity } from "./first-login-provisioning.ts";
import type { VerifiedAuthContext } from "./identity-types.ts";

const migrationUrl = new URL("../../migrations/0001_identity_foundation.sql", import.meta.url);
const authContext: VerifiedAuthContext = {
  provider: "test_provider",
  providerSubject: "verified-subject-a",
  verifiedEmail: "new-pilot@example.test",
};

async function createDatabase(name: string) {
  const miniflare = new Miniflare({
    d1Databases: { FAMEKO_DB: name },
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
  });
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

async function getCounts(database: D1Database) {
  const tableNames = [
    "users",
    "auth_identities",
    "households",
    "household_members",
    "planning_years",
  ] as const;
  return Object.fromEntries(
    await Promise.all(
      tableNames.map(async (tableName) => {
        const row = await database
          .prepare(`SELECT COUNT(*) AS count FROM ${tableName}`)
          .first<{ count: number }>();
        return [tableName, row?.count ?? 0];
      }),
    ),
  );
}

test("first verified login atomically creates User, Household, membership, identity and PlanningYear", async () => {
  const { database, miniflare } = await createDatabase("first-login-create");

  try {
    const context = await resolveOrProvisionAuthorizedIdentity(database, authContext);
    const planningYear = await database
      .prepare(
        `SELECT household_id, year, planning_data, data_version, revision
         FROM planning_years
         WHERE household_id = ? AND year = ?`,
      )
      .bind(context.household.id, currentPlanningYear)
      .first<{
        data_version: number;
        household_id: string;
        planning_data: string;
        revision: number;
        year: number;
      }>();

    assert.deepEqual(await getCounts(database), {
      auth_identities: 1,
      household_members: 1,
      households: 1,
      planning_years: 1,
      users: 1,
    });
    assert.equal(context.identity.provider, authContext.provider);
    assert.equal(context.identity.provider_subject, authContext.providerSubject);
    assert.notEqual(context.user.id, authContext.providerSubject);
    assert.notEqual(context.user.id, authContext.verifiedEmail);
    assert.equal(planningYear?.household_id, context.household.id);
    assert.equal(planningYear?.year, currentPlanningYear);
    assert.equal(planningYear?.data_version, 3);
    assert.equal(planningYear?.revision, 1);
    assert.deepEqual(JSON.parse(planningYear?.planning_data ?? "null"), seedPlanningDataV3);
  } finally {
    await miniflare.dispose();
  }
});

test("second login resolves the same internal graph without duplicate rows", async () => {
  const { database, miniflare } = await createDatabase("first-login-repeat");

  try {
    const first = await resolveOrProvisionAuthorizedIdentity(database, authContext);
    const second = await resolveOrProvisionAuthorizedIdentity(database, {
      ...authContext,
      verifiedEmail: "changed-address@example.test",
    });

    assert.equal(second.user.id, first.user.id);
    assert.equal(second.household.id, first.household.id);
    assert.deepEqual(await getCounts(database), {
      auth_identities: 1,
      household_members: 1,
      households: 1,
      planning_years: 1,
      users: 1,
    });
  } finally {
    await miniflare.dispose();
  }
});

test("simultaneous first logins converge on one User and one complete household graph", async () => {
  const { database, miniflare } = await createDatabase("first-login-concurrent");

  try {
    const [first, second] = await Promise.all([
      resolveOrProvisionAuthorizedIdentity(database, authContext),
      resolveOrProvisionAuthorizedIdentity(database, authContext),
    ]);

    assert.equal(second.user.id, first.user.id);
    assert.equal(second.household.id, first.household.id);
    assert.deepEqual(await getCounts(database), {
      auth_identities: 1,
      household_members: 1,
      households: 1,
      planning_years: 1,
      users: 1,
    });
  } finally {
    await miniflare.dispose();
  }
});

test("a failed PlanningYear insert rolls back the complete first-login transaction", async () => {
  const { database, miniflare } = await createDatabase("first-login-rollback");

  try {
    await database
      .prepare(
        `CREATE TRIGGER reject_planning_year
         BEFORE INSERT ON planning_years
         BEGIN
           SELECT RAISE(ABORT, 'planned test failure');
         END`,
      )
      .run();

    await assert.rejects(resolveOrProvisionAuthorizedIdentity(database, authContext));
    assert.deepEqual(await getCounts(database), {
      auth_identities: 0,
      household_members: 0,
      households: 0,
      planning_years: 0,
      users: 0,
    });
  } finally {
    await miniflare.dispose();
  }
});

test("an existing manually provisioned identity gets exactly one missing PlanningYear", async () => {
  const { database, miniflare } = await createDatabase("first-login-existing");

  try {
    const provisioned = await provisionPilotIdentity(database, {
      email: authContext.verifiedEmail,
      providerSubject: authContext.providerSubject,
    });
    const existingContext = {
      ...authContext,
      provider: "cloudflare_access",
    };

    const first = await resolveOrProvisionAuthorizedIdentity(database, existingContext);
    const second = await resolveOrProvisionAuthorizedIdentity(database, existingContext);

    assert.equal(first.user.id, provisioned.userId);
    assert.equal(second.user.id, provisioned.userId);
    assert.deepEqual(await getCounts(database), {
      auth_identities: 1,
      household_members: 1,
      households: 1,
      planning_years: 1,
      users: 1,
    });
  } finally {
    await miniflare.dispose();
  }
});
