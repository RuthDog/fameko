import type { AccessClaims } from "../auth/access-token";
import { IdentityRepository } from "./identity-repository.ts";
import type { AuthorizedPilotContext } from "./identity-types";

export type IdentityAuthorizationErrorCode =
  | "household_missing"
  | "identity_missing"
  | "user_disabled"
  | "user_inactive"
  | "user_missing";

export class IdentityAuthorizationError extends Error {
  readonly code: IdentityAuthorizationErrorCode;

  constructor(code: IdentityAuthorizationErrorCode) {
    super(code);
    this.name = "IdentityAuthorizationError";
    this.code = code;
  }
}

export async function resolveAuthorizedIdentity(
  repository: IdentityRepository,
  claims: AccessClaims,
): Promise<AuthorizedPilotContext> {
  const identity = await repository.findAuthIdentity("cloudflare_access", claims.sub);

  if (!identity) {
    throw new IdentityAuthorizationError("identity_missing");
  }

  if (identity.email && identity.email.trim().toLowerCase() !== claims.email) {
    throw new IdentityAuthorizationError("identity_missing");
  }

  const user = await repository.getUser(identity.user_id);

  if (!user) {
    throw new IdentityAuthorizationError("user_missing");
  }

  if (user.status === "disabled") {
    throw new IdentityAuthorizationError("user_disabled");
  }

  if (user.status !== "active") {
    throw new IdentityAuthorizationError("user_inactive");
  }

  const memberships = await repository.getHouseholdMemberships(user.id);

  if (memberships.length !== 1) {
    throw new IdentityAuthorizationError("household_missing");
  }

  const membership = memberships[0];
  const household = await repository.getHousehold(membership.household_id);

  if (!household) {
    throw new IdentityAuthorizationError("household_missing");
  }

  return { household, identity, membership, user };
}
