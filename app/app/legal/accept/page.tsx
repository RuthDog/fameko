import Link from "next/link";

import {
  currentPrivacyDocumentVersion,
  currentTermsDocumentVersion,
} from "../../../../server/legal/legal-versions.ts";
import { safePostAcceptancePath } from "../../../../server/legal/legal-acceptance.ts";

export const dynamic = "force-dynamic";

export default async function LegalAcceptancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; returnTo?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safePostAcceptancePath(params.returnTo ?? null);
  const showError = params.error === "terms-required";

  return (
    <main className="min-h-screen bg-[#faf9f7] px-5 py-8 text-stone-900 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-[560px]">
        <Link className="text-[13px] font-semibold text-stone-700 underline-offset-4 hover:underline" href="/">
          Fameko
        </Link>
        <p className="mt-8 text-[11px] font-semibold tracking-[0.08em] text-stone-500">
          VILLKOR 1.0
        </p>
        <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.03em] text-stone-950">
          Godkänn villkoren för att fortsätta
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-stone-600">
          Läs Famekos användarvillkor och integritetspolicy. Integritetspolicyn
          beskriver personuppgiftsbehandlingen; godkännandet nedan gäller avtalet
          och är inte ett generellt GDPR-samtycke.
        </p>

        <nav aria-label="Juridiska dokument" className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold">
          <Link className="text-stone-700 underline underline-offset-4" href="/terms">
            Användarvillkor
          </Link>
          <Link className="text-stone-700 underline underline-offset-4" href="/privacy">
            Integritetspolicy
          </Link>
        </nav>

        {showError ? (
          <p className="mt-6 text-sm font-semibold text-rose-700" role="alert">
            Du måste aktivt godkänna användarvillkoren för att öppna planeringsverktyget.
          </p>
        ) : null}

        <form action="/app/api/legal/accept" className="mt-7" method="post">
          <label className="flex items-start gap-3 text-[15px] leading-6 text-stone-800">
            <input
              className="mt-0.5 h-5 w-5 shrink-0 accent-stone-900"
              name="terms-confirmation"
              required
              type="checkbox"
              value={currentTermsDocumentVersion}
            />
            <span>
              Jag har läst och godkänner användarvillkoren ({currentTermsDocumentVersion}).
            </span>
          </label>
          <input name="privacy-version" type="hidden" value={currentPrivacyDocumentVersion} />
          <input name="return-to" type="hidden" value={returnTo} />
          <button
            className="mt-7 min-h-12 w-full rounded-full bg-[#1d252d] px-5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-900"
            type="submit"
          >
            Godkänn och fortsätt
          </button>
        </form>

        <div className="mt-10 border-t border-stone-200 pt-6">
          <p className="text-sm leading-6 text-stone-600">
            Du kan exportera dina uppgifter eller radera kontot utan att godkänna de nya villkoren.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold">
            <Link className="text-stone-700 underline underline-offset-4" href="/app/account/export">
              Exportera mina uppgifter
            </Link>
            <Link className="text-rose-700 underline underline-offset-4" href="/app/account/delete">
              Radera mitt konto
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
