import { getVerifiedWorkosSessionUser } from "../../../server/auth/workos-session.ts";
import {
  accountLinkGate,
  accountLinkUnavailableResponse,
  completeAccountLink,
  getAccountLinkConfirmation,
} from "../../../server/auth/account-link-http.ts";
import { accountLinkConfirmationPage } from "../../../server/auth/account-link-browser.ts";
import { getFamekoDatabase } from "../../../server/cloudflare/database.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = accountLinkGate(process.env);
  if (!gate.ok) {
    return accountLinkUnavailableResponse(gate.status);
  }
  const database = await getFamekoDatabase();
  const verified = await getAccountLinkConfirmation(request, process.env, {
    database,
    workosUserResolver: getVerifiedWorkosSessionUser,
  });
  if (!verified.ok) {
    return accountLinkUnavailableResponse(verified.code === "configuration_missing" ? 503 : 404);
  }
  return accountLinkConfirmationPage(verified.context.state.token);
}

export async function POST(request: Request) {
  const database = await getFamekoDatabase();
  return completeAccountLink(request, process.env, {
    database,
    workosUserResolver: getVerifiedWorkosSessionUser,
  });
}
