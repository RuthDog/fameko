import { getSignUpUrl } from "@workos-inc/authkit-nextjs";

import { continueWorkosSignUp } from "../../../server/auth/workos-sign-up.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return continueWorkosSignUp(request, process.env, getSignUpUrl);
}
