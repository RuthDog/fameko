import Link from "next/link";

import { InfoTooltip } from "../components/info-tooltip.tsx";
import { getFinancialHealthMetricPresentation } from "../../shared/planning/financial-health-explainability.ts";
import type {
  FinancialHealthMetric,
  FinancialHealthObservation,
  FinancialHealthResult,
  FinancialHealthStatus,
} from "../../shared/planning/financial-health-types.ts";

const statusStyles: Record<FinancialHealthStatus, string> = {
  GOOD_FOUNDATION: "bg-[#eef3ea] text-[#4f674c]",
  INSUFFICIENT_DATA: "bg-stone-100 text-stone-600",
  NEEDS_ATTENTION: "bg-amber-50 text-amber-800",
  STABLE: "bg-emerald-50 text-emerald-800",
  VULNERABLE: "bg-rose-50 text-rose-800",
};

const metricStatusStyles = {
  attention: "text-amber-800 before:bg-amber-500",
  neutral: "text-stone-500 before:bg-stone-400",
  positive: "text-[#597057] before:bg-[#738770]",
} as const;

function formatMetric(metric: FinancialHealthMetric) {
  if (metric.value === null) {
    return "Uppgift saknas";
  }

  if (metric.unit === "currency") {
    return `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(metric.value)} kr`;
  }

  if (metric.unit === "percent") {
    return `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(metric.value)} %`;
  }

  if (metric.unit === "months") {
    return `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(metric.value)} mån`;
  }

  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(
    metric.value,
  );
}

function ObservationSection({
  emptyMessage,
  items,
  title,
}: {
  emptyMessage: string;
  items: FinancialHealthObservation[];
  title: string;
}) {
  return (
    <section className="rounded-[22px] border border-stone-200/80 bg-white p-5 sm:p-6">
      <h2 className="text-xl font-semibold tracking-[-0.025em] text-stone-950">
        {title}
      </h2>
      {items.length ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li className="flex gap-3 text-sm leading-6 text-stone-600" key={item.code}>
              <span aria-hidden="true" className="mt-0.5 text-[#738770]">
                {title === "Styrkor" ? "✓" : "•"}
              </span>
              <span>{item.message}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 text-stone-500">{emptyMessage}</p>
      )}
    </section>
  );
}

export function FinancialHealthView({
  result,
}: {
  result: FinancialHealthResult;
}) {
  return (
    <div className="mt-8 space-y-6" id="financial-health-analysis">
      <section className="rounded-[26px] border border-stone-200/80 bg-white p-5 shadow-[0_18px_55px_rgba(28,25,23,0.04)] sm:p-7 lg:p-9">
        <span
          className={`inline-flex min-h-8 items-center rounded-full px-3 text-sm font-semibold ${statusStyles[result.status]}`}
        >
          {result.statusLabel}
        </span>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-stone-700">
          {result.summary}
        </p>
        <p className="mt-4 text-sm leading-6 text-stone-500">
          {result.dataCompleteness.message}
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <ObservationSection
          emptyMessage="Inga tydliga styrkor kan ännu beskrivas från underlaget."
          items={result.strengths}
          title="Styrkor"
        />
        <ObservationSection
          emptyMessage="Inga särskilda delar behöver uppmärksammas utifrån underlaget."
          items={result.watchItems}
          title="Att hålla koll på"
        />
      </div>

      {result.missingInputs.length ? (
        <section className="rounded-[22px] border border-stone-200/80 bg-[#fbfaf7] p-5 sm:p-6">
          <h2 className="text-xl font-semibold tracking-[-0.025em] text-stone-950">
            Underlag som saknas
          </h2>
          <ul className="mt-4 space-y-3">
            {result.missingInputs.map((item) => (
              <li className="text-sm leading-6 text-stone-600" key={item.code}>
                {item.message}
              </li>
            ))}
          </ul>
          {result.missingInputs.some(
            (item) => item.code === "MISSING_LIQUID_SAVINGS",
          ) ? (
            <Link
              className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-stone-700 transition hover:text-stone-950"
              href="/app/sparande#financial-assets"
            >
              Komplettera privat buffert&nbsp;<span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-[22px] border border-stone-200/80 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold tracking-[-0.025em] text-stone-950">
          Nyckeltal bakom bedömningen
        </h2>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.metrics.map((metric) => {
            const presentation = getFinancialHealthMetricPresentation(
              metric,
              result,
            );

            return (
              <div className="rounded-[16px] bg-[#f8f7f3] p-4" key={metric.code}>
                <div className="flex items-start justify-between gap-2">
                  <dt className="pt-1.5 text-xs text-stone-500">{metric.label}</dt>
                  <InfoTooltip {...presentation.explanation} />
                </div>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-stone-900">
                  {formatMetric(metric)}
                </dd>
                <p
                  className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium before:size-1.5 before:shrink-0 before:rounded-full before:content-[''] ${metricStatusStyles[presentation.status.tone]}`}
                >
                  {presentation.status.label}
                </p>
                {metric.caveat ? (
                  <p className="mt-2 text-xs leading-5 text-stone-400">
                    {metric.caveat}
                  </p>
                ) : null}
              </div>
            );
          })}
        </dl>
      </section>

      <p className="text-xs leading-5 text-stone-400">
        Fameko visar beslutsstöd från dina egna uppgifter. Bedömningen är inte personlig finansiell rådgivning.
      </p>
    </div>
  );
}
