import { NextResponse, type NextRequest } from "next/server";
import {
  authorizeRequest,
  type AuthorizationFailureCode,
} from "./server/auth/authorize-request.ts";

type ErrorPresentation = {
  description: string;
  status: number;
  title: string;
};

const errorPresentations: Record<AuthorizationFailureCode, ErrorPresentation> = {
  configuration_missing: {
    description: "Försök igen om en liten stund. Om problemet kvarstår, kontakta Fameko.",
    status: 503,
    title: "Fameko kan inte öppnas just nu",
  },
  database_unavailable: {
    description: "Försök igen om en liten stund. Dina uppgifter är inte tillgängliga just nu.",
    status: 503,
    title: "Fameko kan inte öppnas just nu",
  },
  household_missing: {
    description: "Ditt konto saknar ett hushåll. Kontakta Fameko så hjälper vi dig.",
    status: 403,
    title: "Vi hittar inget hushåll",
  },
  identity_missing: {
    description: "Den här identiteten är inte aktiverad för piloten. Kontakta Fameko om du ska ha tillgång.",
    status: 403,
    title: "Du har inte tillgång ännu",
  },
  token_invalid: {
    description: "Din inloggning kunde inte bekräftas. Gå tillbaka och logga in igen.",
    status: 401,
    title: "Vi kunde inte bekräfta din inloggning",
  },
  token_missing: {
    description: "Gå tillbaka och välj Logga in för att fortsätta till arbetsytan.",
    status: 401,
    title: "Du behöver logga in",
  },
  user_disabled: {
    description: "Ditt pilotkonto är inte aktivt. Kontakta Fameko om du behöver hjälp.",
    status: 403,
    title: "Ditt konto saknar behörighet",
  },
  user_inactive: {
    description: "Ditt pilotkonto är inte aktiverat ännu. Kontakta Fameko så hjälper vi dig.",
    status: 403,
    title: "Ditt konto är inte aktivt",
  },
  user_missing: {
    description: "Ditt pilotkonto är inte färdigaktiverat. Kontakta Fameko så hjälper vi dig.",
    status: 403,
    title: "Vi hittar inte ditt konto",
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function errorPage(error: ErrorPresentation): NextResponse {
  const title = escapeHtml(error.title);
  const description = escapeHtml(error.description);
  const body = `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} – Fameko</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #f7f5ef; color: #1d252d; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 32px 20px; }
      section { width: min(100%, 520px); text-align: center; }
      .brand { margin: 0 0 40px; color: #657663; font-size: 13px; font-weight: 650; letter-spacing: .15em; text-transform: uppercase; }
      h1 { margin: 0; font-size: clamp(30px, 7vw, 44px); line-height: 1.08; letter-spacing: -.04em; }
      p { margin: 20px auto 0; max-width: 440px; color: #57534e; font-size: 16px; line-height: 1.7; }
      a { display: inline-flex; min-height: 46px; align-items: center; justify-content: center; margin-top: 32px; border: 1px solid #d6d3d1; border-radius: 999px; padding: 0 22px; color: #1d252d; font-size: 14px; font-weight: 600; text-decoration: none; }
      a:focus-visible { outline: 2px solid #657663; outline-offset: 4px; }
    </style>
  </head>
  <body>
    <main>
      <section aria-labelledby="error-title">
        <div class="brand">Fameko</div>
        <h1 id="error-title">${title}</h1>
        <p>${description}</p>
        <a href="/">Till startsidan</a>
      </section>
    </main>
  </body>
</html>`;

  return new NextResponse(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
    status: error.status,
  });
}

export async function middleware(request: NextRequest) {
  const authorization = await authorizeRequest(request);

  if (!authorization.ok) {
    return errorPage(errorPresentations[authorization.code]);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-fameko-household-id");
  requestHeaders.delete("x-fameko-user-id");
  requestHeaders.set("x-fameko-household-id", authorization.context.household.id);
  requestHeaders.set("x-fameko-user-id", authorization.context.user.id);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/app/:path*"],
};
