"use client";

import Image from "next/image";
import { useState } from "react";

import {
  createSavingsGoal,
  getSavingsOverview,
  type SavingsOverviewGoal,
} from "../../shared/planning/savings.ts";
import { formatPreviewCurrency, formatPreviewPercentage } from "./personal-economy-card.tsx";
import type { DetailPlanningData } from "./use-planning-detail.ts";

function SavingsGoalRow({ goal }: { goal: SavingsOverviewGoal }) {
  return (
    <li className="flex min-h-16 items-center justify-between gap-4 border-b border-stone-100 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-stone-900">{goal.name}</p>
        <p className="mt-1 text-xs text-stone-400">
          {formatPreviewCurrency(goal.averageMonthlySavings)} i snitt per månad
        </p>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-emerald-900">
        {formatPreviewCurrency(goal.totalPlannedSavings)}
      </p>
    </li>
  );
}

export function SavingsOverview({
  data,
  onChange,
}: {
  data: DetailPlanningData;
  onChange: (data: DetailPlanningData) => void;
}) {
  const [draft, setDraft] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const overview = getSavingsOverview(data);

  function addGoal() {
    const next = createSavingsGoal(data, draft);
    if (next === data) {
      return;
    }

    onChange(next);
    setDraft("");
    setFormOpen(false);
  }

  return (
    <div className="mt-8 space-y-6">
      <section
        aria-labelledby="savings-overview-title"
        className="grid overflow-hidden rounded-[26px] border border-stone-200/80 bg-[#fbfaf7] shadow-[0_18px_55px_rgba(28,25,23,0.045)] lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:rounded-[30px]"
      >
        <div className="relative min-h-[220px] overflow-hidden bg-[#f1efe8] sm:min-h-[300px] lg:min-h-[470px]">
          <Image
            alt="Stilren illustration av en växt, sparbössa och mynt"
            className="object-contain p-5 sm:p-8 lg:p-10"
            fill
            sizes="(max-width: 1023px) calc(100vw - 48px), min(660px, 42vw)"
            src="/images/dashboard/savings-preview-neutral.png"
            unoptimized
          />
        </div>

        <div className="flex min-w-0 flex-col p-5 sm:p-7 lg:p-9 xl:p-11">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.035em] text-stone-950" id="savings-overview-title">
              Sparöversikt
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-stone-500">
              Allt hämtas från sparmålen och inkomsterna som redan finns i PlanningData.
            </p>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-x-5 gap-y-6 border-t border-stone-200/80 pt-7">
            <div className="min-w-0">
              <dt className="text-xs text-stone-400">Planerat för året</dt>
              <dd className="mt-1.5 break-words text-xl font-semibold tracking-[-0.025em] tabular-nums text-emerald-900">
                {formatPreviewCurrency(overview.totalPlannedSavings)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-stone-400">Snitt per månad</dt>
              <dd className="mt-1.5 break-words text-xl font-semibold tracking-[-0.025em] tabular-nums text-stone-900">
                {formatPreviewCurrency(overview.averageMonthlySavings)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-stone-400">Sparkvot</dt>
              <dd className="mt-1.5 break-words text-xl font-semibold tracking-[-0.025em] tabular-nums text-stone-900">
                {formatPreviewPercentage(overview.savingsRate)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-stone-400">Sparmål</dt>
              <dd className="mt-1.5 break-words text-xl font-semibold tracking-[-0.025em] tabular-nums text-stone-900">
                {overview.goals.length}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="savings-goals-title" className="rounded-[24px] border border-stone-200/80 bg-white p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-stone-950" id="savings-goals-title">
              Dina sparmål
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Buffert, Pension, Investeringar och egna mål ingår i samma totalsumma.
            </p>
          </div>
          {!formOpen ? (
            <button
              className="min-h-10 shrink-0 rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
              onClick={() => setFormOpen(true)}
              type="button"
            >
              + Lägg till sparmål
            </button>
          ) : null}
        </div>

        {formOpen ? (
          <div className="mt-5 flex flex-col gap-3 rounded-[18px] bg-[#f8f7f3] p-4 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1">
              <span className="mb-1.5 block text-xs font-medium text-stone-600">Namn på sparmålet</span>
              <input
                autoFocus
                className="min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none focus:border-[#9aaa97] focus:ring-2 focus:ring-[#dce4da]"
                maxLength={48}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addGoal();
                  }
                }}
                placeholder="Till exempel Renovering"
                value={draft}
              />
            </label>
            <div className="flex gap-2">
              <button className="min-h-11 rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-600" onClick={() => { setDraft(""); setFormOpen(false); }} type="button">
                Avbryt
              </button>
              <button className="min-h-11 rounded-full bg-stone-900 px-5 text-sm font-semibold text-white disabled:bg-stone-300" disabled={!draft.trim()} onClick={addGoal} type="button">
                Lägg till
              </button>
            </div>
          </div>
        ) : null}

        <ul className="mt-5">
          {overview.goals.map((goal) => (
            <SavingsGoalRow goal={goal} key={goal.id} />
          ))}
        </ul>
        <p className="mt-5 text-xs leading-5 text-stone-400">
          Beloppen per månad redigeras i årsplaneringen. Den här sidan använder samma värden utan en separat sparmodell.
        </p>
      </section>
    </div>
  );
}
