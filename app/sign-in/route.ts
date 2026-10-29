import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import {
  publicAuthUnavailableResponse,
  publicWorkosAuthGate,
} from "../../server/auth/public-auth-http.ts";

export async function GET(request: Request) {
  const gate = publicWorkosAuthGate(process.env);
  if (!gate.ok) {
    return publicAuthUnavailableResponse(gate.status);
  }

  try {
    const url = await getSignInUrl({ returnTo: "/app" });
    const response = NextResponse.redirect(url, 303);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    const response = NextResponse.redirect(new URL("/auth/error", request.url), 303);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
