export type AuthFailureStep =
  | "callback_allowlist"
  | "callback_attestation"
  | "callback_exchange"
  | "callback_identity"
  | "callback_provisioning"
  | "sign_up_attestation_issue"
  | "sign_up_authorization_start";

export type AuthDiagnosticEvent =
  | "attestation_issued"
  | "attestation_rejected"
  | "csrf_rejected"
  | "public_auth_unavailable"
  | "signup_post_received"
  | "start_received"
  | "workos_redirect";

export type AuthDiagnosticReason =
  | "attestation_invalid_or_expired"
  | "attestation_missing"
  | "csrf_content_type"
  | "csrf_method"
  | "csrf_missing_origin"
  | "csrf_origin_mismatch"
  | "none"
  | "public_auth_configuration"
  | "public_auth_mode"
  | "start_accept"
  | "start_method"
  | "start_prefetch"
  | "start_rsc";

export type AttestationValidationResult =
  | "invalid_or_expired"
  | "issued_valid"
  | "missing"
  | "not_checked";

type AuthDiagnosticOptions = {
  attestationCookiePresent?: boolean;
  attestationValidationResult?: AttestationValidationResult;
  correlationId: string;
  event: AuthDiagnosticEvent;
  reason?: AuthDiagnosticReason;
  responseStatus: number;
  route: "/auth/start-sign-up" | "/sign-up";
};

function classifiedFetchSite(request: Request):
  | "cross-site"
  | "missing"
  | "none"
  | "other"
  | "same-origin"
  | "same-site" {
  const value = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (
    value === "cross-site"
    || value === "none"
    || value === "same-origin"
    || value === "same-site"
  ) {
    return value;
  }
  return value ? "other" : "missing";
}

export function reportAuthDiagnostic(
  request: Request,
  options: AuthDiagnosticOptions,
): void {
  const origin = request.headers.get("origin");
  const accept = request.headers.get("accept") ?? "";
  const isRsc = request.headers.has("rsc");
  const isPrefetch = request.headers.has("next-router-prefetch")
    || request.headers.get("purpose") === "prefetch"
    || request.headers.get("sec-purpose") === "prefetch";

  console.info(JSON.stringify({
    accepts_html: accept.includes("text/html"),
    attestation_cookie_present: options.attestationCookiePresent ?? false,
    attestation_validation_result:
      options.attestationValidationResult ?? "not_checked",
    correlation_id: options.correlationId,
    diagnostic_event: options.event,
    event: "fameko_auth_diagnostic",
    internal_reason: options.reason ?? "none",
    is_prefetch: isPrefetch,
    is_rsc: isRsc,
    method: request.method,
    origin_matches: Boolean(origin) && origin === new URL(request.url).origin,
    origin_present: Boolean(origin),
    response_status: options.responseStatus,
    route: options.route,
    sec_fetch_site: classifiedFetchSite(request),
  }));
}

export class AuthFlowFailure extends Error {
  readonly correlationId: string;
  readonly step: AuthFailureStep;

  constructor(step: AuthFailureStep) {
    super("Authentication flow failed.");
    this.name = "AuthFlowFailure";
    this.correlationId = crypto.randomUUID();
    this.step = step;
  }
}

export function reportAuthFlowFailure(failure: AuthFlowFailure): void {
  console.error(JSON.stringify({
    correlationId: failure.correlationId,
    event: "fameko_auth_failure",
    step: failure.step,
  }));
}

export function authErrorUrl(requestUrl: string, correlationId: string): string {
  const url = new URL("/auth/error", requestUrl);
  url.searchParams.set("ref", correlationId);
  return url.toString();
}
