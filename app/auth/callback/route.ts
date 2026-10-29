import { handleAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse, type NextRequest } from "next/server";

import { getFamekoDatabase } from "../../../server/cloudflare/database.ts";
import { provisionWorkosAccountAfterVerifiedCallback } from "../../../server/identity/first-login-provisioning.ts";
import { IdentityRepository } from "../../../server/identity/identity-repository.ts";
import {
  publicAuthUnavailableResponse,
  publicWorkosAuthGate,
} from "../../../server/auth/public-auth-http.ts";
import { verifiedAuthContextFromWorkosUser } from "../../../server/auth/workos-auth-context.ts";
import { mayProvisionWorkosIdentity } from "../../../server/auth/registration.ts";

const workosCallback = handleAuth({
  returnPathname: "/app",
  onSuccess: async ({ state, user }) => {
    try {
      const authContext = verifiedAuthContextFromWorkosUser(user);
      const database = await getFamekoDatabase();
      const existingIdentity = await new IdentityRepository(database).findAuthIdentity(
        authContext.provider,
        authContext.providerSubject,
      );
      if (!mayProvisionWorkosIdentity(Boolean(existingIdentity), state)) {
        throw new Error("Registration attestation is missing.");
      }
      await provisionWorkosAccountAfterVerifiedCallback(
        database,
        authContext,
      );
    } catch {
      throw new Error("Callback provisioning failed.");
    }
  },
  onError: async ({ request }) => {
    const response = NextResponse.redirect(new URL("/auth/error", request.url), 303);
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
