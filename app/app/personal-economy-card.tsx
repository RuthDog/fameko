"use client";

import Image from "next/image";
import Link from "next/link";

import type { PersonalEconomyStatus } from "../../shared/planning/personal-economy-status.ts";
import { mobileTypography } from "./mobile-design-system.ts";

export type PersonalEconomyMetric = {
  label: string;
  value: string;
};

const statusStyles: Record<
  PersonalEconomyStatus["tone"],
  { background: string; dot: string; label: string }
> = {
  attention: {
    background: "bg-amber-50/80",
    dot: "bg-amber-400",
    label: "text-amber-950",
  },
  review: {
    background: "bg-rose-50/80",
    dot: "bg-rose-500",
    label: "text-rose-950",
  },
  stable: {
    background: "bg-emerald-50/70",
    dot: "bg-emerald-500",
    label: "text-emerald-950",
  },
  unknown: {
    background: "bg-stone-100/80",
    dot: "bg-stone-400",
    label: "text-stone-800",
  },
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
  href,
  illustrationAlt,
  illustrationSrc,
  metrics,
  status,
  title,
}: {
  actionLabel: string;
  href: string;
  illustrationAlt: string;
  illustrationSrc: string;
  metrics: PersonalEconomyMetric[];
  status: PersonalEconomyStatus;
  title: string;
}) {
  const titleId = `personal-economy-${title.toLocaleLowerCase("sv-SE")}`;
  const displayedMetrics = metrics.slice(0, 2);
  const statusStyle = statusStyles[status.tone];

  return (
    <Link
      className="group block rounded-[24px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-900"
      href={href}
    >
      <article
        aria-labelledby={titleId}
        className="flex h-[400px] min-w-0 flex-col overflow-hidden rounded-[24px] border border-stone-200/80 bg-white shadow-[0_14px_42px_rgba(28,25,23,0.035)] transition group-hover:border-stone-300 group-hover:shadow-[0_18px_48px_rgba(28,25,23,0.06)] lg:h-[440px]"
      >
        <div className="relative h-28 shrink-0 overflow-hidden bg-[#f1efe8] lg:h-44">
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
          <h3
            className={`${mobileTypography.sectionTitle} text-stone-950 lg:text-xl lg:leading-7 lg:tracking-[-0.025em]`}
            id={titleId}
          >
            {title}
          </h3>

          <div className={`mt-4 rounded-[16px] px-4 py-3 ${statusStyle.background}`}>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${statusStyle.dot}`} />
              <p className={`${mobileTypography.metadata} font-medium text-stone-500`}>Status</p>
            </div>
            <p className={`mt-1.5 text-lg font-semibold tracking-[-0.025em] ${statusStyle.label}`}>
              {status.label}
            </p>
            <p className={`mt-1 ${mobileTypography.metadata} text-stone-500`}>{status.message}</p>
          </div>

          {displayedMetrics.length ? (
            <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-stone-200/80 pt-4">
              {displayedMetrics.map((metric) => (
                <div className="min-w-0" key={metric.label}>
                  <dt className={`${mobileTypography.metadata} text-stone-400 lg:text-[11px] lg:leading-4`}>
                    {metric.label}
                  </dt>
                  <dd
                    className={`mt-1 break-words ${mobileTypography.sectionTitle} tabular-nums text-stone-900 lg:text-base lg:leading-5`}
                  >
                    {metric.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          <span
            className={`mt-auto pt-4 ${mobileTypography.metadata} text-stone-500 transition group-hover:text-stone-900 lg:text-xs lg:font-medium lg:leading-4`}
          >
            {actionLabel} <span aria-hidden="true">→</span>
          </span>
        </div>
      </article>
    </Link>
  );
}
