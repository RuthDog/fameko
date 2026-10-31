import type { Metadata } from "next";

import { LegalDocumentPage } from "../legal-document-page.tsx";
import { privacyDocument } from "../../server/legal/legal-documents.ts";

export const metadata: Metadata = {
  title: "Integritetspolicy – arbetsutkast – Fameko",
};

export default function PrivacyPage() {
  return <LegalDocumentPage document={privacyDocument} />;
}
