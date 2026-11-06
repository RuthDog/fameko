import {
  currentPrivacyDocumentVersion,
  currentTermsDocumentVersion,
  legalDocumentEffectiveDate,
  legalDocumentReviewedAt,
} from "./legal-versions.ts";

export type LegalDocumentSection = {
  bullets?: readonly string[];
  heading: string;
  paragraphs: readonly string[];
};

export type LegalDocument = {
  effectiveDate: string;
  intro: string;
  sections: readonly LegalDocumentSection[];
  title: string;
  updatedAt: string;
  version: string;
};

export const privacyDocument: LegalDocument = {
  effectiveDate: legalDocumentEffectiveDate,
  intro:
    "Här beskriver vi hur Fameko behandlar personuppgifter när du frivilligt använder tjänsten.",
  sections: [
    {
      heading: "Vilka uppgifter Fameko behandlar",
      paragraphs: [
        "När du skapar och använder ett konto behandlas din e-postadress, verifieringsstatus, WorkOS användar-ID, interna användar- och hushålls-ID, godkända dokumentversioner samt nödvändig sessions- och säkerhetsinformation. Registreringen kräver inget namn.",
        "I planeringsverktyget väljer du själv vilka uppgifter du vill ange. Det kan vara inkomster, utgifter, saldon, sparande, boende, fordon, tillgångar, planeringsår och egna benämningar.",
        "När du kontaktar Fameko via e-post behandlas meddelandet, din e-postadress och e-postens tekniska metadata. Begränsade tekniska uppgifter kan också behandlas för drift och säkerhet, till exempel tidpunkt, typ av anrop, resultatkod och felsöknings-ID samt IP-adress och webbläsaruppgifter hos drift- och autentiseringsleverantörerna. Famekos egna felloggar ska inte innehålla e-postadress eller ekonomiska planeringsuppgifter.",
      ],
    },
    {
      heading: "Varför uppgifterna behandlas",
      paragraphs: [
        "Konto-, inloggnings- och planeringsuppgifter behandlas för att tillhandahålla tjänsten enligt användarvillkoren och vidta åtgärder på din begäran före registrering.",
        "Begränsade tekniska uppgifter behandlas för att skydda tjänsten, förhindra missbruk och lösa fel. Den behandlingen grundas på Famekos berättigade intresse av en säker och fungerande tjänst. Kontaktmeddelanden behandlas för att besvara din fråga och hantera eventuella rättsliga anspråk.",
        "Fameko använder inte dina planeringsuppgifter för reklam, profilering eller automatiserade beslut som har rättsliga eller liknande betydande följder. Att du godkänner användarvillkoren är inte ett generellt samtycke till personuppgiftsbehandling.",
      ],
    },
    {
      heading: "Frivillighet och dataminimering",
      paragraphs: [
        "Det är frivilligt att skapa ett Fameko-konto och använda tjänsten. För ett konto behövs en e-postadress för säker inloggning, men du avgör själv om och vilka ekonomiska belopp och detaljer du sparar. Tomma fält begränsar bara vilka översikter och beräkningar tjänsten kan visa.",
        "Skriv inte personnummer, kontonummer, hälsouppgifter eller andra känsliga personuppgifter i egna benämningar eller andra fria textfält. Lägg bara in uppgifter om andra personer om du har rätt att göra det.",
      ],
    },
    {
      heading: "Leverantörer och mottagare",
      paragraphs: [
        "Cloudflare används för webbdrift, trafikhantering, EU-begränsad D1-databas och begränsade driftloggar. WorkOS används för inloggningsfönster, e-postkod, identitet och sessioner. Famekos ekonomiska planeringsvärden skickas inte till WorkOS.",
        "Google (Gmail) används när du kontaktar Fameko på fameko.pilot@gmail.com. Google kan då behandla meddelandet, e-postadresser och teknisk e-postmetadata.",
        "Fameko begränsar de uppgifter som skickas till respektive tjänst. Fameko säljer inte personuppgifter och använder ingen extern logotyptjänst eller annonserings- eller analystjänst i arbetsytan. Tillämpliga personuppgiftsbiträdesavtal, leverantörsroller och aktuella underleverantörer är ännu inte slutligt verifierade och dokumenterade för publik lansering.",
      ],
    },
    {
      heading: "Behandling utanför EU/EES",
      paragraphs: [
        "Cloudflare, WorkOS och Google är internationella leverantörer. Uppgifter kan därför behandlas eller vara åtkomliga i länder utanför EU/EES, bland annat USA. WorkOS publicerade databehandlingstillägg innehåller EU-kommissionens standardavtalsklausuler, men Fameko har ännu inte slutfört dokumentationen av tillämpliga avtal, faktiska överföringar och kompletterande skydd. Detta måste vara klart före publik lansering.",
      ],
    },
    {
      heading: "Lagringstid och radering",
      paragraphs: [
        "Kontouppgifter, dokumentgodkännanden och planeringsdata sparas medan kontot används. Föreslagen gallringsregel inför publik lansering är en kontroll minst en gång per år. Om ingen inloggning har skett på 24 månader ska ett meddelande skickas till kontots e-postadress. Kontot och dess aktiva data ska raderas om användaren inte loggar in eller begär att få behålla kontot inom 30 dagar. Regeln och den praktiska rutinen är ännu inte slutligt beslutade.",
        "Du kan när som helst exportera dina Fameko-uppgifter som JSON och radera kontot via kontomenyn. Vid kontoradering tas den interna användaren, identitetskopplingen, medlemskapet, det egna hushållet, planeringsåren och dokumentgodkännandena bort från den aktiva D1-databasen. WorkOS-identiteten och aktiva sessioner tas också bort. Raderingen sker normalt direkt; om ett tekniskt fel uppstår inaktiveras kontot och ärendet följs upp utan onödigt dröjsmål.",
        "Raderade D1-uppgifter kan finnas kvar i Cloudflares skyddade Time Travel-historik i högst 30 dagar och försvinner därefter ur återställningsfönstret. Begränsade Workers-loggar sparas i högst 7 dagar. WorkOS uppger att säkerhetskopior raderas enligt leverantörens gallringsschema, men den exakta tidsgränsen och underleverantörernas tider är ännu inte verifierade av Fameko.",
        "Föreslagen regel är att avslutade supportärenden i Gmail raderas senast 12 månader efter den senaste kontakten. Uppgifter får sparas längre endast när det är nödvändigt för en rättslig skyldighet eller ett konkret rättsligt anspråk och ska raderas när det behovet upphör. Regeln och Gmail-kontots faktiska gallringsmöjligheter måste verifieras före publik lansering.",
      ],
    },
    {
      heading: "Cookies och lagring i webbläsaren",
      paragraphs: [
        "Fameko använder nödvändiga cookies för registrering, säker omdirigering och inloggad session. Famekos tillfälliga registreringscookie gäller i högst fem minuter. Sessionscookies gäller tills du loggar ut eller sessionen löper ut enligt den konfigurerade sessionstiden. Om nödvändiga cookies blockeras fungerar inte inloggningen. WorkOS inloggningsfönsters exakta cookieuppsättning och lagringstider är ännu inte slutligt verifierade.",
        "Valt planeringsår kan sparas lokalt i webbläsaren tills du tar bort webbplatsens lagrade data. En äldre Fameko-version kan också ha lämnat en lokal kopia av planeringsdata. Den kopian kan exporteras eller tas bort i Fameko och raderas inte automatiskt när serverkontot raderas.",
        "Fameko använder inte cookies för annonsering eller egen besöksanalys.",
      ],
    },
    {
      heading: "Dina rättigheter",
      paragraphs: [
        "Du kan exportera konto-, hushålls-, planerings- och dokumentgodkännandeuppgifter som JSON via kontomenyn. Beroende på omständigheterna kan du också begära tillgång, rättelse, radering, begränsning och dataportabilitet samt invända mot behandling som bygger på berättigat intresse. Kontakta fameko.pilot@gmail.com. Fameko kan behöva verifiera din identitet och svarar normalt inom en månad.",
        "Du har rätt att lämna klagomål till Integritetsskyddsmyndigheten på imy.se.",
      ],
    },
    {
      heading: "Ålder, säkerhet och ändringar",
      paragraphs: [
        "Fameko är endast avsett för personer som har fyllt 18 år. Tjänsten använder tekniska och organisatoriska skydd, men ingen internettjänst kan lämna en absolut säkerhetsgaranti.",
        "Väsentliga ändringar av denna policy ska beskrivas tydligt med ny version och nytt beslutsdatum innan de börjar gälla. Om en ändring påverkar hur ett befintligt konto används informeras användaren på ett rimligt sätt.",
      ],
    },
    {
      heading: "Kontakt och personuppgiftsansvarig",
      paragraphs: [
        "Fameko är ett fristående projekt som drivs av Ola Fischer som privatperson. Ola Fischer är personuppgiftsansvarig för den behandling som beskrivs i denna policy.",
        "För frågor om tjänsten eller hur personuppgifter hanteras, kontakta fameko.pilot@gmail.com.",
      ],
    },
  ],
  title: "Integritetspolicy",
  updatedAt: legalDocumentReviewedAt,
  version: currentPrivacyDocumentVersion,
};

export const termsDocument: LegalDocument = {
  effectiveDate: legalDocumentEffectiveDate,
  intro: "Dessa villkor gäller när du frivilligt använder Fameko.",
  sections: [
    {
      heading: "Om Fameko",
      paragraphs: [
        "Fameko är ett frivilligt verktyg för att strukturera och planera hushållets ekonomi.",
        "Tjänsten är kostnadsfri. Det finns ingen avgift eller prenumeration.",
      ],
    },
    {
      heading: "Behörighet och konto",
      paragraphs: [
        "Du måste vara minst 18 år. Registrering kräver en e-postadress som du har tillgång till och verifierar med e-postkod; något namn krävs inte. Avtalet uppstår när du godkänner villkoren och registreringen slutförs.",
        "Kontot är personligt. Du ansvarar för att skydda ditt e-postkonto och logga ut från delade enheter. Kontakta fameko.pilot@gmail.com om du misstänker att någon annan har fått tillgång till kontot.",
      ],
    },
    {
      heading: "Frivilliga uppgifter och ditt ansvar",
      paragraphs: [
        "Du väljer själv om och vilka belopp och detaljer du anger. Du ansvarar för att uppgifterna är rimliga för ditt syfte och att du har rätt att behandla uppgifter som rör andra personer.",
        "Ange inte personnummer, kontonummer, hälsouppgifter eller andra känsliga personuppgifter i egna benämningar eller andra fria textfält.",
      ],
    },
    {
      heading: "Inte finansiell rådgivning",
      paragraphs: [
        "Fameko visar översikter och beräkningar utifrån de uppgifter du anger. Tjänsten ersätter inte individuell finansiell, juridisk, skatte- eller kreditrådgivning. Kontrollera viktiga underlag själv och ta vid behov hjälp av en kvalificerad rådgivare.",
      ],
    },
    {
      heading: "Tillåten användning",
      paragraphs: [
        "Du får inte försöka kringgå behörighetskontroller, komma åt andras hushåll, störa tjänsten eller använda den i strid med lag. Fameko får tillfälligt begränsa ett konto när det behövs för säkerhet, felsökning eller för att stoppa missbruk.",
      ],
    },
    {
      heading: "Tillgänglighet och förändringar",
      paragraphs: [
        "Fameko utvecklas löpande och kan ibland vara otillgängligt eller innehålla fel. Tjänsten lämnar ingen garanti om oavbruten tillgång. Planerat underhåll och väsentliga förändringar meddelas på ett rimligt sätt när det är möjligt.",
        "Villkoren kan ändras när tjänsten eller rättsliga krav ändras. Väsentliga ändringar får en ny version och ett nytt beslutsdatum innan de börjar gälla. Rättigheter som följer av tvingande lag påverkas inte av villkoren.",
      ],
    },
    {
      heading: "Dina data, export och avslut",
      paragraphs: [
        "Du behåller dina rättigheter till de uppgifter du själv lägger in. Via kontomenyn kan du hämta en versionerad JSON-export med dina konto-, hushålls-, planerings- och dokumentgodkännandeuppgifter.",
        "Du kan radera kontot via kontomenyn efter en ny autentisering. Raderingen tar bort den interna användaren, identitetskopplingen, medlemskapet, ditt eget hushåll, planeringsåren och dokumentgodkännandena samt WorkOS-identiteten och aktiva sessioner. Åtgärden kan inte ångras, så exportera först om du vill behålla en kopia. En äldre lokal webbläsarkopia måste du ta bort separat.",
        "Föreslagen gallringsregel är att ett konto som inte har använts på 24 månader kan avslutas efter e-postmeddelande och 30 dagars möjlighet att behålla kontot. Regeln är ännu inte slutligt beslutad. Fameko kan också avveckla tjänsten. När det är rimligt möjligt lämnas då förhandsinformation och möjlighet att exportera uppgifter.",
      ],
    },
    {
      heading: "Ansvar och tvist",
      paragraphs: [
        "Fameko ansvarar enligt tvingande lag. Eftersom resultatet bygger på dina uppgifter ansvarar Fameko inte för beslut som grundas på felaktiga eller ofullständiga indata. Villkoren begränsar inte ansvar som enligt lag inte får begränsas.",
        "Svensk lag tillämpas i den mån lagen tillåter. Kontakta först fameko.pilot@gmail.com om du har ett klagomål. En tvist som inte kan lösas genom dialog prövas av svensk allmän domstol, om inte tvingande lag ger rätt till en annan prövning.",
      ],
    },
    {
      heading: "Kontakt och avtalspart",
      paragraphs: [
        "Fameko är ett fristående projekt som drivs av Ola Fischer. Tjänsten tillhandahålls kostnadsfritt.",
        "För frågor om tjänsten och användarvillkoren, kontakta fameko.pilot@gmail.com.",
      ],
    },
  ],
  title: "Användarvillkor",
  updatedAt: legalDocumentReviewedAt,
  version: currentTermsDocumentVersion,
};
