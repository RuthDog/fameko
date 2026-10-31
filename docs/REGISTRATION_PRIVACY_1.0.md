# Fameko – Registration & Privacy 1.0

Status: **DRAFT – ingen produktions- eller stagingrelease**
Inventerad: 2026-10-31

## Registreringsflöde

- Famekos `POST /sign-up` behåller exakt same-origin-, Origin-, metod-,
  Content-Type- och Fetch Metadata-kontroll.
- Vuxenbekräftelse och ett separat villkorsgodkännande krävs innan den signerade
  femminutersattesteringen utfärdas.
- Attesteringen binder `create` eller `recover`, villkorsversion och visad
  privacyversion till samma PKCE/state-skyddade callbackflöde.
- `create` använder fortsatt WorkOS Hosted UI signup och `recover` Hosted UI
  sign-in. Vanlig `/sign-in` får fortsatt inte provisionera en ny Fameko-identitet.
- Ingen e-post, namnuppgift eller ekonomisk uppgift läggs i attesteringen.

## Email-only WorkOS

WorkOS User API anger `first_name` och `last_name` som valfria och SDK:ns User-typ
som nullable. Famekos kod läser endast verifierad e-post och immutable WorkOS
user ID. Magic Auth kan därför användas som email + kod utan en egen OTP-UI.

Officiell Hosted UI-dokumentation beskriver ingen särskild toggle för namn. Innan
Dashboard ändras ska Staging-applikationen kontrolleras read-only:

1. rätt WorkOS Staging environment och application/client ID;
2. Magic Auth på, lösenord och sociala providers av;
3. ett nytt AuthKit `screen_hint=sign-up`-flöde visar endast e-post och kod;
4. eventuellt namn-/teamformulär hör inte till WorkOS Dashboard-onboarding för
   utvecklarkontot i stället för Famekos AuthKit-app.

Om AuthKit faktiskt kräver namn trots dessa inställningar ska WorkOS Support
bekräfta den dokumenterade Dashboard-inställningen. Ingen headless OTP-lösning
ska byggas som första åtgärd.

## Cookies och browserlagring

| Mekanism | Innehåll/ändamål | Maxålder |
| --- | --- | --- |
| `__Host-fameko-sign-up` | signerad registreringsattestering | 5 minuter |
| `wos-auth-verifier-*` | sealed PKCE/state | 10 minuter |
| staging-sessioncookie | sealed WorkOS/Fameko-session | 8 timmar |
| `fameko.active-planning-year` | valt år | tills lokal rensning |
| `fameko.planning-data.v3` | möjlig legacy-planeringsdata | tills explicit rensning |

Fameko-cookies är HttpOnly, Secure, SameSite=Lax och host-only. WorkOS Hosted UI:s
egna cookies måste inventeras i verklig browser innan policyn färdigställs.

## Cloudflare invocation logs

Auth-staging använder fortsatt strukturerad observability med sampling 100 %, men
automatiska invocation logs är avstängda för att inte lagra callback-URL:er.
Cloudflares dokumentation beskriver Fetch-invocationen med metod och request-URL.
Eftersom callbacken har code/state i queryn finns en oacceptabel kunskapslucka
om automatloggen behåller querydelen eller redigerar den före lagring.

Dataminimerande stagingkonfiguration:

1. behåll `observability.logs.invocation_logs=false` endast för auth-staging;
2. behåll begränsade egna authhändelser med correlation ID, steg och enum-reason;
3. verifiera i deployad Worker att callback-URL, code, state, cookies, e-post och
   ekonomiska värden inte förekommer;
4. välj en lägre sampling för övriga säkra felloggar när felsökningsfasen är klar.

## Logo.dev

Direkta Logo.dev-anrop och den publika klientnyckeln är borttagna. Kända
varumärken visas i stället med en neutral lokal bokstavsmarkör. Ingen
varumärkesdomän skickas därför till en extern logotyptjänst.

## Beständig villkorsaccept – migrationsbeslut krävs

Den signerade kortlivade attesteringen bevisar villkorsversionen under callbacken,
men skapar inget beständigt register. Minsta framtida tabell är:

```text
legal_acceptances
- id (UUID, primary key)
- user_id (FK users, cascade)
- terms_version
- privacy_version_presented
- adult_confirmation_version
- accepted_at
- source (signup eller recovery)
- unique(user_id, terms_version)
```

IP, user-agent, e-post, WorkOS-token och attesteringsvärde ska inte sparas.
Införandet kräver en separat D1-migration och uppdatering av den atomiska
provisioneringstransaktionen. Ingen sådan migration ingår i denna ändring.

## Kommande export och kontoradering

Export ska efter nylig autentisering ge versionerad JSON med användare,
identitetsreferens, medlemskap, eget hushåll, planeringsår och legal acceptans,
men aldrig tokens, cookies, secrets eller andra hushålls data.

Radering ska: verifiera identitet och scope, återkalla WorkOS-sessioner, stoppa
nya writes, radera endast användarens interna relationer/hushåll enligt tydliga
äganderegler, radera WorkOS-user och verifiera efteråt. D1 Time Travel, Workers
Logs och WorkOS backupretention ska redovisas; de får inte döljas bakom ett löfte
om omedelbar total radering.
