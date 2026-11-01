import { checkRecentAuth, getWorkOS } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import {
  AccountDataControlError,
  requestAccountDeletion,
  type WorkosDeletionGateway,
} from "../../../../../server/account/account-data-control.ts";
import { isSameOriginAccountJsonRequest } from "../../../../../server/account/account-http.ts";
import { authorizeRequest } from "../../../../../server/auth/authorize-request.ts";
import { publicWorkosAuthGate } from "../../../../../server/auth/public-auth-http.ts";
import { getFamekoDatabase } from "../../../../../server/cloudflare/database.ts";

const confirmationPhrase = "RADERA MITT KONTO";

function isNotFound(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === "object"
    && "status" in error
    && error.status === 404,
  );
}

function workosGateway(): WorkosDeletionGateway {
  const userManagement = getWorkOS().userManagement;
  return {
    async deleteUser(userId) {
      try {
        await userManagement.deleteUser(userId);
        return "deleted";
      } catch (error) {
        if (isNotFound(error)) return "missing";
        throw error;
      }
    },
    async listActiveSessionIds(userId) {
      const sessions = await (await userManagement.listSessions(userId)).autoPagination();
      return sessions.filter((session) => session.status === "active").map((session) => session.id);
    },
    async revokeSession(sessionId) {
      await userManagement.revokeSession({ sessionId });
    },
  };
}

function expiredSessionCookie(): string | null {
  const name = process.env.WORKOS_COOKIE_NAME?.trim();
  if (!name || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u.test(name)) return null;
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

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

  const recent = await checkRecentAuth({ maxAge: 300 });
  if (recent.isStale) {
    return NextResponse.json(
      { error: "reauthentication_required" },
      { headers: { "Cache-Control": "no-store" }, status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }
  if (
    !payload
    || typeof payload !== "object"
    || Object.keys(payload).length !== 1
    || !("confirmation" in payload)
    || payload.confirmation !== confirmationPhrase
  ) {
    return NextResponse.json(
      { error: "confirmation_required" },
      { headers: { "Cache-Control": "no-store" }, status: 400 },
    );
  }

  try {
    const result = await requestAccountDeletion(
      await getFamekoDatabase(),
      authorization.context,
      workosGateway(),
    );
    if (result.status !== "complete") {
      return NextResponse.json(
        { error: "deletion_pending", referenceId: result.jobId },
        { headers: { "Cache-Control": "no-store" }, status: 503 },
      );
    }
    const response = NextResponse.json(
      { redirectTo: "/account-deleted" },
      { headers: { "Cache-Control": "no-store" }, status: 200 },
    );
    const cookie = expiredSessionCookie();
    if (cookie) response.headers.append("Set-Cookie", cookie);
    return response;
  } catch (error) {
    if (error instanceof AccountDataControlError) {
      return NextResponse.json(
        { error: error.code },
        { headers: { "Cache-Control": "no-store" }, status: 409 },
      );
    }
    return NextResponse.json(
      { error: "deletion_failed", referenceId: crypto.randomUUID() },
      { headers: { "Cache-Control": "no-store" }, status: 500 },
    );
  }
}
