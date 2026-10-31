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
      heading: "Personuppgiftsansvarig",
      paragraphs: [
        "Fameko drivs av [FULLSTÄNDIGT NAMN], [POSTADRESS]. Kontakt för integritetsfrågor: [E-POSTADRESS]. Produktägaren är personuppgiftsansvarig för den behandling som beskrivs här.",
      ],
    },
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
        "Fameko laddar inte externa leverantörslogotyper i arbetsytan. Varumärkesmarkörer visas lokalt och skickar inga företagsnamn till en logotyptjänst.",
      ],
    },
    {
      heading: "Behandling utanför EU/EES",
      paragraphs: [
        "WorkOS och Cloudflare kan innebära behandling eller åtkomst utanför EU/EES. [KOMPLETTERA med ingångna personuppgiftsbiträdesavtal, aktuella underbiträden, överföringsmekanismer och utförd tredjelandsbedömning innan publik lansering.]",
      ],
    },
    {
      heading: "Lagringstid och radering",
      paragraphs: [
        "[BESLUT KRÄVS: lagringstid för aktiva och inaktiva konton, WorkOS-historik, supportärenden och loggar.] D1:s återställningshistorik kan innehålla raderad information i upp till 30 dagar. Cloudflare Workers Logs har olika retention beroende på kontoplan.",
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
        "Du kan, beroende på omständigheterna, begära tillgång, rättelse, radering, begränsning och dataportabilitet samt invända mot behandling som bygger på berättigat intresse. Kontakt: [E-POSTADRESS]. Vi kan behöva verifiera din identitet innan en begäran genomförs.",
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
      heading: "Avtalspart och tjänst",
      paragraphs: [
        "Fameko tillhandahålls av [FULLSTÄNDIGT NAMN], [POSTADRESS], kontakt [E-POSTADRESS]. Fameko är ett frivilligt verktyg för att strukturera och planera hushållets ekonomi.",
        "[BESLUT KRÄVS: tjänsten är kostnadsfri pilot, kostnadsfri tjänst eller betald tjänst. Pris, betalningsvillkor, uppsägning och eventuell ångerrätt ska anges innan publik lansering.]",
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
        "[BESLUT KRÄVS: regler och förvarning för inaktiva konton samt vad som sker om tjänsten avvecklas.]",
      ],
    },
    {
      heading: "Ansvar och tvist",
      paragraphs: [
        "[JURIDISK GRANSKNING KRÄVS: skälig ansvarsbegränsning, svensk lag, behörig domstol och information om Allmänna reklamationsnämnden.]",
      ],
    },
  ],
  title: "Användarvillkor",
  updatedAt: legalDocumentReviewedAt,
  version: currentTermsDocumentVersion,
};
