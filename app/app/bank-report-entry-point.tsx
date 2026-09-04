import Link from "next/link";

export function BankReportEntryPoint() {
  return (
    <section className="mx-auto w-full max-w-[1560px] px-4 pb-2 pt-12 sm:px-6 lg:px-8 lg:pt-16" aria-labelledby="bank-report-entry-title">
      <div className="flex flex-col gap-5 border-y border-stone-200 py-6 sm:flex-row sm:items-center sm:justify-between sm:py-7">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-stone-950" id="bank-report-entry-title">Hushållets ekonomiska översikt</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-stone-500">Få en samlad bild av hushållets kassaflöde, tillgångar, skulder och ekonomiska hälsa.</p>
        </div>
        <Link className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 transition hover:border-stone-500 hover:text-stone-950" href="/app/ekonomisk-sammanstallning">Visa översikt <span aria-hidden="true" className="ml-2">→</span></Link>
      </div>
    </section>
  );
}
