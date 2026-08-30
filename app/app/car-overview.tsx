"use client";

import Image from "next/image";

import {
  calculateCarEconomics,
  emptyCarData,
  getCarLoanMode,
  type CarData,
  type CarPlanningEconomics,
} from "../../shared/planning/car.ts";
import { formatPreviewCurrency, formatPreviewPercentage } from "./personal-economy-card.tsx";

type NumericCarField =
  | "annualInsurance"
  | "annualService"
  | "averageInterestRate"
  | "carValue"
  | "currentLoanBalance"
  | "monthlyAmortization";

function CarNumberField({
  field,
  label,
  max,
  onChange,
  step,
  suffix,
  value,
}: {
  field: NumericCarField;
  label: string;
  max: number;
  onChange: (field: NumericCarField, value: number | null) => void;
  step: number;
  suffix: string;
  value: number | null;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-medium text-stone-600">
        <span>{label}</span>
        <span className="font-normal text-stone-400">Valfritt</span>
      </span>
      <span className="relative block">
        <input
          className="min-h-11 w-full rounded-xl border border-stone-200 bg-[#f8f7f3] px-3 pr-12 text-sm font-medium tabular-nums text-stone-900 outline-none transition placeholder:text-stone-300 focus:border-[#9aaa97] focus:bg-white focus:ring-2 focus:ring-[#dce4da]"
          inputMode="decimal"
          max={max}
          min={0}
          name={field}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(field, nextValue === "" ? null : Number(nextValue));
          }}
          placeholder="Ej angivet"
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

function CarMetric({ detail, label, value }: { detail?: string; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[18px] border border-stone-200/80 bg-white p-4 sm:p-5">
      <dt className="text-xs text-stone-400">{label}</dt>
      <dd className="mt-1.5 break-words text-xl font-semibold tracking-[-0.025em] tabular-nums text-stone-900">
        {value}
      </dd>
      {detail ? <dd className="mt-1 text-[11px] leading-4 text-stone-400">{detail}</dd> : null}
    </div>
  );
}

export function CarOverview({
  data,
  onChange,
  planning,
}: {
  data: CarData | undefined;
  onChange: (data: CarData) => void;
  planning: CarPlanningEconomics;
}) {
  const car = data ?? emptyCarData;
  const economics = calculateCarEconomics(car);
  const loanMode = getCarLoanMode(data);
  const summary =
    loanMode === "loanFree"
      ? "Bilen är uttryckligen registrerad som lånefri. De planerade bilkostnaderna hämtas fortfarande från årsplaneringen."
      : loanMode === "withLoan"
        ? "Lånet visas från CarData medan månadens och årets planerade bilkostnader hämtas från PlanningData."
        : "Biluppgifter saknas eller är ofullständiga. Ange låneskuld 0 kr först när bilen faktiskt är lånefri.";

  function updateNumber(field: NumericCarField, value: number | null) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      return;
    }

    onChange({ ...car, [field]: value });
  }

  return (
    <div className="mt-8 space-y-6">
      <section aria-labelledby="car-overview-title">
        <div className="grid overflow-hidden rounded-[26px] border border-stone-200/80 bg-[#fbfaf7] shadow-[0_18px_55px_rgba(28,25,23,0.045)] lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:rounded-[30px]">
          <div className="relative min-h-[220px] overflow-hidden bg-[#f1efe8] sm:min-h-[300px] lg:min-h-[570px]">
            <Image
              alt="Stilren illustration av en modern familjebil"
              className="object-contain p-5 sm:p-8 lg:p-10"
              fill
              sizes="(max-width: 1023px) calc(100vw - 48px), min(660px, 42vw)"
              src="/images/dashboard/car-preview-neutral.jpg"
              unoptimized
            />
          </div>

          <div className="flex min-w-0 flex-col p-5 sm:p-7 lg:p-9 xl:p-11">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.035em] text-stone-950" id="car-overview-title">
                Bil och ägandekostnad
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-stone-500">{summary}</p>
            </div>

            <fieldset className="mt-7 grid gap-4 sm:grid-cols-2">
              <legend className="sr-only">Bilens ekonomiska uppgifter</legend>
              <label className="block min-w-0 sm:col-span-2">
                <span className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-medium text-stone-600">
                  <span>Bilens namn eller benämning</span>
                  <span className="font-normal text-stone-400">Valfritt</span>
                </span>
                <input
                  className="min-h-11 w-full rounded-xl border border-stone-200 bg-[#f8f7f3] px-3 text-sm font-medium text-stone-900 outline-none transition placeholder:text-stone-300 focus:border-[#9aaa97] focus:bg-white focus:ring-2 focus:ring-[#dce4da]"
                  maxLength={80}
                  name="carName"
                  onChange={(event) =>
                    onChange({ ...car, carName: event.target.value.trimStart() || null })
                  }
                  placeholder="Till exempel Familjebilen"
                  type="text"
                  value={car.carName ?? ""}
                />
              </label>
              <CarNumberField field="carValue" label="Bilens värde" max={1_000_000_000_000} onChange={updateNumber} step={1_000} suffix="kr" value={car.carValue} />
              <CarNumberField field="currentLoanBalance" label="Aktuell låneskuld" max={1_000_000_000_000} onChange={updateNumber} step={1_000} suffix="kr" value={car.currentLoanBalance} />
              <CarNumberField field="averageInterestRate" label="Genomsnittlig ränta" max={100} onChange={updateNumber} step={0.01} suffix="%" value={car.averageInterestRate} />
              <CarNumberField field="monthlyAmortization" label="Amortering per månad" max={1_000_000_000_000} onChange={updateNumber} step={100} suffix="kr" value={car.monthlyAmortization} />
              <CarNumberField field="annualInsurance" label="Försäkring per år" max={1_000_000_000_000} onChange={updateNumber} step={100} suffix="kr" value={car.annualInsurance} />
              <CarNumberField field="annualService" label="Service och underhåll per år" max={1_000_000_000_000} onChange={updateNumber} step={100} suffix="kr" value={car.annualService} />
            </fieldset>
          </div>
        </div>
      </section>

      <section aria-labelledby="car-key-figures-title">
        <div className="mb-4">
          <h2 className="text-xl font-semibold tracking-[-0.025em] text-stone-950" id="car-key-figures-title">
            Översikt
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            Planerade kostnader kommer från PlanningData. Lån, försäkring och service kommer från CarData.
          </p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CarMetric
            detail="CarData"
            label="Lån"
            value={
              loanMode === "loanFree"
                ? "Lånefri"
                : loanMode === "withLoan"
                  ? formatPreviewCurrency(car.currentLoanBalance)
                  : "Ej angivet"
            }
          />
          <CarMetric detail="PlanningData · aktuell månad" label="Planerad månadskostnad" value={formatPreviewCurrency(planning.monthlyPlannedCost)} />
          <CarMetric detail="PlanningData · hela året" label="Planerad årskostnad" value={formatPreviewCurrency(planning.annualPlannedCost)} />
          <CarMetric detail="Ränta + amortering / månad" label="Beräknad lånekostnad" value={formatPreviewCurrency(economics.monthlyLoanCost)} />
          <CarMetric detail={formatPreviewCurrency(economics.monthlyInsurance) + " / månad"} label="Försäkring" value={formatPreviewCurrency(car.annualInsurance) + " / år"} />
          <CarMetric detail={formatPreviewCurrency(economics.monthlyService) + " / månad"} label="Service och underhåll" value={formatPreviewCurrency(car.annualService) + " / år"} />
          <CarMetric detail="CarData" label="Bilens värde" value={formatPreviewCurrency(car.carValue)} />
          <CarMetric detail="CarData" label="Genomsnittlig ränta" value={formatPreviewPercentage(car.averageInterestRate)} />
        </dl>
      </section>
    </div>
  );
}
