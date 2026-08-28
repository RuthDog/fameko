# Fameko Pilot D1 – operations

Den auktoritativa identitetskällan är D1-bindingen `FAMEKO_DB`. Den tidigare
miljöbaserade pilotkatalogen är endast en test-fixture och får inte användas i
produktion.

## Skapa Cloudflare-resursen

Databasen är medvetet inte skapad av denna sprint. Skapa den autentiserat och
med EU-jurisdiktion:

```powershell
npx.cmd wrangler d1 create fameko-pilot --jurisdiction eu
```

Kopiera det returnerade `database_id` till `wrangler.jsonc` i stället för
`REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID`. Kör därefter:

```powershell
npm.cmd run cf-typegen
npx.cmd wrangler d1 migrations apply fameko-pilot --remote
```

Ingen Worker behöver deployas för att skapa databasen eller applicera
migrationen.

## Lokal utveckling

Skapa och migrera den lokala, Wrangler-hanterade D1-instansen:

```powershell
npm.cmd run db:migrate:local
```

`npm.cmd run dev` använder därefter samma lokala binding genom OpenNexts
Cloudflare-kontext.

## Provisionera en pilotperson

Provisioneringen använder en D1-batch med prepared statements. User,
Household, owner-medlemskap och AuthIdentity skapas tillsammans. Inga
personuppgifter eller Access-subject lagras i repot.

Sätt värdena endast i det aktuella terminalfönstret:

```powershell
$env:PILOT_EMAIL = "pilot@example.com"
$env:PILOT_ACCESS_SUBJECT = "verified-access-subject"
$env:PILOT_DISPLAY_NAME = "Pilot"
$env:PILOT_HOUSEHOLD_NAME = "Mitt hushåll"
```

Provisionera lokalt:

```powershell
npm.cmd run pilot:provision -- --local
```

Provisionera den verkliga pilotdatabasen först efter att resursen skapats,
migrationen applicerats och målidentiteten kontrollerats:

```powershell
npm.cmd run pilot:provision -- --remote
```

Rensa därefter terminalvariablerna:

```powershell
Remove-Item Env:PILOT_EMAIL
Remove-Item Env:PILOT_ACCESS_SUBJECT
Remove-Item Env:PILOT_DISPLAY_NAME
Remove-Item Env:PILOT_HOUSEHOLD_NAME
```

Provisioneringskommandot skriver endast stabila interna ID:n till terminalen,
inte e-post eller Access-subject.
