import { NextResponse } from "next/server";

import { authorizeRequest } from "../../../../server/auth/authorize-request.ts";

export async function GET(request: Request) {
  const authorization = await authorizeRequest(request);
  if (!authorization.ok) {
    return NextResponse.json(
      { error: "session_unavailable" },
      {
        headers: { "Cache-Control": "no-store", Vary: "Cookie" },
        status: authorization.code === "token_missing" ? 401 : 403,
      },
    );
  }

  return NextResponse.json(
    {
      email: authorization.context.identity.email,
      mode: authorization.mode,
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "Cookie, CF-Access-Jwt-Assertion",
      },
    },
  );
}
