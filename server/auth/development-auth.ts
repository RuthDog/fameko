import type { AuthorizedPilotContext } from "../identity/identity-types.ts";

const loopbackDevelopmentHostnames = new Set(["localhost", "127.0.0.1", "::1"]);
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

function normalizeHostname(hostname: string): string {
  const normalized = hostname.toLowerCase();

  return normalized.startsWith("[") && normalized.endsWith("]")
    ? normalized.slice(1, -1)
    : normalized;
}

function parseCanonicalIpv4(hostname: string): [number, number, number, number] | null {
  const parts = hostname.split(".");

  if (
    parts.length !== 4 ||
    parts.some((part) => !/^(0|[1-9]\d{0,2})$/.test(part))
  ) {
    return null;
  }

  const octets = parts.map(Number);

  return octets.every((octet) => octet <= 255)
    ? (octets as [number, number, number, number])
    : null;
}

function isDevelopmentBypassHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);

  if (loopbackDevelopmentHostnames.has(normalized)) {
    return true;
  }

  const octets = parseCanonicalIpv4(normalized);

  if (!octets) {
    return false;
  }

  const [first, second] = octets;

  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isValidPort(port: string | undefined): boolean {
  if (port === undefined) {
    return true;
  }

  return /^\d{1,5}$/.test(port) && Number(port) <= 65_535;
}

function hostnameFromHostHeader(host: string): string | null {
  if (!host || host !== host.trim()) {
    return null;
  }

  const bracketedIpv6 = host.match(/^\[([^\]]+)\](?::(\d+))?$/);

  if (bracketedIpv6) {
    return isValidPort(bracketedIpv6[2]) ? bracketedIpv6[1] : null;
  }

  const hostnameWithOptionalPort = host.match(/^([^:]+)(?::(\d+))?$/);

  if (!hostnameWithOptionalPort || !isValidPort(hostnameWithOptionalPort[2])) {
    return null;
  }

  return hostnameWithOptionalPort[1];
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
    const requestHostname = normalizeHostname(requestUrl.hostname);
    const normalizedHeaderHostname = headerHostname
      ? normalizeHostname(headerHostname)
      : null;

    return (
      normalizedHeaderHostname !== null &&
      isDevelopmentBypassHostname(requestHostname) &&
      isDevelopmentBypassHostname(normalizedHeaderHostname)
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
