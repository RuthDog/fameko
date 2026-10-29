import type { User } from "@workos-inc/node";

import type { VerifiedAuthContext } from "../identity/identity-types.ts";

export const workosIdentityProvider = "workos";

export type VerifiedWorkosUser = Pick<User, "email" | "emailVerified" | "id">;

export function verifiedAuthContextFromWorkosUser(
  user: VerifiedWorkosUser,
): VerifiedAuthContext {
  const providerSubject = user.id.trim();
  const verifiedEmail = user.email.trim().toLowerCase();

  if (
    !providerSubject ||
    !verifiedEmail ||
    !verifiedEmail.includes("@") ||
    user.emailVerified !== true
  ) {
    throw new TypeError("A verified WorkOS identity is required.");
  }

  return {
    provider: workosIdentityProvider,
    providerSubject,
    verifiedEmail,
  };
}
