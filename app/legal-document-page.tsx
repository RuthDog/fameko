import Link from "next/link";

import type { LegalDocument } from "../server/legal/legal-documents.ts";

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <main className="min-h-screen bg-[#faf9f7] px-5 py-8 text-stone-900 sm:px-6 sm:py-10">
      <article className="mx-auto w-full max-w-[720px]">
        <header>
          <Link className="text-[13px] font-semibold text-stone-700 underline-offset-4 hover:underline" href="/">
            Fameko
          </Link>
          <p className="mt-5 text-[11px] font-semibold tracking-[0.08em] text-stone-500">
            ARBETSUTKAST – INTE SLUTLIGT GODKÄNT
          </p>
          <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.025em] text-stone-950">
            {document.title}
          </h1>
          <p className="mt-3 text-[14px] leading-[1.65] text-stone-600 sm:text-[13px] sm:leading-[1.6]">
            {document.intro}
          </p>
        </header>

        <div className="mt-8 space-y-6">
          {document.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-[15px] font-semibold leading-6 text-stone-900">
                {section.heading}
              </h2>
              <div className="mt-2 space-y-[11px] text-[14px] leading-[1.65] text-stone-700 sm:text-[13px] sm:leading-[1.6]">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets ? (
                  <ul className="list-disc space-y-[10px] pl-5">
                    {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}

          <p className="border-t border-stone-200 pt-4 text-[12px] leading-[1.6] text-stone-500">
            Dokumentet innehåller platshållare och får inte presenteras som slutligt eller lanseringsklart.
          </p>

          <nav aria-label="Juridiska dokument" className="flex flex-wrap gap-x-4 gap-y-2 text-[12px] font-medium">
            <Link className="text-stone-600 underline underline-offset-4 hover:text-stone-900" href="/privacy">Integritetspolicy</Link>
            <Link className="text-stone-600 underline underline-offset-4 hover:text-stone-900" href="/terms">Användarvillkor</Link>
            <Link className="text-stone-600 underline underline-offset-4 hover:text-stone-900" href="/sign-up">Till registreringen</Link>
          </nav>

          <footer className="pb-2 text-[11px] leading-5 text-stone-500">
            Version {document.version} · Senast inventerad {document.updatedAt} · Gäller från {document.effectiveDate}
          </footer>
        </div>
      </article>
    </main>
  );
}
