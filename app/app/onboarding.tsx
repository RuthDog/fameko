"use client";

import { useState, type ReactNode } from "react";

import { CurrencyInput } from "../components/currency-input.tsx";

import { emptyCarData, type CarData } from "../../shared/planning/car.ts";
import { emptyHousingData, type HousingData } from "../../shared/planning/housing.ts";
import {
  getOnboardingIncomeAmount,
  getOnboardingSavingsAmount,
  type OnboardingIncomeKey,
  type OnboardingPlanningData,
  type OnboardingSavingsGoalId,
  type PlanningCompletionSuggestion,
} from "../../shared/planning/onboarding.ts";

const incomeFields: Array<{ key: OnboardingIncomeKey; label: string }> = [
  { key: "salaryOne", label: "Lön 1" },
  { key: "salaryTwo", label: "Lön 2" },
  { key: "other", label: "Övriga inkomster" },
];

const savingsFields: Array<{ key: OnboardingSavingsGoalId; label: string }> = [
  { key: "sparmal-buffert", label: "Buffert" },
  { key: "sparmal-pension", label: "Pension" },
  { key: "sparmal-investeringar", label: "Investeringar" },
];

const fieldClassName =
  "mt-2 h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 text-[15px] text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-stone-600 focus:ring-2 focus:ring-stone-200";

function parseAmountInput(value: string): number {
  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function StepProgress({ step }: { step: number }) {
  return (
    <div aria-label={`Steg ${step} av 5`} className="mb-7">
      <p className="text-xs font-medium text-stone-500">Steg {step} av 5</p>
      <div aria-hidden="true" className="mt-3 grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((currentStep) => (
          <span
            className={`h-1 rounded-full transition-colors duration-300 ${
              currentStep <= step ? "bg-stone-800" : "bg-stone-200"
            }`}
            key={currentStep}
          />
        ))}
      </div>
    </div>
  );
}

function AmountField({
  label,
  onChange,
  showZero = false,
  value,
}: {
  label: string;
  onChange: (value: number | null) => void;
  showZero?: boolean;
  value: number | null;
}) {
  return (
    <CurrencyInput label={label} onChange={onChange} showZero={showZero} value={value} />
  );
}

export function IncomeSetupFields({
  data,
  onChange,
}: {
  data: OnboardingPlanningData;
  onChange: (key: OnboardingIncomeKey, value: number) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {incomeFields.map((field) => (
        <AmountField
          key={field.key}
          label={field.label}
          onChange={(value) => onChange(field.key, value ?? 0)}
          value={getOnboardingIncomeAmount(data, field.key)}
        />
      ))}
    </div>
  );
}

export function SavingsSetupFields({
  data,
  onChange,
}: {
  data: OnboardingPlanningData;
  onChange: (key: OnboardingSavingsGoalId, value: number) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {savingsFields.map((field) => (
        <AmountField
          key={field.key}
          label={field.label}
          onChange={(value) => onChange(field.key, value ?? 0)}
          value={getOnboardingSavingsAmount(data, field.key)}
        />
      ))}
    </div>
  );
}

export function SetupChoiceButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`min-h-11 rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${
        active
          ? "border-stone-800 bg-stone-900 text-white"
          : "border-stone-300 bg-white text-stone-700 hover:border-stone-500"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function OnboardingFrame({
  children,
  onBack,
  onContinue,
  onSkip,
  primaryLabel = "Fortsätt",
  step,
}: {
  children: ReactNode;
  onBack?: () => void;
  onContinue: () => void;
  onSkip: () => void;
  primaryLabel?: string;
  step: number;
}) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-112px)] w-full max-w-3xl items-start px-4 py-8 sm:items-center sm:px-6 sm:py-12">
      <div className="w-full rounded-[24px] border border-stone-200/80 bg-[#fffefa] p-5 shadow-[0_18px_52px_rgba(28,25,23,0.055)] sm:p-8">
        <StepProgress step={step} />
        {children}

        <p className="mt-7 text-xs leading-5 text-stone-500">
          Du kan alltid fylla i detta senare.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-5">
          {onBack ? (
            <button
              className="min-h-11 rounded-xl px-3.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
              onClick={onBack}
              type="button"
            >
              Tillbaka
            </button>
          ) : null}
          <button
            className="min-h-11 rounded-xl px-3.5 text-sm font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            onClick={onSkip}
            type="button"
          >
            Hoppa över
          </button>
          <button
            className="ml-auto min-h-11 rounded-xl bg-stone-900 px-5 text-sm font-semibold text-white transition hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
            onClick={onContinue}
            type="button"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

export function OnboardingWelcome({ onStart }: { onStart: () => void }) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-112px)] w-full max-w-3xl items-center px-4 py-10 sm:px-6">
      <div className="w-full overflow-hidden rounded-[26px] border border-stone-200/80 bg-[#fffefa] px-5 py-10 text-center shadow-[0_20px_60px_rgba(28,25,23,0.06)] sm:px-12 sm:py-14">
        <div
          aria-hidden="true"
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e9eee8] text-2xl text-[#425449]"
        >
          ◌
        </div>
        <p className="mt-6 text-xs font-semibold tracking-[0.12em] text-stone-500">Din ekonomi</p>
        <h1 className="mx-auto mt-3 max-w-xl text-[28px] font-semibold leading-[1.12] tracking-[-0.035em] text-stone-950 sm:text-4xl">
          Välkommen till Fameko
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-6 text-stone-600">
          Vi hjälper dig bygga grunden till din hushållsekonomi. Det tar ungefär 10 minuter, och du kan hoppa över allt du inte vet i dag.
        </p>
        <button
          className="mt-8 min-h-12 rounded-xl bg-stone-900 px-6 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(28,25,23,0.14)] transition hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
          onClick={onStart}
          type="button"
        >
          Bygg min ekonomi
        </button>
      </div>
    </section>
  );
}

export function OnboardingFlow({
  data,
  onCarChange,
  onComplete,
  onHousingChange,
  onIncomeChange,
  onSavingsChange,
}: {
  data: OnboardingPlanningData;
  onCarChange: (data: CarData) => void;
  onComplete: () => void;
  onHousingChange: (data: HousingData) => void;
  onIncomeChange: (key: OnboardingIncomeKey, value: number) => void;
  onSavingsChange: (key: OnboardingSavingsGoalId, value: number) => void;
}) {
  const [step, setStep] = useState(1);
  const [housingType, setHousingType] = useState<string | null>(null);
  const [hasMortgage, setHasMortgage] = useState<boolean | null>(
    data.housingData && Object.values(data.housingData).some((value) => value !== null)
      ? true
      : null,
  );
  const [carCount, setCarCount] = useState<"none" | "one" | "multiple" | null>(
    data.carData && Object.values(data.carData).some((value) => value !== null)
      ? "one"
      : null,
  );

  const next = () => setStep((current) => Math.min(current + 1, 5));
  const back = () => setStep((current) => Math.max(current - 1, 1));

  if (step === 1) {
    return (
      <OnboardingFrame onContinue={next} onSkip={next} step={step}>
        <p className="text-xs font-semibold tracking-[0.1em] text-stone-500">Inkomster</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-stone-950 sm:text-[30px]">
          Vad kommer in varje månad?
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Ange ungefärliga belopp efter skatt. De används för årets alla månader och kan ändras senare.
        </p>
        <div className="mt-6">
          <IncomeSetupFields data={data} onChange={onIncomeChange} />
        </div>
      </OnboardingFrame>
    );
  }

  if (step === 2) {
    const housing = data.housingData ?? emptyHousingData;

    return (
      <OnboardingFrame onBack={back} onContinue={next} onSkip={next} step={step}>
        <p className="text-xs font-semibold tracking-[0.1em] text-stone-500">Boende</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-stone-950 sm:text-[30px]">
          Hur bor du?
        </h1>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {["Villa", "Bostadsrätt", "Hyresrätt", "Annat"].map((option) => (
            <SetupChoiceButton
              active={housingType === option}
              key={option}
              onClick={() => setHousingType(option)}
            >
              {option}
            </SetupChoiceButton>
          ))}
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-stone-700">Har boendet bolån?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <SetupChoiceButton
              active={hasMortgage === true}
              onClick={() => {
                setHasMortgage(true);
                onHousingChange(data.housingData ?? { ...emptyHousingData });
              }}
            >
              Ja
            </SetupChoiceButton>
            <SetupChoiceButton
              active={hasMortgage === false}
              onClick={() => {
                setHasMortgage(false);
                onHousingChange({ ...emptyHousingData });
              }}
            >
              Nej
            </SetupChoiceButton>
          </div>
        </fieldset>

        {hasMortgage ? (
          <div className="mt-5 grid gap-4 border-t border-stone-200 pt-5 sm:grid-cols-2">
            <AmountField
              label="Bostadsvärde"
              onChange={(value) => onHousingChange({ ...housing, propertyValue: value })}
              value={housing.propertyValue}
            />
            <AmountField
              label="Bolån totalt"
              onChange={(value) => onHousingChange({ ...housing, totalMortgage: value })}
              value={housing.totalMortgage}
            />
            <label className="block text-sm font-medium text-stone-700">
              Snittränta
              <span className="relative block">
                <input
                  className={`${fieldClassName} pr-9 tabular-nums`}
                  inputMode="decimal"
                  min="0"
                  onChange={(event) =>
                    onHousingChange({
                      ...housing,
                      averageInterestRate:
                        event.target.value === ""
                          ? null
                          : parseAmountInput(event.target.value),
                    })
                  }
                  step="0.01"
                  type="number"
                  value={housing.averageInterestRate ?? ""}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center pt-2 text-xs text-stone-400">
                  %
                </span>
              </span>
            </label>
            <AmountField
              label="Amortering per månad"
              onChange={(value) =>
                onHousingChange({ ...housing, monthlyAmortization: value })
              }
              value={housing.monthlyAmortization}
            />
            <label className="block text-sm font-medium text-stone-700 sm:col-span-2">
              Senaste värdering
              <input
                className={fieldClassName}
                onChange={(event) =>
                  onHousingChange({ ...housing, valuationDate: event.target.value || null })
                }
                type="date"
                value={housing.valuationDate ?? ""}
              />
            </label>
          </div>
        ) : null}
      </OnboardingFrame>
    );
  }

  if (step === 3) {
    const car = data.carData ?? emptyCarData;
    const showCarFields = carCount === "one" || carCount === "multiple";

    return (
      <OnboardingFrame onBack={back} onContinue={next} onSkip={next} step={step}>
        <p className="text-xs font-semibold tracking-[0.1em] text-stone-500">Bil</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-stone-950 sm:text-[30px]">
          Har hushållet bil?
        </h1>
        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          {[
            { label: "Ingen bil", value: "none" as const },
            { label: "En bil", value: "one" as const },
            { label: "Flera bilar", value: "multiple" as const },
          ].map((option) => (
            <SetupChoiceButton
              active={carCount === option.value}
              key={option.value}
              onClick={() => {
                setCarCount(option.value);
                if (option.value === "none") {
                  onCarChange({ ...emptyCarData });
                } else {
                  onCarChange(data.carData ?? { ...emptyCarData });
                }
              }}
            >
              {option.label}
            </SetupChoiceButton>
          ))}
        </div>

        {showCarFields ? (
          <div className="mt-5 grid gap-4 border-t border-stone-200 pt-5 sm:grid-cols-2">
            {carCount === "multiple" ? (
              <p className="text-sm leading-6 text-stone-600 sm:col-span-2">
                Börja med bilen som påverkar ekonomin mest. Fler uppgifter kan läggas till senare.
              </p>
            ) : null}
            <label className="block text-sm font-medium text-stone-700 sm:col-span-2">
              Bil
              <input
                className={fieldClassName}
                maxLength={80}
                onChange={(event) =>
                  onCarChange({ ...car, carName: event.target.value.trimStart() || null })
                }
                placeholder="Till exempel Volvo XC40"
                type="text"
                value={car.carName ?? ""}
              />
            </label>
            <AmountField
              label="Bilens värde"
              onChange={(value) => onCarChange({ ...car, carValue: value })}
              value={car.carValue}
            />
            <AmountField
              label="Lån kvar"
              onChange={(value) => onCarChange({ ...car, currentLoanBalance: value })}
              showZero
              value={car.currentLoanBalance}
            />
            <label className="block text-sm font-medium text-stone-700">
              Snittränta
              <span className="relative block">
                <input
                  className={`${fieldClassName} pr-9 tabular-nums`}
                  inputMode="decimal"
                  min="0"
                  onChange={(event) =>
                    onCarChange({
                      ...car,
                      averageInterestRate:
                        event.target.value === ""
                          ? null
                          : parseAmountInput(event.target.value),
                    })
                  }
                  step="0.01"
                  type="number"
                  value={car.averageInterestRate ?? ""}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center pt-2 text-xs text-stone-400">
                  %
                </span>
              </span>
            </label>
            <AmountField
              label="Amortering per månad"
              onChange={(value) => onCarChange({ ...car, monthlyAmortization: value })}
              value={car.monthlyAmortization}
            />
          </div>
        ) : null}
      </OnboardingFrame>
    );
  }

  if (step === 4) {
    return (
      <OnboardingFrame onBack={back} onContinue={next} onSkip={next} step={step}>
        <p className="text-xs font-semibold tracking-[0.1em] text-stone-500">Sparande</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-stone-950 sm:text-[30px]">
          Vad vill du planera att spara?
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Ange ett ungefärligt månadsbelopp för de delar som är aktuella.
        </p>
        <div className="mt-6">
          <SavingsSetupFields data={data} onChange={onSavingsChange} />
        </div>
      </OnboardingFrame>
    );
  }

  return (
    <OnboardingFrame
      onBack={back}
      onContinue={onComplete}
      onSkip={onComplete}
      primaryLabel="Öppna min ekonomi"
      step={step}
    >
      <div className="py-2 text-center sm:py-5">
        <div
          aria-hidden="true"
          className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#e4eee6] text-2xl font-semibold text-[#3e6248]"
        >
          ✓
        </div>
        <p className="mt-6 text-xs font-semibold tracking-[0.1em] text-stone-500">Klart</p>
        <h1 className="mx-auto mt-2 max-w-xl text-2xl font-semibold leading-tight tracking-[-0.03em] text-stone-950 sm:text-[30px]">
          Bra! Nu har du byggt grunden för din ekonomi.
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-stone-600">
          Resten kan du fylla i när du vill. Fameko använder uppgifterna direkt i Dashboard, årsplanering och Min ekonomi.
        </p>
      </div>
    </OnboardingFrame>
  );
}

export function WorkspaceCompletionHint({
  onAction,
  suggestion,
}: {
  onAction: () => void;
  suggestion: PlanningCompletionSuggestion;
}) {
  return (
    <aside
      aria-label="Komplettera din ekonomi"
      className="mx-auto w-full max-w-[1560px] px-4 pb-10 pt-2 sm:px-6 lg:px-8 lg:pb-12"
    >
      <button
        className="group flex w-full flex-col items-start gap-3 rounded-2xl border border-stone-200 bg-[#fbfaf6] px-4 py-4 text-left transition hover:border-stone-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 sm:flex-row sm:items-center sm:px-5"
        onClick={onAction}
        type="button"
      >
        <span
          aria-hidden="true"
          className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-stone-200/70 text-sm text-stone-600"
        >
          +
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-stone-800">{suggestion.title}</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">{suggestion.description}</p>
        </div>
        <span className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-stone-700 transition group-hover:bg-stone-100 group-hover:text-stone-950">
          {suggestion.actionLabel}
        </span>
      </button>
    </aside>
  );
}
