import { getSignInUrl } from "@workos-inc/authkit-nextjs";

import { startAccountDeleteReauthentication } from "../../../../server/account/account-delete-reauth.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return startAccountDeleteReauthentication(request, getSignInUrl);
}
