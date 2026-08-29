import { NextResponse } from "next/server";

import { authorizeRequest } from "../auth/authorize-request.ts";

const authorizationStatus = {
  configuration_missing: 503,
  database_unavailable: 503,
  household_missing: 403,
  identity_missing: 403,
  token_invalid: 401,
  token_missing: 401,
  user_disabled: 403,
  user_inactive: 403,
  user_missing: 403,
} as const;

export async function requirePlanningAuthorization(request: Request) {
  const authorization = await authorizeRequest(request);

  if (!authorization.ok) {
    return {
      response: NextResponse.json(
        { message: "Du har inte behörighet att läsa den här ekonomin." },
        { status: authorizationStatus[authorization.code] },
      ),
    };
  }

  return { context: authorization.context };
}

export function isSameOriginJsonRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const origin = request.headers.get("origin");

  if (!contentType.startsWith("application/json") || !origin) {
    return false;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
