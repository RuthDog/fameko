import Link from "next/link";

import type { LegalDocument } from "../server/legal/legal-documents.ts";

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <main className="min-h-screen bg-[#f7f5ef] px-4 py-8 text-stone-900 sm:px-6 sm:py-12">
      <article className="mx-auto max-w-3xl overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_24px_80px_rgba(28,25,23,0.08)]">
        <header className="border-b border-stone-200 bg-[#eef2ea] px-6 py-8 sm:px-10 sm:py-10">
          <Link className="text-sm font-semibold text-[#3f5140] underline-offset-4 hover:underline" href="/">
            Fameko
          </Link>
          <div className="mt-5 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold tracking-[0.16em] text-amber-950">
            ARBETSUTKAST – INTE SLUTLIGT GODKÄNT
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-stone-950 sm:text-5xl">
            {document.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-stone-700 sm:text-lg">
            {document.intro}
          </p>
          <dl className="mt-6 grid gap-2 text-sm text-stone-600 sm:grid-cols-3">
            <div><dt className="font-semibold text-stone-900">Version</dt><dd>{document.version}</dd></div>
            <div><dt className="font-semibold text-stone-900">Senast inventerad</dt><dd>{document.updatedAt}</dd></div>
            <div><dt className="font-semibold text-stone-900">Gäller från</dt><dd>{document.effectiveDate}</dd></div>
          </dl>
        </header>

        <div className="space-y-10 px-6 py-8 sm:px-10 sm:py-12">
          {document.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold tracking-[-0.025em] text-stone-950 sm:text-2xl">
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3 text-[15px] leading-7 text-stone-700 sm:text-base">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets ? (
                  <ul className="list-disc space-y-2 pl-5">
                    {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}

          <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
            Dokumentet innehåller platshållare och får inte presenteras som slutligt eller lanseringsklart.
          </aside>

          <nav aria-label="Juridiska dokument" className="flex flex-wrap gap-4 border-t border-stone-200 pt-6 text-sm font-semibold">
            <Link className="text-[#3f5140] underline-offset-4 hover:underline" href="/privacy">Integritetspolicy</Link>
            <Link className="text-[#3f5140] underline-offset-4 hover:underline" href="/terms">Användarvillkor</Link>
            <Link className="text-[#3f5140] underline-offset-4 hover:underline" href="/sign-up">Till registreringen</Link>
          </nav>
        </div>
      </article>
    </main>
  );
}
