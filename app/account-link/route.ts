import { getSignInUrl } from "@workos-inc/authkit-nextjs";

import {
  accountLinkGate,
  accountLinkUnavailableResponse,
  startAccountLink,
} from "../../server/auth/account-link-http.ts";
import { authorizeExistingAccessRequest } from "../../server/auth/authorize-request.ts";
import { getFamekoDatabase } from "../../server/cloudflare/database.ts";

export const dynamic = "force-dynamic";

function page(error: string | null): Response {
  const message = error === "confirmation-required"
    ? "Bekräfta att du vill fortsätta."
    : error
    ? "Övergången kunde inte startas. Försök igen från den här sidan."
    : "";
  const body = `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Byt inloggning – Fameko</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #f7f5ef; color: #1d252d; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 32px 20px; }
      section { width: min(100%, 540px); }
      h1 { margin: 0; font-size: 36px; letter-spacing: -.04em; }
      p { color: #57534e; line-height: 1.65; }
      label { display: flex; gap: 12px; align-items: flex-start; margin: 28px 0; }
      button { min-height: 46px; border: 0; border-radius: 999px; padding: 0 22px; background: #526451; color: white; font: inherit; font-weight: 650; }
      .error { color: #9f1239; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>Behåll ditt befintliga Fameko-konto</h1>
        <p>Du är inloggad med Cloudflare Access. Nästa steg verifierar även din nya WorkOS-identitet. Dina befintliga hushålls- och planeringsuppgifter flyttas inte.</p>
        ${message ? `<p class="error">${message}</p>` : ""}
        <form method="post">
          <label><input name="account-link-confirmation" required type="checkbox" value="confirmed" /><span>Jag vill starta den säkra övergången till WorkOS-inloggning.</span></label>
          <button type="submit">Fortsätt till WorkOS</button>
        </form>
      </section>
    </main>
  </body>
</html>`;
  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

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
  return page(new URL(request.url).searchParams.get("error"));
}

export async function POST(request: Request) {
  const database = await getFamekoDatabase();
  return startAccountLink(request, process.env, {
    createSignInUrl: getSignInUrl,
    database,
    workosUserResolver: async () => null,
  });
}
