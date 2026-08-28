/** Development/test fixture only. Production authorization uses D1. */
import type { AccessClaims } from "../access-token";

type UserStatus = "invited" | "active" | "disabled";
type HouseholdRole = "owner" | "member";

type PilotUser = {
  created_at: string;
  display_name?: string | null;
  email_normalized: string;
  id: string;
  status: UserStatus;
  updated_at: string;
};

type AuthIdentity = {
  created_at: string;
  email_snapshot: string;
  last_seen_at?: string | null;
  provider: "cloudflare_access";
  subject: string;
  user_id: string;
};

type Household = {
  created_at: string;
  id: string;
  name: string;
  updated_at: string;
};

type HouseholdMember = {
  created_at: string;
  household_id: string;
  role: HouseholdRole;
  user_id: string;
};

type PilotDirectory = {
  auth_identities: AuthIdentity[];
  household_members: HouseholdMember[];
  households: Household[];
  users: PilotUser[];
};

export type AuthorizedPilotContext = {
  household: Household;
  membership: HouseholdMember;
  user: PilotUser;
};

export type PilotDirectoryErrorCode =
  | "directory_invalid"
  | "household_missing"
  | "identity_missing"
  | "user_disabled"
  | "user_missing";

export class PilotDirectoryError extends Error {
  readonly code: PilotDirectoryErrorCode;

  constructor(code: PilotDirectoryErrorCode) {
    super(code);
    this.name = "PilotDirectoryError";
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isUser(value: unknown): value is PilotUser {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.email_normalized) &&
    ["invited", "active", "disabled"].includes(String(value.status)) &&
    isNonEmptyString(value.created_at) &&
    isNonEmptyString(value.updated_at)
  );
}

function isAuthIdentity(value: unknown): value is AuthIdentity {
  return (
    isRecord(value) &&
    value.provider === "cloudflare_access" &&
    isNonEmptyString(value.subject) &&
    isNonEmptyString(value.user_id) &&
    isNonEmptyString(value.email_snapshot) &&
    isNonEmptyString(value.created_at)
  );
}

function isHousehold(value: unknown): value is Household {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.created_at) &&
    isNonEmptyString(value.updated_at)
  );
}

function isHouseholdMember(value: unknown): value is HouseholdMember {
  return (
    isRecord(value) &&
    isNonEmptyString(value.household_id) &&
    isNonEmptyString(value.user_id) &&
    ["owner", "member"].includes(String(value.role)) &&
    isNonEmptyString(value.created_at)
  );
}

export function parsePilotDirectory(rawDirectory: string): PilotDirectory {
  let value: unknown;

  try {
    value = JSON.parse(rawDirectory);
  } catch {
    throw new PilotDirectoryError("directory_invalid");
  }

  if (
    !isRecord(value) ||
    !Array.isArray(value.users) ||
    !value.users.every(isUser) ||
    !Array.isArray(value.auth_identities) ||
    !value.auth_identities.every(isAuthIdentity) ||
    !Array.isArray(value.households) ||
    !value.households.every(isHousehold) ||
    !Array.isArray(value.household_members) ||
    !value.household_members.every(isHouseholdMember)
  ) {
    throw new PilotDirectoryError("directory_invalid");
  }

  const userIds = new Set(value.users.map((user) => user.id));
  const householdIds = new Set(value.households.map((household) => household.id));
  const identityKeys = new Set<string>();
  const userEmails = new Set<string>();

  for (const user of value.users) {
    const normalizedEmail = user.email_normalized.trim().toLowerCase();
    if (userEmails.has(normalizedEmail)) {
      throw new PilotDirectoryError("directory_invalid");
    }
    userEmails.add(normalizedEmail);
    user.email_normalized = normalizedEmail;
  }

  for (const identity of value.auth_identities) {
    const key = `${identity.provider}:${identity.subject}`;
    if (identityKeys.has(key) || !userIds.has(identity.user_id)) {
      throw new PilotDirectoryError("directory_invalid");
    }
    identityKeys.add(key);
  }

  for (const membership of value.household_members) {
    if (!userIds.has(membership.user_id) || !householdIds.has(membership.household_id)) {
      throw new PilotDirectoryError("directory_invalid");
    }
  }

  return value as PilotDirectory;
}

export function resolvePilotIdentity(
  claims: AccessClaims,
  rawDirectory: string,
): AuthorizedPilotContext {
  const directory = parsePilotDirectory(rawDirectory);
  const identity = directory.auth_identities.find(
    (candidate) =>
      candidate.provider === "cloudflare_access" && candidate.subject === claims.sub,
  );

  if (!identity) {
    throw new PilotDirectoryError("user_missing");
  }

  const user = directory.users.find((candidate) => candidate.id === identity.user_id);
  if (!user) {
    throw new PilotDirectoryError("user_missing");
  }

  if (user.status === "disabled") {
    throw new PilotDirectoryError("user_disabled");
  }

  if (user.status !== "active") {
    throw new PilotDirectoryError("user_missing");
  }

  if (user.email_normalized !== claims.email) {
    throw new PilotDirectoryError("identity_missing");
  }

  const memberships = directory.household_members.filter(
    (candidate) => candidate.user_id === user.id,
  );

  if (memberships.length !== 1) {
    throw new PilotDirectoryError("household_missing");
  }

  const membership = memberships[0];
  const household = directory.households.find(
    (candidate) => candidate.id === membership.household_id,
  );

  if (!household) {
    throw new PilotDirectoryError("household_missing");
  }

  return { household, membership, user };
}
