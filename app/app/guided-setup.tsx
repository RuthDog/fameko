"use client";

import { useMemo, useState, type ReactNode } from "react";

import { CurrencyInput } from "../components/currency-input.tsx";
import { RecognizedBrandLogo } from "../components/brand-logo.tsx";
import {
  getGuidedSetupExpense,
  getGuidedSetupCurrentMonthId,
  getGuidedSetupTemplate,
  guidedSetupFrequencyOptions,
  guidedSetupGuides,
  guidedSetupMonthIds,
  guidedSetupTemplates,
  type GuidedSetupFrequency,
  type GuidedSetupGuideId,
  type GuidedSetupPlanningData,
  type GuidedSetupTemplate,
} from "../../shared/planning/guided-setup.ts";
import {
  getOnboardingIncomeAmount,
  getOnboardingSavingsAmount,
  setOnboardingIncomeAmount,
  setOnboardingSavingsAmount,
  type OnboardingIncomeKey,
  type OnboardingPlanningData,
  type OnboardingSavingsGoalId,
  type PlanningCompletionSuggestion,
} from "../../shared/planning/onboarding.ts";
import {
  IncomeSetupFields,
  SavingsSetupFields,
  SetupChoiceButton,
} from "./onboarding.tsx";
import {
  famekoMainSectionSymbols,
  type FamekoMainSectionId,
} from "../../shared/ui/fameko-symbols.ts";

type GuidedSetupWorkspaceData = GuidedSetupPlanningData & OnboardingPlanningData;

const guidedIncomeKeys: OnboardingIncomeKey[] = ["salaryOne", "salaryTwo", "other"];
const guidedSavingsKeys: OnboardingSavingsGoalId[] = [
  "sparmal-buffert",
  "sparmal-pension",
  "sparmal-investeringar",
];

const guidedSetupMainSectionIds: Partial<
  Record<GuidedSetupGuideId, FamekoMainSectionId>
> = {
  debts: "debts",
  income: "income",
  insurance: "insurance",
  pets: "pets",
  savings: "savings",
};

const monthLabels: Record<(typeof guidedSetupMonthIds)[number], string> = {
  jan: "Januari",
  feb: "Februari",
  mar: "Mars",
  apr: "April",
  maj: "Maj",
  jun: "Juni",
  jul: "Juli",
  aug: "Augusti",
  sep: "September",
  okt: "Oktober",
  nov: "November",
  dec: "December",
};

const secondaryButtonClass =
  "min-h-11 rounded-xl px-3.5 text-sm font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900";
const primaryButtonClass =
  "min-h-11 rounded-xl bg-stone-900 px-5 text-sm font-semibold text-white transition hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:cursor-not-allowed disabled:bg-stone-300";

function formatAmount(value: number) {
  return `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 })
    .format(value)
    .replace(/\s/g, " ")} kr`;
}

function frequencyLabel(frequency: GuidedSetupFrequency) {
  return guidedSetupFrequencyOptions.find((option) => option.id === frequency)?.label ?? "Varje månad";
}

function GuidedSetupFrame({
  children,
  description,
  eyebrow,
  onExit,
  progress,
  title,
}: {
  children: ReactNode;
  description?: string;
  eyebrow: string;
  onExit: () => void;
  progress?: { current: number; total: number };
  title: string;
}) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-112px)] w-full max-w-3xl items-start px-4 py-8 sm:items-center sm:px-6 sm:py-12">
      <div className="w-full rounded-[24px] border border-stone-200/80 bg-[#fffefa] p-5 shadow-[0_18px_52px_rgba(28,25,23,0.055)] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.1em] text-stone-500">{eyebrow}</p>
            {progress ? (
              <p className="mt-2 text-xs text-stone-400">
                Fråga {progress.current} av {progress.total}
              </p>
            ) : null}
          </div>
          <button className="text-xs font-medium text-stone-400 hover:text-stone-700" onClick={onExit} type="button">
            Avsluta
          </button>
        </div>
        {progress ? (
          <div aria-hidden="true" className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${progress.total}, minmax(0, 1fr))` }}>
            {Array.from({ length: progress.total }, (_, index) => (
              <span className={`h-1 rounded-full ${index < progress.current ? "bg-stone-800" : "bg-stone-200"}`} key={index} />
            ))}
          </div>
        ) : null}
        <h1 className="mt-6 text-2xl font-semibold leading-tight tracking-[-0.03em] text-stone-950 sm:text-[30px]">
          {title}
        </h1>
        {description ? <p className="mt-3 text-sm leading-6 text-stone-600">{description}</p> : null}
        {children}
      </div>
    </section>
  );
}

function QuestionActions({
  nextDisabled = false,
  nextLabel = "Nästa",
  onBack,
  onNext,
  onSkip,
}: {
  nextDisabled?: boolean;
  nextLabel?: string;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <p className="mt-7 text-xs leading-5 text-stone-500">Du kan alltid fylla i detta senare.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-5">
        <button className={secondaryButtonClass} onClick={onBack} type="button">Tillbaka</button>
        <button className={secondaryButtonClass} onClick={onSkip} type="button">Hoppa över</button>
        <button className={`ml-auto ${primaryButtonClass}`} disabled={nextDisabled} onClick={onNext} type="button">
          {nextLabel}
        </button>
      </div>
    </>
  );
}

function TemplateQuestion({
  data,
  forceEdit = false,
  onApply,
  onBack,
  onDone,
  onExit,
  position,
  template,
  total,
}: {
  data: GuidedSetupPlanningData;
  forceEdit?: boolean;
  onApply: (templateId: string, value: { amount: number; frequency: GuidedSetupFrequency; paymentMonth: string }) => void;
  onBack: () => void;
  onDone: () => void;
  onExit: () => void;
  position: number;
  template: GuidedSetupTemplate;
  total: number;
}) {
  const existing = getGuidedSetupExpense(data, template.id);
  const [editing, setEditing] = useState(forceEdit);
  const [amount, setAmount] = useState<number | null>(existing?.amount ?? null);
  const [frequency, setFrequency] = useState<GuidedSetupFrequency>(existing?.frequency ?? template.defaultFrequency);
  const [paymentMonth, setPaymentMonth] = useState(
    existing?.paymentMonth ?? getGuidedSetupCurrentMonthId(),
  );
  const [editStage, setEditStage] = useState<"amount" | "frequency" | "month">("amount");

  function applyAndFinish() {
    if (!amount || amount <= 0) {
      return;
    }

    onApply(template.id, { amount, frequency, paymentMonth });
    onDone();
  }

  function backFromAmount() {
    if (existing && !forceEdit) {
      setEditing(false);
      return;
    }

    onBack();
  }

  if (existing && !editing) {
    return (
      <GuidedSetupFrame eyebrow={guidedSetupGuides.find((guide) => guide.id === template.guideId)?.name ?? "Guided setup"} onExit={onExit} progress={{ current: position, total }} title={template.displayName}>
        <div className="mt-6 rounded-2xl border border-stone-200 bg-white px-4 py-4">
          <p className="text-xs font-medium text-stone-500">Finns i din planering</p>
          <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-stone-950">
            <RecognizedBrandLogo name={existing.label} />
            <span>{existing.label}</span>
          </p>
          <p className="mt-1 text-sm text-stone-600">
            {formatAmount(existing.amount)} · {frequencyLabel(existing.frequency)}
          </p>
        </div>
        <p className="mt-5 text-sm leading-6 text-stone-600">Vill du behålla uppgiften eller ändra den?</p>
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-5">
          <button className={secondaryButtonClass} onClick={onBack} type="button">Tillbaka</button>
          <button className={secondaryButtonClass} onClick={onDone} type="button">Hoppa över</button>
          <button className={secondaryButtonClass} onClick={() => { setEditStage("amount"); setEditing(true); }} type="button">Ändra</button>
          <button className={`ml-auto ${primaryButtonClass}`} onClick={onDone} type="button">Behåll</button>
        </div>
      </GuidedSetupFrame>
    );
  }

  if (!editing) {
    return (
      <GuidedSetupFrame eyebrow={guidedSetupGuides.find((guide) => guide.id === template.guideId)?.name ?? "Guided setup"} onExit={onExit} progress={{ current: position, total }} title={template.question}>
        <div className="mt-7 grid grid-cols-2 gap-2">
          <SetupChoiceButton active={false} onClick={() => { setEditStage("amount"); setEditing(true); }}>Ja</SetupChoiceButton>
          <SetupChoiceButton active={false} onClick={onDone}>Nej</SetupChoiceButton>
        </div>
        <QuestionActions onBack={onBack} onNext={() => { setEditStage("amount"); setEditing(true); }} onSkip={onDone} nextLabel="Ja, lägg till" />
      </GuidedSetupFrame>
    );
  }

  if (editStage === "amount") {
    return (
      <GuidedSetupFrame
        description={template.supportsFrequency ? "Ange vad en betalning kostar." : "Ange hushållets totala kostnad per månad."}
        eyebrow={guidedSetupGuides.find((guide) => guide.id === template.guideId)?.name ?? "Guided setup"}
        onExit={onExit}
        progress={{ current: position, total }}
        title={`Vad kostar ${template.displayName.toLocaleLowerCase("sv-SE")}?`}
      >
        <div className="mt-6">
          <CurrencyInput label={template.supportsFrequency ? "Belopp per betalning" : "Belopp per månad"} onChange={setAmount} step={100} value={amount} />
        </div>
        <QuestionActions
          nextDisabled={!amount || amount <= 0}
          onBack={backFromAmount}
          onNext={() => template.supportsFrequency ? setEditStage("frequency") : applyAndFinish()}
          onSkip={onDone}
        />
      </GuidedSetupFrame>
    );
  }

  if (editStage === "frequency") {
    return (
      <GuidedSetupFrame
        eyebrow={guidedSetupGuides.find((guide) => guide.id === template.guideId)?.name ?? "Guided setup"}
        onExit={onExit}
        progress={{ current: position, total }}
        title={`Hur ofta betalas ${template.displayName.toLocaleLowerCase("sv-SE")}?`}
      >
        <fieldset className="mt-6">
          <legend className="sr-only">Betalningsfrekvens</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {guidedSetupFrequencyOptions.map((option) => (
              <SetupChoiceButton active={frequency === option.id} key={option.id} onClick={() => setFrequency(option.id)}>
                {option.label}
              </SetupChoiceButton>
            ))}
          </div>
        </fieldset>
        <QuestionActions
          onBack={() => setEditStage("amount")}
          onNext={() => frequency === "monthly" ? applyAndFinish() : setEditStage("month")}
          onSkip={onDone}
        />
      </GuidedSetupFrame>
    );
  }

  return (
    <GuidedSetupFrame
      eyebrow={guidedSetupGuides.find((guide) => guide.id === template.guideId)?.name ?? "Guided setup"}
      onExit={onExit}
      progress={{ current: position, total }}
      title={frequency === "yearly" ? "Vilken månad betalas den?" : "När kommer den första betalningen?"}
    >
        <label className="mt-6 block text-sm font-medium text-stone-700">
          {frequency === "yearly" ? "Betalningsmånad" : "Första betalningsmånad"}
          <select
            className="mt-2 h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 text-sm text-stone-950 outline-none focus:border-stone-600 focus:ring-2 focus:ring-stone-200"
            onChange={(event) => setPaymentMonth(event.target.value)}
            value={paymentMonth}
          >
            {guidedSetupMonthIds.map((monthId) => <option key={monthId} value={monthId}>{monthLabels[monthId]}</option>)}
          </select>
        </label>
      <QuestionActions
        onBack={() => setEditStage("frequency")}
        onNext={applyAndFinish}
        onSkip={onDone}
      />
    </GuidedSetupFrame>
  );
}

function TemplateSequence({
  data,
  guideId,
  onApply,
  onBack,
  onComplete,
  onExit,
  templateIds,
}: {
  data: GuidedSetupPlanningData;
  guideId: GuidedSetupGuideId;
  onApply: (templateId: string, value: { amount: number; frequency: GuidedSetupFrequency; paymentMonth: string }) => void;
  onBack: () => void;
  onComplete: () => void;
  onExit: () => void;
  templateIds: string[];
}) {
  const templates = templateIds
    .map((templateId) => getGuidedSetupTemplate(templateId))
    .filter((template): template is GuidedSetupTemplate => Boolean(template));
  const [index, setIndex] = useState(0);
  const template = templates[index];

  if (!template) {
    onComplete();
    return null;
  }

  return (
    <TemplateQuestion
      data={data}
      key={template.id}
      onApply={onApply}
      onBack={() => index === 0 ? onBack() : setIndex((current) => current - 1)}
      onDone={() => index === templates.length - 1 ? onComplete() : setIndex((current) => current + 1)}
      onExit={onExit}
      position={index + 1}
      template={{ ...template, guideId }}
      total={templates.length}
    />
  );
}

function StreamingGuide({
  data,
  onApply,
  onBack,
  onComplete,
  onExit,
}: {
  data: GuidedSetupPlanningData;
  onApply: (templateId: string, value: { amount: number; frequency: GuidedSetupFrequency; paymentMonth: string }) => void;
  onBack: () => void;
  onComplete: () => void;
  onExit: () => void;
}) {
  const streamingTemplates = guidedSetupTemplates.filter(
    (template) => template.guideId === "subscriptions" && template.id !== "subscription.mobile",
  );
  const existingIds = streamingTemplates
    .filter((template) => getGuidedSetupExpense(data, template.id))
    .map((template) => template.id);
  const [phase, setPhase] = useState<"question" | "select" | "amounts">("question");
  const [selectedIds, setSelectedIds] = useState<string[]>(existingIds);
  const [amountIndex, setAmountIndex] = useState(0);

  if (phase === "question") {
    const hasExisting = existingIds.length > 0;
    return (
      <GuidedSetupFrame
        description={hasExisting ? existingIds.map((id) => getGuidedSetupExpense(data, id)?.label).filter(Boolean).join(", ") : undefined}
        eyebrow="Abonnemang"
        onExit={onExit}
        progress={{ current: 2, total: 2 }}
        title={hasExisting ? "Streaming finns redan i din planering" : "Har hushållet streamingtjänster?"}
      >
        <div className="mt-7 grid grid-cols-2 gap-2">
          <SetupChoiceButton active={false} onClick={() => setPhase("select")}>{hasExisting ? "Ändra" : "Ja"}</SetupChoiceButton>
          <SetupChoiceButton active={false} onClick={onComplete}>{hasExisting ? "Behåll" : "Nej"}</SetupChoiceButton>
        </div>
        <QuestionActions onBack={onBack} onNext={() => setPhase("select")} onSkip={onComplete} nextLabel={hasExisting ? "Ändra" : "Ja, välj tjänster"} />
      </GuidedSetupFrame>
    );
  }

  if (phase === "select") {
    return (
      <GuidedSetupFrame description="Välj bara de tjänster som hushållet faktiskt använder." eyebrow="Abonnemang" onExit={onExit} title="Vilka streamingtjänster har ni?">
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {streamingTemplates.map((template) => {
            const active = selectedIds.includes(template.id);
            return (
              <SetupChoiceButton
                active={active}
                key={template.id}
                onClick={() => setSelectedIds((current) => active ? current.filter((id) => id !== template.id) : [...current, template.id])}
              >
                <span className="flex items-center gap-2">
                  <RecognizedBrandLogo name={template.displayName} />
                  <span>{template.displayName}</span>
                </span>
              </SetupChoiceButton>
            );
          })}
        </div>
        <QuestionActions nextDisabled={selectedIds.length === 0} onBack={() => setPhase("question")} onNext={() => { setAmountIndex(0); setPhase("amounts"); }} onSkip={onComplete} />
      </GuidedSetupFrame>
    );
  }

  const template = getGuidedSetupTemplate(selectedIds[amountIndex]);
  if (!template) {
    onComplete();
    return null;
  }

  return (
    <TemplateQuestion
      data={data}
      forceEdit
      key={template.id}
      onApply={onApply}
      onBack={() => amountIndex === 0 ? setPhase("select") : setAmountIndex((current) => current - 1)}
      onDone={() => amountIndex === selectedIds.length - 1 ? onComplete() : setAmountIndex((current) => current + 1)}
      onExit={onExit}
      position={amountIndex + 1}
      template={template}
      total={selectedIds.length}
    />
  );
}

function SubscriptionsGuide(props: Parameters<typeof StreamingGuide>[0]) {
  const [phase, setPhase] = useState<"mobile" | "streaming">("mobile");

  if (phase === "mobile") {
    return (
      <TemplateSequence
        data={props.data}
        guideId="subscriptions"
        onApply={props.onApply}
        onBack={props.onBack}
        onComplete={() => setPhase("streaming")}
        onExit={props.onExit}
        templateIds={["subscription.mobile"]}
      />
    );
  }

  return <StreamingGuide {...props} onBack={() => setPhase("mobile")} />;
}

function PetsGuide(props: Parameters<typeof StreamingGuide>[0]) {
  const [animal, setAnimal] = useState<"dog" | "cat" | "other" | null>(null);

  if (!animal) {
    return (
      <GuidedSetupFrame description="Du behöver inte ange antal eller ras." eyebrow="Husdjur" onExit={props.onExit} title="Har hushållet husdjur?">
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SetupChoiceButton active={false} onClick={props.onComplete}>Nej</SetupChoiceButton>
          <SetupChoiceButton active={false} onClick={() => setAnimal("dog")}>Hund</SetupChoiceButton>
          <SetupChoiceButton active={false} onClick={() => setAnimal("cat")}>Katt</SetupChoiceButton>
          <SetupChoiceButton active={false} onClick={() => setAnimal("other")}>Annat</SetupChoiceButton>
        </div>
        <QuestionActions onBack={props.onBack} onNext={() => setAnimal("other")} onSkip={props.onComplete} nextLabel="Annat" />
      </GuidedSetupFrame>
    );
  }

  return (
    <TemplateSequence
      data={props.data}
      guideId="pets"
      onApply={props.onApply}
      onBack={() => setAnimal(null)}
      onComplete={props.onComplete}
      onExit={props.onExit}
      templateIds={["insurance.pet", "pet.food"]}
    />
  );
}

function PlanningBasicsGuide({
  data,
  guideId,
  onBack,
  onComplete,
  onExit,
  onIncomeChange,
  onSavingsChange,
}: {
  data: GuidedSetupWorkspaceData;
  guideId: "income" | "savings";
  onBack: () => void;
  onComplete: () => void;
  onExit: () => void;
  onIncomeChange: (key: OnboardingIncomeKey, value: number) => void;
  onSavingsChange: (key: OnboardingSavingsGoalId, value: number) => void;
}) {
  const [draft, setDraft] = useState<GuidedSetupWorkspaceData>(data);
  const isIncome = guideId === "income";

  function saveDraft() {
    if (isIncome) {
      guidedIncomeKeys.forEach((key) =>
        onIncomeChange(key, getOnboardingIncomeAmount(draft, key)),
      );
    } else {
      guidedSavingsKeys.forEach((key) =>
        onSavingsChange(key, getOnboardingSavingsAmount(draft, key)),
      );
    }
    onComplete();
  }

  return (
    <GuidedSetupFrame
      description={
        isIncome
          ? "Ange ungefärliga månadsbelopp efter skatt. Befintliga uppgifter visas och kan behållas."
          : "Ange de månadsbelopp som är aktuella. Egna sparmål kan fortsatt hanteras i Workspace."
      }
      eyebrow={isIncome ? "Inkomster" : "Sparande"}
      onExit={onExit}
      title={isIncome ? "Vad kommer in varje månad?" : "Vad vill du planera att spara?"}
    >
      <div className="mt-6">
        {isIncome ? (
          <IncomeSetupFields
            data={draft}
            onChange={(key, value) =>
              setDraft((current) => setOnboardingIncomeAmount(current, key, value))
            }
          />
        ) : (
          <SavingsSetupFields
            data={draft}
            onChange={(key, value) =>
              setDraft((current) => setOnboardingSavingsAmount(current, key, value))
            }
          />
        )}
      </div>
      <QuestionActions onBack={onBack} onNext={saveDraft} onSkip={onComplete} />
    </GuidedSetupFrame>
  );
}

export function GuidedSetupEntryPoint({
  onStart,
  suggestion,
}: {
  onStart: (guideId?: GuidedSetupGuideId) => void;
  suggestion: PlanningCompletionSuggestion | null;
}) {
  return (
    <aside className="mx-auto w-full max-w-[1560px] px-4 pb-12 pt-0 sm:px-6 lg:px-8 lg:pb-4 lg:pt-6" aria-labelledby="guided-setup-entry-title">
      <div className="flex flex-col gap-4 rounded-[18px] border border-stone-200 bg-[#fbfaf6] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-stone-900" id="guided-setup-entry-title">Bygg vidare på din ekonomi</h2>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-stone-500">Fameko kan hjälpa dig att lägga till delar du kanske inte hunnit planera ännu.</p>
          {suggestion ? (
            <p className="mt-2 text-xs font-medium text-stone-700">
              Nästa steg: {suggestion.actionLabel}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
          {suggestion ? (
            <button className={secondaryButtonClass} onClick={() => onStart()} type="button">
              Välj område
            </button>
          ) : null}
          <button
            className={`${primaryButtonClass} shrink-0`}
            onClick={() => onStart(suggestion?.guideId)}
            type="button"
          >
            {suggestion?.actionLabel ?? "Bygg vidare"}
          </button>
        </div>
      </div>
    </aside>
  );
}

export function GuidedSetupPlatform({
  data,
  initialGuideId,
  onApply,
  onClose,
  onIncomeChange,
  onSavingsChange,
}: {
  data: GuidedSetupWorkspaceData;
  initialGuideId?: GuidedSetupGuideId;
  onApply: (templateId: string, value: { amount: number; frequency: GuidedSetupFrequency; paymentMonth: string }) => void;
  onClose: () => void;
  onIncomeChange: (key: OnboardingIncomeKey, value: number) => void;
  onSavingsChange: (key: OnboardingSavingsGoalId, value: number) => void;
}) {
  const [queue, setQueue] = useState<GuidedSetupGuideId[]>(() =>
    initialGuideId ? [initialGuideId] : [],
  );
  const [queueIndex, setQueueIndex] = useState(0);
  const [complete, setComplete] = useState(false);
  const activeGuide = queue[queueIndex];
  const guide = useMemo(() => guidedSetupGuides.find((candidate) => candidate.id === activeGuide), [activeGuide]);

  function start(nextQueue: GuidedSetupGuideId[]) {
    setQueue(nextQueue);
    setQueueIndex(0);
    setComplete(false);
  }

  function completeGuide() {
    if (queueIndex < queue.length - 1) {
      setQueueIndex((current) => current + 1);
    } else {
      setComplete(true);
    }
  }

  if (complete) {
    return (
      <GuidedSetupFrame description="Dina svar finns nu i samma årsplanering som resten av din ekonomi." eyebrow="Klart" onExit={onClose} title="Bra, din ekonomi har fått lite mer form">
        <div className="mt-8 flex justify-end border-t border-stone-200 pt-5">
          <button className={primaryButtonClass} onClick={onClose} type="button">Tillbaka till Workspace</button>
        </div>
      </GuidedSetupFrame>
    );
  }

  if (!activeGuide || !guide) {
    return (
      <GuidedSetupFrame description="Välj en del nu eller gå igenom allt i lugn takt." eyebrow="Guided setup" onExit={onClose} title="Vad vill du gå igenom?">
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {guidedSetupGuides.map((option) => (
            <button className="rounded-2xl border border-stone-200 bg-white px-4 py-4 text-left transition hover:border-stone-400 hover:shadow-[0_8px_24px_rgba(28,25,23,0.05)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900" key={option.id} onClick={() => start([option.id])} type="button">
              <span className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                {guidedSetupMainSectionIds[option.id] ? (
                  <span aria-hidden="true" className="w-5 text-center text-sm leading-none">
                    {famekoMainSectionSymbols[guidedSetupMainSectionIds[option.id]!]}
                  </span>
                ) : null}
                <span>{option.name}</span>
              </span>
              <span className="mt-1 block text-xs leading-5 text-stone-500">{option.description}</span>
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-5">
          <button className={secondaryButtonClass} onClick={onClose} type="button">Tillbaka till Workspace</button>
          <button className={`ml-auto ${primaryButtonClass}`} onClick={() => start(guidedSetupGuides.map((option) => option.id))} type="button">Gå igenom allt</button>
        </div>
      </GuidedSetupFrame>
    );
  }

  const commonProps = {
    data,
    onApply,
    onBack: () =>
      queueIndex > 0 ? setQueueIndex((current) => current - 1) : setQueue([]),
    onComplete: completeGuide,
    onExit: onClose,
  };

  if (activeGuide === "income" || activeGuide === "savings") {
    return (
      <PlanningBasicsGuide
        data={data}
        guideId={activeGuide}
        key={`${activeGuide}-${queueIndex}`}
        onBack={commonProps.onBack}
        onComplete={completeGuide}
        onExit={onClose}
        onIncomeChange={onIncomeChange}
        onSavingsChange={onSavingsChange}
      />
    );
  }

  if (activeGuide === "subscriptions") return <SubscriptionsGuide key={`${activeGuide}-${queueIndex}`} {...commonProps} />;
  if (activeGuide === "pets") return <PetsGuide key={`${activeGuide}-${queueIndex}`} {...commonProps} />;

  return (
    <TemplateSequence
      key={`${activeGuide}-${queueIndex}`}
      {...commonProps}
      guideId={activeGuide}
      templateIds={
        activeGuide === "insurance"
          ? ["insurance.home", "insurance.villa", "insurance.car"]
          : [
              "debt.csn",
              "debt.private-loan",
              "debt.credit-card",
              "debt.unsecured-loan",
              "debt.consumer-loan",
              "debt.other",
            ]
      }
    />
  );
}
