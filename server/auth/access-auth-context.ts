import type { VerifiedAuthContext } from "../identity/identity-types.ts";
import type { AccessClaims } from "./access-token.ts";

export function verifiedAuthContextFromAccessClaims(
  claims: AccessClaims,
): VerifiedAuthContext {
  return {
    provider: "cloudflare_access",
    providerSubject: claims.sub,
    verifiedEmail: claims.email,
  };
}
