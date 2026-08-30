import Link from "next/link";
import type { ReactNode } from "react";

import { mobileTypography } from "./mobile-design-system.ts";
import type { DetailLoadState, DetailSaveState } from "./use-planning-detail.ts";

export function DetailPageShell({
  children,
  description,
  hasChanges,
  loadState,
  message,
  onSave,
  saveState,
  title,
}: {
  children: ReactNode;
  description: string;
  hasChanges: boolean;
  loadState: DetailLoadState;
  message: string;
  onSave: () => void;
  saveState: DetailSaveState;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-[#f7f5ef] text-stone-950">
      <header className="border-b border-stone-200/80 bg-[#f7f5ef]/95">
        <div className="mx-auto flex min-h-16 w-full max-w-[1560px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link className="text-sm font-semibold tracking-[-0.02em] text-[#657663]" href="/app">
            Fameko
          </Link>
          <div className="flex items-center gap-3">
            {message ? (
              <span className="hidden text-xs text-stone-500 sm:inline" role="status">
                {message}
              </span>
            ) : null}
            <button
              className="min-h-10 rounded-full bg-stone-900 px-5 text-sm font-semibold text-white transition enabled:hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
              disabled={!hasChanges || loadState !== "ready" || saveState === "saving"}
              onClick={onSave}
              type="button"
            >
              {saveState === "saving" ? "Sparar…" : "Spara"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1560px] px-4 pb-16 pt-7 sm:px-6 sm:pt-10 lg:px-8 lg:pb-24 lg:pt-12">
        <Link
          className="inline-flex min-h-10 items-center text-sm font-medium text-stone-500 transition hover:text-stone-950"
          href="/app#personal-economy-title"
        >
          <span aria-hidden="true">←</span>&nbsp; Tillbaka till Min ekonomi
        </Link>
        <div className="mt-5 max-w-3xl">
          <h1 className={`${mobileTypography.pageTitle} text-stone-950 lg:text-[40px] lg:leading-[1.08]`}>
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-stone-500 sm:text-[15px] sm:leading-7">
            {description}
          </p>
          {message ? (
            <p className="mt-3 text-xs text-stone-500 sm:hidden" role="status">
              {message}
            </p>
          ) : null}
        </div>

        {loadState === "loading" ? (
          <div className="mt-8 rounded-[24px] border border-stone-200/80 bg-white p-6 text-sm text-stone-500">
            Hämtar din ekonomi…
          </div>
        ) : loadState === "error" ? (
          <div className="mt-8 rounded-[24px] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
            {message}
          </div>
        ) : (
          children
        )}
      </div>
    </main>
  );
}
