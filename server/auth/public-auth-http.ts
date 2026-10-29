import {
  AuthConfigurationError,
  getAuthMode,
  validateWorkosConfiguration,
  workosStagingAuthMode,
} from "./auth-mode.ts";

export type PublicAuthGate =
  | { ok: true }
  | { ok: false; status: 404 | 503 };

export function publicWorkosAuthGate(
  environment: Record<string, string | undefined>,
): PublicAuthGate {
  try {
    if (getAuthMode(environment) !== workosStagingAuthMode) {
      return { ok: false, status: 404 };
    }
    validateWorkosConfiguration(environment);
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return { ok: false, status: 503 };
    }
    return { ok: false, status: 503 };
  }
}

export function isSameOriginFormRequest(request: Request): boolean {
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
  if (!origin || origin !== new URL(request.url).origin) {
    return false;
  }

  return !fetchSite || fetchSite === "same-origin";
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
