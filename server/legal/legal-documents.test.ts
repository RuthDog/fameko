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
  assert.match(combined, /\[E-POSTADRESS\]/);
  assert.match(combined, /BESLUT KRÄVS/);
  assert.doesNotMatch(combined, /samtycker till behandling av (alla )?personuppgifter/i);
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
  assert.match(legalPage, /max-w-3xl/);
  assert.match(legalPage, /px-4/);
  assert.match(legalPage, /href="\/sign-up"/);
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
