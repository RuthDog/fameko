# Fameko – Registrering 1.0

Status: **releasekandidat för kontrollerad staging – produktion oförändrad**

Inventerad mot: `9c40a75663b9a29fa6847e66b7800af4749eb1a8`

Datum: 2026-11-19

## Inventering

Följande fanns redan på `main`:

- `/sign-up` med aktiv, ej förkryssad 18-årsbekräftelse och acceptans av exakt
  aktuell version av användarvillkor och integritetspolicy;
- en signerad, fem minuter lång och callback-bunden registreringsattestering;
- WorkOS AuthKit Hosted UI för e-postverifiering samt separat create/recover-flöde;
- callback-only-provisionering av `User`, eget `Household`, owner-medlemskap,
  WorkOS-identitet, aktuell `PlanningYear` och beständig juridisk acceptans;
- idempotens för upprepad och samtidig callback, med unik provider/subject-identitet;
- vanlig inloggning som aldrig provisionerar ett okänt WorkOS-subject;
- strikt, serverhärledd user- och household-scope samt fail-closed-felhantering;
- Legal Acceptance 1.0 för befintliga användare som saknar aktuell acceptans;
- separat WorkOS-stagingläge med allowlist och separat Worker/D1-konfiguration;
- produktionsgrinden `FAMEKO_PUBLIC_REGISTRATION=enabled`, som krävs utöver
  `workos_production` för att publik registrering ska vara tillgänglig;
- pilotansökan via e-post och befintliga landningssideknappar.

Det som saknades för en sammanhängande Registrering 1.0-upplevelse var att
landningssidan fortfarande alltid visade pilotansökan och inloggning, även när
registrering var säkert aktiverad i staging.

## Lokal ändring

Landningssidan är nu dynamisk och använder samma server-side,
konfigurationsvaliderande registreringsgrind som `/sign-up`:

- när grinden är öppen visas `Skapa konto` och `Kom igång gratis` med länk till
  `/sign-up`;
- när grinden är stängd behålls pilotansökan och inloggningen;
- ofullständig eller ogiltig WorkOS-konfiguration döljer registrerings-CTA:n;
- produktion ändrar inte beteende utan den explicita flaggan
  `FAMEKO_PUBLIC_REGISTRATION=enabled`.

Ingen autentiseringsmodell, migration, juridisk text eller WorkOS-konfiguration
har ändrats.

## Regressionstäckning

Det fokuserade kommandot `npm run test:registration` täcker:

- verifierad och overifierad WorkOS-e-post;
- aktiv ålders- och villkorsacceptans;
- avbruten, utgången och manipulerad registrering;
- nekad stagingidentitet och ofullständig konfiguration;
- befintlig användare och vanlig inloggning;
- upprepad och samtidig callback utan dubbla konton eller hushåll;
- separata användare, separata hushåll och nekad cross-household-åtkomst;
- atomisk rollback om provisionering eller planeringsår misslyckas;
- lokal applicering av migrationerna `0001`–`0003` genom
  konto-länkningsintegrationstestet;
- att landningssidans CTA följer den fail-closed servergrinden.

## Staging och migration `0003`

Den isolerade stagingdefinitionen använder:

- Worker `fameko-auth-staging`;
- domän `auth-staging.fameko.se`;
- D1 `fameko-auth-staging-eu`;
- `FAMEKO_AUTH_MODE=workos_staging`;
- separat sessionscookie och en allowlist med två eller tre testadresser.

`migrations/0003_account_link_grants.sql` finns i aktuell kod och passerar lokal
schema- och integrationstestning. Enligt tidigare extern inventering saknas den i
staging. Denna implementation har inte läst eller ändrat stagingmiljön.

Migrationen skapar konto-länkningsgrants, indexet som begränsar en WorkOS-identitet
per intern användare och triggern som konsumerar en grant. Självständig
nyregistrering i `workos_staging` använder inte konto-länkning och är därför inte
direkt beroende av tabellen. Migrationen rekommenderas ändå före slutligt
staginggodkännande så att körande kod och databasschema är identiska och alla
authinvarianter kan verifieras. Den får appliceras först efter separat beslut,
read-only kontroll av aktuell migrationslista och stagingbackup/rollbackpunkt.

## Manuell stagingverifiering

Efter beslut om schema-paritet kan följande köras utan produktionsändring:

1. Kontrollera read-only att rätt Worker, D1, domän, WorkOS staging client och
   allowlist används och att produktion saknar publik registreringsflagga.
2. Kontrollera migrationslistan. Redovisa och godkänn `0003` separat innan den
   eventuellt appliceras.
3. Besök landningssidan på staging i mobil och desktop och följ
   `Kom igång gratis` till `/sign-up`.
4. Avbryt ett försök och verifiera att ingen intern användare eller hushåll skapas.
5. Registrera två nya, tillåtna syntetiska e-postadresser och verifiera e-postkod,
   juridisk acceptans, direkt navigering till `/app` och begriplig tom planering.
6. Verifiera exakt en User, WorkOS-identitet, Household, owner-medlem,
   PlanningYear och legal acceptance per testperson.
7. Upprepa registrering/inloggning för samma WorkOS-användare och verifiera
   oförändrade radantal och samma hushåll.
8. Försök med en icke-tillåten stagingadress och verifiera att Fameko inte skapar
   någon intern kontograf.
9. Testa att användare A inte kan läsa eller skriva användare B:s planering,
   inklusive manipulerade household- och sessionsvärden.
10. Verifiera att `fameko.se` fortfarande saknar registrerings-CTA och att
    `/sign-up` där förblir stängd.

Genomförda externa steg och resultat redovisas i stagingreleasens slutrapport.
