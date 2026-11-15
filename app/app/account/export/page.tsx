import Link from "next/link";

import { AccountExportButton } from "./account-export-button.tsx";

export const dynamic = "force-dynamic";

export default function AccountExportPage() {
  return (
    <main className="min-h-screen bg-stone-50 px-4 py-10 text-stone-900">
      <section className="mx-auto max-w-xl rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <Link className="text-sm font-semibold text-stone-600 underline" href="/app/legal/accept">
          Till kontoalternativ
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Exportera mina uppgifter</h1>
        <p className="mt-4 text-sm leading-6 text-stone-700">
          Exporten är en versionerad JSON-fil med dina konto-, hushålls-,
          planerings- och dokumentgodkännandeuppgifter.
        </p>
        <AccountExportButton />
      </section>
    </main>
  );
}
