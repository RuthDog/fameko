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
  validateRegistrationCallbackAttestationDetails,
} from "../../../server/auth/registration.ts";
import {
  assertWorkosStagingEmailAllowed,
  getAuthMode,
  isPublicRegistrationEnabled,
  workosStagingAuthMode,
} from "../../../server/auth/auth-mode.ts";
import {
  accountLinkStateCookieName,
} from "../../../server/auth/account-link-state.ts";
import { bindAccountLinkCallback } from "../../../server/auth/account-link-http.ts";
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

async function clearAccountLinkState(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(accountLinkStateCookieName, "", {
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
      const mode = getAuthMode(process.env);
      if (mode === workosStagingAuthMode) {
        step = "callback_allowlist";
        assertWorkosStagingEmailAllowed(authContext.verifiedEmail, process.env);
      }
      const database = await getFamekoDatabase();
      const existingIdentity = await new IdentityRepository(database).findAuthIdentity(
        authContext.provider,
        authContext.providerSubject,
      );
      const cookieStore = await cookies();
      const accountLinkCookie = cookieStore.get(accountLinkStateCookieName)?.value;
      if (mode !== workosStagingAuthMode && accountLinkCookie) {
        step = "callback_attestation";
        await bindAccountLinkCallback(
          state,
          accountLinkCookie,
          user,
          database,
          process.env,
        );
        return;
      }

      step = "callback_attestation";
      const attestationValidation = await validateRegistrationCallbackAttestationDetails(
        state,
        cookieStore.get(registrationAttestationCookieName)?.value,
        process.env,
      );
      const registrationAllowed = mode === workosStagingAuthMode
        || isPublicRegistrationEnabled(process.env);
      if (
        !existingIdentity
        && (
          !registrationAllowed
          || !mayProvisionWorkosIdentity(
            false,
            attestationValidation.result === "valid",
          )
        )
      ) {
        if (attestationValidation.result === "valid") {
          throw new AuthFlowFailure("callback_attestation");
        }
        throw new AuthFlowFailure("callback_attestation", attestationValidation.result);
      }
      step = "callback_provisioning";
      if (!existingIdentity) {
        await provisionWorkosAccountAfterVerifiedCallback(
          database,
          authContext,
          attestationValidation.acceptance,
        );
      }
      step = "callback_cleanup";
      await clearRegistrationAttestation();
    } catch (error) {
      await clearRegistrationAttestation();
      await clearAccountLinkState();
      throw error instanceof AuthFlowFailure ? error : new AuthFlowFailure(step);
    }
  },
  onError: async ({ error, request }) => {
    await clearRegistrationAttestation();
    await clearAccountLinkState();
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
