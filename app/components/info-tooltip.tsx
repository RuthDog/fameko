"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

export function InfoTooltip({
  description,
  importance,
  learnMoreHref,
  title,
  usage,
}: {
  description: string;
  importance: string;
  learnMoreHref?: string;
  title: string;
  usage: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <span
      className="relative inline-flex"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onFocus={() => setOpen(true)}
      onMouseEnter={() => {
        if (window.matchMedia("(hover: hover)").matches) setOpen(true);
      }}
      onMouseLeave={() => {
        if (window.matchMedia("(hover: hover)").matches) setOpen(false);
      }}
      ref={containerRef}
    >
      <button
        aria-controls={tooltipId}
        aria-expanded={open}
        aria-label={`Mer information om ${title}`}
        className="inline-flex size-7 items-center justify-center rounded-full text-stone-400 transition hover:bg-white hover:text-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-700"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span
          aria-hidden="true"
          className="flex size-[17px] items-center justify-center rounded-full border border-current text-[11px] font-semibold leading-none"
        >
          i
        </span>
      </button>

      {open ? (
        <span
          className="absolute right-0 top-full z-30 mt-2 w-[min(286px,calc(100vw-3rem))] rounded-[16px] border border-stone-200/90 bg-[#fffefa] p-4 text-left shadow-[0_14px_38px_rgba(28,25,23,0.14)]"
          id={tooltipId}
          role={learnMoreHref ? "dialog" : "tooltip"}
        >
          <span className="block text-sm font-semibold text-stone-900">
            {title}
          </span>
          <span className="mt-2 block text-xs leading-5 text-stone-600">
            {description}
          </span>
          <span className="mt-3 block text-[11px] font-semibold text-stone-500">
            Varför det spelar roll
          </span>
          <span className="mt-1 block text-xs leading-5 text-stone-600">
            {importance}
          </span>
          <span className="mt-3 block text-[11px] font-semibold text-stone-500">
            Så använder Fameko det
          </span>
          <span className="mt-1 block text-xs leading-5 text-stone-600">
            {usage}
          </span>
          {learnMoreHref ? (
            <Link
              className="mt-3 inline-flex text-xs font-semibold text-stone-700 transition hover:text-stone-950"
              href={learnMoreHref}
            >
              Läs mer&nbsp;<span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
