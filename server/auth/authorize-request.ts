import { AccessTokenError, verifyAccessToken } from "./access-token.ts";
import { verifiedAuthContextFromAccessClaims } from "./access-auth-context.ts";
import {
  AuthConfigurationError,
  cloudflareAccessAuthMode,
  getAuthMode,
  validateCloudflareAccessConfiguration,
  validateWorkosConfiguration,
  workosStagingAuthMode,
} from "./auth-mode.ts";
import { getLocalDevelopmentAuthContext } from "./development-auth.ts";
import {
  verifiedAuthContextFromWorkosUser,
  type VerifiedWorkosUser,
} from "./workos-auth-context.ts";
import { getVerifiedWorkosSessionUser } from "./workos-session.ts";
import { DatabaseUnavailableError, getFamekoDatabase } from "../cloudflare/database.ts";
import {
  FirstLoginProvisioningError,
  resolveOrProvisionAuthorizedIdentity,
} from "../identity/first-login-provisioning.ts";
import { IdentityAuthorizationError } from "../identity/resolve-identity.ts";
import { IdentityRepository } from "../identity/identity-repository.ts";
import { resolveAuthorizedIdentity } from "../identity/resolve-identity.ts";
import type { AuthorizedPilotContext } from "../identity/identity-types";

export type AuthorizationFailureCode =
  | "configuration_missing"
  | "database_unavailable"
  | "household_missing"
  | "identity_missing"
  | "provisioning_failed"
  | "token_invalid"
  | "token_missing"
  | "user_disabled"
  | "user_inactive"
  | "user_missing";

export type AuthorizationResult =
  | {
      context: AuthorizedPilotContext;
      mode: "access" | "development" | "workos";
      ok: true;
    }
  | { code: AuthorizationFailureCode; ok: false };

type AuthorizeRequestOptions = {
  database?: D1Database;
  environment?: Record<string, string | undefined>;
  workosUserResolver?: () => Promise<VerifiedWorkosUser | null>;
};

export async function authorizeRequest(
  request: Request,
  options: AuthorizeRequestOptions = {},
): Promise<AuthorizationResult> {
  const environment = options.environment ?? process.env;
  const developmentContext = getLocalDevelopmentAuthContext(request, environment);

  if (developmentContext) {
    return { context: developmentContext, mode: "development", ok: true };
  }

  let authMode;
  try {
    authMode = getAuthMode(environment);
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return { code: "configuration_missing", ok: false };
    }
    return { code: "configuration_missing", ok: false };
  }

  if (authMode === workosStagingAuthMode) {
    try {
      validateWorkosConfiguration(environment);
      const user = await (options.workosUserResolver ?? getVerifiedWorkosSessionUser)();
      if (!user) {
        return { code: "token_missing", ok: false };
      }

      const database = options.database ?? (await getFamekoDatabase());
      const authContext = verifiedAuthContextFromWorkosUser(user);
      const context = await resolveAuthorizedIdentity(
        new IdentityRepository(database),
        authContext,
      );
      return { context, mode: "workos", ok: true };
    } catch (error) {
      if (error instanceof AuthConfigurationError) {
        return { code: "configuration_missing", ok: false };
      }
      if (error instanceof IdentityAuthorizationError) {
        return { code: error.code, ok: false };
      }
      if (error instanceof DatabaseUnavailableError) {
        return { code: "database_unavailable", ok: false };
      }
      if (error instanceof TypeError) {
        return { code: "token_invalid", ok: false };
      }
      return { code: "token_invalid", ok: false };
    }
  }

  if (authMode !== cloudflareAccessAuthMode) {
    return { code: "configuration_missing", ok: false };
  }

  const token = request.headers.get("cf-access-jwt-assertion");

  if (!token) {
    return { code: "token_missing", ok: false };
  }

  try {
    validateCloudflareAccessConfiguration(environment);
  } catch {
    return { code: "configuration_missing", ok: false };
  }

  const teamDomain = environment.CF_ACCESS_TEAM_DOMAIN as string;
  const audience = environment.CF_ACCESS_AUD as string;

  try {
    const claims = await verifyAccessToken(token, teamDomain, audience);
    const database = options.database ?? (await getFamekoDatabase());
    const authContext = verifiedAuthContextFromAccessClaims(claims);
    const context = await resolveOrProvisionAuthorizedIdentity(database, authContext);
    return { context, mode: "access", ok: true };
  } catch (error) {
    if (error instanceof IdentityAuthorizationError) {
      return { code: error.code, ok: false };
    }

    if (error instanceof AccessTokenError) {
      return { code: "token_invalid", ok: false };
    }

    if (error instanceof FirstLoginProvisioningError) {
      return { code: "provisioning_failed", ok: false };
    }

    if (error instanceof DatabaseUnavailableError) {
      return { code: "database_unavailable", ok: false };
    }

    return { code: "database_unavailable", ok: false };
  }
}
