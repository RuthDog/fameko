import type { VerifiedAuthContext } from "./identity-types.ts";

export type VerifiedAccountLinkGrant = {
  consumedAt: string | null;
  expiresAt: string;
  existingUserId: string;
  id: string;
  sourceProvider: string;
  sourceProviderSubject: string;
  targetProvider: string;
  targetProviderSubject: string;
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

export function prepareAccountLinkPlan(
  grant: VerifiedAccountLinkGrant,
  sourceIdentity: VerifiedAuthContext,
  targetIdentity: VerifiedAuthContext,
  now = new Date(),
): AccountLinkPlan {
  if (
    grant.consumedAt !== null ||
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
