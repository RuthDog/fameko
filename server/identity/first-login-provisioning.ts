import {
  currentPlanningYear,
  seedPlanningDataV3,
} from "../../shared/planning/seed-planning-data.ts";
import { PlanningRepository } from "../planning/planning-repository.ts";
import {
  isPlanningData,
  planningDataVersion,
} from "../planning/planning-schema.ts";
import { IdentityRepository } from "./identity-repository.ts";
import type {
  AuthorizedPilotContext,
  VerifiedAuthContext,
} from "./identity-types.ts";
import {
  IdentityAuthorizationError,
  resolveAuthorizedIdentity,
} from "./resolve-identity.ts";

export class FirstLoginProvisioningError extends Error {
  constructor() {
    super("First login provisioning failed.");
    this.name = "FirstLoginProvisioningError";
  }
}

function requiredValue(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function normalizeAuthContext(authContext: VerifiedAuthContext): VerifiedAuthContext {
  const verifiedEmail = requiredValue(authContext.verifiedEmail, "verifiedEmail").toLowerCase();
  if (!verifiedEmail.includes("@")) {
    throw new Error("verifiedEmail is invalid.");
  }

  return {
    provider: requiredValue(authContext.provider, "provider"),
    providerSubject: requiredValue(authContext.providerSubject, "providerSubject"),
    verifiedEmail,
  };
}

async function provisionNewIdentity(
  database: D1Database,
  authContext: VerifiedAuthContext,
): Promise<void> {
  const normalized = normalizeAuthContext(authContext);
  const planningData: unknown = seedPlanningDataV3;

  if (!isPlanningData(planningData)) {
    throw new FirstLoginProvisioningError();
  }

  const userId = crypto.randomUUID();
  const householdId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  await database.batch([
    database
      .prepare(
        `INSERT INTO users (id, display_name, status, created_at, updated_at)
         VALUES (?, NULL, 'active', ?, ?)`,
      )
      .bind(userId, timestamp, timestamp),
    database
      .prepare(
        `INSERT INTO households (id, name, created_at, updated_at)
         VALUES (?, 'Mitt hushåll', ?, ?)`,
      )
      .bind(householdId, timestamp, timestamp),
    database
      .prepare(
        `INSERT INTO household_members (household_id, user_id, role, created_at)
         VALUES (?, ?, 'owner', ?)`,
      )
      .bind(householdId, userId, timestamp),
    database
      .prepare(
        `INSERT INTO auth_identities
           (id, user_id, provider, provider_subject, email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        userId,
        normalized.provider,
        normalized.providerSubject,
        normalized.verifiedEmail,
        timestamp,
        timestamp,
      ),
    database
      .prepare(
        `INSERT INTO planning_years
           (id, household_id, year, planning_data, data_version, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        householdId,
        currentPlanningYear,
        JSON.stringify(planningData),
        planningDataVersion,
        timestamp,
        timestamp,
      ),
  ]);
}

async function ensurePlanningYear(
  database: D1Database,
  context: AuthorizedPilotContext,
): Promise<void> {
  const planningData: unknown = seedPlanningDataV3;
  if (!isPlanningData(planningData)) {
    throw new FirstLoginProvisioningError();
  }

  const repository = new PlanningRepository(database);
  const existing = await repository.get(context.household.id, currentPlanningYear);
  if (existing) {
    return;
  }

  const created = await repository.create(
    context.household.id,
    currentPlanningYear,
    planningData,
    planningDataVersion,
  );

  if (!created && !(await repository.get(context.household.id, currentPlanningYear))) {
    throw new FirstLoginProvisioningError();
  }
}

async function resolveExisting(
  repository: IdentityRepository,
  authContext: VerifiedAuthContext,
): Promise<AuthorizedPilotContext | null> {
  try {
    return await resolveAuthorizedIdentity(repository, authContext);
  } catch (error) {
    if (error instanceof IdentityAuthorizationError && error.code === "identity_missing") {
      return null;
    }
    throw error;
  }
}

export async function resolveOrProvisionAuthorizedIdentity(
  database: D1Database,
  authContext: VerifiedAuthContext,
): Promise<AuthorizedPilotContext> {
  const normalized = normalizeAuthContext(authContext);
  const repository = new IdentityRepository(database);
  let context = await resolveExisting(repository, normalized);

  if (!context) {
    try {
      await provisionNewIdentity(database, normalized);
    } catch {
      context = await resolveExisting(repository, normalized);
      if (!context) {
        throw new FirstLoginProvisioningError();
      }
    }

    context ??= await resolveExisting(repository, normalized);
    if (!context) {
      throw new FirstLoginProvisioningError();
    }
  }

  try {
    await ensurePlanningYear(database, context);
  } catch (error) {
    if (error instanceof IdentityAuthorizationError) {
      throw error;
    }
    throw new FirstLoginProvisioningError();
  }

  return context;
}
