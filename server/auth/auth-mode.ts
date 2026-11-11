export const cloudflareAccessAuthMode = "cloudflare_access";
export const workosStagingAuthMode = "workos_staging";
export const workosProductionTransitionAuthMode = "workos_production_transition";
export const workosProductionAuthMode = "workos_production";
export const legacyAccountLinkEnabledValue = "enabled";

export type AuthMode =
  | typeof cloudflareAccessAuthMode
  | typeof workosStagingAuthMode
  | typeof workosProductionTransitionAuthMode
  | typeof workosProductionAuthMode;

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
    values.length < 2 ||
    values.length > 3 ||
    unique.size !== values.length ||
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
  if (
    mode === cloudflareAccessAuthMode
    || mode === workosStagingAuthMode
    || mode === workosProductionTransitionAuthMode
    || mode === workosProductionAuthMode
  ) {
    return mode;
  }
  throw new AuthConfigurationError();
}

export function isWorkosAuthMode(mode: AuthMode): boolean {
  return mode === workosStagingAuthMode
    || mode === workosProductionTransitionAuthMode
    || mode === workosProductionAuthMode;
}

export function isPublicRegistrationEnabled(environment: AuthEnvironment): boolean {
  const mode = getAuthMode(environment);
  if (mode === workosStagingAuthMode) {
    return true;
  }
  return mode === workosProductionAuthMode
    && environment.FAMEKO_PUBLIC_REGISTRATION?.trim() === "enabled";
}

export function isLegacyAccountLinkEnabled(
  environment: AuthEnvironment,
): boolean {
  return getAuthMode(environment) === workosProductionAuthMode
    && environment.FAMEKO_LEGACY_ACCOUNT_LINK?.trim()
      === legacyAccountLinkEnabledValue;
}

export function isAccountLinkEnabled(environment: AuthEnvironment): boolean {
  const mode = getAuthMode(environment);
  return mode === workosProductionTransitionAuthMode
    || (mode === workosProductionAuthMode
      && isLegacyAccountLinkEnabled(environment));
}

export function allowsAccessFallbackForPath(
  mode: AuthMode,
  pathname: string,
  environment: AuthEnvironment,
): boolean {
  if (mode === workosProductionTransitionAuthMode) {
    return true;
  }
  return mode === workosProductionAuthMode
    && pathname === "/account-link/confirm"
    && isLegacyAccountLinkEnabled(environment);
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
  const clientId = required(environment, "WORKOS_CLIENT_ID");
  required(environment, "WORKOS_API_KEY");
  const cookiePassword = required(environment, "WORKOS_COOKIE_PASSWORD");
  const redirectUriValue = required(environment, "NEXT_PUBLIC_WORKOS_REDIRECT_URI");
  const issuerValue = required(environment, "WORKOS_ISSUER");
  const mode = getAuthMode(environment);
  if (!isWorkosAuthMode(mode)) {
    throw new AuthConfigurationError();
  }
  if (mode === workosStagingAuthMode) {
    workosStagingAllowedEmails(environment);
  }

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

  const validIssuerPath = mode === workosStagingAuthMode
    ? issuer.pathname === "/"
    : issuer.pathname === `/user_management/${clientId}`;

  if (
    issuer.protocol !== "https:" ||
    !validIssuerPath ||
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

export function validateProductionTransitionConfiguration(
  environment: AuthEnvironment,
): { publicOrigin: string; redirectUri: string } {
  if (getAuthMode(environment) !== workosProductionTransitionAuthMode) {
    throw new AuthConfigurationError();
  }
  validateCloudflareAccessConfiguration(environment);
  return validateWorkosConfiguration(environment);
}
