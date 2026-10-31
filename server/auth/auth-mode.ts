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

export class WorkosEmailNotAllowedError extends Error {
  constructor() {
    super("WorkOS identity is not allowed in staging.");
    this.name = "WorkosEmailNotAllowedError";
  }
}

function required(environment: AuthEnvironment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new AuthConfigurationError();
  }
  return value;
}

function workosStagingAllowedEmails(environment: AuthEnvironment): Set<string> {
  const values = required(environment, "WORKOS_STAGING_ALLOWED_EMAILS")
    .split(",")
    .map((value) => value.trim().toLowerCase());
  const unique = new Set(values);

  if (
    values.length !== 2 ||
    unique.size !== 2 ||
    values.some(
      (value) =>
        !value ||
        value.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    )
  ) {
    throw new AuthConfigurationError();
  }

  return unique;
}

export function assertWorkosStagingEmailAllowed(
  verifiedEmail: string,
  environment: AuthEnvironment,
): void {
  const normalized = verifiedEmail.trim().toLowerCase();
  if (!workosStagingAllowedEmails(environment).has(normalized)) {
    throw new WorkosEmailNotAllowedError();
  }
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
): { publicOrigin: string; redirectUri: string } {
  required(environment, "WORKOS_CLIENT_ID");
  required(environment, "WORKOS_API_KEY");
  const cookiePassword = required(environment, "WORKOS_COOKIE_PASSWORD");
  const redirectUriValue = required(environment, "NEXT_PUBLIC_WORKOS_REDIRECT_URI");
  const issuerValue = required(environment, "WORKOS_ISSUER");
  workosStagingAllowedEmails(environment);

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

  return {
    publicOrigin: redirectUri.origin,
    redirectUri: redirectUri.toString(),
  };
}
