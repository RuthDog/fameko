export const cloudflareAccessAuthMode = "cloudflare_access";
export const workosStagingAuthMode = "workos_staging";

export type AuthMode =
  | typeof cloudflareAccessAuthMode
  | typeof workosStagingAuthMode;

export class AuthConfigurationError extends Error {
  constructor() {
    super("Authentication is not configured.");
    this.name = "AuthConfigurationError";
  }
}

type AuthEnvironment = Record<string, string | undefined>;

function required(environment: AuthEnvironment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new AuthConfigurationError();
  }
  return value;
}

export function getAuthMode(environment: AuthEnvironment): AuthMode {
  const mode = required(environment, "FAMEKO_AUTH_MODE");
  if (mode === cloudflareAccessAuthMode || mode === workosStagingAuthMode) {
    return mode;
  }
  throw new AuthConfigurationError();
}

export function validateCloudflareAccessConfiguration(
  environment: AuthEnvironment,
): void {
  required(environment, "CF_ACCESS_TEAM_DOMAIN");
  required(environment, "CF_ACCESS_AUD");
}

export function validateWorkosConfiguration(
  environment: AuthEnvironment,
): { redirectUri: string } {
  required(environment, "WORKOS_CLIENT_ID");
  required(environment, "WORKOS_API_KEY");
  const cookiePassword = required(environment, "WORKOS_COOKIE_PASSWORD");
  const redirectUriValue = required(environment, "NEXT_PUBLIC_WORKOS_REDIRECT_URI");
  const issuerValue = required(environment, "WORKOS_ISSUER");

  if (cookiePassword.length < 32) {
    throw new AuthConfigurationError();
  }

  let redirectUri: URL;
  let issuer: URL;
  try {
    redirectUri = new URL(redirectUriValue);
    issuer = new URL(issuerValue);
  } catch {
    throw new AuthConfigurationError();
  }

  const isLocalDevelopment =
    redirectUri.protocol === "http:" &&
    (redirectUri.hostname === "localhost" || redirectUri.hostname === "127.0.0.1");

  if (
    (!isLocalDevelopment && redirectUri.protocol !== "https:") ||
    redirectUri.pathname !== "/auth/callback" ||
    redirectUri.username ||
    redirectUri.password ||
    redirectUri.search ||
    redirectUri.hash
  ) {
    throw new AuthConfigurationError();
  }

  if (
    issuer.protocol !== "https:" ||
    issuer.pathname !== "/" ||
    issuer.username ||
    issuer.password ||
    issuer.search ||
    issuer.hash
  ) {
    throw new AuthConfigurationError();
  }

  return { redirectUri: redirectUri.toString() };
}
