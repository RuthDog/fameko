export type AuthFailureStep =
  | "callback_allowlist"
  | "callback_attestation"
  | "callback_cleanup"
  | "callback_exchange"
  | "callback_identity"
  | "callback_provisioning"
  | "sign_up_attestation_issue"
  | "sign_up_authorization_start";

export type AuthFailureReason =
  | "configuration_error"
  | "expired"
  | "invalid_payload"
  | "invalid_signature"
  | "missing"
  | "state_mismatch"
  | "wrong_phase";

export class AuthFlowFailure extends Error {
  readonly correlationId: string;
  readonly reason?: AuthFailureReason;
  readonly step: AuthFailureStep;

  constructor(step: AuthFailureStep, reason?: AuthFailureReason) {
    super("Authentication flow failed.");
    this.name = "AuthFlowFailure";
    this.correlationId = crypto.randomUUID();
    this.reason = reason;
    this.step = step;
  }
}

export function reportAuthFlowFailure(failure: AuthFlowFailure): void {
  console.error(JSON.stringify({
    correlationId: failure.correlationId,
    event: "fameko_auth_failure",
    ...(failure.reason ? { reason: failure.reason } : {}),
    step: failure.step,
  }));
}

export function authErrorUrl(requestUrl: string, correlationId: string): string {
  const url = new URL("/auth/error", requestUrl);
  url.searchParams.set("ref", correlationId);
  return url.toString();
}
