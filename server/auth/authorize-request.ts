import { AccessTokenError, verifyAccessToken } from "./access-token.ts";
import { DatabaseUnavailableError, getFamekoDatabase } from "../cloudflare/database.ts";
import {
  IdentityAuthorizationError,
  resolveAuthorizedIdentity,
} from "../identity/resolve-identity.ts";
import { IdentityRepository } from "../identity/identity-repository.ts";
import type { AuthorizedPilotContext } from "../identity/identity-types";

export type AuthorizationFailureCode =
  | "configuration_missing"
  | "database_unavailable"
  | "household_missing"
  | "identity_missing"
  | "token_invalid"
  | "token_missing"
  | "user_disabled"
  | "user_inactive"
  | "user_missing";

export type AuthorizationResult =
  | { context: AuthorizedPilotContext; ok: true }
  | { code: AuthorizationFailureCode; ok: false };

type AuthorizeRequestOptions = {
  database?: D1Database;
  environment?: Record<string, string | undefined>;
};

export async function authorizeRequest(
  request: Request,
  options: AuthorizeRequestOptions = {},
): Promise<AuthorizationResult> {
  const environment = options.environment ?? process.env;
  const token = request.headers.get("cf-access-jwt-assertion");

  if (!token) {
    return { code: "token_missing", ok: false };
  }

  const teamDomain = environment.CF_ACCESS_TEAM_DOMAIN;
  const audience = environment.CF_ACCESS_AUD;

  if (!teamDomain || !audience) {
    return { code: "configuration_missing", ok: false };
  }

  try {
    const claims = await verifyAccessToken(token, teamDomain, audience);
    const database = options.database ?? (await getFamekoDatabase());
    const repository = new IdentityRepository(database);
    const context = await resolveAuthorizedIdentity(repository, claims);
    return { context, ok: true };
  } catch (error) {
    if (error instanceof IdentityAuthorizationError) {
      return { code: error.code, ok: false };
    }

    if (error instanceof AccessTokenError) {
      return { code: "token_invalid", ok: false };
    }

    if (error instanceof DatabaseUnavailableError) {
      return { code: "database_unavailable", ok: false };
    }

    return { code: "database_unavailable", ok: false };
  }
}
