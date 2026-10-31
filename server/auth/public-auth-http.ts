import {
  AuthConfigurationError,
  getAuthMode,
  validateWorkosConfiguration,
  workosStagingAuthMode,
} from "./auth-mode.ts";

export type PublicAuthGate =
  | { ok: true }
  | {
      ok: false;
      reason: "public_auth_configuration" | "public_auth_mode";
      status: 404 | 503;
    };

export type SameOriginFormRequestResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "csrf_content_type"
        | "csrf_method"
        | "csrf_missing_origin"
        | "csrf_origin_mismatch";
    };

export function publicWorkosAuthGate(
  environment: Record<string, string | undefined>,
): PublicAuthGate {
  try {
    if (getAuthMode(environment) !== workosStagingAuthMode) {
      return { ok: false, reason: "public_auth_mode", status: 404 };
    }
    validateWorkosConfiguration(environment);
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return { ok: false, reason: "public_auth_configuration", status: 503 };
    }
    return { ok: false, reason: "public_auth_configuration", status: 503 };
  }
}

export function inspectSameOriginFormRequest(
  request: Request,
): SameOriginFormRequestResult {
  if (request.method !== "POST") {
    return { ok: false, reason: "csrf_method" };
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (
    !contentType.startsWith("application/x-www-form-urlencoded") &&
    !contentType.startsWith("multipart/form-data")
  ) {
    return { ok: false, reason: "csrf_content_type" };
  }

  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin) {
    return origin === new URL(request.url).origin
      ? { ok: true }
      : { ok: false, reason: "csrf_origin_mismatch" };
  }

  return fetchSite === "same-origin"
    ? { ok: true }
    : { ok: false, reason: "csrf_missing_origin" };
}

export function isSameOriginFormRequest(request: Request): boolean {
  return inspectSameOriginFormRequest(request).ok;
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
