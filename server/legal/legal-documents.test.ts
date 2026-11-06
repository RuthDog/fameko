import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { privacyDocument, termsDocument } from "./legal-documents.ts";
import {
  currentPrivacyDocumentVersion,
  currentTermsDocumentVersion,
} from "./legal-versions.ts";

const privacyPageUrl = new URL("../../app/privacy/page.tsx", import.meta.url);
const termsPageUrl = new URL("../../app/terms/page.tsx", import.meta.url);
const legalPageUrl = new URL("../../app/legal-document-page.tsx", import.meta.url);
const authStagingConfigUrl = new URL("../../wrangler.auth-staging.jsonc", import.meta.url);
const brandLogoUrl = new URL("../../app/components/brand-logo.tsx", import.meta.url);

test("legal documents remain draft-versioned without internal editing notes", async () => {
  assert.equal(privacyDocument.version, currentPrivacyDocumentVersion);
  assert.equal(termsDocument.version, currentTermsDocumentVersion);
  assert.match(privacyDocument.version, /-draft$/);
  assert.match(termsDocument.version, /-draft$/);
  assert.equal(privacyDocument.effectiveDate, "Ej fastställt");
  assert.equal(termsDocument.effectiveDate, "Ej fastställt");

  const combined = JSON.stringify([privacyDocument, termsDocument]);
  assert.match(combined, /\[FULLSTÄNDIGT NAMN – FASTSTÄLLS FÖRE PUBLICERING\]/);
  assert.match(combined, /fameko\.pilot@gmail\.com/);
  assert.doesNotMatch(
    combined,
    /\[E-POSTADRESS\]|KOMPLETTERA|BESLUT KRÄVS|JURIDISK GRANSKNING|\[POSTADRESS\]/,
  );
  assert.doesNotMatch(combined, /samtycker till behandling av (alla )?personuppgifter/i);
});

test("legal drafts reflect the implemented service and proposed retention policy", () => {
  const privacy = JSON.stringify(privacyDocument);
  const terms = JSON.stringify(termsDocument);

  assert.match(terms, /Tjänsten är kostnadsfri\. Det finns ingen avgift eller prenumeration\./);
  assert.match(terms, /frivilligt verktyg/);
  assert.match(terms, /minst 18 år/);
  assert.match(terms, /verifierar med e-postkod; något namn krävs inte/);
  assert.match(privacy, /ingen inloggning har skett på 24 månader/);
  assert.match(privacy, /inom 30 dagar/);
  assert.match(privacy, /Föreslagen regel är att avslutade supportärenden/);
  assert.match(privacy, /senast 12 månader efter den senaste kontakten/);
  assert.match(privacy, /Time Travel-historik i högst 30 dagar/);
  assert.match(privacy, /Workers-loggar sparas i högst 7 dagar/);
  assert.match(privacy, /Google \(Gmail\)/);
  assert.match(privacy, /ännu inte slutligt verifierade och dokumenterade/);
  assert.match(privacy, /exakta cookieuppsättning och lagringstider är ännu inte/);
  assert.match(privacy, /exportera dina Fameko-uppgifter som JSON och radera kontot/);
  assert.match(privacy, /WorkOS-identiteten och aktiva sessioner tas också bort/);
  assert.match(terms, /versionerad JSON-export/);
  assert.match(terms, /Du kan radera kontot via kontomenyn efter en ny autentisering/);
  assert.match(terms, /Föreslagen gallringsregel/);
  assert.doesNotMatch(privacy + terms, /inte färdigställd|när .* är implementerad/i);
});

test("privacy sections keep the approved order and end with controller contact", () => {
  assert.deepEqual(
    privacyDocument.sections.map((section) => section.heading),
    [
      "Vilka uppgifter Fameko behandlar",
      "Varför uppgifterna behandlas",
      "Frivillighet och dataminimering",
      "Leverantörer och mottagare",
      "Behandling utanför EU/EES",
      "Lagringstid och radering",
      "Cookies och lagring i webbläsaren",
      "Dina rättigheter",
      "Ålder, säkerhet och ändringar",
      "Kontakt och personuppgiftsansvarig",
    ],
  );
  assert.deepEqual(privacyDocument.sections.at(-1)?.paragraphs, [
    "Fameko är ett fristående projekt som drivs av en privatperson. Personuppgiftsansvarig och kontakt för dataskyddsfrågor är [FULLSTÄNDIGT NAMN – FASTSTÄLLS FÖRE PUBLICERING], fameko.pilot@gmail.com.",
  ]);
});

test("terms sections keep the approved order and end with contracting-party contact", () => {
  assert.deepEqual(
    termsDocument.sections.map((section) => section.heading),
    [
      "Om Fameko",
      "Behörighet och konto",
      "Frivilliga uppgifter och ditt ansvar",
      "Inte finansiell rådgivning",
      "Tillåten användning",
      "Tillgänglighet och förändringar",
      "Dina data, export och avslut",
      "Ansvar och tvist",
      "Kontakt och avtalspart",
    ],
  );
  assert.equal(
    termsDocument.sections[0]?.paragraphs[0],
    "Fameko är ett frivilligt verktyg för att strukturera och planera hushållets ekonomi.",
  );
  assert.deepEqual(termsDocument.sections.at(-1)?.paragraphs, [
    "Fameko tillhandahålls av [FULLSTÄNDIGT NAMN – FASTSTÄLLS FÖRE PUBLICERING], privatperson. Kontakt: fameko.pilot@gmail.com.",
  ]);
});

test("privacy and terms routes use the shared mobile legal-document presentation", async () => {
  const [privacyPage, termsPage, legalPage] = await Promise.all([
    readFile(privacyPageUrl, "utf8"),
    readFile(termsPageUrl, "utf8"),
    readFile(legalPageUrl, "utf8"),
  ]);

  assert.match(privacyPage, /privacyDocument/);
  assert.match(termsPage, /termsDocument/);
  assert.match(legalPage, /ARBETSUTKAST/);
  assert.match(legalPage, /max-w-\[720px\]/);
  assert.match(legalPage, /text-\[26px\]/);
  assert.match(legalPage, /text-\[15px\]/);
  assert.match(legalPage, /space-y-\[11px\]/);
  assert.match(legalPage, /Version \{document\.version\}/);
  assert.match(legalPage, /href="\/sign-up"/);
  assert.doesNotMatch(legalPage, /rounded-\[28px\]|shadow-|bg-amber-|rounded-2xl/);
});

test("auth staging minimizes automatic request logs while retaining bounded diagnostics", async () => {
  const [configSource, diagnosticsSource] = await Promise.all([
    readFile(authStagingConfigUrl, "utf8"),
    readFile(new URL("../auth/auth-diagnostics.ts", import.meta.url), "utf8"),
  ]);
  const config = JSON.parse(configSource) as {
    observability?: {
      enabled?: boolean;
      logs?: { enabled?: boolean; head_sampling_rate?: number; invocation_logs?: boolean };
    };
  };

  assert.equal(config.observability?.enabled, true);
  assert.equal(config.observability?.logs?.enabled, true);
  assert.equal(config.observability?.logs?.head_sampling_rate, 1);
  assert.equal(config.observability?.logs?.invocation_logs, false);
  assert.match(diagnosticsSource, /event: "fameko_auth_failure"/);
  const reportSection = diagnosticsSource.slice(
    diagnosticsSource.indexOf("export function reportAuthFlowFailure"),
    diagnosticsSource.indexOf("export function authErrorUrl"),
  );
  assert.doesNotMatch(reportSection, /request\.url|requestUrl|authorization|cookie|email/i);
});

test("brand markers do not load an external logo provider", async () => {
  const brandLogoSource = await readFile(brandLogoUrl, "utf8");

  assert.match(brandLogoSource, /bg-stone-200/);
  assert.doesNotMatch(brandLogoSource, /<img|https?:\/\/|Logo\.dev|process\.env/);
});
