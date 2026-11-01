import type { AuthorizedPilotContext } from "../identity/identity-types.ts";

export class AccountDataControlError extends Error {
  readonly code:
    | "deletion_in_progress"
    | "deletion_partial"
    | "identity_not_supported"
    | "shared_household";

  constructor(
    code:
      | "deletion_in_progress"
      | "deletion_partial"
      | "identity_not_supported"
      | "shared_household",
  ) {
    super("Account data operation could not be completed.");
    this.name = "AccountDataControlError";
    this.code = code;
  }
}

type LegalAcceptanceRow = {
  accepted_at: string;
  privacy_version: string;
  terms_version: string;
  user_id: string;
};

type PlanningYearRow = {
  data_version: number;
  planning_data: string;
  revision: number;
  updated_at: string;
  year: number;
};

type DeletionJobStatus =
  | "pending"
  | "processing_workos"
  | "workos_deleted"
  | "processing_d1";

type DeletionJob = {
  household_id: string | null;
  id: string;
  lease_expires_at: string | null;
  lease_token: string | null;
  provider: string;
  provider_subject: string;
  status: DeletionJobStatus;
  user_id: string;
};

export type AccountExport = {
  account: {
    createdAt: string;
    email: string | null;
    identityProvider: string;
    identitySubject: string;
    userId: string;
  };
  exportedAt: string;
  household: {
    createdAt: string;
    householdId: string;
    membershipRole: "owner" | "member";
    name: string | null;
  };
  legalAcceptances: Array<{
    acceptedAt: string;
    privacyVersion: string;
    termsVersion: string;
  }>;
  planningYears: Array<{
    dataVersion: number;
    planningData: unknown;
    revision: number;
    updatedAt: string;
    year: number;
  }>;
  schemaVersion: 1;
};

export type WorkosDeletionGateway = {
  deleteUser(userId: string): Promise<"deleted" | "missing">;
  listActiveSessionIds(userId: string): Promise<string[]>;
  revokeSession(sessionId: string): Promise<void>;
};

type DeletionResult =
  | { jobId: string; status: "complete" }
  | { jobId: string; status: "in_progress" | "partial" };

const leaseMilliseconds = 60_000;

async function assertExclusiveHousehold(
  database: D1Database,
  context: AuthorizedPilotContext,
): Promise<void> {
  const membership = await database
    .prepare(
      `SELECT
         COUNT(*) AS member_count,
         SUM(CASE WHEN user_id = ? AND role = 'owner' THEN 1 ELSE 0 END) AS owner_count
       FROM household_members
       WHERE household_id = ?`,
    )
    .bind(context.user.id, context.household.id)
    .first<{ member_count: number; owner_count: number }>();

  if (membership?.member_count !== 1 || membership.owner_count !== 1) {
    throw new AccountDataControlError("shared_household");
  }
}

export async function createAccountExport(
  database: D1Database,
  context: AuthorizedPilotContext,
  now = new Date(),
): Promise<AccountExport> {
  await assertExclusiveHousehold(database, context);

  const [planningYears, acceptances] = await Promise.all([
    database
      .prepare(
        `SELECT year, planning_data, data_version, revision, updated_at
         FROM planning_years
         WHERE household_id = ?
         ORDER BY year ASC`,
      )
      .bind(context.household.id)
      .all<PlanningYearRow>(),
    database
      .prepare(
        `SELECT user_id, terms_version, privacy_version, accepted_at
         FROM legal_acceptances
         WHERE user_id = ?
         ORDER BY accepted_at ASC, terms_version ASC, privacy_version ASC`,
      )
      .bind(context.user.id)
      .all<LegalAcceptanceRow>(),
  ]);

  return {
    account: {
      createdAt: context.user.created_at,
      email: context.identity.email,
      identityProvider: context.identity.provider,
      identitySubject: context.identity.provider_subject,
      userId: context.user.id,
    },
    exportedAt: now.toISOString(),
    household: {
      createdAt: context.household.created_at,
      householdId: context.household.id,
      membershipRole: context.membership.role,
      name: context.household.name,
    },
    legalAcceptances: acceptances.results.map((row) => ({
      acceptedAt: row.accepted_at,
      privacyVersion: row.privacy_version,
      termsVersion: row.terms_version,
    })),
    planningYears: planningYears.results.map((row) => ({
      dataVersion: row.data_version,
      planningData: JSON.parse(row.planning_data) as unknown,
      revision: row.revision,
      updatedAt: row.updated_at,
      year: row.year,
    })),
    schemaVersion: 1,
  };
}

async function getDeletionJob(
  database: D1Database,
  userId: string,
): Promise<DeletionJob | null> {
  return await database
    .prepare(
      `SELECT id, user_id, household_id, provider, provider_subject, status,
              lease_token, lease_expires_at
       FROM account_deletion_jobs
       WHERE user_id = ?`,
    )
    .bind(userId)
    .first<DeletionJob>();
}

async function prepareDeletionJob(
  database: D1Database,
  context: AuthorizedPilotContext,
  now: Date,
): Promise<DeletionJob> {
  await assertExclusiveHousehold(database, context);
  if (context.identity.provider !== "workos") {
    throw new AccountDataControlError("identity_not_supported");
  }

  let existing = await getDeletionJob(database, context.user.id);
  if (!existing) {
    const timestamp = now.toISOString();
    try {
      await database.batch([
        database
          .prepare(
            `INSERT INTO account_deletion_jobs
               (id, user_id, household_id, provider, provider_subject, status,
                lease_token, lease_expires_at, last_error_code, requested_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            context.user.id,
            context.household.id,
            context.identity.provider,
            context.identity.provider_subject,
            timestamp,
            timestamp,
          ),
        database
          .prepare(
            `UPDATE users
             SET status = 'disabled', updated_at = ?
             WHERE id = ? AND status = 'active'`,
          )
          .bind(timestamp, context.user.id),
      ]);
    } catch {
      // A concurrent request may have created the same single-user job.
    }
    existing = await getDeletionJob(database, context.user.id);
  }

  if (
    !existing
    || existing.household_id !== context.household.id
    || existing.provider !== context.identity.provider
    || existing.provider_subject !== context.identity.provider_subject
  ) {
    throw new AccountDataControlError("deletion_partial");
  }
  return existing;
}

async function claimJobStage(
  database: D1Database,
  job: DeletionJob,
  fromStatus: "pending" | "workos_deleted",
  processingStatus: "processing_workos" | "processing_d1",
  now: Date,
): Promise<string | null> {
  const leaseToken = crypto.randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + leaseMilliseconds).toISOString();
  const result = await database
    .prepare(
      `UPDATE account_deletion_jobs
       SET status = ?, lease_token = ?, lease_expires_at = ?,
           last_error_code = NULL, updated_at = ?
       WHERE id = ? AND (
         status = ? OR (
           status = ? AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?
         )
       )`,
    )
    .bind(
      processingStatus,
      leaseToken,
      leaseExpiresAt,
      now.toISOString(),
      job.id,
      fromStatus,
      processingStatus,
      now.toISOString(),
    )
    .run();
  return result.meta.changes === 1 ? leaseToken : null;
}

async function releaseWorkosJob(
  database: D1Database,
  jobId: string,
  leaseToken: string,
  errorCode: "workos_sessions" | "workos_user",
  now: Date,
): Promise<void> {
  await database
    .prepare(
      `UPDATE account_deletion_jobs
       SET status = 'pending', lease_token = NULL, lease_expires_at = NULL,
           last_error_code = ?, updated_at = ?
       WHERE id = ? AND status = 'processing_workos' AND lease_token = ?`,
    )
    .bind(errorCode, now.toISOString(), jobId, leaseToken)
    .run();
}

async function processWorkosStage(
  database: D1Database,
  job: DeletionJob,
  gateway: WorkosDeletionGateway,
  now: Date,
): Promise<"advanced" | "in_progress" | "partial"> {
  if (job.status === "workos_deleted" || job.status === "processing_d1") {
    return "advanced";
  }
  const leaseToken = await claimJobStage(
    database,
    job,
    "pending",
    "processing_workos",
    now,
  );
  if (!leaseToken) {
    return "in_progress";
  }

  let sessionIds: string[];
  try {
    sessionIds = await gateway.listActiveSessionIds(job.provider_subject);
    for (const sessionId of sessionIds) {
      await gateway.revokeSession(sessionId);
    }
  } catch {
    await releaseWorkosJob(database, job.id, leaseToken, "workos_sessions", now);
    return "partial";
  }

  try {
    await gateway.deleteUser(job.provider_subject);
  } catch {
    await releaseWorkosJob(database, job.id, leaseToken, "workos_user", now);
    return "partial";
  }

  await database
    .prepare(
      `UPDATE account_deletion_jobs
       SET status = 'workos_deleted', lease_token = NULL, lease_expires_at = NULL,
           last_error_code = NULL, updated_at = ?
       WHERE id = ? AND status = 'processing_workos' AND lease_token = ?`,
    )
    .bind(now.toISOString(), job.id, leaseToken)
    .run();
  return "advanced";
}

async function processD1Stage(
  database: D1Database,
  job: DeletionJob,
  now: Date,
): Promise<"complete" | "in_progress" | "partial"> {
  const current = await getDeletionJob(database, job.user_id);
  if (!current) {
    return "complete";
  }
  const leaseToken = await claimJobStage(
    database,
    current,
    "workos_deleted",
    "processing_d1",
    now,
  );
  if (!leaseToken) {
    return "in_progress";
  }

  const exclusive = await database
    .prepare(
      `SELECT COUNT(*) AS member_count,
              SUM(CASE WHEN user_id = ? AND role = 'owner' THEN 1 ELSE 0 END) AS owner_count
       FROM household_members WHERE household_id = ?`,
    )
    .bind(current.user_id, current.household_id)
    .first<{ member_count: number; owner_count: number }>();
  if (exclusive?.member_count !== 1 || exclusive.owner_count !== 1) {
    await database
      .prepare(
        `UPDATE account_deletion_jobs
         SET status = 'workos_deleted', lease_token = NULL, lease_expires_at = NULL,
             last_error_code = 'shared_household', updated_at = ?
         WHERE id = ? AND lease_token = ?`,
      )
      .bind(now.toISOString(), current.id, leaseToken)
      .run();
    return "partial";
  }

  try {
    await database.batch([
      database
        .prepare(
          `DELETE FROM households
           WHERE id = ?
             AND (SELECT COUNT(*) FROM household_members WHERE household_id = ?) = 1
             AND EXISTS (
               SELECT 1 FROM household_members
               WHERE household_id = ? AND user_id = ? AND role = 'owner'
             )`,
        )
        .bind(current.household_id, current.household_id, current.household_id, current.user_id),
      database
        .prepare(
          `DELETE FROM users
           WHERE id = ?
             AND NOT EXISTS (SELECT 1 FROM household_members WHERE user_id = ?)`,
        )
        .bind(current.user_id, current.user_id),
    ]);
  } catch {
    await database
      .prepare(
        `UPDATE account_deletion_jobs
         SET status = 'workos_deleted', lease_token = NULL, lease_expires_at = NULL,
             last_error_code = 'd1_finalize', updated_at = ?
         WHERE id = ? AND lease_token = ?`,
      )
      .bind(now.toISOString(), current.id, leaseToken)
      .run();
    return "partial";
  }

  const userStillExists = await database
    .prepare("SELECT id FROM users WHERE id = ?")
    .bind(current.user_id)
    .first<{ id: string }>();
  if (userStillExists) {
    await database
      .prepare(
        `UPDATE account_deletion_jobs
         SET status = 'workos_deleted', lease_token = NULL, lease_expires_at = NULL,
             last_error_code = 'd1_finalize', updated_at = ?
         WHERE id = ? AND lease_token = ?`,
      )
      .bind(now.toISOString(), current.id, leaseToken)
      .run();
    return "partial";
  }
  return "complete";
}

export async function resumeAccountDeletion(
  database: D1Database,
  job: DeletionJob,
  gateway: WorkosDeletionGateway,
  now = new Date(),
): Promise<DeletionResult> {
  const workos = await processWorkosStage(database, job, gateway, now);
  if (workos !== "advanced") {
    return { jobId: job.id, status: workos };
  }
  const d1 = await processD1Stage(database, job, now);
  return { jobId: job.id, status: d1 };
}

export async function requestAccountDeletion(
  database: D1Database,
  context: AuthorizedPilotContext,
  gateway: WorkosDeletionGateway,
  now = new Date(),
): Promise<DeletionResult> {
  const job = await prepareDeletionJob(database, context, now);
  return await resumeAccountDeletion(database, job, gateway, now);
}
