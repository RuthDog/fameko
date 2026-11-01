import { NextResponse } from "next/server";

import { createAccountExport, AccountDataControlError } from "../../../../../server/account/account-data-control.ts";
import { isSameOriginAccountJsonRequest } from "../../../../../server/account/account-http.ts";
import { authorizeRequest } from "../../../../../server/auth/authorize-request.ts";
import { publicWorkosAuthGate } from "../../../../../server/auth/public-auth-http.ts";
import { getFamekoDatabase } from "../../../../../server/cloudflare/database.ts";

export async function POST(request: Request) {
  const gate = publicWorkosAuthGate(process.env);
  if (!gate.ok || !isSameOriginAccountJsonRequest(request, gate.publicOrigin)) {
    return new Response("Not found", { status: 404 });
  }

  const authorization = await authorizeRequest(request);
  if (!authorization.ok || authorization.mode !== "workos") {
    return NextResponse.json(
      { error: "not_authorized" },
      { headers: { "Cache-Control": "no-store" }, status: 403 },
    );
  }

  try {
    const data = await createAccountExport(
      await getFamekoDatabase(),
      authorization.context,
    );
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": 'attachment; filename="fameko-export.json"',
        "Content-Type": "application/json; charset=utf-8",
        "Referrer-Policy": "no-referrer",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
      },
      status: 200,
    });
  } catch (error) {
    if (error instanceof AccountDataControlError && error.code === "shared_household") {
      return NextResponse.json(
        { error: "shared_household" },
        { headers: { "Cache-Control": "no-store" }, status: 409 },
      );
    }
    return NextResponse.json(
      { error: "export_failed", referenceId: crypto.randomUUID() },
      { headers: { "Cache-Control": "no-store" }, status: 500 },
    );
  }
}
