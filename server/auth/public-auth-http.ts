import {
  AuthConfigurationError,
  getAuthMode,
  isPublicRegistrationEnabled,
  isWorkosAuthMode,
  validateWorkosConfiguration,
} from "./auth-mode.ts";

export type PublicAuthGate =
  | { ok: true; publicOrigin: string }
  | { ok: false; status: 404 | 503 };

export function publicWorkosAuthGate(
  environment: Record<string, string | undefined>,
): PublicAuthGate {
  try {
    if (!isWorkosAuthMode(getAuthMode(environment))) {
      return { ok: false, status: 404 };
    }
    const { publicOrigin } = validateWorkosConfiguration(environment);
    return { ok: true, publicOrigin };
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return { ok: false, status: 503 };
    }
    return { ok: false, status: 503 };
  }
}

export function publicWorkosRegistrationGate(
  environment: Record<string, string | undefined>,
): PublicAuthGate {
  const gate = publicWorkosAuthGate(environment);
  if (!gate.ok) {
    return gate;
  }
  try {
    return isPublicRegistrationEnabled(environment)
      ? gate
      : { ok: false, status: 404 };
  } catch {
    return { ok: false, status: 503 };
  }
}

export function isSameOriginFormRequest(
  request: Request,
  trustedPublicOrigin: string,
): boolean {
  if (request.method !== "POST") {
    return false;
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (
    !contentType.startsWith("application/x-www-form-urlencoded") &&
    !contentType.startsWith("multipart/form-data")
  ) {
    return false;
  }

  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin) {
    return origin === trustedPublicOrigin && fetchSite !== "cross-site";
  }

  return fetchSite === "same-origin";
}

export function publicAuthUnavailableResponse(status: 404 | 503): Response {
  return new Response(status === 404 ? "Not found" : "Authentication unavailable", {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
    status,
  });
}
