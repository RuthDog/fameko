import {
  isSameOriginFormRequest,
  publicAuthUnavailableResponse,
  publicWorkosAuthGate,
} from "./public-auth-http.ts";
import {
  issueRegistrationAttestation,
  readRegistrationAttestationCookie,
  registrationAttestationDeleteCookie,
  registrationAttestationSetCookie,
  startRegistrationAttestation,
  type RegistrationIntent,
} from "./registration.ts";
import {
  AuthFlowFailure,
  authErrorUrl,
  reportAuthFlowFailure,
} from "./auth-diagnostics.ts";
import {
  currentPrivacyDocumentVersion,
  currentTermsDocumentVersion,
} from "../legal/legal-versions.ts";

type WorkosAuthorizationUrlFactory = (options: {
  returnTo: string;
  state: string;
}) => Promise<string>;

type WorkosRegistrationUrlFactories = {
  createSignInUrl: WorkosAuthorizationUrlFactory;
  createSignUpUrl: WorkosAuthorizationUrlFactory;
};

function registrationIntent(form: FormData): RegistrationIntent | null {
  const values = form.getAll("registration-intent");
  if (values.length !== 1) {
    return null;
  }
  const [value] = values;
  return value === "create" || value === "recover" ? value : null;
}

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
  const gate = publicWorkosAuthGate(environment);
  if (!gate.ok) {
    return publicAuthUnavailableResponse(gate.status);
  }
  if (!isSameOriginFormRequest(request, gate.publicOrigin)) {
    return publicAuthUnavailableResponse(404);
  }

  const form = await request.formData();
  if (form.get("adult-confirmation") !== "confirmed") {
    return redirect(
      new URL("/sign-up?error=adult-required", gate.publicOrigin).toString(),
    );
  }
  if (
    form.get("terms-confirmation") !== currentTermsDocumentVersion
    || form.get("privacy-version") !== currentPrivacyDocumentVersion
  ) {
    return redirect(
      new URL("/sign-up?error=terms-required", gate.publicOrigin).toString(),
    );
  }
  const intent = registrationIntent(form);
  if (!intent) {
    return publicAuthUnavailableResponse(404);
  }

  try {
    const attestation = await issueRegistrationAttestation(environment, intent);
    return redirect(
      new URL("/auth/start-sign-up", gate.publicOrigin).toString(),
      registrationAttestationSetCookie(attestation.token, attestation.expiresAt),
    );
  } catch {
    const failure = new AuthFlowFailure("sign_up_attestation_issue");
    reportAuthFlowFailure(failure);
    return redirect(
      authErrorUrl(gate.publicOrigin, failure.correlationId),
      registrationAttestationDeleteCookie(),
    );
  }
}

export async function continueWorkosSignUp(
  request: Request,
  environment: Record<string, string | undefined>,
  factories: WorkosRegistrationUrlFactories,
): Promise<Response> {
  const gate = publicWorkosAuthGate(environment);
  if (!gate.ok) {
    return publicAuthUnavailableResponse(gate.status);
  }
  const accept = request.headers.get("accept") ?? "";
  const isPrefetch = request.headers.has("next-router-prefetch")
    || request.headers.has("rsc")
    || request.headers.get("purpose") === "prefetch"
    || request.headers.get("sec-purpose") === "prefetch";
  if (request.method !== "GET" || !accept.includes("text/html") || isPrefetch) {
    return publicAuthUnavailableResponse(404);
  }

  const attestation = await startRegistrationAttestation(
    readRegistrationAttestationCookie(request),
    environment,
  );
  if (!attestation) {
    return redirect(
      new URL("/sign-up?error=attestation-expired", gate.publicOrigin).toString(),
      registrationAttestationDeleteCookie(),
    );
  }

  try {
    const createAuthorizationUrl = attestation.intent === "recover"
      ? factories.createSignInUrl
      : factories.createSignUpUrl;
    const url = await createAuthorizationUrl({
      returnTo: "/app",
      state: attestation.token,
    });
    return redirect(
      url,
      registrationAttestationSetCookie(attestation.token, attestation.expiresAt),
    );
  } catch {
    const failure = new AuthFlowFailure("sign_up_authorization_start");
    reportAuthFlowFailure(failure);
    return redirect(
      authErrorUrl(gate.publicOrigin, failure.correlationId),
      registrationAttestationDeleteCookie(),
    );
  }
}
