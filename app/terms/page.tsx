import type { Metadata } from "next";

import { LegalDocumentPage } from "../legal-document-page.tsx";
import { termsDocument } from "../../server/legal/legal-documents.ts";

export const metadata: Metadata = {
  title: "Användarvillkor – arbetsutkast – Fameko",
};

export default function TermsPage() {
  return <LegalDocumentPage document={termsDocument} />;
}
