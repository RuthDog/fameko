import { authorizeRequest } from "../auth/authorize-request.ts";
import { publicWorkosAuthGate, isSameOriginFormRequest } from "../auth/public-auth-http.ts";
import { getFamekoDatabase } from "../cloudflare/database.ts";
import {
  currentPrivacyDocumentVersion,
  currentTermsDocumentVersion,
} from "./legal-versions.ts";
import {
  recordCurrentTermsAcceptance,
  safePostAcceptancePath,
} from "./legal-acceptance.ts";

type LegalAcceptanceDependencies = {
  authorize?: typeof authorizeRequest;
  database?: D1Database;
  now?: Date;
};

function redirect(location: string): Response {
  return new Response(null, {
    headers: {
      "Cache-Control": "no-store",
      Location: location,
      "Referrer-Policy": "no-referrer",
    },
    status: 303,
  });
}

function unavailable(status: 403 | 404 | 503): Response {
  return new Response(status === 404 ? "Not found" : "Acceptance unavailable", {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
    status,
  });
}

export async function acceptCurrentLegalTerms(
  request: Request,
  environment: Record<string, string | undefined>,
  dependencies: LegalAcceptanceDependencies = {},
): Promise<Response> {
  const gate = publicWorkosAuthGate(environment);
  if (!gate.ok) {
    return unavailable(gate.status);
  }
  if (!isSameOriginFormRequest(request, gate.publicOrigin)) {
    return unavailable(404);
  }

  const form = await request.formData();
  const returnTo = safePostAcceptancePath(form.get("return-to"));
  if (
    form.get("terms-confirmation") !== currentTermsDocumentVersion
    || form.get("privacy-version") !== currentPrivacyDocumentVersion
  ) {
    return redirect(
      new URL("/app/legal/accept?error=terms-required", gate.publicOrigin).toString(),
    );
  }

  const database = dependencies.database ?? await getFamekoDatabase();
  const authorization = await (dependencies.authorize ?? authorizeRequest)(request, {
    allowWithoutCurrentTerms: true,
    database,
    environment,
  });
  if (!authorization.ok || authorization.mode !== "workos") {
    return unavailable(authorization.ok ? 403 : authorization.code === "token_missing" ? 403 : 503);
  }

  try {
    await recordCurrentTermsAcceptance(
      database,
      authorization.context,
      dependencies.now,
    );
    return redirect(new URL(returnTo, gate.publicOrigin).toString());
  } catch {
    return unavailable(503);
  }
}
