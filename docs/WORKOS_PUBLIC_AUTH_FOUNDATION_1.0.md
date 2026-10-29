# Fameko – WorkOS Public Authentication Integration Foundation 1.0

Status: lokal integrationsgrund. Inte godkänd för publik registrering, deploy eller
databasmigrering.

## Avgränsning

Implementationen är byggd för två explicita runtime-lägen:

- `cloudflare_access`: befintlig Cloudflare Access-JWT, befintlig intern identitet
  och nuvarande pilotprovisionering.
- `workos_staging`: AuthKit-session med WorkOS-subject kopplat till
  `auth_identities`. Okänd identitet nekas på vanliga `/app`- och API-anrop.

`FAMEKO_AUTH_MODE` måste finnas och ha ett av dessa två värden. Saknat eller okänt
läge, saknade secrets och ogiltiga callback-/issuer-URL:er ger fail-closed. Lokal
utvecklingsauth behåller sin redan avgränsade loopback/LAN-kodväg.

Ingen produktions- eller stagingkonfiguration ändras i denna sprint. En framtida
deploy av branchen kräver därför ett separat konfigurationsbeslut innan trafik får
skickas till koden.

## Server-side identitetskedja

```text
Cloudflare Access JWT ─┐
                      ├─ VerifiedAuthContext(provider, subject, verified email)
WorkOS AuthKit user ───┘
                                   │
                                   ▼
                  auth_identities(provider, provider_subject)
                                   │
                                   ▼
                 users → household_members → households
                                   │
                                   ▼
                         household-scoped PlanningYear
```

Intern `user_id` och `household_id` är fortsatt auktoritativa. E-post normaliseras
och lagras som kontakt-/revisionsuppgift men används aldrig ensam för identitetskoppling.
Klientstyrda Fameko-identitetsheaders tas bort i middleware och ersätts med värden
från serverns resolver.

## WorkOS-flöde

1. `/sign-in` startar Hosted UI sign-in i en Route Handler.
2. `POST /sign-up` kräver same-origin-formulär och vuxenbekräftelse innan Hosted UI
   startas. Bekräftelsen binds i det signerade/PKCE-skyddade callback-state som
   `adult-confirmed-v1`.
3. `/auth/callback` använder AuthKit SDK:ns code exchange, PKCE och state-kontroll.
4. Endast callbackens verifierade `onSuccess` får skapa ny intern användare,
   hushåll, owner-medlemskap, WorkOS-identitet och första planeringsår.
5. D1-batchen och unikheten på `(provider, provider_subject)` gör callbacken
   idempotent. Samtidiga callbacks konvergerar till samma interna graf.
6. Ett normalt GET-/API-anrop med okänt WorkOS-subject nekas med
   `identity_missing`; det får inte provisionera.
7. Middleware validerar/refreshar AuthKit-sessionen och förmedlar endast SDK:ns
   tillåtna request-/responseheaders. Transienta refreshfel bevarar cookien och
   ger ett generiskt tillfälligt fel.
8. Logout ligger i en Server Action. WorkOS-cookien raderas och WorkOS logout
   anropas; legacy-läget använder Cloudflare Access logout.

AuthKit SDK är låst till `@workos-inc/authkit-nextjs@4.4.0` och
`@workos-inc/node@10.14.0`. Runtime måste sätta minst:

- `FAMEKO_AUTH_MODE=workos_staging`
- `WORKOS_CLIENT_ID` (icke-hemlig runtimekonfiguration)
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI` (icke-hemlig runtimekonfiguration)
- `WORKOS_ISSUER` (förväntad HTTPS-issuer, exempelvis WorkOS standardissuer)
- `WORKOS_API_KEY` som Cloudflare secret
- `WORKOS_COOKIE_PASSWORD` som unik Cloudflare secret, minst 32 tecken

Rekommenderad explicit cookiekonfiguration inför aktivering är
`WORKOS_COOKIE_SAMESITE=lax`, HTTPS callback och en beslutad
`WORKOS_COOKIE_MAX_AGE`. Den låsta SDK-versionen sätter sessionscookien HttpOnly,
Secure för HTTPS och SameSite. Access-/refresh-token får aldrig loggas eller skickas
till klientkod.

## Kontoprovisionering

Nytt konto skapar exakt:

- en `users`-rad med nytt internt UUID;
- ett nytt hushåll;
- ett owner-medlemskap;
- en `auth_identities`-rad med provider `workos` och WorkOS user id;
- ett tomt planeringsår med aktuell schemastruktur.

Samma e-post som en befintlig pilot skapar fortfarande en separat intern användare
och ett separat hushåll. Detta är avsiktligt: en e-postmatchning är inte ett bevis
för rätt att ta över pilotens data.

## Pilotlänkning – förslag som kräver separat D1-godkännande

Ingen pilot länkas i denna sprint. En säker engångsprocess behöver minst en ny
server-side tabell, exempelvis `account_link_grants`, med:

- slumpmässigt grant-id och hash av en engångstoken;
- befintligt `user_id`;
- exakt källprovider och källsubject;
- exakt målprovider och målsubject;
- `expires_at`, `consumed_at`, `revoked_at` och revisionsmetadata;
- unikhet för aktiv målidentitet och foreign keys till användare.

Föreslaget flöde:

1. Piloten autentiserar sig med befintlig Cloudflare-identitet.
2. Servern skapar en kortlivad engångsgrant för exakt internt `user_id`; tokenvärdet
   lagras endast hashat.
3. Samma browser genomför WorkOS-inloggning. Callbacken måste matcha grantens exakta
   målsubject, inte bara e-post.
4. I en enda D1-transaktion infogas WorkOS-identiteten på befintligt `user_id` och
   granten konsumeras. Inga hushåll eller PlanningYear flyttas.
5. Vid fel rullas hela transaktionen tillbaka. Innan legacy-identiteten tas bort
   verifieras separat att WorkOS-inloggning fungerar.
6. Återställning innebär att WorkOS-identiteten tas bort/inaktiveras och den
   befintliga Cloudflare-identiteten behålls. Händelsen måste revisionsloggas utan
   token eller ekonomiska värden.

Domänlogiken i `account-linking.ts` kräver en exakt, ej konsumerad och ej utgången
subject-grant. Persistens, migrations-SQL och routes får inte införas utan separat
godkännande.

## Konto, logout och sessionsbyte

Kontomenyn visar konto/e-post och logout. Vid osparade ändringar erbjuds:

- Spara och logga ut;
- Fortsätt redigera;
- Logga ut utan att spara.

Spara-och-logout fortsätter endast om Cloud Save lyckas. Befintligt
`sessionContextId`, bundet till internt user/hushåll, kontrolleras vid fokus och före
mutation. Om sessionen byts döljs ekonomin och saves blockeras.

## Säkerhetsstatus

Implementerat eller automatiskt verifierat:

- AuthKit PKCE/state och callback cookiehantering via låst SDK;
- same-origin POST och vuxen-state för registreringsstart;
- explicit issuer, mode och secret-gates;
- signerad sessionvalidering och proaktiv refresh via AuthKit middleware;
- callback-only, atomisk och idempotent provisionering;
- serverhärledd hushållsscope och skydd mot klientheaders;
- no-store för authfel, sessionssammanfattning och privata API/PDF-flöden;
- generiska publika fel utan kontobesked eller providerdetaljer;
- inga WorkOS-secrets i klientkomponenter eller källkonfiguration.

Kvarstående säkerhetsgates före publik aktivering:

- verklig Hosted UI/OTP/callback/refresh/logout E2E på avsedd publik staginghost;
- verifiering av cookieflaggor i faktisk browser och Cloudflare Worker;
- leverantörs- och Cloudflare-rate-limit/bot-skydd med dokumenterade trösklar;
- adversarial tvåanvändartest mot live staging, inklusive stale revision och
  sessionsbyte;
- logggranskning som bekräftar att callbackfel aldrig innehåller code, token,
  cookie eller ekonomiska värden;
- blockerad direkt workers.dev/preview-åtkomst;
- säkerhetsgranskning av SDK-uppdateringar och sessionstider.

Ingen publik registrering får aktiveras om någon av dessa gates saknas.

## GDPR-inventering – inte juridiskt godkänd

Tekniskt berörda datakategorier:

- e-postadress, WorkOS user id och verifieringsstatus;
- sessions-id, access-/refresh-token i krypterad HttpOnly-cookie;
- autentiseringstid, metod, IP-/user-agent- och säkerhetshändelser hos leverantören;
- Famekos interna user-/household-id och providerkoppling i D1.

Ekonomiska PlanningYear-värden skickas inte till WorkOS av denna integration.

Officiella WorkOS-källor som måste granskas och avtalsmässigt verifieras:

- DPA: https://workos.com/legal/data-processing-addendum
- underbiträden: https://trust.workos.com/subprocessors
- integritetspolicy: https://workos.com/legal/privacy
- sessionsmodell: https://workos.com/docs/authkit/sessions

WorkOS DPA beskriver bland annat behandling för tjänstens utförande,
underbiträden, gränsöverskridande överföring inklusive USA samt SCC-mekanismer.
Detta dokument gör ingen bedömning att dessa villkor är tillräckliga för Fameko.

Juridiska beslut som återstår:

- fastställ personuppgiftsansvarig/biträdesroller och rättslig grund;
- ingå och arkivera tillämplig DPA;
- genomför TIA och bedöm SCC, kompletterande skydd och USA-åtkomst;
- granska och bevaka underbiträden;
- besluta retention för WorkOS-user, authloggar, sessioner och backups;
- implementera och testa export, rättelse, konto-/identitetsradering och
  verifierbar vidarebefordran till WorkOS;
- uppdatera integritetsinformation och register över behandling;
- bedöm om DPIA krävs;
- juridiskt bedöm vuxen-självdeklarationen och hur felaktiga uppgifter hanteras.

GDPR-granskningen är uttryckligen inte färdig.

## Exakt stagingaktiveringsplan – separat godkännande krävs

Nuvarande `next16-staging.fameko.se` skyddas i sin helhet av Cloudflare Access. Det
innebär att externa WorkOS sign-in/sign-up/callback inte kan testas som publik
registrering så länge Access ligger framför hela hosten.

Rekommenderad säkraste aktivering är `auth-staging.fameko.se` kopplad till en
separat WorkOS-staging-Worker och en separat, tom staging-D1 med endast godkänt
schema. Den nuvarande Access-skyddade hosten, Workern och D1 behålls oförändrade
som rollback-/jämförelseyta. Detta är ny domän-, Worker- och databas-infrastruktur
och kräver separat godkännande.

Den befintliga EU-staging-D1 kan tekniskt återanvändas eftersom all ekonomisk data
auktoriseras genom serverhärlett household-id. Den ger däremot inte full
miljöisolering: `users`, `households` och `planning_years` saknar miljö-/tenantkolumn,
och WorkOS-registreringar skulle blandas med befintliga Access-pilotrader. Separat
D1 är därför det minsta säkra valet för publika syntetiska registreringstester.

Samma deployade Worker kan inte användas för båda hostarna med nuvarande design:
`FAMEKO_AUTH_MODE` är en Worker-runtimevariabel, inte en hostnamevariabel. Att sätta
`workos_staging` på den befintliga staging-Workern skulle byta authperimeter även för
`next16-staging.fameko.se`. En separat Worker är därför obligatorisk om den hosten
ska lämnas oförändrad.

Aktiveringsordning:

1. Skapa en särskild releasebranch/commit och kör full Linux CI/audit.
2. Ta read-only snapshots av befintlig staging Worker-version, D1, Access och routes.
3. Skapa efter separat godkännande en separat Worker och en separat schema-only D1.
   Koppla inte `next16-staging.fameko.se` eller dess D1 till den nya Workern.
4. Registrera exakt callback `https://auth-staging.fameko.se/auth/callback`,
   initiate-login `https://auth-staging.fameko.se/sign-in` och godkänd sign-out-
   retur `https://auth-staging.fameko.se/` i WorkOS Staging. Inga wildcards.
5. Sätt endast på den separata Workern: `FAMEKO_AUTH_MODE=workos_staging`, exakt
   client-id, redirect URI och issuer. Lägg API-nyckel och ett unikt cookie-password
   som Cloudflare secrets, aldrig som `vars` eller i Git.
6. Lämna `WORKOS_COOKIE_DOMAIN` osatt så att sessionen blir host-only. Använd
   `WORKOS_COOKIE_SAMESITE=lax`, HTTPS/Secure/HttpOnly via SDK:n, ett unikt
   staging-cookie-namn och en beslutad kort staginglivslängd.
7. Säkerställ att workers.dev och preview URLs är avstängda och att endast exakt
   `auth-staging.fameko.se` routas till den nya Workern.
8. Lägg den nya hosten utanför Access endast efter att WorkOS-middleware, callback
   och fail-closed-kontroller verifierats på deploymentens direkta version.
9. Kontrollera oautentiserat: `/` enligt design, `/app` till sign-in, API/PDF utan
   session nekas, callback utan giltigt state nekas, legacyhost fortsatt Access-skyddad.
10. Kör två syntetiska registreringar, separata hushåll, Cloud Save, stale revision,
   logout/refresh/expiry, sessionsbyte, PDF/no-store och negativa household-försök.
11. Kontrollera D1-radantal och att ingen produktion, befintlig staging-D1 eller
    pilotidentitet ändrats. Verifiera dessutom att `fameko.se` och
    `next16-staging.fameko.se` inte skickar eller accepterar WorkOS-cookien.
12. Rollback vid avvikelse: ta bort endast den nya domänkopplingen eller återställ
    föregående staging Worker-version. Ändra inte D1 eller produktion som kompensation.

Att i stället smalna av befintlig Access-policy på `next16-staging.fameko.se` är
möjligt men innebär större risk för oavsiktlig exponering och rekommenderas inte som
första publika test.

## Rekommenderad nästa sprint

1. Juridisk DPA/TIA/retention/privacy-review.
2. Separat godkännande av publik staginghost och Access-perimeter.
3. Beslut om Cloudflare/WorkOS rate limiting och bot-skydd.
4. Runtime-secretkonfiguration och live E2E med syntetiska användare.
5. Separat schema-sprint för engångsbaserad pilotlänkning, audit trail samt
   export/radering – utan migrering av verkliga piloter förrän rollbacktest är klart.
