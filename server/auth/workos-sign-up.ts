import {
  inspectSameOriginFormRequest,
  publicAuthUnavailableResponse,
  publicWorkosAuthGate,
} from "./public-auth-http.ts";
import {
  issueRegistrationAttestation,
  readRegistrationAttestationCookie,
  registrationAttestationDeleteCookie,
  registrationAttestationSetCookie,
  startRegistrationAttestation,
} from "./registration.ts";
import {
  AuthFlowFailure,
  authErrorUrl,
  reportAuthDiagnostic,
  reportAuthFlowFailure,
} from "./auth-diagnostics.ts";

type WorkosSignUpUrlFactory = (options: {
  returnTo: string;
  state: string;
}) => Promise<string>;

function redirect(location: string, setCookie?: string): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    Location: location,
    "Referrer-Policy": "no-referrer",
  });
  if (setCookie) {
    headers.append("Set-Cookie", setCookie);
  }
  return new Response(null, {
    headers,
    status: 303,
  });
}

export async function acceptWorkosSignUp(
  request: Request,
  environment: Record<string, string | undefined>,
): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const gate = publicWorkosAuthGate(environment);
  if (!gate.ok) {
    reportAuthDiagnostic(request, {
      correlationId,
      event: "signup_post_received",
      reason: gate.reason,
      responseStatus: gate.status,
      route: "/sign-up",
    });
    reportAuthDiagnostic(request, {
      correlationId,
      event: "public_auth_unavailable",
      reason: gate.reason,
      responseStatus: gate.status,
      route: "/sign-up",
    });
    return publicAuthUnavailableResponse(gate.status);
  }
  const sameOrigin = inspectSameOriginFormRequest(request);
  if (!sameOrigin.ok) {
    reportAuthDiagnostic(request, {
      correlationId,
      event: "signup_post_received",
      reason: sameOrigin.reason,
      responseStatus: 404,
      route: "/sign-up",
    });
    reportAuthDiagnostic(request, {
      correlationId,
      event: "csrf_rejected",
      reason: sameOrigin.reason,
      responseStatus: 404,
      route: "/sign-up",
    });
    return publicAuthUnavailableResponse(404);
  }

  const form = await request.formData();
  if (form.get("adult-confirmation") !== "confirmed") {
    reportAuthDiagnostic(request, {
      correlationId,
      event: "signup_post_received",
      responseStatus: 303,
      route: "/sign-up",
    });
    return redirect(new URL("/sign-up?error=adult-required", request.url).toString());
  }

  try {
    const attestation = await issueRegistrationAttestation(environment);
    reportAuthDiagnostic(request, {
      correlationId,
      event: "signup_post_received",
      responseStatus: 303,
      route: "/sign-up",
    });
    reportAuthDiagnostic(request, {
      correlationId,
      event: "attestation_issued",
      responseStatus: 303,
      route: "/sign-up",
    });
    return redirect(
      new URL("/auth/start-sign-up", request.url).toString(),
      registrationAttestationSetCookie(attestation.token, attestation.expiresAt),
    );
  } catch {
    const failure = new AuthFlowFailure("sign_up_attestation_issue");
    reportAuthFlowFailure(failure);
    reportAuthDiagnostic(request, {
      correlationId,
      event: "signup_post_received",
      responseStatus: 303,
      route: "/sign-up",
    });
    return redirect(
      authErrorUrl(request.url, failure.correlationId),
      registrationAttestationDeleteCookie(),
    );
  }
}

export async function continueWorkosSignUp(
  request: Request,
  environment: Record<string, string | undefined>,
  createSignUpUrl: WorkosSignUpUrlFactory,
): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const gate = publicWorkosAuthGate(environment);
  if (!gate.ok) {
    reportAuthDiagnostic(request, {
      correlationId,
      event: "start_received",
      reason: gate.reason,
      responseStatus: gate.status,
      route: "/auth/start-sign-up",
    });
    reportAuthDiagnostic(request, {
      correlationId,
      event: "public_auth_unavailable",
      reason: gate.reason,
      responseStatus: gate.status,
      route: "/auth/start-sign-up",
    });
    return publicAuthUnavailableResponse(gate.status);
  }
  const accept = request.headers.get("accept") ?? "";
  const isRsc = request.headers.has("rsc");
  const isPrefetch = request.headers.has("next-router-prefetch")
    || request.headers.get("purpose") === "prefetch"
    || request.headers.get("sec-purpose") === "prefetch";
  if (
    request.method !== "GET"
    || !accept.includes("text/html")
    || isRsc
    || isPrefetch
  ) {
    const reason = request.method !== "GET"
      ? "start_method"
      : !accept.includes("text/html")
        ? "start_accept"
        : isRsc
          ? "start_rsc"
          : "start_prefetch";
    reportAuthDiagnostic(request, {
      correlationId,
      event: "start_received",
      reason,
      responseStatus: 404,
      route: "/auth/start-sign-up",
    });
    return publicAuthUnavailableResponse(404);
  }

  const cookie = readRegistrationAttestationCookie(request);
  const attestation = await startRegistrationAttestation(cookie, environment);
  if (!attestation) {
    const validationResult = cookie ? "invalid_or_expired" : "missing";
    const reason = cookie ? "attestation_invalid_or_expired" : "attestation_missing";
    reportAuthDiagnostic(request, {
      attestationCookiePresent: Boolean(cookie),
      attestationValidationResult: validationResult,
      correlationId,
      event: "start_received",
      reason,
      responseStatus: 303,
      route: "/auth/start-sign-up",
    });
    reportAuthDiagnostic(request, {
      attestationCookiePresent: Boolean(cookie),
      attestationValidationResult: validationResult,
      correlationId,
      event: "attestation_rejected",
      reason,
      responseStatus: 303,
      route: "/auth/start-sign-up",
    });
    return redirect(
      new URL("/sign-up?error=attestation-expired", request.url).toString(),
      registrationAttestationDeleteCookie(),
    );
  }

  try {
    const url = await createSignUpUrl({
      returnTo: "/app",
      state: attestation.token,
    });
    reportAuthDiagnostic(request, {
      attestationCookiePresent: true,
      attestationValidationResult: "issued_valid",
      correlationId,
      event: "start_received",
      responseStatus: 303,
      route: "/auth/start-sign-up",
    });
    reportAuthDiagnostic(request, {
      attestationCookiePresent: true,
      attestationValidationResult: "issued_valid",
      correlationId,
      event: "workos_redirect",
      responseStatus: 303,
      route: "/auth/start-sign-up",
    });
    return redirect(
      url,
      registrationAttestationSetCookie(attestation.token, attestation.expiresAt),
    );
  } catch {
    const failure = new AuthFlowFailure("sign_up_authorization_start");
    reportAuthFlowFailure(failure);
    reportAuthDiagnostic(request, {
      attestationCookiePresent: true,
      attestationValidationResult: "issued_valid",
      correlationId,
      event: "start_received",
      responseStatus: 303,
      route: "/auth/start-sign-up",
    });
    return redirect(
      authErrorUrl(request.url, failure.correlationId),
      registrationAttestationDeleteCookie(),
    );
  }
}
