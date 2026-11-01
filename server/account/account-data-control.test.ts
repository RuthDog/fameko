import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { unstable_splitSqlQuery } from "wrangler";

import { provisionWorkosAccountAfterVerifiedCallback } from "../identity/first-login-provisioning.ts";
import type { AuthorizedPilotContext } from "../identity/identity-types.ts";
import {
  AccountDataControlError,
  createAccountExport,
  requestAccountDeletion,
  type WorkosDeletionGateway,
} from "./account-data-control.ts";

const migrationUrls = [
  new URL("../../migrations/0001_identity_foundation.sql", import.meta.url),
  new URL("../../migrations/0002_account_data_control.sql", import.meta.url),
];

const acceptance = {
  acceptedAt: "2026-11-01T10:00:00.000Z",
  privacyVersion: "privacy-1.0-draft" as const,
  termsVersion: "terms-1.0-draft" as const,
};

async function createDatabase(name: string) {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      d1Databases: { FAMEKO_DB: name },
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

async function provision(
  database: D1Database,
  suffix: string,
): Promise<AuthorizedPilotContext> {
  return await provisionWorkosAccountAfterVerifiedCallback(
    database,
    {
      provider: "workos",
      providerSubject: `workos-${suffix}`,
      verifiedEmail: `${suffix}@example.test`,
    },
    acceptance,
  );
}

function gateway(options: { failDeleteOnce?: boolean; delay?: number } = {}) {
  let failDeleteOnce = options.failDeleteOnce ?? false;
  const calls = { delete: 0, list: 0, revoke: 0 };
  const implementation: WorkosDeletionGateway = {
    async deleteUser() {
      calls.delete += 1;
      if (options.delay) await new Promise((resolve) => setTimeout(resolve, options.delay));
      if (failDeleteOnce) {
        failDeleteOnce = false;
        throw new Error("synthetic WorkOS failure");
      }
      return "deleted";
    },
    async listActiveSessionIds() {
      calls.list += 1;
      return ["synthetic-session"];
    },
    async revokeSession() {
      calls.revoke += 1;
    },
  };
  return { calls, implementation };
}

test("export contains only the server-derived user's household and legal history", async () => {
  const { database, miniflare } = await createDatabase("account-export-isolation");
  try {
    const first = await provision(database, "first");
    const second = await provision(database, "second");
    const exported = await createAccountExport(database, first, new Date("2026-11-01T12:00:00Z"));

    assert.equal(exported.account.userId, first.user.id);
    assert.equal(exported.household.householdId, first.household.id);
    assert.equal(exported.planningYears.length, 1);
    assert.equal(exported.legalAcceptances.length, 1);
    const serialized = JSON.stringify(exported);
    assert.doesNotMatch(serialized, new RegExp(second.user.id, "u"));
    assert.doesNotMatch(serialized, new RegExp(second.household.id, "u"));
    assert.doesNotMatch(serialized, /cookie|token|session/i);
  } finally {
    await miniflare.dispose();
  }
});

test("export and deletion fail closed for a shared household", async () => {
  const { database, miniflare } = await createDatabase("account-shared-denied");
  try {
    const first = await provision(database, "owner");
    const second = await provision(database, "member");
    await database
      .prepare(
        `INSERT INTO household_members (household_id, user_id, role, created_at)
         VALUES (?, ?, 'member', ?)`,
      )
      .bind(first.household.id, second.user.id, "2026-11-01T10:00:00.000Z")
      .run();

    await assert.rejects(
      createAccountExport(database, first),
      (error: unknown) => error instanceof AccountDataControlError && error.code === "shared_household",
    );
    await assert.rejects(
      requestAccountDeletion(database, first, gateway().implementation),
      (error: unknown) => error instanceof AccountDataControlError && error.code === "shared_household",
    );
  } finally {
    await miniflare.dispose();
  }
});

test("successful deletion removes only the selected synthetic account graph", async () => {
  const { database, miniflare } = await createDatabase("account-delete-success");
  try {
    const deleted = await provision(database, "delete-me");
    const preserved = await provision(database, "preserve-me");
    const fake = gateway();
    const result = await requestAccountDeletion(database, deleted, fake.implementation);

    assert.equal(result.status, "complete");
    assert.deepEqual(fake.calls, { delete: 1, list: 1, revoke: 1 });
    assert.equal(
      await database.prepare("SELECT id FROM users WHERE id = ?").bind(deleted.user.id).first(),
      null,
    );
    assert.ok(
      await database.prepare("SELECT id FROM users WHERE id = ?").bind(preserved.user.id).first(),
    );
    assert.equal(
      await database.prepare("SELECT COUNT(*) AS count FROM account_deletion_jobs").first<{ count: number }>()
        .then((row) => row?.count),
      0,
    );
  } finally {
    await miniflare.dispose();
  }
});

test("partial WorkOS failure retains D1 data and an idempotent retry completes", async () => {
  const { database, miniflare } = await createDatabase("account-delete-retry");
  try {
    const context = await provision(database, "retry");
    const fake = gateway({ failDeleteOnce: true });
    const first = await requestAccountDeletion(database, context, fake.implementation);
    assert.equal(first.status, "partial");
    const retained = await database
      .prepare("SELECT status FROM users WHERE id = ?")
      .bind(context.user.id)
      .first<{ status: string }>();
    assert.equal(retained?.status, "disabled");
    assert.ok(
      await database.prepare("SELECT id FROM households WHERE id = ?").bind(context.household.id).first(),
    );

    const retry = await requestAccountDeletion(
      database,
      context,
      fake.implementation,
      new Date(Date.now() + 1_000),
    );
    assert.equal(retry.status, "complete");
    assert.equal(fake.calls.delete, 2);
    assert.equal(
      await database.prepare("SELECT id FROM users WHERE id = ?").bind(context.user.id).first(),
      null,
    );
  } finally {
    await miniflare.dispose();
  }
});

test("D1 finalization failure never repeats WorkOS deletion and is safely retryable", async () => {
  const { database, miniflare } = await createDatabase("account-delete-d1-retry");
  try {
    const context = await provision(database, "d1-retry");
    const fake = gateway();
    await database
      .prepare(
        `CREATE TRIGGER reject_account_household_delete
         BEFORE DELETE ON households
         BEGIN
           SELECT RAISE(ABORT, 'synthetic finalization failure');
         END`,
      )
      .run();
    const first = await requestAccountDeletion(database, context, fake.implementation);
    assert.equal(first.status, "partial");
    assert.equal(fake.calls.delete, 1);
    assert.ok(
      await database.prepare("SELECT id FROM users WHERE id = ?").bind(context.user.id).first(),
    );

    await database.prepare("DROP TRIGGER reject_account_household_delete").run();
    const retry = await requestAccountDeletion(
      database,
      context,
      fake.implementation,
      new Date(Date.now() + 1_000),
    );
    assert.equal(retry.status, "complete");
    assert.equal(fake.calls.delete, 1);
  } finally {
    await miniflare.dispose();
  }
});

test("concurrent deletion requests use one WorkOS lease", async () => {
  const { database, miniflare } = await createDatabase("account-delete-concurrent");
  try {
    const context = await provision(database, "concurrent");
    const fake = gateway({ delay: 25 });
    const results = await Promise.all([
      requestAccountDeletion(database, context, fake.implementation),
      requestAccountDeletion(database, context, fake.implementation),
    ]);
    assert.equal(fake.calls.delete, 1);
    assert.ok(results.some((result) => result.status === "complete"));
    assert.ok(results.every((result) => result.status === "complete" || result.status === "in_progress"));
  } finally {
    await miniflare.dispose();
  }
});
