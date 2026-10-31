import {
  publicAuthUnavailableResponse,
  publicWorkosAuthGate,
} from "../../server/auth/public-auth-http.ts";
import { acceptWorkosSignUp } from "../../server/auth/workos-sign-up.ts";
import {
  currentPrivacyDocumentVersion,
  currentTermsDocumentVersion,
} from "../../server/legal/legal-versions.ts";

function registrationPage(request: Request): Response {
  const showAdultError = new URL(request.url).searchParams.get("error") === "adult-required";
  const error = showAdultError
    ? '<p id="form-error" role="alert">Du måste bekräfta att du är minst 18 år.</p>'
    : "";
  const showExpiredError = new URL(request.url).searchParams.get("error")
    === "attestation-expired";
  const showTermsError = new URL(request.url).searchParams.get("error")
    === "terms-required";
  const registrationError = showTermsError
    ? '<p id="form-error" role="alert">Du måste godkänna användarvillkoren för att skapa eller slutföra ett konto.</p>'
    : showExpiredError
    ? '<p id="form-error" role="alert">Registreringen hann g&aring; ut. Bekr&auml;fta din &aring;lder och f&ouml;rs&ouml;k igen.</p>'
    : error;
  const body = `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Skapa konto – Fameko</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #f7f5ef; color: #1d252d; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 32px 20px; }
      section { width: min(100%, 520px); border: 1px solid #e7e5e4; border-radius: 24px; background: white; padding: 32px; box-shadow: 0 18px 56px rgba(28,25,23,.06); }
      .brand { color: #657663; font-size: 13px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
      h1 { margin: 18px 0 0; font-size: 34px; letter-spacing: -.04em; }
      p { color: #57534e; line-height: 1.65; }
      label { display: flex; gap: 12px; margin-top: 18px; line-height: 1.5; }
      input { width: 20px; height: 20px; flex: 0 0 auto; }
      input[type="hidden"] { display: none; }
      .notice { margin-top: 20px; border-radius: 16px; background: #eef2ea; padding: 16px; font-size: 14px; }
      .draft { border: 1px solid #f4d99b; border-radius: 12px; background: #fffbeb; color: #713f12; padding: 10px 12px; font-size: 13px; font-weight: 650; }
      .actions { display: grid; gap: 12px; margin-top: 24px; }
      button { width: 100%; min-height: 48px; border: 0; border-radius: 999px; background: #1d252d; color: white; font: inherit; font-weight: 700; cursor: pointer; }
      button.secondary { border: 1px solid #d6d3d1; background: white; color: #1d252d; }
      a { color: #3f5140; }
      #form-error { color: #9f1239; font-weight: 650; }
    </style>
  </head>
  <body>
    <main>
      <section aria-labelledby="registration-title">
        <div class="brand">Fameko</div>
        <h1 id="registration-title">Skapa konto</h1>
        <p>Fameko är ett frivilligt planeringsverktyg för vuxna. Du väljer själv vilka ekonomiska belopp och detaljer du anger.</p>
        <div class="notice">Registreringen använder endast din e-postadress och en e-postkod som identifikationsuppgifter. Vi använder e-postadressen för säker inloggning och för att koppla din planering till rätt konto. <a href="/privacy">Läs arbetsutkastet till integritetspolicy</a>.</div>
        <p class="draft">Staging: policy och villkor är arbetsutkast och inte slutligt godkända.</p>
        ${registrationError}
        <form action="/sign-up" method="post">
          <label><input name="adult-confirmation" required type="checkbox" value="confirmed" /><span>Jag bekräftar att jag är minst 18 år.</span></label>
          <label><input name="terms-confirmation" required type="checkbox" value="${currentTermsDocumentVersion}" /><span>Jag har läst och godkänner <a href="/terms">arbetsutkastet till användarvillkor</a> (${currentTermsDocumentVersion}). Detta är ett avtalsgodkännande, inte ett generellt GDPR-samtycke.</span></label>
          <input name="privacy-version" type="hidden" value="${currentPrivacyDocumentVersion}" />
          <div class="actions">
            <button name="registration-intent" type="submit" value="create">Skapa nytt konto</button>
            <button class="secondary" name="registration-intent" type="submit" value="recover">Jag har redan påbörjat registreringen</button>
          </div>
        </form>
        <p>Har du redan ett konto? <a href="/sign-in">Logga in</a>.</p>
      </section>
    </main>
  </body>
</html>`;

  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://api.workos.com https://spontaneous-theme-13-staging.authkit.app; base-uri 'none'; frame-ancestors 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "strict-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function GET(request: Request) {
  const gate = publicWorkosAuthGate(process.env);
  if (!gate.ok) {
    return publicAuthUnavailableResponse(gate.status);
  }
  return registrationPage(request);
}

export async function POST(request: Request) {
  return acceptWorkosSignUp(request, process.env);
}
