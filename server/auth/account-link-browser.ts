const accountLinkStartFormAction =
  "'self' https://api.workos.com https://proactive-myth-55.authkit.app";

function documentHeaders(formAction: string): HeadersInit {
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; form-action ${formAction}; base-uri 'none'; frame-ancestors 'none'`,
    "Content-Type": "text/html; charset=utf-8",
    "Referrer-Policy": "strict-origin",
    "X-Content-Type-Options": "nosniff",
  };
}

export function accountLinkStartPage(error: string | null): Response {
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
        <form action="/account-link" method="post">
          <label><input name="account-link-confirmation" required type="checkbox" value="confirmed" /><span>Jag vill starta den säkra övergången till WorkOS-inloggning.</span></label>
          <button type="submit">Fortsätt till WorkOS</button>
        </form>
      </section>
    </main>
  </body>
</html>`;
  return new Response(body, {
    headers: documentHeaders(accountLinkStartFormAction),
  });
}

export function accountLinkConfirmationPage(state: string): Response {
  const escapedState = state
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const body = `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bekräfta inloggningsbyte – Fameko</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #f7f5ef; color: #1d252d; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 32px 20px; }
      section { width: min(100%, 540px); }
      h1 { margin: 0; font-size: 36px; letter-spacing: -.04em; }
      p { color: #57534e; line-height: 1.65; }
      label { display: flex; gap: 12px; align-items: flex-start; margin: 28px 0; }
      button { min-height: 46px; border: 0; border-radius: 999px; padding: 0 22px; background: #526451; color: white; font: inherit; font-weight: 650; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>Bekräfta övergången</h1>
        <p>Både din befintliga Cloudflare Access-identitet och din nya WorkOS-identitet har verifierats. Bekräfta för att koppla WorkOS till samma befintliga Fameko-konto och hushåll.</p>
        <form action="/account-link/confirm" method="post">
          <input name="account-link-state" type="hidden" value="${escapedState}" />
          <label><input name="account-link-confirmation" required type="checkbox" value="confirmed" /><span>Jag bekräftar att WorkOS-identiteten ska kopplas till mitt befintliga Fameko-konto.</span></label>
          <button type="submit">Bekräfta inloggningsbytet</button>
        </form>
      </section>
    </main>
  </body>
</html>`;
  return new Response(body, {
    headers: documentHeaders("'self'"),
  });
}
