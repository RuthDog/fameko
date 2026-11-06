import type {
  AuthorizedPilotContext,
  VerifiedAuthContext,
} from "./identity-types.ts";

export type VerifiedAccountLinkGrant = {
  consumedAt: string | null;
  expiresAt: string;
  existingUserId: string;
  id: string;
  revokedAt: string | null;
  stateHash: string;
  sourceProvider: string;
  sourceProviderSubject: string;
  targetProvider: string | null;
  targetProviderSubject: string | null;
};

export type AccountLinkPlan = {
  grantId: string;
  provider: string;
  providerSubject: string;
  userId: string;
};

export class AccountLinkingError extends Error {
  constructor() {
    super("Account linking is not authorized.");
    this.name = "AccountLinkingError";
  }
}

type AccountLinkGrantRow = {
  consumed_at: string | null;
  existing_user_id: string;
  expires_at: string;
  id: string;
  revoked_at: string | null;
  source_provider: string;
  source_provider_subject: string;
  state_hash: string;
  target_provider: string | null;
  target_provider_subject: string | null;
};

function verifiedGrant(row: AccountLinkGrantRow): VerifiedAccountLinkGrant {
  return {
    consumedAt: row.consumed_at,
    existingUserId: row.existing_user_id,
    expiresAt: row.expires_at,
    id: row.id,
    revokedAt: row.revoked_at,
    sourceProvider: row.source_provider,
    sourceProviderSubject: row.source_provider_subject,
    stateHash: row.state_hash,
    targetProvider: row.target_provider,
    targetProviderSubject: row.target_provider_subject,
  };
}

function isoTimestamp(value: Date): string {
  if (!Number.isFinite(value.getTime())) {
    throw new AccountLinkingError();
  }
  return value.toISOString();
}

export function prepareAccountLinkPlan(
  grant: VerifiedAccountLinkGrant,
  sourceIdentity: VerifiedAuthContext,
  targetIdentity: VerifiedAuthContext,
  now = new Date(),
): AccountLinkPlan {
  if (
    grant.consumedAt !== null ||
    grant.revokedAt !== null ||
    !grant.id ||
    !grant.existingUserId ||
    Date.parse(grant.expiresAt) <= now.getTime() ||
    grant.sourceProvider !== sourceIdentity.provider ||
    grant.sourceProviderSubject !== sourceIdentity.providerSubject ||
    grant.targetProvider !== targetIdentity.provider ||
    grant.targetProviderSubject !== targetIdentity.providerSubject ||
    sourceIdentity.provider === targetIdentity.provider
  ) {
    throw new AccountLinkingError();
  }

  return {
    grantId: grant.id,
    provider: targetIdentity.provider,
    providerSubject: targetIdentity.providerSubject,
    userId: grant.existingUserId,
  };
}

export async function createAccountLinkGrant(
  database: D1Database,
  source: AuthorizedPilotContext,
  state: { expiresAt: number; grantId: string; stateHash: string },
  now = new Date(),
): Promise<void> {
  if (
    source.identity.provider !== "cloudflare_access"
    || source.identity.user_id !== source.user.id
    || !source.identity.provider_subject
    || !state.grantId
    || !state.stateHash
  ) {
    throw new AccountLinkingError();
  }
  const timestamp = isoTimestamp(now);
  const expiresAt = new Date(state.expiresAt * 1000);
  if (expiresAt.getTime() <= now.getTime()) {
    throw new AccountLinkingError();
  }

  const results = await database.batch([
    database
      .prepare(
        `UPDATE account_link_grants
         SET revoked_at = ?, updated_at = ?, revision = revision + 1
         WHERE existing_user_id = ?
           AND source_provider = ?
           AND source_provider_subject = ?
           AND consumed_at IS NULL
           AND revoked_at IS NULL`,
      )
      .bind(
        timestamp,
        timestamp,
        source.user.id,
        source.identity.provider,
        source.identity.provider_subject,
      ),
    database
      .prepare(
        `INSERT INTO account_link_grants
           (id, state_hash, existing_user_id, source_provider,
            source_provider_subject, target_provider, target_provider_subject,
            created_at, expires_at, target_bound_at, consumed_at, revoked_at,
            updated_at, revision)
         SELECT ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL, NULL, NULL, ?, 0
         WHERE EXISTS (
           SELECT 1
           FROM auth_identities
           WHERE user_id = ? AND provider = ? AND provider_subject = ?
         )`,
      )
      .bind(
        state.grantId,
        state.stateHash,
        source.user.id,
        source.identity.provider,
        source.identity.provider_subject,
        timestamp,
        expiresAt.toISOString(),
        timestamp,
        source.user.id,
        source.identity.provider,
        source.identity.provider_subject,
      ),
  ]);

  if ((results[1]?.meta.changes ?? 0) !== 1) {
    throw new AccountLinkingError();
  }
}

export async function getAccountLinkGrant(
  database: D1Database,
  grantId: string,
): Promise<VerifiedAccountLinkGrant | null> {
  const row = await database
    .prepare(
      `SELECT id, state_hash, existing_user_id, source_provider,
              source_provider_subject, target_provider, target_provider_subject,
              expires_at, consumed_at, revoked_at
       FROM account_link_grants
       WHERE id = ?
       LIMIT 1`,
    )
    .bind(grantId)
    .first<AccountLinkGrantRow>();
  return row ? verifiedGrant(row) : null;
}

export async function bindAccountLinkTarget(
  database: D1Database,
  state: { grantId: string; stateHash: string },
  targetIdentity: VerifiedAuthContext,
  now = new Date(),
): Promise<void> {
  if (
    targetIdentity.provider !== "workos"
    || !targetIdentity.providerSubject
  ) {
    throw new AccountLinkingError();
  }
  const timestamp = isoTimestamp(now);
  try {
    const result = await database
      .prepare(
        `UPDATE account_link_grants
         SET target_provider = ?, target_provider_subject = ?,
             target_bound_at = ?, updated_at = ?, revision = revision + 1
         WHERE id = ?
           AND state_hash = ?
           AND target_provider IS NULL
           AND target_provider_subject IS NULL
           AND consumed_at IS NULL
           AND revoked_at IS NULL
           AND expires_at > ?
           AND EXISTS (
             SELECT 1 FROM auth_identities source
             WHERE source.user_id = account_link_grants.existing_user_id
               AND source.provider = account_link_grants.source_provider
               AND source.provider_subject = account_link_grants.source_provider_subject
           )
           AND NOT EXISTS (
             SELECT 1 FROM auth_identities target
             WHERE target.provider = ? AND target.provider_subject = ?
           )
           AND NOT EXISTS (
             SELECT 1 FROM auth_identities existing_workos
             WHERE existing_workos.user_id = account_link_grants.existing_user_id
               AND existing_workos.provider = 'workos'
           )`,
        )
      .bind(
        targetIdentity.provider,
        targetIdentity.providerSubject,
        timestamp,
        timestamp,
        state.grantId,
        state.stateHash,
        timestamp,
        targetIdentity.provider,
        targetIdentity.providerSubject,
      )
      .run();
    if ((result.meta.changes ?? 0) !== 1) {
      throw new AccountLinkingError();
    }
  } catch (error) {
    if (error instanceof AccountLinkingError) {
      throw error;
    }
    throw new AccountLinkingError();
  }
}

export async function consumeAccountLinkGrant(
  database: D1Database,
  state: { grantId: string; stateHash: string },
  sourceIdentity: VerifiedAuthContext,
  targetIdentity: VerifiedAuthContext,
  now = new Date(),
): Promise<AccountLinkPlan> {
  const grant = await getAccountLinkGrant(database, state.grantId);
  if (!grant || grant.stateHash !== state.stateHash) {
    throw new AccountLinkingError();
  }
  const plan = prepareAccountLinkPlan(grant, sourceIdentity, targetIdentity, now);
  const timestamp = isoTimestamp(now);

  try {
    const result = await database
      .prepare(
        `INSERT INTO auth_identities
           (id, user_id, provider, provider_subject, email, created_at, updated_at)
         SELECT ?, grant.existing_user_id, ?, ?, ?, ?, ?
         FROM account_link_grants grant
         WHERE grant.id = ?
           AND grant.state_hash = ?
           AND grant.existing_user_id = ?
           AND grant.source_provider = ?
           AND grant.source_provider_subject = ?
           AND grant.target_provider = ?
           AND grant.target_provider_subject = ?
           AND grant.consumed_at IS NULL
           AND grant.revoked_at IS NULL
           AND grant.expires_at > ?
           AND EXISTS (
             SELECT 1 FROM auth_identities source
             WHERE source.user_id = grant.existing_user_id
               AND source.provider = grant.source_provider
               AND source.provider_subject = grant.source_provider_subject
           )
           AND NOT EXISTS (
             SELECT 1 FROM auth_identities target
             WHERE target.provider = grant.target_provider
               AND target.provider_subject = grant.target_provider_subject
           )
           AND NOT EXISTS (
             SELECT 1 FROM auth_identities existing_workos
             WHERE existing_workos.user_id = grant.existing_user_id
               AND existing_workos.provider = 'workos'
           )`,
        )
      .bind(
        crypto.randomUUID(),
        targetIdentity.provider,
        targetIdentity.providerSubject,
        targetIdentity.verifiedEmail.trim().toLowerCase(),
        timestamp,
        timestamp,
        state.grantId,
        state.stateHash,
        plan.userId,
        sourceIdentity.provider,
        sourceIdentity.providerSubject,
        targetIdentity.provider,
        targetIdentity.providerSubject,
        timestamp,
      )
      .run();
    // D1/SQLite may include the grant-consuming trigger update in `changes`.
    // Zero always means that the guarded identity INSERT did not happen.
    if ((result.meta.changes ?? 0) < 1) {
      throw new AccountLinkingError();
    }
    const consumed = await getAccountLinkGrant(database, state.grantId);
    if (!consumed?.consumedAt) {
      throw new AccountLinkingError();
    }
    return plan;
  } catch (error) {
    if (error instanceof AccountLinkingError) {
      throw error;
    }
    throw new AccountLinkingError();
  }
}
