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

test("draft legal documents remain visibly incomplete and versioned", async () => {
  assert.equal(privacyDocument.version, currentPrivacyDocumentVersion);
  assert.equal(termsDocument.version, currentTermsDocumentVersion);
  assert.match(privacyDocument.intro, /arbetsutkast/i);
  assert.match(termsDocument.intro, /arbetsutkast/i);

  const combined = JSON.stringify([privacyDocument, termsDocument]);
  assert.match(combined, /\[FULLSTÄNDIGT NAMN\]/);
  assert.match(combined, /fameko\.pilot@gmail\.com/);
  assert.doesNotMatch(combined, /\[E-POSTADRESS\]/);
  assert.match(combined, /BESLUT KRÄVS/);
  assert.doesNotMatch(combined, /samtycker till behandling av (alla )?personuppgifter/i);
});

test("legal drafts reflect established launch facts without claiming unfinished controls", () => {
  const privacy = JSON.stringify(privacyDocument);
  const terms = JSON.stringify(termsDocument);

  assert.match(terms, /Fameko erbjuds kostnadsfritt\./);
  assert.match(privacy, /inte har använts på 24 månader/);
  assert.match(privacy, /minst 30 dagars möjlighet/);
  assert.match(privacy, /senast inom 30 dagar/);
  assert.match(privacy, /högst 12 månader efter att ärendet avslutats/);
  assert.match(privacy, /7 dagar på Workers Free eller 30 dagar på Workers Paid/);
  assert.match(privacy, /Google \(Gmail\)/);
  assert.match(privacy, /måste verifieras och dokumenteras före slutligt godkännande/);
  assert.match(privacy, /inte färdigställd/);
  assert.match(terms, /KOMPLETTERA när fullständig export och säker kontoradering/);
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
    "Fameko är ett fristående projekt som drivs av en privatperson. För frågor om tjänsten och hur personuppgifter hanteras kan du kontakta fameko.pilot@gmail.com. Personuppgiftsansvarig är [FULLSTÄNDIGT NAMN].",
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
    "Fameko tillhandahålls av [FULLSTÄNDIGT NAMN], [POSTADRESS]. Kontakt: fameko.pilot@gmail.com.",
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
