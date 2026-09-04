"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { buildBankReportModel } from "../../../shared/planning/bank-report.ts";
import { BankReportView } from "../bank-report-view.tsx";
import { BankReportPdfAction } from "../bank-report-pdf-action.tsx";
import { usePlanningDetail } from "../use-planning-detail.ts";

export default function BankReportPreviewPage() {
  const planning = usePlanningDetail();
  const [generatedAt] = useState(() => new Date().toISOString());
  const report = useMemo(
    () => planning.data
      ? buildBankReportModel(planning.data, {
          generatedAt,
          planningYear: planning.planningYear,
        })
      : null,
    [generatedAt, planning.data, planning.planningYear],
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f2f0e9] text-stone-950">
      <header className="border-b border-stone-200/80 bg-[#f7f5ef]/95">
        <div className="mx-auto flex min-h-16 w-full max-w-[1560px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link className="text-sm font-semibold tracking-[-0.02em] text-[#657663]" href="/app">Fameko</Link>
          <span className="text-xs font-medium text-stone-400">Förhandsvisning</span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1120px] px-3 pb-16 pt-5 sm:px-6 sm:pt-8 lg:px-8 lg:pb-24 lg:pt-10">
        <div className="flex items-start justify-between gap-4">
          <Link className="inline-flex min-h-10 items-center text-sm font-medium text-stone-500 transition hover:text-stone-950" href="/app">
            <span aria-hidden="true">←</span>&nbsp; Tillbaka till Workspace
          </Link>
          {report ? <BankReportPdfAction planningYear={report.document.planningYear} /> : null}
        </div>
        {planning.loadState === "loading" ? (
          <div className="mx-auto mt-5 max-w-[960px] border border-stone-200 bg-[#fffefa] p-8 text-sm text-stone-500">Hämtar hushållets ekonomiska översikt…</div>
        ) : planning.loadState === "error" ? (
          <div className="mx-auto mt-5 max-w-[960px] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-800">{planning.message}</div>
        ) : report ? (
          <div className="mt-5"><BankReportView report={report} /></div>
        ) : null}
      </div>
    </main>
  );
}
