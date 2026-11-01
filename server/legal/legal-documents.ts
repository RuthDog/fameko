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
    "Detta arbetsutkast beskriver hur Fameko avser att behandla personuppgifter. Uppgifterna inom hakparenteser och markerade beslut måste fastställas innan dokumentet får användas för en publik lansering.",
  sections: [
    {
      heading: "Vilka uppgifter Fameko behandlar",
      paragraphs: [
        "För konto och inloggning behandlas e-postadress, verifieringsstatus, WorkOS användar-ID, interna användar- och hushålls-ID samt nödvändig sessions- och säkerhetsinformation.",
        "I planeringsverktyget väljer du själv vilka uppgifter du vill ange. Det kan vara inkomster, utgifter, saldon, sparande, boende, fordon, tillgångar, planeringsår och frivilliga benämningar. Fameko behöver inte ditt namn för registrering.",
        "Begränsad teknisk information kan behandlas för drift och säkerhet, exempelvis tidpunkt, route, resultatkod, korrelations-ID, IP-adress och webbläsaruppgifter hos drift- och autentiseringsleverantörerna.",
      ],
    },
    {
      heading: "Varför uppgifterna behandlas",
      paragraphs: [
        "Konto-, inloggnings- och planeringsuppgifter behandlas för att tillhandahålla den tjänst du själv väljer att använda. Avsedd rättslig grund är avtal eller åtgärder på din begäran innan avtal ingås.",
        "Begränsad säkerhets- och feldiagnostik avses behandlas med stöd av berättigat intresse efter dokumenterad intresseavvägning. Ett godkännande av användarvillkor är inte ett generellt GDPR-samtycke.",
      ],
    },
    {
      heading: "Frivillighet och dataminimering",
      paragraphs: [
        "Det är frivilligt att skapa ett Fameko-konto. Du avgör själv vilka ekonomiska belopp och detaljer du fyller i. För att använda ett konto krävs dock en e-postadress för säker inloggning.",
        "Skriv inte personnummer, kontonummer, hälsouppgifter eller andra känsliga personuppgifter i fria textfält.",
      ],
    },
    {
      heading: "Leverantörer och mottagare",
      paragraphs: [
        "Cloudflare används för webbdrift, routing, EU-begränsad D1-databas och driftloggar. WorkOS används för Hosted UI, e-postkod, identitet och sessioner. Ekonomiska planeringsvärden skickas inte till WorkOS av Famekos integration.",
        "Google (Gmail) används när du kontaktar Fameko via e-post. Meddelandets innehåll, din e-postadress och teknisk e-postmetadata kan då behandlas av Google. [KOMPLETTERA med verifierad avtals-, lagrings- och överföringsinformation före slutligt godkännande.]",
        "Fameko laddar inte externa leverantörslogotyper i arbetsytan. Varumärkesmarkörer visas lokalt och skickar inga företagsnamn till en logotyptjänst.",
      ],
    },
    {
      heading: "Behandling utanför EU/EES",
      paragraphs: [
        "WorkOS, Cloudflare och Google kan innebära behandling eller åtkomst utanför EU/EES. [KOMPLETTERA med ingångna personuppgiftsbiträdesavtal, aktuella underbiträden, överföringsmekanismer och utförd tredjelandsbedömning innan publik lansering.]",
      ],
    },
    {
      heading: "Lagringstid och radering",
      paragraphs: [
        "Kontouppgifter och planeringsdata sparas medan kontot används. Föreslagen regel är att ett konto som inte har använts på 24 månader får raderas efter e-postmeddelande och minst 30 dagars möjlighet att behålla kontot. När den säkra raderingsfunktionen är implementerad ska en bekräftad begäran normalt slutföras omedelbart och senast inom 30 dagar om teknisk uppföljning krävs. [BESLUT KRÄVS: godkänn dessa lagringstider före publik lansering.]",
        "Supportärenden föreslås sparas i högst 12 månader efter att ärendet avslutats, om uppgifterna inte behöver behållas längre för ett konkret rättsligt anspråk. [BESLUT KRÄVS: godkänn lagringstiden och verifiera Gmail-kontots faktiska gallringsmöjligheter.]",
        "Raderade D1-uppgifter kan finnas kvar i Cloudflare Time Travel i 7 dagar på Workers Free eller 30 dagar på Workers Paid. Aktuell kontoplan och faktisk retention måste verifieras före lansering. Cloudflare Workers Logs har enligt nuvarande dokumentation högst 7 dagars retention. Lagringstid och radering hos WorkOS och eventuella underbiträden måste verifieras och dokumenteras före slutligt godkännande.",
        "En fullständig självbetjäningsfunktion för export och kontoradering är inte färdigställd. Den ska omfatta Fameko-data, WorkOS-identitet och aktiva sessioner utan att påverka andra hushåll.",
      ],
    },
    {
      heading: "Cookies och lagring i webbläsaren",
      paragraphs: [
        "Fameko använder nödvändiga, säkra cookies för registrering, PKCE/state och inloggad session. Ett valt planeringsår kan sparas lokalt. En äldre Fameko-version kan ha lämnat en lokal kopia av planeringsdata som användaren kan exportera eller ta bort.",
        "[KOMPLETTERA efter verifierad browserinventering av WorkOS Hosted UI:s cookies.]",
      ],
    },
    {
      heading: "Dina rättigheter",
      paragraphs: [
        "Du kan, beroende på omständigheterna, begära tillgång, rättelse, radering, begränsning och dataportabilitet samt invända mot behandling som bygger på berättigat intresse. Kontakta fameko.pilot@gmail.com. Vi kan behöva verifiera din identitet innan en begäran genomförs.",
        "Du kan lämna klagomål till Integritetsskyddsmyndigheten, imy.se.",
      ],
    },
    {
      heading: "Ålder, säkerhet och ändringar",
      paragraphs: [
        "Fameko är avsett för personer som har fyllt 18 år. Tjänsten använder tekniska och organisatoriska skydd men kan inte lämna absoluta garantier.",
        "Väsentliga ändringar ska beskrivas tydligt med ny version och beslutsdatum innan de börjar gälla.",
      ],
    },
    {
      heading: "Kontakt och personuppgiftsansvarig",
      paragraphs: [
        "Fameko är ett fristående projekt som drivs av en privatperson. För frågor om tjänsten och hur personuppgifter hanteras kan du kontakta fameko.pilot@gmail.com. Personuppgiftsansvarig är [FULLSTÄNDIGT NAMN].",
      ],
    },
  ],
  title: "Integritetspolicy",
  updatedAt: legalDocumentReviewedAt,
  version: currentPrivacyDocumentVersion,
};

export const termsDocument: LegalDocument = {
  effectiveDate: legalDocumentEffectiveDate,
  intro:
    "Detta är ett arbetsutkast till Famekos användarvillkor. Platshållare och markerade beslut måste fastställas innan villkoren kan godkännas för publik användning.",
  sections: [
    {
      heading: "Om Fameko",
      paragraphs: [
        "Fameko är ett frivilligt verktyg för att strukturera och planera hushållets ekonomi.",
        "Fameko erbjuds kostnadsfritt.",
      ],
    },
    {
      heading: "Behörighet och konto",
      paragraphs: [
        "Du måste vara minst 18 år. Registrering kräver en e-postadress som du har tillgång till och verifierar med e-postkod. Du ansvarar för att skydda ditt e-postkonto och avsluta sessionen på delade enheter.",
      ],
    },
    {
      heading: "Frivilliga uppgifter och ditt ansvar",
      paragraphs: [
        "Du väljer själv vilka belopp och detaljer du anger och ansvarar för att du har rätt att behandla uppgifter som rör andra personer. Ange inte personnummer, kontonummer eller känsliga personuppgifter i fria textfält.",
      ],
    },
    {
      heading: "Inte finansiell rådgivning",
      paragraphs: [
        "Fameko ger översikter och beräkningar baserade på dina uppgifter. Tjänsten ersätter inte individuell finansiell, juridisk, skatte- eller kreditrådgivning. Du ansvarar för beslut som fattas med hjälp av underlaget.",
      ],
    },
    {
      heading: "Tillåten användning",
      paragraphs: [
        "Du får inte försöka kringgå behörighetskontroller, komma åt andras hushåll, störa tjänsten eller använda den i strid med lag. Fameko får begränsa ett konto när det är nödvändigt för säkerhet eller för att stoppa missbruk.",
      ],
    },
    {
      heading: "Tillgänglighet och förändringar",
      paragraphs: [
        "Fameko utvecklas löpande och kan tillfälligt vara otillgängligt. Väsentliga förändringar av tjänsten eller villkoren ska meddelas på ett tydligt sätt. Tvingande konsumenträtt påverkas inte av dessa villkor.",
      ],
    },
    {
      heading: "Dina data, export och avslut",
      paragraphs: [
        "Du behåller dina rättigheter till de uppgifter du själv lägger in. [KOMPLETTERA när fullständig export och säker kontoradering är implementerade och testade.]",
        "Föreslagen regel är att ett konto som inte har använts på 24 månader får avslutas efter e-postmeddelande och minst 30 dagars möjlighet att behålla kontot. [BESLUT KRÄVS: godkänn regeln och fastställ vad som sker om tjänsten avvecklas.]",
      ],
    },
    {
      heading: "Ansvar och tvist",
      paragraphs: [
        "[JURIDISK GRANSKNING KRÄVS: skälig ansvarsbegränsning, svensk lag, behörig domstol och information om Allmänna reklamationsnämnden.]",
      ],
    },
    {
      heading: "Kontakt och avtalspart",
      paragraphs: [
        "Fameko tillhandahålls av [FULLSTÄNDIGT NAMN], [POSTADRESS]. Kontakt: fameko.pilot@gmail.com.",
      ],
    },
  ],
  title: "Användarvillkor",
  updatedAt: legalDocumentReviewedAt,
  version: currentTermsDocumentVersion,
};
