"use client";

import Image from "next/image";

export type PersonalEconomyMetric = {
  indicatorClassName?: string;
  label: string;
  value: string;
};

const currencyFormatter = new Intl.NumberFormat("sv-SE", {
  maximumFractionDigits: 0,
});

const percentageFormatter = new Intl.NumberFormat("sv-SE", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export function formatPreviewCurrency(value: number | null) {
  return value === null ? "—" : `${currencyFormatter.format(Math.round(value))} kr`;
}

export function formatPreviewPercentage(value: number | null) {
  return value === null ? "—" : `${percentageFormatter.format(value)} %`;
}

export function PersonalEconomyCard({
  actionLabel,
  illustrationAlt,
  illustrationSrc,
  metrics,
  summary,
  title,
}: {
  actionLabel: string;
  illustrationAlt: string;
  illustrationSrc: string;
  metrics: PersonalEconomyMetric[];
  summary: string;
  title: string;
}) {
  const titleId = `personal-economy-${title.toLocaleLowerCase("sv-SE")}`;
  const metricColumns = metrics.length === 2 ? "grid-cols-2" : "grid-cols-3";

  return (
    <article
      aria-labelledby={titleId}
      className="flex h-[464px] min-w-0 flex-col overflow-hidden rounded-[24px] border border-stone-200/80 bg-white shadow-[0_14px_42px_rgba(28,25,23,0.035)] sm:h-[440px]"
    >
      <div className="relative h-44 shrink-0 overflow-hidden bg-[#f1efe8]">
        <Image
          alt={illustrationAlt}
          className="object-contain p-4"
          fill
          sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1279px) calc(50vw - 34px), calc(33vw - 34px)"
          src={illustrationSrc}
          unoptimized
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-stone-400">
            Livsområde
          </p>
          <h3
            className="mt-1 text-xl font-semibold tracking-[-0.025em] text-stone-950"
            id={titleId}
          >
            {title}
          </h3>
          <p className="mt-2 min-h-12 text-sm leading-6 text-stone-500">{summary}</p>
        </div>

        <dl
          className={`mt-4 grid ${metricColumns} divide-x divide-stone-200/80 border-t border-stone-200/80 pt-4`}
        >
          {metrics.map((metric, index) => (
            <div
              className={`min-w-0 ${index === 0 ? "pr-3" : "px-3 last:pr-0"}`}
              key={metric.label}
            >
              <dt className="flex min-h-8 items-start gap-1.5 text-[11px] leading-4 text-stone-400">
                {metric.indicatorClassName ? (
                  <span
                    aria-hidden="true"
                    className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${metric.indicatorClassName}`}
                  />
                ) : null}
                {metric.label}
              </dt>
              <dd className="mt-1 break-words text-[15px] font-semibold leading-5 tracking-[-0.02em] tabular-nums text-stone-900 sm:text-base">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>

        <span
          aria-label={`${actionLabel}, kommer i en senare version`}
          className="mt-auto pt-4 text-xs font-medium text-stone-500"
        >
          {actionLabel} <span aria-hidden="true">→</span>
        </span>
      </div>
    </article>
  );
}
