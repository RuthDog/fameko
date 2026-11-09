import { getSignInUrl } from "@workos-inc/authkit-nextjs";

import {
  accountLinkGate,
  accountLinkUnavailableResponse,
  startAccountLink,
} from "../../server/auth/account-link-http.ts";
import { accountLinkStartPage } from "../../server/auth/account-link-browser.ts";
import { authorizeExistingAccessRequest } from "../../server/auth/authorize-request.ts";
import { getFamekoDatabase } from "../../server/cloudflare/database.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = accountLinkGate(process.env);
  if (!gate.ok) {
    return accountLinkUnavailableResponse(gate.status);
  }
  const database = await getFamekoDatabase();
  const access = await authorizeExistingAccessRequest(request, {
    database,
    environment: process.env,
  });
  if (!access.ok) {
    return accountLinkUnavailableResponse(access.code === "token_missing" ? 404 : 503);
  }
  return accountLinkStartPage(new URL(request.url).searchParams.get("error"));
}

export async function POST(request: Request) {
  const database = await getFamekoDatabase();
  return startAccountLink(request, process.env, {
    createSignInUrl: getSignInUrl,
    database,
    workosUserResolver: async () => null,
  });
}
