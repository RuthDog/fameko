# Fameko – Pilot Architecture 1.0

Status: APPROVED
Version: Pilot Architecture 1.0
Purpose: Architecture baseline for Pilot 1
Datum: 2026-08-28
Omfattning: 5–10 inbjudna pilotanvändare

Detta dokument beskriver hur Fameko går från en lokal single-user-produkt med `localStorage` till en säker, inbjudningsbaserad pilotprodukt. Dokumentet är en plan. Det innehåller ingen produktionskod och ändrar inte Workspace 1.0 eller den ekonomiska modellen.

Arkitekturbesluten i detta dokument är låsta under pilotimplementationen om inget konkret tekniskt problem kräver omprövning.

## 1. Sammanfattat beslut

Pilot 1.0 ska använda följande arkitektur:

- Cloudflare Access med e-postbaserad engångskod som pilotens autentisering.
- Fameko-genererade UUID:n som stabila interna identiteter.
- `User → HouseholdMember → Household → PlanningYear` som ägarskapsmodell.
- Cloudflare D1, skapad med EU-jurisdiktion, som serverdatalager.
- En komplett, versionerad `PlanningData`-JSON per hushåll och kalenderår.
- Next.js Route Handlers under den skyddade `/app`-sökvägen som enda dataåtkomst från klienten.
- Ekonomiska beräkningar och UI-state kvar i klienten; autentisering, accesskontroll, validering och persistens på servern.
- Ingen generell automatisk localStorage-migrering. En explicit engångsimport erbjuds bara när serveråret saknas och lokal data inte är oförändrad seed-data.
- Ingen `/admin`-vy i piloten. Pilotkonton hanteras med Cloudflare Access Dashboard och små, kontrollerade admin-kommandon.

Detta är den minsta arkitektur som ger säker användarisolering nu utan att knyta ekonomisk data till Cloudflare Access eller en e-postadress för all framtid.

## 2. Faktiskt utgångsläge

Fameko använder i dag:

- Next.js 15 App Router och TypeScript.
- Tailwind CSS.
- OpenNext för Cloudflare.
- En Cloudflare Worker med namnet `fameko`.
- Publik landing på `/`.
- Workspace 1.0 på `/app`.
- `PlanningData.version = 3`.
- localStorage-nyckeln `fameko.planning-data.v3`.
- Klientbaserade beräkningar och klientbaserad persistens.
- Ingen D1-binding, auth-provider eller serverbaserad användarmodell.

Den nuvarande `PlanningData` innehåller produktens indata: ingående saldo, inkomster, kostnadskategorier, kostnadsposter, fördelningar, områdesvärden och redigerbara etiketter. Beräknade prognosvyer skapas från denna data och behöver inte lagras separat.

### Känd förutsättning före auth

Landingsidans produktpreview laddar för närvarande den riktiga `/app` i en iframe. Det skapar två problem när Pilot 1.0 införs:

1. Cloudflare Access kommer att stoppa eller visa loginflödet inuti preview-ramen.
2. Den inbäddade arbetsytan kan skapa seed-data i `localStorage` för en besökare som aldrig aktivt har använt arbetsytan.

Före Access aktiveras ska previewen därför bytas från live-iframe till en statisk, sanerad bild av Workspace 1.0. Detta är en pilotförutsättning, inte en förändring av arbetsytans ekonomiska modell.

Migreringen får inte tolka blotta förekomsten av `fameko.planning-data.v3` som bevis på att användaren har egen data. Oförändrad seed-data ska inte erbjudas för import.

## 3. Arkitekturprinciper

Följande principer gäller genom hela Pilot 1.0:

1. Ekonomisk data ägs av ett hushåll, aldrig av en e-postadress.
2. Klienten får aldrig bestämma vilket hushåll en operation gäller.
3. Workspace 1.0:s `PlanningData` och ekonomiska regler behålls intakta.
4. Servern är auktoritativ för sparad data; `localStorage` upphör som primär lagring.
5. Alla auth- och datafel ska neka åtkomst säkert, inte falla tillbaka till lokal data.
6. Piloten ska vara enkel att driva manuellt för 5–10 personer.
7. Framtida familjedelning ska kunna läggas till genom medlemskap, inte genom datamigrering.
8. Leverantörsspecifik identitet hålls separat från Famekos interna `User.id`.

## 4. Autentisering

### 4.1 Bedömda alternativ

| Alternativ | Fördelar | Nackdelar | Kostnad för pilot | Komplexitet | Migreringsrisk |
| --- | --- | --- | --- | --- | --- |
| Cloudflare Access + OTP | Finns i nuvarande Cloudflare-stack, skyddar hela sökvägen före applikationen, exakt e-postlista, ingen lösenordshantering eller e-postleverantör i Fameko | Cloudflare-brandat loginflöde, inte fullständig konsument-IAM, begränsad produktstyrning över session och återställning | Cloudflare Zero Trust Free är avsedd för team under 50 användare och kostar för närvarande 0 USD | Låg | Medel om Access-identiteten används direkt som datanyckel; låg med separat `auth_identities`-tabell |
| Egen application auth, exempelvis Better Auth på D1 | Full kontroll över login, sessioner och framtida produktupplevelse; Better Auth har D1-stöd | Fameko äger säkerhetsytan för sessioner, magic links/lösenord, rate limiting, återställning, e-postleverans och auth-migrationer | Biblioteket kan vara kostnadsfritt men e-post, drift och säkerhetsarbete tillkommer | Högre | Låg leverantörsrisk men högre implementations- och säkerhetsrisk nu |
| Managed application auth, exempelvis Clerk | Färdiga Next.js-komponenter, dashboard och senare stöd för publik användarhantering; nuvarande Hobby-plan rymmer långt fler än pilotens användare | Extern personuppgiftsleverantör, ytterligare SDK/CSP/integration, leverantörsberoende och funktioner piloten inte behöver | Clerk Hobby är för närvarande kostnadsfri inom sin fria användarnivå | Medel | Medel; enklare framtida kundauth men onödig integration i denna fas |

Aktuella kostnadsuppgifter: [Cloudflare Zero Trust-planer](https://www.cloudflare.com/plans/zero-trust-services/) och [Clerk pricing](https://clerk.com/pricing). Better Auth dokumenterar stöd för [Cloudflare D1](https://better-auth.com/docs/concepts/database).

### 4.2 Rekommendation: Cloudflare Access

Pilot 1.0 ska använda Cloudflare Access med One-time PIN och en policy som endast inkluderar uttryckligen godkända e-postadresser. Cloudflare beskriver OTP som ett flöde där en godkänd adress får en engångskod som gäller i tio minuter. En loginmetod får aldrig tillåtas utan en begränsad e-postlista, eftersom en sådan policy annars kan öppna applikationen för alla giltiga adresser. Se [One-time PIN login](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/) och [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/).

Rekommenderad sessionslängd för piloten är åtta timmar. Det ger en rimlig balans mellan låg friktion och privatekonomisk känslighet. Ingen publik registrering skapas.

Access är rätt beslut för piloten därför att det tar bort den största nya säkerhetsytan: Fameko behöver inte ännu bygga lösenord, magic-link-leverans, sessionsrotation, kontoåterställning eller publikt onboardingflöde. Interna UUID:n och en separat auth-identitet gör att Access senare kan ersättas utan att hushåll eller planeringsdata byter ägare.

### 4.3 Serververifiering är obligatorisk

Access framför Worker-routen är inte ensam tillräcklig som applikationskontroll. Varje serveroperation ska läsa `Cf-Access-Jwt-Assertion` och verifiera:

- JWT-signaturen mot Cloudflares JWKS.
- korrekt `iss`.
- korrekt Access Application `aud`.
- `exp`, `nbf` och `iat`.
- `type = app`.
- ett icke-tomt `sub`.

Cloudflare rekommenderar verifiering av headern framför cookie och beskriver att signaturen måste kontrolleras, inte bara tokeninnehållet. Se [Validate JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) och [Application token](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/).

Access-claimen `sub` används som leverantörens subject i `auth_identities`, aldrig som `User.id`. Cloudflare anger att `sub` kan ändras om en användare tas bort och läggs tillbaka i Zero Trust-organisationen. En sådan identitetsändring ska därför kräva en kontrollerad admin-relink; Fameko ska inte automatiskt koppla om ekonomisk data enbart genom matchning på e-post.

### 4.4 När Access ska ersättas

Byte till egen eller managed application auth ska utvärderas när minst ett av följande blir aktuellt:

- publik registrering.
- helt Fameko-brandat loginflöde.
- självadministration av konto och e-postadress.
- hushållsinbjudningar mellan användare.
- betalning eller prenumeration.
- Access-kostnaden eller seat-modellen blir olämplig för konsumentanvändare.

Vid ett byte skapas en ny rad i `auth_identities` för samma interna `User.id`. `HouseholdMember` och `PlanningYear` påverkas inte.

## 5. URL-struktur

| URL | Åtkomst | Beslut |
| --- | --- | --- |
| `/` | Publik | Fameko Landing 1.0. Ingen auth-cookie krävs. |
| `/app` och `/app/*` | Skyddad | Workspace, årsdata och alla dataendpoints. Cloudflare Access + serververifiering. |
| `/app/api/planning-years` | Skyddad | Lista tillgängliga år för det autentiserade hushållet. |
| `/app/api/planning-years/[year]` | Skyddad | Läs och skriv ett specifikt planeringsår. |
| `/login` | Byggs inte | “Logga in” länkar direkt till `/app`; Access startar loginflödet. |
| `/admin` | Byggs inte | Admin sker via Cloudflare Dashboard och lokala CLI-kommandon under piloten. |

API-routes placeras under `/app/api` så att en enda Access-sökväg, `fameko.se/app*`, skyddar både gränssnitt och dataåtkomst. Det minskar risken att en ny dataroute glöms utanför auth-policyn.

Cloudflare Access ska skydda hela `/app*`, inklusive alla dataendpoints under exempelvis `/app/api/*`. Access är däremot endast första säkerhetslagret. Varje dataoperation måste dessutom verifiera autentiserad identitet, aktiv intern `User`, `HouseholdMember` och rätt serverhärlett `Household` scope. Access får aldrig vara enda kontrollen för ekonomisk data.

`www.fameko.se` ska göra permanent redirect till `fameko.se` innan login. Då finns ett kanoniskt origin och ett auth-cookieflöde. Om båda domänerna i stället behålls måste båda uttryckligen ingå i samma Access-applikation och testas som ett multi-domain-flöde.

## 6. Identitets- och hushållsmodell

```text
Cloudflare Access subject
          │
          ▼
    AuthIdentity
          │
          ▼
         User
          │
          ▼
   HouseholdMember
          │
          ▼
       Household
          │
          ▼
     PlanningYear
```

Alla primärnycklar genereras server-side med `crypto.randomUUID()`. Tider sparas som UTC. E-post normaliseras för kontakt, provisioning och unik pilotidentitet, men används inte i foreign keys till hushåll eller planeringsdata.

### 6.1 User

| Fält | Typ | Regel |
| --- | --- | --- |
| `id` | TEXT UUID | Primärnyckel och Famekos stabila användaridentitet. |
| `email_normalized` | TEXT | Unik under piloten; auth- och kontaktinformation. |
| `display_name` | TEXT nullable | Enkel visning, inte profilplattform. |
| `status` | TEXT | `invited`, `active` eller `disabled`. |
| `created_at` | TEXT UTC | Skapad. |
| `updated_at` | TEXT UTC | Senast ändrad. |

### 6.2 AuthIdentity

| Fält | Typ | Regel |
| --- | --- | --- |
| `provider` | TEXT | För piloten `cloudflare_access`. |
| `subject` | TEXT | Verifierad JWT `sub`. |
| `user_id` | TEXT UUID | Foreign key till `users.id`. |
| `email_snapshot` | TEXT | E-post som providern verifierade vid kopplingstillfället. |
| `created_at` | TEXT UTC | Kopplad. |
| `last_seen_at` | TEXT UTC | Senaste godkända session. |

Primär/unik nyckel är `(provider, subject)`. En användare kan senare ha flera auth-identiteter utan att få ett nytt hushåll.

### 6.3 Household

| Fält | Typ | Regel |
| --- | --- | --- |
| `id` | TEXT UUID | Primärnyckel och ekonomiskt ägarskaps-ID. |
| `name` | TEXT | Neutral standard, exempelvis “Mitt hushåll”. |
| `created_at` | TEXT UTC | Skapad. |
| `updated_at` | TEXT UTC | Senast ändrad. |

### 6.4 HouseholdMember

| Fält | Typ | Regel |
| --- | --- | --- |
| `household_id` | TEXT UUID | Foreign key till hushåll. |
| `user_id` | TEXT UUID | Foreign key till användare. |
| `role` | TEXT | Strukturellt `owner` eller `member`; piloten skapar endast `owner`. |
| `created_at` | TEXT UTC | Medlemskapet skapades. |

Primärnyckel är `(household_id, user_id)`. Ett index på `user_id` gör serverns hushållsuppslag effektivt.

Pilotens provisioning skapar en användare, ett hushåll och ett `owner`-medlemskap. Framtida familjedelning lägger endast till ännu en `HouseholdMember` för samma hushåll. Planeringsdata behöver då inte flyttas eller dupliceras.

### 6.5 Provisioning och status

Admin skapar först en intern användare med status `invited` och tillhörande hushåll. Därefter läggs samma e-postadress till i Access-policyn.

Första inloggningen följer exakt denna princip:

```text
Cloudflare Access verifierar identiteten
          ↓
auth_identity
          ↓
internt Fameko User
          ↓
HouseholdMember
          ↓
Household
```

En lyckad Access-inloggning får inte ensam ge ekonomisk dataåtkomst. Användaren måste finnas eller aktiveras i Famekos interna identitetsmodell och vara kopplad till ett hushåll via `HouseholdMember`. Pilotversionen använder därför ett kontrollerat bootstrap-/provisioneringsflöde och ingen publik självregistrering.

Vid första giltiga Access-requesten:

1. Servern verifierar JWT:n.
2. Servern söker `(provider, subject)` i `auth_identities`.
3. Om identiteten saknas får den endast kopplas till exakt en `invited` användare vars normaliserade e-post matchar den verifierade claimen.
4. Koppling och statusbyte till `active` sker atomiskt.
5. Om samma e-post redan hör till en `active` eller `disabled` användare utan matchande subject nekas åtkomst och admin måste relinka manuellt.

Detta använder e-post för en kontrollerad första koppling, inte som nyckel till ekonomisk data.

## 7. Datalagring

### 7.1 Rekommendation: Cloudflare D1

En enda D1-databas ska användas för Pilot 1.0. Databasen ska skapas med `jurisdiction = "eu"` från början. Cloudflare anger att jurisdiktionen bestämmer var databasen körs och lagrar data och att den inte kan läggas till i efterhand. Se [D1 EU jurisdiction](https://developers.cloudflare.com/changelog/post/2025-11-05-d1-jurisdiction/).

D1 passar Fameko eftersom samma databas kan hantera:

- unika auth-identiteter.
- användarstatus.
- hushållsmedlemskap.
- ett planeringsår per hushåll och år.
- atomisk villkorad uppdatering och indexerade accessfrågor.
- Time Travel för återställning.

OpenNext kan läsa en D1-binding via Cloudflare-kontext i en Next.js Route Handler. Detta stöds av [OpenNext bindings](https://opennext.js.org/cloudflare/bindings), och Route Handlers stöds av adaptern enligt [OpenNext Cloudflare](https://opennext.js.org/cloudflare).

### 7.2 Bedömning av Cloudflare-alternativ

| Lagring | Bedömning |
| --- | --- |
| D1 | Valt. Relationer, unika constraints, index, villkorade updates och JSON som TEXT i samma billiga tjänst. |
| Workers KV | Avvisat som primärdatabas. Eventual consistency och avsaknad av relationer gör medlemskap och samtidiga skrivningar svårare att säkra. |
| Durable Objects | Inte nu. Bra om ett hushåll senare behöver seriell realtidssamordning, men routing och instansmodell är överbyggnad för 5–10 användare. |
| R2 | Inte primärlagring. Bra för framtida längre backupexporter, men olämpligt för identitets- och medlemsfrågor. |

En databas per hushåll behövs inte. En gemensam pilotdatabas med strikt query-scoping är enklare att migrera, observera och säkerhetsgranska. D1:s nuvarande gränser är mycket större än pilotbehovet; en enskild sträng eller rad får vara upp till 2 MB. Fameko ska ändå sätta en egen payloadgräns på 256 KB. Se [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

## 8. PlanningData och årsmodell

### 8.1 Beslut: hel JSON per hushåll och år

`PlanningData` ska lagras som en komplett JSON-sträng i en `planning_years`-rad. Inkomster, kostnadsposter och månadsfält ska inte normaliseras i Pilot 1.0.

Skäl:

- Modellen fungerar redan som en sammanhållen produktkärna.
- Den förändras fortfarande snabbare än rapporteringsbehoven.
- Workspace läser och uppdaterar helheten.
- Pilotens datamängd är mycket liten.
- Normalisering skulle duplicera klientens domänmodell och öka migrationsytan utan användarnytta.

D1 lagrar JSON som `TEXT` och kan vid behov använda SQLite JSON-funktioner senare. Se [D1 Query JSON](https://developers.cloudflare.com/d1/sql-api/query-json/).

### 8.2 PlanningYear

| Fält | Typ | Regel |
| --- | --- | --- |
| `id` | TEXT UUID | Primärnyckel. |
| `household_id` | TEXT UUID | Härleds alltid server-side. |
| `year` | INTEGER | Exempelvis 2026, 2027 eller 2028. |
| `planning_data` | TEXT JSON | Komplett, validerad PlanningData. |
| `data_version` | INTEGER | Motsvarar aktuell `PlanningData.version`; initialt 3. |
| `revision` | INTEGER | Börjar på 1 och ökar vid varje sparning. |
| `created_at` | TEXT UTC | Skapad. |
| `updated_at` | TEXT UTC | Senast sparad. |
| `last_modified_by` | TEXT UUID | Intern `User.id`, inte e-post eller Access subject. |

Constraint: `UNIQUE(household_id, year)`.

Det får endast finnas ett auktoritativt `PlanningYear` per hushåll och kalenderår. Varje år är en separat rad. “Kopiera föregående år” kan senare skapa en ny rad med nytt `id`, nytt `year`, `revision = 1` och ett migrerat exemplar av föregående JSON. “Uppdatera från föregående år” blir en explicit domänoperation mellan två årsrader. Ingen av funktionerna byggs i Pilot 1.0.

### 8.3 Validering och versionering

Servern ska vid varje skrivning:

- kräva ett helt JSON-objekt.
- neka payload större än 256 KB.
- validera att `version` stöds.
- validera samtliga obligatoriska typer, nycklar, arraygränser och beloppsformat.
- neka `NaN`, `Infinity`, orimliga stränglängder och okända prototypvärden.
- sätta `data_version` från validerad data, inte från ett fristående klientfält.
- behålla migrationsfunktioner som `v3 → v4` när modellen senare ändras.

Beräknade årsprognoser och saldon lagras inte separat. De fortsätter att härledas från `PlanningData` så att Fameko inte får två konkurrerande sanningar.

Normalisering ska först övervägas när en konkret trigger finns, exempelvis cross-household-rapportering, serverbaserade sökningar i kostnadsposter, delvisa skrivningar som dominerar lasten eller när JSON-raden närmar sig den egna storleksgränsen.

### 8.4 Samtidighet

Klienten skickar den `revision` den senast läste. Servern uppdaterar endast med ett villkor motsvarande:

```sql
UPDATE planning_years
SET planning_data = ?, revision = revision + 1, updated_at = ?, last_modified_by = ?
WHERE id = ? AND household_id = ? AND revision = ?;
```

Noll uppdaterade rader betyder konflikt och ger HTTP `409`. Piloten gör ingen automatisk merge. Användaren får ladda om den senaste serverversionen innan en ny ändring görs. Detta kostar lite nu men förhindrar tyst dataförlust när ett hushåll senare får två användare eller två öppna flikar.

## 9. Migration från localStorage

### 9.1 Beslut: explicit engångsimport, aldrig automatisk merge

På första autentiserade laddningen för ett år gäller följande ordning:

1. Klienten hämtar serverns `PlanningYear`.
2. Om serveråret finns används det alltid. Lokal data ignoreras och laddas aldrig upp automatiskt.
3. Om serveråret saknas kontrolleras `fameko.planning-data.v3`.
4. Lokal JSON måste klara både klient- och servervalidering.
5. Om JSON är byte-/innehållsmässigt samma som känd seed-data skapas ett nytt serverår från aktuell seed utan importfråga.
6. Om lokal data avviker från seed visas en tydlig engångsfråga: vilket konto och år importen gäller och att serveråret är tomt.
7. Bekräftad import gör en create-only-skrivning. Servern får inte skriva över en rad som skapats under tiden.
8. Efter lyckad skrivning gör klienten en verifierande serverläsning. Först därefter tas den gamla localStorage-nyckeln bort.
9. Vid fel behålls lokal data och användaren får ett tydligt fel-ID. Ingen tom serverdata får ersätta den lokala vyn tyst.

Det ska inte finnas någon generell merge mellan localStorage och serverdata. Pilotanvändare som aldrig använt den lokala arbetsytan får en ny serverlagrad seed.

### 9.2 Varför inte behålla localStorage som cache

`localStorage` ska efter migration inte vara en auktoritativ cache. Den saknar användar- och hushållsscope, kan ligga kvar på delade datorer och gör konfliktbeteendet otydligt. In-memory state räcker under sessionen. En framtida offlineprodukt kräver en separat design med användarscoperad cache och synkprotokoll; det ingår inte i piloten.

## 10. Ansvarsfördelning mellan klient och server

| Klient | Server |
| --- | --- |
| Expand/collapse, vald månad, dialoger och inline-editor-state | Verifiera Access JWT och användarstatus |
| Optimistisk uppdatering av den öppna arbetsytan | Slå upp intern User och HouseholdMember |
| Befintliga ekonomiska beräkningar och prognoser | Härleda household scope; aldrig acceptera det från request body |
| UX-validering och formatering | Fullständig, auktoritativ PlanningData-validering |
| Visa `Sparar`, `Sparat`, konflikt och fel | Läsa/skriva D1 med revision och prepared statements |
| Skicka valt kalenderår och senaste revision | Sätta timestamps, data_version och last_modified_by |

De ekonomiska beräkningarna ska fortsätta i klienten i Pilot 1.0. De är deterministiska, används direkt av gränssnittet och behöver inte köras på servern för att säkra ägarskap. Servern lagrar endast den validerade indata som beräkningarna bygger på.

På sikt bör typer, valideringsschema och rena migrationsfunktioner ligga i delade moduler. Det betyder inte att servern behöver återberäkna varje vy vid varje save.

## 11. Data access och API

### 11.1 Beslut: Next.js Route Handlers

Fameko ska använda små Route Handlers i samma Next.js/OpenNext-applikation. Ett separat backendprojekt eller generellt REST-API ska inte byggas.

Route Handlers väljs framför Server Actions eftersom den befintliga arbetsytan är en stor Client Component och redan hanterar en sammanhållen datarepresentation. Ett litet resurskontrakt blir lätt att testa, ger tydliga HTTP-felkoder och kräver mindre ombyggnad av Workspace 1.0.

Föreslagna endpoints:

| Metod och route | Syfte |
| --- | --- |
| `GET /app/api/planning-years` | Returnerar årtal och metadata som hör till autentiserat hushåll. |
| `GET /app/api/planning-years/[year]` | Returnerar `{ year, schemaVersion, revision, data, updatedAt }`. |
| `PUT /app/api/planning-years/[year]` | Skapar eller uppdaterar hel PlanningData med förväntad revision. |

Ingen endpoint tar emot `householdId` som auktoritativ input. Om ett sådant ID någon gång behövs i URL för framtida multi-household-navigation måste servern fortfarande bevisa medlemskap innan åtkomst.

Rekommenderade svarskoder:

- `401`: saknad eller ogiltig Access-token.
- `403`: disabled användare eller saknat medlemskap.
- `404`: året finns inte.
- `409`: revisionskonflikt eller create-only-import mot befintligt år.
- `413`: payload över Famekos storleksgräns.
- `422`: ogiltigt år eller PlanningData.
- `500`: oväntat server-/D1-fel med ett publikt correlation ID.

Samma origin ska användas, CORS ska inte öppnas och skrivningar ska kräva JSON samt godkänd `Origin`/`Host`. D1-anrop använder bundna prepared statements, vilket Cloudflare rekommenderar för dynamiska värden och SQL injection-skydd. Se [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/).

### 11.2 Intern kodgräns för framtida implementation

Den framtida implementationen bör hålla följande ansvarsgränser:

```text
app/app/api/.../route.ts
        │
        ├── server/auth/access-token.ts
        ├── server/auth/require-user.ts
        ├── server/planning/planning-schema.ts
        └── server/planning/planning-repository.ts
                                  │
                                  ▼
                                  D1
```

Route Handlern koordinerar HTTP. Auth-modulen verifierar identitet. Repositoryn äger SQL. Valideringsmodulen äger formatet. UI-komponenten ska inte känna till D1.

## 12. Säkerhetskrav från dag ett

Pilot 1.0 är inte klar förrän följande kontroller finns och är testade:

1. Access skyddar hela `/app*`, inklusive dataendpoints.
2. Varje serverrequest verifierar Access-tokenens signatur och claims.
3. Auth subject mappas till intern `User.id`.
4. `users.status` kontrolleras vid varje dataläsning och dataskrivning.
5. Hushållet härleds genom `household_members`; det tas aldrig från klientens body.
6. Varje SQL-fråga mot `planning_years` innehåller serverhärlett `household_id`.
7. PlanningData valideras och storleksbegränsas server-side.
8. Skrivningar använder revision och får inte ge silent last-write-wins.
9. SQL använder prepared statements.
10. Skrivande endpoints är same-origin och nekar oväntade origins/content types.
11. Secrets och Access audience/team domain ligger som Worker secrets/vars, aldrig i klientbundle eller repo.
12. Server- och klientfel får inte logga PlanningData, belopp, radnamn eller hela e-postadresser.
13. Ett D1-fel ska ge fail closed. Klienten får inte fortsätta som om lokal sparning vore lyckad.
14. Två testidentiteter måste bevisa negativ isolering: A kan inte läsa eller skriva B:s år ens med manipulerad URL eller request body.

### Minsta säkerhetstestmatris

| Test | Förväntat resultat |
| --- | --- |
| Oautentiserad `GET /app` | Access-login, ingen workspace-data. |
| Oautentiserad API-request | Nekad innan data returneras. |
| Giltig Access-token men okänd användare | `403`, ingen auto-provision om ingen `invited` match finns. |
| Disabled användare med fortfarande giltig Access-session | `403` i applikationen. |
| Användare A försöker ange B:s household ID | ID ignoreras/nekas; ingen data lämnas. |
| Felaktig revision | `409`, ingen skrivning. |
| Ogiltig eller för stor PlanningData | `422` eller `413`, ingen skrivning. |
| D1 otillgänglig | Kontrollerat fel, ingen fallback till localStorage. |

## 13. Minimal administration

Ingen admin-UI ska byggas i Pilot 1.0.

För cirka 5–10 pilotanvändare hanteras Access allowlist och inbjudningar via Cloudflare. Intern `User`- och `Household`-provisionering sker genom minsta kontrollerade administrativa metod, till exempel lokala, icke-publika admin-kommandon. Ett riktigt `/admin` byggs först när faktisk administrativ friktion motiverar det.

Administration delas i två små ytor:

1. Cloudflare Zero Trust Dashboard används för Access-policyn och den explicita e-postlistan.
2. Lokala, icke-publika admin-kommandon används för Famekos interna data.

Föreslagna framtida kommandon:

- `pilot:user:create --email ... --name ...` skapar `User(status=invited)`, Household och owner-medlemskap atomiskt.
- `pilot:user:list` visar id, maskerad e-post, status, skapad tid och hushålls-id; aldrig ekonomisk data.
- `pilot:user:disable --user-id ...` sätter intern status till `disabled`.
- `pilot:identity:relink --user-id ...` används endast kontrollerat om Access subject ändras.
- `pilot:user:export --user-id ...` skapar portabel export.
- `pilot:user:delete --user-id ...` gör en förhandsvisning och kräver explicit bekräftelse.

Inaktivering görs i ordningen: intern status `disabled` först, därefter borttagning från Access-policyn. Därmed stoppas dataåtkomst även om en Access-cookie ännu är giltig.

CLI-kommandona ska använda samma repository och valideringsregler som applikationen. Frihands-SQL i dashboarden ska inte vara normal adminprocess.

## 14. Privacy, data och GDPR-riktning

Detta är inte juridisk rådgivning, men arkitekturen ska stödja följande från pilotstart:

### Dataminimering

- Spara endast intern identitet, e-post, valfritt visningsnamn, hushållsmedlemskap, PlanningData och nödvändig driftmetadata.
- Samla inte adress, personnummer, bankuppgifter, IP-historik eller profilfält som produkten inte behöver.
- Spara inte beräknade dubletter av ekonomiska värden.

### Datalokalisering och leverantör

- Skapa D1 med EU-jurisdiktion innan första personuppgiften lagras.
- Dokumentera Cloudflare som personuppgiftsbiträde och kontrollera aktuellt DPA före pilotinbjudan.
- Dokumentera var Access- och Workers-loggar lagras och deras retention; D1:s EU-jurisdiktion omfattar inte automatiskt alla Cloudflare-metadataflöden.

### Loggning

- Logga eventnamn, internt user-ID eller envägs-hash, år, resultatkod, latency, Cloudflare Ray ID och correlation ID.
- Logga aldrig PlanningData JSON, belopp, anpassade radnamn, Access JWT, cookies eller full e-post.
- Auth-händelser felsöks i Access authentication logs, inte genom egen kopia av auth-token.

### Backup och återställning

D1 Time Travel är alltid aktiverat och ger för närvarande sju dagars återställningsfönster på Workers Free och trettio dagar på Workers Paid. Se [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).

Pilotkrav:

- ta en namngiven Time Travel-bookmark eller verifierad export före varje schema-/datamigration.
- dokumentera och öva en återställning innan första piloten.
- använd inte R2-backup i första sprinten; lägg till krypterad periodisk export först när retention längre än Time Travel-fönstret faktiskt behövs.

### Export och borttagning

- Admin ska kunna exportera användarens User-, Household- och PlanningYear-data som läsbar, versionerad JSON.
- Borttagning ska först inaktivera användaren, visa exakt vilka hushåll och år som påverkas och kräva explicit bekräftelse.
- Om ett hushåll senare har fler medlemmar får en användarborttagning inte automatiskt radera hushållets ekonomi.
- Dokumentera att raderad data kan finnas kvar inom Time Travel-fönstret och när den slutligt faller ur återställningshistoriken.
- Fastställ en enkel retentionregel för inaktiva pilotkonton innan piloten startar; lagra inte pilotdata obegränsat utan beslut.

## 15. Observability

Pilotnivån ska använda Cloudflares befintliga verktyg, inte en ny analyticsplattform.

### Workers Logs

Aktivera Workers Logs för Worker `fameko` med strukturerade loggar för:

- `auth.verify.failed`.
- `auth.user.disabled`.
- `planning.read.failed`.
- `planning.save.failed`.
- `planning.save.conflict`.
- `planning.import.failed`.
- `db.query.failed`.

Cloudflare uppger att Workers Logs ingår i både Free och Paid; Free har för närvarande 200 000 events per dag och tre dagars retention. Se [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/).

Varje felrespons till klienten ska innehålla ett ofarligt correlation ID som kan matchas mot loggen. Användaren ska kunna säga “jag fick fel ABC123” utan att skicka sin ekonomiska data.

### Access- och D1-observation

- Access authentication logs används för att se tillåtna och nekade loginförsök. På Zero Trust Free är Access-loggretentionen för närvarande 24 timmar. Se [Zero Trust log retention](https://developers.cloudflare.com/cloudflare-one/insights/logs/) och [Access authentication logs](https://developers.cloudflare.com/cloudflare-one/insights/logs/dashboard-logs/access-authentication-logs/).
- D1 Dashboard används för query latency, rader lästa/skrivna och lagringsstorlek. Se [D1 metrics](https://developers.cloudflare.com/d1/observability/metrics-analytics/).
- Under aktiv pilotstart kontrolleras authfel och savefel dagligen. Ingen tung alertingplattform behövs.

## 16. Kostnadsbild

Kostnadsbilden nedan är verifierad 2026-08-28 och ska kontrolleras igen inför implementation.

| Tjänst | Pilotbruk | Nuvarande fri/låg kostnad | Vad kan börja kosta |
| --- | --- | --- | --- |
| Cloudflare Access | OTP, exakt e-postlista, skydd av `/app*` | Zero Trust Free: 0 USD för team under 50 användare | Pay-as-you-go anges till 7 USD/användare/månad över fri teamnivå; Access bör sannolikt ersättas före bred konsumentskala |
| Cloudflare Worker/OpenNext | Befintlig landing, workspace och Route Handlers | Workers Free: 100 000 requests/dag | Workers Paid har för närvarande minst 5 USD/månad och högre inkluderade gränser |
| Cloudflare D1 | Identitet, hushåll, PlanningYear JSON | Free: 5 miljoner rows read/dag, 100 000 rows written/dag och 5 GB total lagring | Paid debiterar över inkluderade månadsnivåer; full scans och täta autosaves driver usage |
| Workers Logs | Felsökning av auth/save/DB | Free: 200 000 events/dag, tre dagars retention | Paid inkluderar 20 miljoner events/månad och debiterar därefter |
| R2 | Används inte initialt | 0 i pilotarkitekturen | Längre backupretention kan senare ge lagrings-/operationskostnad |

Källor: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Cloudflare Zero Trust pricing](https://www.cloudflare.com/plans/zero-trust-services/) och [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/).

För 5–10 användare med ett fåtal årsobjekt bör Access, D1 och Workers ligga mycket långt under sina fria användningsgränser. Den största framtida kostnadstriggern är inte ekonomisk datalagring utan att använda en seat-baserad Zero Trust-produkt som publik konsumentauth.

## 17. Rekommenderad slutarkitektur för Pilot 1.0

```text
Browser
   │
   ├── GET / ──────────────────────────────────────► Public Landing
   │                                                  └── statisk Workspace-preview
   │
   └── /app* ──► Cloudflare Access (OTP + allowlist)
                    │
                    ▼
              Next.js / OpenNext
              Cloudflare Worker: fameko
                    │
                    ├── verifiera Access JWT
                    ├── resolve AuthIdentity → User
                    ├── kontrollera User.status
                    ├── resolve HouseholdMember → Household
                    ├── validera år, revision och PlanningData
                    │
                    ▼
              Cloudflare D1, EU jurisdiction
                    │
                    ├── users
                    ├── auth_identities
                    ├── households
                    ├── household_members
                    └── planning_years
                          └── planning_data: PlanningData v3
```

Det finns ingen direkt Browser → D1-väg. Det finns ingen e-post → PlanningYear-relation. Varje ekonomisk operation går genom verifierad identitet och serverhärlett hushållsmedlemskap.

## 18. Implementationsplan i små sprintar

### Pilot Sprint 1 – Datakontrakt och D1-fundament

Mål: Skapa en testbar servergrund utan att ändra Workspace 1.0:s ekonomiska beteende.

Bygg:

- delade PlanningData-typer och strikt runtime-validering för version 3.
- D1-databas med EU-jurisdiktion och binding.
- migrationer för `users`, `auth_identities`, `households`, `household_members` och `planning_years`.
- repository med prepared statements och revision.
- admin-kommandon create/list/disable för lokala och preview-miljöer.

Bygg inte:

- login-UI, migration från localStorage eller ändringar i workspaceflödet.
- familjedelning eller admin-UI.

Definition of done:

- migrationer kan köras från tom databas och upprepas säkert.
- unika constraints och foreign keys testas.
- två testhushåll kan skapas och kan inte blandas i repository-tester.
- PlanningData v3 round-trip ger identisk semantik.

### Pilot Sprint 2 – Auth och skyddad `/app`

Mål: Endast uttryckligen inbjudna identiteter kan nå arbetsytan eller dess framtida dataendpoints.

Bygg:

- statisk, sanerad produktpreview på landing i stället för iframe till `/app`.
- Cloudflare Access-applikation för `fameko.se/app*` med exakt e-postlista och OTP.
- JWT-verifiering av header, signatur och claims.
- första koppling från invited User till AuthIdentity.
- serverkontroll av `User.status` och hushållsmedlemskap.
- kanonisk redirect från `www` till apex för `/app`.

Bygg inte:

- egen loginform, lösenord, publik registrering eller social login.
- PlanningData-persistens ännu.

Definition of done:

- `/` är publik och `/app*` är skyddad.
- okänd, disabled och felaktigt konfigurerad identitet nekas.
- giltig invited användare aktiveras exakt en gång.
- Access subject exponeras inte som ekonomisk primärnyckel.

### Pilot Sprint 3 – Serverlagrad PlanningData

Mål: D1 blir enda auktoritativa källa för arbetsytans data.

Bygg:

- Route Handlers för lista, läsning och skrivning av planeringsår.
- serverhärledd household scope.
- full payloadvalidering, storleksgräns och revisionskontroll.
- laddnings-, sparnings-, fel- och konfliktstatus i workspace.
- serialiserad/koalescerad sparning efter bekräftade ekonomiska redigeringar.

Bygg inte:

- ny ekonomisk logik, ny navigering eller normaliserade kostnadstabeller.
- offline-synk eller automatisk konfliktmerge.

Definition of done:

- en användare kan logga in, ändra data, stänga browsern och återkomma till samma data.
- två användare får separata PlanningYear-rader.
- manipulerad household-input kan inte ge cross-tenant read/write.
- refresh under sparning ger inte tyst dataförlust.

### Pilot Sprint 4 – localStorage-migration och resiliens

Mål: Befintlig verklig lokal data kan flyttas en gång utan overwrite eller seed-falskpositiv.

Bygg:

- seed-jämförelse och explicit importprompt endast när serveråret saknas.
- create-only-import med servervalidering.
- verifierande readback före borttagning av localStorage-nyckeln.
- tydlig retry och correlation ID vid fel.
- test för två flikar och `409`-konflikt.

Bygg inte:

- merge mellan lokal och serverlagrad data.
- localStorage som permanent cache eller offlinefunktion.

Definition of done:

- oförändrad seed importeras inte som användardata.
- befintligt serverår kan aldrig skrivas över av import.
- misslyckad import lämnar lokal data orörd.
- lyckad import överlever ny browser/session via D1.

### Pilot Sprint 5 – Pilotdrift och första användare

Mål: Bjuda in de första personerna med fungerande support-, privacy- och återställningsrutiner.

Bygg/konfigurera:

- Workers Logs med redigerade strukturerade events.
- Access authloggrutin och D1-mätkontroll.
- export-, disable- och delete-kommandon med bekräftelse.
- dokumenterad Time Travel-återställning.
- pilotchecklista och supporttext för OTP-problem.
- 2 interna testkonton, därefter 2–3 användare, därefter högst 10.

Bygg inte:

- analyticsplattform, adminportal, betalning, offentlig onboarding eller familjeinbjudningar.

Definition of done:

- en authincident och en saveincident kan spåras via correlation/Ray ID utan att ekonomisk data loggas.
- export och inaktivering är testade.
- återställning är övad på icke-produktionsdata.
- pilotens privacy-/retentioninformation är dokumenterad och accepterad innan inbjudan.

## 19. Beslutslogg

| Beslut | Varför | Trigger för omprövning |
| --- | --- | --- |
| Cloudflare Access + OTP för Pilot 1.0 | Minst ny säkerhetsyta och passar exakt 5–10 kontrollerade användare | Publik registrering, branded auth, familjeinbjudningar eller konsumentskala |
| Separat `auth_identities` och intern `User.id` | Ekonomisk data får inte låsas till e-post eller Access subject | Behålls även vid providerbyte; modellen behöver inte omprövas |
| Household + HouseholdMember redan i piloten | Gör 1 user = 1 household nu och två vuxna senare utan datamigrering | Flera hushåll per användare kräver endast ny produktnavigation/policy |
| D1 med EU-jurisdiktion | Cloudflare-native, relationsstöd, låg kostnad och enkel drift | Extrem write concurrency, avancerad analytics eller andra compliancekrav |
| Hel PlanningData JSON per hushåll/år | Modellen utvecklas snabbt och läses/skrivs som en helhet | Serverqueries i delområden, stora payloads eller stabil domänmodell |
| Route Handlers under `/app/api` | Minsta förändring av nuvarande Client Component och en Access-policy för hela ytan | Server Components/Actions ger senare tydlig produktfördel |
| Revision med `409`, ingen merge | Förhindrar tyst dataförlust utan att bygga samarbetsmotor | Realtidssamarbete eller frekventa tvåanvändarkonflikter |
| Explicit engångsimport, ingen localStorage-cache | Säkert ägarskap och tydlig serverauktoritet | En separat beslutad offlineprodukt |
| Ingen admin-UI | 5–10 konton kan hanteras säkrare och billigare med dashboard + CLI | Återkommande supportarbete eller fler administratörer |
| Workers/Access/D1 native observability | Tillräcklig felsökning utan ny dataleverantör | Retention-, SLA- eller larmkrav över pilotnivå |

## 20. Fem viktigaste arkitekturbesluten

1. Cloudflare Access används för pilotauth, men Access-identiteten isoleras bakom Famekos interna User-ID.
2. Ekonomisk data ägs av Household och nås endast via serververifierad HouseholdMember.
3. D1 i EU-jurisdiktion är den enda serverdatabasen.
4. Komplett PlanningData lagras som versionerad JSON per Household och år med revision.
5. Servern härleder all access; klienten skickar aldrig ett betrott household ID och får aldrig falla tillbaka till localStorage efter serverfel.

## 21. Sådant som uttryckligen inte byggs i Pilot 1.0

- betalning eller prenumeration.
- offentlig registrering.
- social login.
- avancerade profiler.
- familjeinbjudningar eller delnings-UI.
- fler produktroller än den strukturella modellen kräver.
- bankintegration.
- AI, PDF eller notiser.
- scenariomotor.
- avancerad analytics.
- generell offlinefunktion.
- normaliserade tabeller för varje inkomst, kostnad och månad.

Workspace 1.0:s ekonomiska modell förblir låst under hela pilotarkitekturens implementation.
