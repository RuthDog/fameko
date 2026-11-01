import { checkRecentAuth, getSignInUrl } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DeleteAccountForm } from "./delete-account-form.tsx";

export const dynamic = "force-dynamic";

export default async function DeleteAccountPage() {
  const recent = await checkRecentAuth({ maxAge: 300 });
  if (recent.isStale) {
    redirect(await getSignInUrl({ maxAge: 300, returnTo: "/app/account/delete" }));
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
