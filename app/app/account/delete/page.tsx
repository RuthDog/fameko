import { checkRecentAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";

import { needsAccountDeleteReauthentication } from "../../../../server/account/account-delete-auth.ts";
import { DeleteAccountForm } from "./delete-account-form.tsx";

export const dynamic = "force-dynamic";

export default async function DeleteAccountPage() {
  const needsReauthentication = await needsAccountDeleteReauthentication(checkRecentAuth);
  if (needsReauthentication) {
    return (
      <main className="min-h-screen bg-stone-50 px-4 py-10 text-stone-900">
        <section className="mx-auto max-w-xl rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <Link className="text-sm font-semibold text-stone-600 underline" href="/app/legal/accept">
            Till kontoalternativ
          </Link>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Bekräfta din inloggning</h1>
          <p className="mt-4 text-sm leading-6 text-stone-700">
            Du behöver logga in igen innan du kan öppna sidan för kontoradering.
          </p>
          <a
            className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-stone-900 px-5 text-sm font-semibold text-white"
            href="/auth/reauth/account-delete"
          >
            Logga in igen
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-10 text-stone-900">
      <section className="mx-auto max-w-xl rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <Link className="text-sm font-semibold text-stone-600 underline" href="/app">
          Tillbaka till arbetsytan
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Radera mitt konto</h1>
        <p className="mt-4 text-sm leading-6 text-stone-700">
          Kontot, hushållet och alla planeringsår tas bort permanent. WorkOS-identiteten och
          aktiva sessioner avslutas också. Åtgärden kan inte ångras.
        </p>
        <p className="mt-3 text-sm leading-6 text-stone-700">
          Radering tillåts bara när du är ensam ägare och enda medlem i hushållet. Vid
          osäkerhet avbryts åtgärden och uppgifterna behålls.
        </p>
        <DeleteAccountForm />
      </section>
    </main>
  );
}
