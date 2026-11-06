import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { unstable_splitSqlQuery } from "wrangler";

import { issueAccountLinkState } from "../auth/account-link-state.ts";
import { emptyPlanningDataV3 } from "../../shared/planning/seed-planning-data.ts";
import { provisionPilotIdentity } from "./provision-pilot.ts";
import { IdentityRepository } from "./identity-repository.ts";
import { resolveAuthorizedIdentity } from "./resolve-identity.ts";
import {
  AccountLinkingError,
  bindAccountLinkTarget,
  consumeAccountLinkGrant,
  createAccountLinkGrant,
  getAccountLinkGrant,
} from "./account-linking.ts";

const migrationUrls = [1, 2, 3].map((number) =>
  new URL(
    `../../migrations/${String(number).padStart(4, "0")}_${[
      "identity_foundation",
      "account_data_control",
      "account_link_grants",
    ][number - 1]}.sql`,
    import.meta.url,
  )
);
const environment = { WORKOS_COOKIE_PASSWORD: "link-integration-secret".repeat(2) };
const baseTime = Date.parse("2026-11-06T12:00:00.000Z");

async function createDatabase(name = crypto.randomUUID()) {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      d1Databases: { FAMEKO_DB: name },
      modules: true,
      script: "export default { fetch() { return new Response('ok'); } }",
    }),
  );
  const database = await miniflare.getD1Database("FAMEKO_DB");
  for (const url of migrationUrls) {
    const sql = await readFile(url, "utf8");
    await database.batch(
      unstable_splitSqlQuery(sql)
        .map((statement) => statement.trim())
        .filter(Boolean)
        .map((statement) => database.prepare(statement)),
    );
  }
  return { database, miniflare };
}

async function seedSixPilots(database: D1Database) {
  const pilots = [];
  for (let index = 0; index < 6; index += 1) {
    const provisioned = await provisionPilotIdentity(database, {
      email: `pilot-${index + 1}@example.test`,
      providerSubject: `access-subject-${index + 1}`,
    });
    const years = index === 0 ? [2026, 2027] : [2026];
    for (const [yearIndex, year] of years.entries()) {
      const timestamp = new Date(baseTime + index * 1_000 + yearIndex).toISOString();
      await database
        .prepare(
          `INSERT INTO planning_years
             (id, household_id, year, planning_data, data_version, revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, 3, ?, ?, ?)`,
        )
        .bind(
          `planning-${index + 1}-${year}`,
          provisioned.householdId,
          year,
          JSON.stringify({ ...emptyPlanningDataV3, syntheticMarker: `pilot-${index + 1}-${year}` }),
          index * 10 + yearIndex + 1,
          timestamp,
          timestamp,
        )
        .run();
    }
    pilots.push({
      ...provisioned,
      accessEmail: `pilot-${index + 1}@example.test`,
      accessSubject: `access-subject-${index + 1}`,
    });
  }
  return pilots;
}

async function sourceContext(database: D1Database, pilot: Awaited<ReturnType<typeof seedSixPilots>>[number]) {
  const authContext = {
    provider: "cloudflare_access",
    providerSubject: pilot.accessSubject,
    verifiedEmail: pilot.accessEmail,
  };
  return {
    authContext,
    context: await resolveAuthorizedIdentity(new IdentityRepository(database), authContext),
  };
}

async function createBoundGrant(
  database: D1Database,
  pilot: Awaited<ReturnType<typeof seedSixPilots>>[number],
  workosSubject: string,
  workosEmail = `workos-${workosSubject}@example.test`,
  offset = 0,
) {
  const now = new Date(baseTime + offset);
  const source = await sourceContext(database, pilot);
  const state = await issueAccountLinkState(environment, { now: now.getTime() });
  await createAccountLinkGrant(database, source.context, state, now);
  const target = {
    provider: "workos",
    providerSubject: workosSubject,
    verifiedEmail: workosEmail,
  };
  await bindAccountLinkTarget(database, state, target, new Date(now.getTime() + 1_000));
  return { now, source, state, target };
}

async function snapshot(database: D1Database) {
  const [users, households, memberships, years] = await Promise.all([
    database.prepare("SELECT id, status, created_at, updated_at FROM users ORDER BY id").all(),
    database.prepare("SELECT id, name, created_at, updated_at FROM households ORDER BY id").all(),
    database.prepare("SELECT household_id, user_id, role, created_at FROM household_members ORDER BY user_id").all(),
    database.prepare("SELECT id, household_id, year, planning_data, data_version, revision, created_at, updated_at FROM planning_years ORDER BY id").all(),
  ]);
  return {
    households: households.results,
    memberships: memberships.results,
    users: users.results,
    years: years.results,
  };
}

test("six synthetic pilots retain six users, six households and seven planning years", async () => {
  const { database, miniflare } = await createDatabase();
  try {
    const pilots = await seedSixPilots(database);
    const before = await snapshot(database);
    for (const [index, pilot] of pilots.entries()) {
      const link = await createBoundGrant(
        database,
        pilot,
        `workos-subject-${index + 1}`,
        `new-${index + 1}@example.test`,
        index * 10_000,
      );
      const plan = await consumeAccountLinkGrant(
        database,
        link.state,
        link.source.authContext,
        link.target,
        new Date(link.now.getTime() + 2_000),
      );
      assert.equal(plan.userId, pilot.userId);
    }
    assert.deepEqual(await snapshot(database), before);
    const counts = await database.prepare(
      `SELECT
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM households) AS households,
         (SELECT COUNT(*) FROM household_members) AS memberships,
         (SELECT COUNT(*) FROM planning_years) AS planning_years,
         (SELECT COUNT(*) FROM auth_identities WHERE provider = 'cloudflare_access') AS access_identities,
         (SELECT COUNT(*) FROM auth_identities WHERE provider = 'workos') AS workos_identities,
         (SELECT COUNT(*) FROM account_link_grants WHERE consumed_at IS NOT NULL) AS consumed_grants`,
    ).first();
    assert.deepEqual(counts, {
      access_identities: 6,
      consumed_grants: 6,
      households: 6,
      memberships: 6,
      planning_years: 7,
      users: 6,
      workos_identities: 6,
    });
  } finally {
    await miniflare.dispose();
  }
});

test("wrong subjects, replay, double callbacks and expiry fail closed", async () => {
  const { database, miniflare } = await createDatabase();
  try {
    const pilots = await seedSixPilots(database);
    const pilot = pilots[0];
    const link = await createBoundGrant(database, pilot, "workos-correct");
    await assert.rejects(
      bindAccountLinkTarget(database, link.state, link.target, new Date(baseTime + 2_000)),
      AccountLinkingError,
    );
    await assert.rejects(
      consumeAccountLinkGrant(
        database,
        link.state,
        { ...link.source.authContext, providerSubject: "wrong-access" },
        link.target,
        new Date(baseTime + 2_000),
      ),
      AccountLinkingError,
    );
    await assert.rejects(
      consumeAccountLinkGrant(
        database,
        link.state,
        link.source.authContext,
        { ...link.target, providerSubject: "wrong-workos" },
        new Date(baseTime + 2_000),
      ),
      AccountLinkingError,
    );
    await consumeAccountLinkGrant(
      database,
      link.state,
      link.source.authContext,
      link.target,
      new Date(baseTime + 2_000),
    );
    await assert.rejects(
      consumeAccountLinkGrant(
        database,
        link.state,
        link.source.authContext,
        link.target,
        new Date(baseTime + 3_000),
      ),
      AccountLinkingError,
    );

    const secondPilot = pilots[1];
    const expired = await createBoundGrant(
      database,
      secondPilot,
      "workos-expired",
      "expired@example.test",
      700_000,
    );
    await assert.rejects(
      consumeAccountLinkGrant(
        database,
        expired.state,
        expired.source.authContext,
        expired.target,
        new Date(expired.now.getTime() + 601_000),
      ),
      AccountLinkingError,
    );
  } finally {
    await miniflare.dispose();
  }
});

test("email collisions never select a household and concurrent consumption has one winner", async () => {
  const { database, miniflare } = await createDatabase();
  try {
    const pilots = await seedSixPilots(database);
    const link = await createBoundGrant(
      database,
      pilots[0],
      "workos-email-collision",
      pilots[1].accessEmail,
    );
    const results = await Promise.allSettled([
      consumeAccountLinkGrant(
        database,
        link.state,
        link.source.authContext,
        link.target,
        new Date(baseTime + 2_000),
      ),
      consumeAccountLinkGrant(
        database,
        link.state,
        link.source.authContext,
        link.target,
        new Date(baseTime + 2_000),
      ),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    const identity = await database
      .prepare("SELECT user_id FROM auth_identities WHERE provider = 'workos' AND provider_subject = ?")
      .bind(link.target.providerSubject)
      .first<{ user_id: string }>();
    assert.equal(identity?.user_id, pilots[0].userId);
    assert.notEqual(identity?.user_id, pilots[1].userId);
  } finally {
    await miniflare.dispose();
  }
});

test("restarting an incomplete transition revokes the old grant without linking", async () => {
  const { database, miniflare } = await createDatabase();
  try {
    const [pilot] = await seedSixPilots(database);
    const source = await sourceContext(database, pilot);
    const first = await issueAccountLinkState(environment, { now: baseTime });
    await createAccountLinkGrant(database, source.context, first, new Date(baseTime));
    const second = await issueAccountLinkState(environment, { now: baseTime + 10_000 });
    await createAccountLinkGrant(database, source.context, second, new Date(baseTime + 10_000));
    const firstGrant = await getAccountLinkGrant(database, first.grantId);
    assert.ok(firstGrant?.revokedAt);
    await assert.rejects(
      bindAccountLinkTarget(
        database,
        first,
        { provider: "workos", providerSubject: "old-target", verifiedEmail: "old@example.test" },
        new Date(baseTime + 11_000),
      ),
      AccountLinkingError,
    );
    const target = { provider: "workos", providerSubject: "new-target", verifiedEmail: "new@example.test" };
    await bindAccountLinkTarget(database, second, target, new Date(baseTime + 11_000));
    assert.equal(
      await database.prepare("SELECT COUNT(*) AS count FROM auth_identities WHERE provider = 'workos'").first<{ count: number }>().then((row) => row?.count),
      0,
    );
    await consumeAccountLinkGrant(
      database,
      second,
      source.authContext,
      target,
      new Date(baseTime + 12_000),
    );
  } finally {
    await miniflare.dispose();
  }
});
