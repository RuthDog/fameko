"use client";

import Image from "next/image";

import {
  calculateHousingEconomics,
  emptyHousingData,
  getHousingSummary,
  getLoanToValueBand,
  type HousingData,
  type LoanToValueBand,
} from "../../shared/planning/housing.ts";
import {
  formatPreviewCurrency,
  formatPreviewPercentage,
  PersonalEconomyCard,
} from "./personal-economy-card.tsx";
import { mobileRhythm, mobileTypography } from "./mobile-design-system.ts";

type NumericHousingField =
  | "propertyValue"
  | "totalMortgage"
  | "averageInterestRate"
  | "monthlyAmortization";

const loanToValueColors: Record<LoanToValueBand, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  orange: "bg-orange-400",
  red: "bg-rose-500",
};

function HousingNumberField({
  field,
  label,
  max,
  onChange,
  optional = false,
  step,
  suffix,
  value,
}: {
  field: NumericHousingField;
  label: string;
  max: number;
  onChange: (field: NumericHousingField, value: number | null) => void;
  optional?: boolean;
  step: number;
  suffix: string;
  value: number | null;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-medium text-stone-600">
        <span>{label}</span>
        {optional ? <span className="font-normal text-stone-400">Valfritt</span> : null}
      </span>
      <span className="relative block">
        <input
          className="min-h-11 w-full rounded-xl border border-stone-200 bg-[#f8f7f3] px-3 pr-11 text-sm font-medium tabular-nums text-stone-900 outline-none transition placeholder:text-stone-300 focus:border-[#9aaa97] focus:bg-white focus:ring-2 focus:ring-[#dce4da]"
          inputMode="decimal"
          max={max}
          min={0}
          name={field}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(field, nextValue === "" ? null : Number(nextValue));
          }}
          placeholder="0"
          step={step}
          type="number"
          value={value ?? ""}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-stone-400">
          {suffix}
        </span>
      </span>
    </label>
  );
}

export function HousingPreview({ data }: { data: HousingData | undefined }) {
  const housing = data ?? emptyHousingData;
  const economics = calculateHousingEconomics(housing);
  const loanToValueBand = getLoanToValueBand(economics.loanToValue);
  const metrics = [
    economics.loanToValue === null
      ? null
      : {
          indicatorClassName: loanToValueBand
            ? loanToValueColors[loanToValueBand]
            : undefined,
          label: "Belåningsgrad",
          value: formatPreviewPercentage(economics.loanToValue),
        },
    housing.totalMortgage === null
      ? null
      : { label: "Bolån", value: formatPreviewCurrency(housing.totalMortgage) },
    economics.monthlyMortgageCost === null
      ? null
      : {
          label: "Månadskostnad",
          value: formatPreviewCurrency(economics.monthlyMortgageCost),
        },
  ].filter((metric) => metric !== null);

  return (
    <PersonalEconomyCard
      actionLabel="Visa boende"
      href="/app/boende"
      illustrationAlt="Stilren illustration av ett modernt nordiskt hus"
      illustrationSrc="/images/dashboard/housing-home-neutral.jpg"
      metrics={metrics}
      summary={getHousingSummary(economics.loanToValue)}
      title="Boende"
    />
  );
}

export function HousingOverview({
  data,
  embedded = false,
  onChange,
}: {
  data: HousingData | undefined;
  embedded?: boolean;
  onChange: (data: HousingData) => void;
}) {
  const housing = data ?? emptyHousingData;
  const economics = calculateHousingEconomics(housing);
  const loanToValueBand = getLoanToValueBand(economics.loanToValue);

  function updateNumber(field: NumericHousingField, value: number | null) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      return;
    }

    onChange({ ...housing, [field]: value });
  }

  return (
    <section
      aria-labelledby="housing-overview-title"
      className={
        embedded
          ? "mt-8 w-full"
          : "mx-auto w-full max-w-[1560px] px-4 pb-8 sm:px-6 sm:pb-10 lg:px-8"
      }
    >
      <article className="grid overflow-hidden rounded-[26px] border border-stone-200/80 bg-[#fbfaf7] shadow-[0_18px_55px_rgba(28,25,23,0.045)] lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:rounded-[30px]">
        <div className="relative min-h-[230px] overflow-hidden bg-[#f1efe8] sm:min-h-[310px] lg:min-h-[560px]">
          <Image
            alt="Stilren illustration av ett modernt nordiskt hus"
            className="object-contain p-5 sm:p-8 lg:p-10"
            fill
            sizes="(max-width: 1023px) calc(100vw - 48px), min(660px, 42vw)"
            src="/images/dashboard/housing-home-neutral.jpg"
            unoptimized
          />
        </div>

        <div className="flex min-w-0 flex-col p-5 sm:p-7 lg:p-9 xl:p-11">
          <div>
            <h2
              className={`${mobileTypography.pageTitle} text-stone-950 lg:text-[28px]`}
              id="housing-overview-title"
            >
              Bostad och bolån
            </h2>
            <p
              className={`${mobileRhythm.headingToDescription} max-w-xl ${mobileTypography.metadata} text-stone-500 lg:mt-3 lg:text-sm lg:leading-6`}
            >
              {getHousingSummary(economics.loanToValue)}
            </p>
          </div>

          <fieldset className="mt-7 grid gap-4 sm:grid-cols-2">
            <legend className="sr-only">Bostadens ekonomiska uppgifter</legend>
            <HousingNumberField
              field="propertyValue"
              label="Bostadens värde"
              max={1_000_000_000_000}
              onChange={updateNumber}
              step={10_000}
              suffix="kr"
              value={housing.propertyValue}
            />
            <label className="block min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-stone-600">
                Datum för värderingen
              </span>
              <input
                className="min-h-11 w-full rounded-xl border border-stone-200 bg-[#f8f7f3] px-3 text-sm font-medium text-stone-900 outline-none transition focus:border-[#9aaa97] focus:bg-white focus:ring-2 focus:ring-[#dce4da]"
                max="9999-12-31"
                name="valuationDate"
                onChange={(event) =>
                  onChange({ ...housing, valuationDate: event.target.value || null })
                }
                type="date"
                value={housing.valuationDate ?? ""}
              />
            </label>
            <HousingNumberField
              field="totalMortgage"
              label="Totalt bolån"
              max={1_000_000_000_000}
              onChange={updateNumber}
              step={10_000}
              suffix="kr"
              value={housing.totalMortgage}
            />
            <HousingNumberField
              field="averageInterestRate"
              label="Genomsnittlig ränta"
              max={100}
              onChange={updateNumber}
              step={0.01}
              suffix="%"
              value={housing.averageInterestRate}
            />
            <div className="sm:col-span-2 sm:max-w-[calc(50%_-_0.5rem)]">
              <HousingNumberField
                field="monthlyAmortization"
                label="Amortering per månad"
                max={1_000_000_000_000}
                onChange={updateNumber}
                optional
                step={100}
                suffix="kr"
                value={housing.monthlyAmortization}
              />
            </div>
          </fieldset>

          <dl className="mt-8 grid grid-cols-2 gap-x-5 gap-y-6 border-t border-stone-200/80 pt-7">
            <div className="min-w-0">
              <dt className="flex items-center gap-2 text-xs text-stone-400">
                {loanToValueBand ? (
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${loanToValueColors[loanToValueBand]}`}
                  />
                ) : null}
                Belåningsgrad
              </dt>
              <dd className="mt-1.5 break-words text-xl font-semibold tracking-[-0.025em] tabular-nums text-stone-900">
                {formatPreviewPercentage(economics.loanToValue)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-stone-400">Räntekostnad</dt>
              <dd className="mt-1.5 break-words text-xl font-semibold tracking-[-0.025em] tabular-nums text-stone-900">
                {formatPreviewCurrency(economics.monthlyInterestCost)}
              </dd>
              <dd className="mt-1 text-[11px] text-stone-400">
                {formatPreviewCurrency(economics.annualInterestCost)} / år
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-stone-400">Bolånekostnad</dt>
              <dd className="mt-1.5 break-words text-xl font-semibold tracking-[-0.025em] tabular-nums text-stone-900">
                {formatPreviewCurrency(economics.monthlyMortgageCost)}
              </dd>
              <dd className="mt-1 text-[11px] text-stone-400">Ränta + amortering / månad</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-stone-400">Amortering</dt>
              <dd className="mt-1.5 break-words text-xl font-semibold tracking-[-0.025em] tabular-nums text-stone-900">
                {formatPreviewCurrency(housing.monthlyAmortization)}
              </dd>
              <dd className="mt-1 text-[11px] text-stone-400">Per månad</dd>
            </div>
          </dl>
        </div>
      </article>
    </section>
  );
}
