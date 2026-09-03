import Link from "next/link";

import type {
  FinancialHealthObservation,
  FinancialHealthResult,
  FinancialHealthStatus,
} from "../../shared/planning/financial-health-types.ts";
import { mobileRhythm, mobileTypography } from "./mobile-design-system.ts";

const statusStyles: Record<FinancialHealthStatus, string> = {
  GOOD_FOUNDATION: "bg-[#eef3ea] text-[#4f674c]",
  INSUFFICIENT_DATA: "bg-stone-100 text-stone-600",
  NEEDS_ATTENTION: "bg-amber-50 text-amber-800",
  STABLE: "bg-emerald-50 text-emerald-800",
  VULNERABLE: "bg-rose-50 text-rose-800",
};

function ObservationPreview({
  items,
  title,
}: {
  items: FinancialHealthObservation[];
  title: string;
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-stone-400">{title}</p>
      <ul className="mt-2 space-y-2">
        {items.slice(0, 2).map((item) => (
          <li className="flex gap-2 text-sm leading-5 text-stone-700" key={item.code}>
            <span aria-hidden="true" className="text-[#738770]">
              {title === "Styrkor" ? "✓" : "•"}
            </span>
            <span>{item.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FinancialHealthCard({
  result,
}: {
  result: FinancialHealthResult;
}) {
  return (
    <section
      aria-labelledby="financial-health-title"
      className={`mx-auto w-full max-w-[1560px] ${mobileRhythm.section} pt-0 lg:px-8 lg:pb-2 lg:pt-16`}
      id="financial-health"
    >
      <div className="rounded-[22px] border border-stone-200/80 bg-white p-5 shadow-[0_14px_42px_rgba(28,25,23,0.035)] sm:p-6 lg:rounded-[26px] lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <div className="max-w-3xl">
            <p className={`${mobileTypography.metadata} text-stone-400`}>
              Ekonomisk motståndskraft
            </p>
            <h2
              className={`mt-1 ${mobileTypography.pageTitle} text-stone-950 lg:text-[28px]`}
              id="financial-health-title"
            >
              Din ekonomiska motståndskraft
            </h2>
            <span
              className={`mt-4 inline-flex min-h-8 items-center rounded-full px-3 text-sm font-semibold ${statusStyles[result.status]}`}
            >
              {result.statusLabel}
            </span>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 sm:text-[15px] sm:leading-7">
              {result.summary}
            </p>
            <p className="mt-3 text-xs leading-5 text-stone-400">
              {result.dataCompleteness.message}
            </p>
          </div>

          <div className="hidden w-full max-w-xl grid-cols-2 gap-8 border-l border-stone-100 pl-8 lg:grid">
            <ObservationPreview items={result.strengths} title="Styrkor" />
            <ObservationPreview items={result.watchItems} title="Att hålla koll på" />
          </div>
        </div>

        <div className="mt-5 flex justify-end border-t border-stone-100 pt-4 lg:mt-7">
          <Link
            className="inline-flex min-h-10 items-center text-sm font-semibold text-stone-700 transition hover:text-stone-950"
            href="/app/ekonomisk-halsa"
          >
            Visa analys&nbsp;<span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
