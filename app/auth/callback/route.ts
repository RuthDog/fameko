import { handleAuth } from "@workos-inc/authkit-nextjs";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { getFamekoDatabase } from "../../../server/cloudflare/database.ts";
import { provisionWorkosAccountAfterVerifiedCallback } from "../../../server/identity/first-login-provisioning.ts";
import { IdentityRepository } from "../../../server/identity/identity-repository.ts";
import {
  publicAuthUnavailableResponse,
  publicWorkosAuthGate,
} from "../../../server/auth/public-auth-http.ts";
import { verifiedAuthContextFromWorkosUser } from "../../../server/auth/workos-auth-context.ts";
import {
  mayProvisionWorkosIdentity,
  registrationAttestationCookieName,
  verifyRegistrationCallbackAttestation,
} from "../../../server/auth/registration.ts";
import { assertWorkosStagingEmailAllowed } from "../../../server/auth/auth-mode.ts";
import {
  AuthFlowFailure,
  authErrorUrl,
  reportAuthFlowFailure,
  type AuthFailureStep,
} from "../../../server/auth/auth-diagnostics.ts";

async function clearRegistrationAttestation(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(registrationAttestationCookieName, "", {
    expires: new Date(0),
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
}

const workosCallback = handleAuth({
  returnPathname: "/app",
  onSuccess: async ({ state, user }) => {
    let step: AuthFailureStep = "callback_identity";
    try {
      const authContext = verifiedAuthContextFromWorkosUser(user);
      step = "callback_allowlist";
      assertWorkosStagingEmailAllowed(authContext.verifiedEmail, process.env);
      const database = await getFamekoDatabase();
      const existingIdentity = await new IdentityRepository(database).findAuthIdentity(
        authContext.provider,
        authContext.providerSubject,
      );
      step = "callback_attestation";
      const cookieStore = await cookies();
      const callbackAttestationValid = await verifyRegistrationCallbackAttestation(
        state,
        cookieStore.get(registrationAttestationCookieName)?.value,
        process.env,
      );
      if (!mayProvisionWorkosIdentity(Boolean(existingIdentity), callbackAttestationValid)) {
        throw new Error("Registration attestation is missing.");
      }
      step = "callback_provisioning";
      await provisionWorkosAccountAfterVerifiedCallback(
        database,
        authContext,
      );
      await clearRegistrationAttestation();
    } catch {
      await clearRegistrationAttestation();
      throw new AuthFlowFailure(step);
    }
  },
  onError: async ({ error, request }) => {
    await clearRegistrationAttestation();
    const failure = error instanceof AuthFlowFailure
      ? error
      : new AuthFlowFailure("callback_exchange");
    reportAuthFlowFailure(failure);
    const response = NextResponse.redirect(
      authErrorUrl(request.url, failure.correlationId),
      303,
    );
    response.headers.set("Cache-Control", "private, no-cache, no-store, max-age=0");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  },
});

export async function GET(request: NextRequest) {
  const gate = publicWorkosAuthGate(process.env);
  if (!gate.ok) {
    return publicAuthUnavailableResponse(gate.status);
  }
  return workosCallback(request);
}
