# Fameko – Legal finalization 1.0

Status: **GODKÄND FÖR PRODUKTIONSRELEASE – inte publicerad**
Granskat: 2026-11-16

## Leverans

De fullständiga dokumentförslagen finns i `server/legal/legal-documents.ts`.
Avsnittsordning, komponent, typografi och övrig dokumentdesign är oförändrade.
Koden är godkänd med versionerna `privacy-1.0` och `terms-1.0` samt
ikraftträdandedatumet 2026-11-16. Produktägaren godkände texterna, datumet och
en kontrollerad produktionsrelease den 2026-11-16.

En mobilanpassad acceptanssida är implementerad för befintliga
WorkOS-användare som saknar exakt aktuell acceptans. Godkännandet är aktivt,
aldrig förkryssat, och sparas idempotent med serververifierat användar-ID,
dokumentversioner och tidpunkt i den befintliga tabellen `legal_acceptances`.
Planeringssidor och planerings-API blockeras tills villkoren har accepterats.
Integritetspolicy, användarvillkor, dataexport och kontoradering är fortsatt
tillgängliga. Ingen D1-migration eller automatisk acceptans behövs.

## Verifierat mot produktion och kod

- Aktiv Worker-version den 2026-11-15 kör `FAMEKO_AUTH_MODE=workos_production`.
  Publik registrering är avstängd eftersom `FAMEKO_PUBLIC_REGISTRATION=enabled`
  saknas. Det tidigare Access-kontot kan fortfarande länkas genom den särskilda
  övergångsfunktionen.
- Produktionsdatabasen `fameko-pilot` har EU-jurisdiktion, kör i EEUR och har
  read replication avstängd. EU-jurisdiktionen gäller D1-databasen, inte
  automatiskt Cloudflares trafik- eller loggmetadata.
- Samtliga tre migrationer är tillämpade. Databasen innehåller sex användare,
  sex Cloudflare Access-identiteter, två länkade WorkOS-identiteter och noll
  poster i `legal_acceptances`.
- De sex pilotkontona har alltså inte tillskrivits godkännande av de nya
  villkoren. Koden skapar inte heller en acceptanspost vid vanlig inloggning för
  en redan känd WorkOS-identitet.
- Nya registreringar kräver vuxenbekräftelse och exakt aktuell villkorsversion.
  Den signerade attesteringen följer callbacken och acceptansen sparas vid
  kontoprovisioneringen.
- JSON-export och kontoradering finns i kontomenyn. Radering kräver nylig
  autentisering, återkallar aktiva WorkOS-sessioner, tar bort WorkOS-användaren
  och raderar användarens ensamhushåll från den aktiva D1-databasen. Vid ett
  delfel inaktiveras kontot och jobbet kan följas upp utan att WorkOS-raderingen
  upprepas.
- Ett Time Travel-bokmärke kunde hämtas 29 dagar bakåt. Det bekräftar att den
  aktuella D1-miljön har ett 30-dagars återställningsfönster. Återställningsdata
  är inte aktiva kontodata.
- Någon automatisk 24-månadersgallring finns inte. Datamodellen saknar även ett
  tillförlitligt fält för senaste inloggning. Dokumentförslagen säger därför
  uttryckligen att Fameko för närvarande inte raderar konton automatiskt enbart
  på grund av inaktivitet.

## Leverantörsvillkor

### WorkOS

Verifierat i offentliga villkor:

- [Terms of Service](https://workos.com/legal/terms-of-service), uppdaterade
  2026-08-04, gäller vid accepterande eller användning av tjänsten.
- [Data Processing Addendum](https://workos.com/legal/data-processing-addendum)
  utgör en del av tjänsteavtalet och blir bindande när avtalet träder i kraft.
  Det omfattar överföring till USA, EU:s standardavtalsklausuler när de är
  tillämpliga och radering av backup-/arkivkopior enligt WorkOS
  gallringsschema. Någon exakt offentlig tidsgräns för dessa kopior anges inte.
- Aktuell [underbiträdeslista](https://trust.workos.com/subprocessors) publiceras
  separat och kan ändras.

Den publika produktionsinloggningen är verifierad läsande och visar e-post följt
av engångskod, utan lösenordsfält. Kontospecifik avtalstyp, eventuell separat
orderblankett och vald sessionstid kan endast verifieras efter projektägarens
inloggning i WorkOS Dashboard. Någon sådan uppgift antas därför inte här och
ingen Dashboard-inställning ska ändras i kontrollen.

### Cloudflare

Verifierat i offentliga villkor:

- [Cloudflare DPA version 6.4](https://www.cloudflare.com/cloudflare-customer-dpa/),
  gällande från 2026-04-03, anger att DPA:n ingår i huvudavtalet. Cloudflare
  uppger även att DPA:n är införlivad genom hänvisning i Self-Serve Subscription
  Agreement. DPA:n innehåller EU:s standardavtalsklausuler för begränsade
  överföringar när de är tillämpliga.
- [D1 data location](https://developers.cloudflare.com/d1/configuration/data-location/)
  bekräftar att `eu` begränsar var själva databasen körs och lagrar data, men
  inte var Workers behandlar trafik.
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) anger
  30 dagars Time Travel för Workers Paid och 7 dagar för Free. Famekos faktiska
  30-dagarsfönster är dessutom verifierat läsande mot databasen.
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
  har högst 7 dagars retention på Paid och 3 dagar på Free när funktionen är
  aktiverad. Detta ska inte förväxlas med D1 Time Travel eller beskrivas som en
  generell lagringstid för all Cloudflare-metadata.

Cloudflares offentliga standardvillkor är verifierade, men kontospecifik
avtalstyp och eventuell separat överenskommelse kan endast verifieras efter
projektägarens inloggning. Ingen separat SCC, TIA, lagringstid eller teknisk
garanti antas utöver de tillämpliga villkoren.

## Releasebeslut

1. Produktägaren har godkänt dokumenttexterna, versionerna `privacy-1.0` och
   `terms-1.0`, ikraftträdandedatumet 2026-11-16 och en kontrollerad
   produktionsrelease.
2. Publik registrering ska fortsatt vara avstängd. Den aktiveras endast genom
   ett separat beslut och en separat verifiering.
3. Kontospecifik avtalstyp hos WorkOS och Cloudflare dokumenteras när
   projektägaren är inloggad; inga sådana avtalsuppgifter antas i releasen.

## Exakt vad som krävs för att ta bort DRAFT

DRAFT-markeringarna är redan borttagna i den förberedda koden, utan ändring av
layout, typografi eller avsnittsordning. Produktägaren har godkänt texterna,
versionerna, ikraftträdandedatumet och den kontrollerade produktionssättningen.
DRAFT-status kan därför tas bort när exakt den godkända committen har passerat
Linux CI och aktiverats i produktion.

Om produktionsdeploy inte sker 2026-11-16 måste datumfrågan tas upp för ett nytt
beslut innan en Worker-version aktiveras.

## Kort plan för publik registrering

1. Granska testresultatet och verifiera både ny registrering och befintlig
   användares uttryckliga godkännande i staging, utan att skriva acceptans för
   ett verkligt befintligt konto i förväg.
2. Produktägaren gör slutgodkännandet och en kontrollerad produktionsdeploy med
   publik registrering fortfarande avstängd.
3. Smoke-testa inloggning, dokumentversion, acceptanshistorik, export och
   kontoradering i produktion.
4. Aktivera därefter publik registrering separat och verifiera ett nytt konto
   från registrering till export/radering.

## Verifiering 2026-11-16

- Auth-, legal-, konto- och identitetstester: 129 godkända.
- Full planeringsregression: 235 godkända.
- Riktade Financial Health-, årshanterings-, PDF- och storage/save-tester:
  79 godkända.
- ESLint, Next-produktionsbygge, AuthKit-middlewarekontroll och OpenNext-bygge:
  godkända.
- `npm audit`: ett känt moderat Next.js-fynd. Den berörda kombinationen
  `use cache`/`unstable_cache` används inte i Fameko. Uppdatering till den
  korrigerade Next.js-versionen hanteras i en separat release.

Releasecommitten innehåller ingen Dashboard-ändring, D1-migration,
användarändring eller aktivering av publik registrering.
