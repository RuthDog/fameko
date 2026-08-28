export type ProvisionPilotInput = {
  displayName?: string | null;
  email: string;
  householdName?: string | null;
  providerSubject: string;
};

export type ProvisionPilotResult = {
  authIdentityId: string;
  householdId: string;
  userId: string;
};

function requiredValue(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

export async function provisionPilotIdentity(
  database: D1Database,
  input: ProvisionPilotInput,
): Promise<ProvisionPilotResult> {
  const email = requiredValue(input.email, "email").toLowerCase();
  const providerSubject = requiredValue(input.providerSubject, "providerSubject");

  if (!email.includes("@")) {
    throw new Error("email is invalid.");
  }

  const userId = crypto.randomUUID();
  const householdId = crypto.randomUUID();
  const authIdentityId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const displayName = input.displayName?.trim() || null;
  const householdName = input.householdName?.trim() || "Mitt hushåll";

  await database.batch([
    database
      .prepare(
        `INSERT INTO users (id, display_name, status, created_at, updated_at)
         VALUES (?, ?, 'active', ?, ?)`,
      )
      .bind(userId, displayName, timestamp, timestamp),
    database
      .prepare(
        `INSERT INTO households (id, name, created_at, updated_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(householdId, householdName, timestamp, timestamp),
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
         VALUES (?, ?, 'cloudflare_access', ?, ?, ?, ?)`,
      )
      .bind(
        authIdentityId,
        userId,
        providerSubject,
        email,
        timestamp,
        timestamp,
      ),
  ]);

  return { authIdentityId, householdId, userId };
}
