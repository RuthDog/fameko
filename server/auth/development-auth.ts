import type { AuthorizedPilotContext } from "../identity/identity-types.ts";

const localDevelopmentHostnames = new Set(["localhost", "127.0.0.1", "[::1]"]);
const stableTimestamp = "1970-01-01T00:00:00.000Z";

export const localDevelopmentAuthContext: AuthorizedPilotContext = {
  household: {
    created_at: stableTimestamp,
    id: "fameko-local-development-household",
    name: "Lokalt QA-hushåll",
    updated_at: stableTimestamp,
  },
  identity: {
    created_at: stableTimestamp,
    email: null,
    id: "fameko-local-development-identity",
    provider: "fameko_local_development",
    provider_subject: "fameko-local-development-subject",
    updated_at: stableTimestamp,
    user_id: "fameko-local-development-user",
  },
  membership: {
    created_at: stableTimestamp,
    household_id: "fameko-local-development-household",
    role: "owner",
    user_id: "fameko-local-development-user",
  },
  user: {
    created_at: stableTimestamp,
    display_name: "Lokal utveckling",
    id: "fameko-local-development-user",
    status: "active",
    updated_at: stableTimestamp,
  },
};

function isLocalDevelopmentHostname(hostname: string): boolean {
  return localDevelopmentHostnames.has(hostname.toLowerCase());
}

function hostnameFromHostHeader(host: string): string | null {
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return null;
  }
}

export function isLocalDevelopmentRequest(
  request: Request,
  environment: Record<string, string | undefined> = process.env,
): boolean {
  if (environment.NODE_ENV !== "development") {
    return false;
  }

  const hostHeader = request.headers.get("host");
  if (!hostHeader) {
    return false;
  }

  try {
    const requestUrl = new URL(request.url);
    const headerHostname = hostnameFromHostHeader(hostHeader);

    return (
      headerHostname !== null &&
      isLocalDevelopmentHostname(requestUrl.hostname) &&
      isLocalDevelopmentHostname(headerHostname)
    );
  } catch {
    return false;
  }
}

export function getLocalDevelopmentAuthContext(
  request: Request,
  environment: Record<string, string | undefined> = process.env,
): AuthorizedPilotContext | null {
  return isLocalDevelopmentRequest(request, environment)
    ? localDevelopmentAuthContext
    : null;
}
