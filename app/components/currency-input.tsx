"use client";

import { useEffect, useState } from "react";

import {
  defaultCurrencyInputStep,
  formatCurrencyInput,
  parseCurrencyInput,
} from "../../shared/ui/currency-input.ts";

export function CurrencyInput({
  className = "",
  id,
  label,
  onChange,
  showZero = false,
  step = defaultCurrencyInputStep,
  value,
}: {
  className?: string;
  id?: string;
  label: string;
  onChange: (value: number | null) => void;
  showZero?: boolean;
  step?: number;
  value: number | null;
}) {
  const [displayValue, setDisplayValue] = useState(() =>
    value === 0 && !showZero ? "" : formatCurrencyInput(value),
  );

  useEffect(() => {
    setDisplayValue(value === 0 && !showZero ? "" : formatCurrencyInput(value));
  }, [showZero, value]);

  return (
    <label className="block text-sm font-medium text-stone-700" htmlFor={id}>
      {label}
      <span className="relative block">
        <input
          className={`mt-2 h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 pr-10 text-[15px] tabular-nums text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-stone-600 focus:ring-2 focus:ring-stone-200 ${className}`}
          id={id}
          inputMode="numeric"
          min="0"
          onChange={(event) => {
            const amount = parseCurrencyInput(event.target.value);
            setDisplayValue(formatCurrencyInput(amount));
            onChange(amount);
          }}
          placeholder=""
          step={step}
          type="text"
          value={displayValue}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center pt-2 text-xs text-stone-400"
        >
          kr
        </span>
      </span>
    </label>
  );
}
