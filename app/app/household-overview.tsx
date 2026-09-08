"use client";

import Image from "next/image";

import {
  createHouseholdChild,
  emptyHouseholdProfile,
  getHouseholdProfile,
  householdChildAgeMax,
  householdCountMax,
  type HouseholdChild,
  type HouseholdProfile,
} from "../../shared/planning/household.ts";
import { mobileTypography } from "./mobile-design-system.ts";

type HouseholdTextField =
  | "address"
  | "city"
  | "householdDisplayName"
  | "postalCode";
type HouseholdCountField = "adultCount" | "childCount";

const textFieldLengths: Record<HouseholdTextField, number> = {
  address: 160,
  city: 80,
  householdDisplayName: 120,
  postalCode: 12,
};

function HouseholdTextInput({
  autoComplete,
  field,
  label,
  onChange,
  placeholder,
  value,
}: {
  autoComplete?: string;
  field: HouseholdTextField;
  label: string;
  onChange: (field: HouseholdTextField, value: string) => void;
  placeholder: string;
  value: string | null;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-medium text-stone-600">
        <span>{label}</span>
        <span className="font-normal text-stone-400">Valfritt</span>
      </span>
      <input
        autoComplete={autoComplete}
        className="min-h-11 w-full rounded-xl border border-stone-200 bg-[#f8f7f3] px-3 text-sm font-medium text-stone-900 outline-none transition placeholder:text-stone-300 focus:border-[#9aaa97] focus:bg-white focus:ring-2 focus:ring-[#dce4da]"
        maxLength={textFieldLengths[field]}
        name={field}
        onChange={(event) => onChange(field, event.target.value)}
        placeholder={placeholder}
        value={value ?? ""}
      />
    </label>
  );
}

function HouseholdCountInput({
  field,
  label,
  onChange,
  value,
}: {
  field: HouseholdCountField;
  label: string;
  onChange: (field: HouseholdCountField, value: number | null) => void;
  value: number | null;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-medium text-stone-600">
        <span>{label}</span>
        <span className="font-normal text-stone-400">Valfritt</span>
      </span>
      <input
        className="min-h-11 w-full rounded-xl border border-stone-200 bg-[#f8f7f3] px-3 text-sm font-medium tabular-nums text-stone-900 outline-none transition placeholder:text-stone-300 focus:border-[#9aaa97] focus:bg-white focus:ring-2 focus:ring-[#dce4da]"
        inputMode="numeric"
        max={householdCountMax}
        min={0}
        name={field}
        onChange={(event) =>
          onChange(field, event.target.value === "" ? null : Number(event.target.value))
        }
        placeholder="0"
        step={1}
        type="number"
        value={value ?? ""}
      />
    </label>
  );
}

function ChildDetailRow({
  child,
  index,
  onChange,
  onRemove,
}: {
  child: HouseholdChild;
  index: number;
  onChange: (child: HouseholdChild) => void;
  onRemove: () => void;
}) {
  const mode = child.birthYear !== null && child.birthYear !== undefined
    ? "birthYear"
    : "age";
  const value = mode === "age" ? child.age : child.birthYear;

  function changeMode(nextMode: "age" | "birthYear") {
    onChange({
      age: nextMode === "age" ? child.age ?? null : null,
      birthYear: nextMode === "birthYear" ? child.birthYear ?? null : null,
      id: child.id,
    });
  }

  return (
    <li className="rounded-[18px] border border-stone-200/80 bg-[#fbfaf7] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-stone-900">Barn {index + 1}</p>
        <button
          aria-label={`Ta bort uppgifter för barn ${index + 1}`}
          className="min-h-9 rounded-full px-3 text-xs font-medium text-stone-400 transition hover:bg-stone-100 hover:text-stone-800"
          onClick={onRemove}
          type="button"
        >
          Ta bort
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-stone-600">Uppgift</legend>
          <div className="inline-flex min-h-11 rounded-xl bg-stone-100 p-1">
            {([
              ["age", "Ålder"],
              ["birthYear", "Födelseår"],
            ] as const).map(([option, label]) => (
              <button
                aria-pressed={mode === option}
                className={`rounded-lg px-3 text-sm font-medium transition ${
                  mode === option
                    ? "bg-white text-stone-950 shadow-sm"
                    : "text-stone-500 hover:text-stone-800"
                }`}
                key={option}
                onClick={() => changeMode(option)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block min-w-0">
          <span className="mb-1.5 block text-xs font-medium text-stone-600">
            {mode === "age" ? "Ålder" : "Födelseår"}
          </span>
          <span className="relative block">
            <input
              aria-label={`${mode === "age" ? "Ålder" : "Födelseår"} för barn ${index + 1}`}
              className="min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 pr-10 text-sm font-medium tabular-nums text-stone-900 outline-none transition placeholder:text-stone-300 focus:border-[#9aaa97] focus:ring-2 focus:ring-[#dce4da]"
              inputMode="numeric"
              max={mode === "age" ? householdChildAgeMax : 2200}
              min={mode === "age" ? 0 : 1900}
              onChange={(event) => {
                const nextValue = event.target.value === "" ? null : Number(event.target.value);
                onChange({
                  age: mode === "age" ? nextValue : null,
                  birthYear: mode === "birthYear" ? nextValue : null,
                  id: child.id,
                });
              }}
              placeholder={mode === "age" ? "0" : "2018"}
              step={1}
              type="number"
              value={value ?? ""}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-stone-400">
              {mode === "age" ? "år" : null}
            </span>
          </span>
        </label>
      </div>
    </li>
  );
}

export function HouseholdOverview({
  data,
  onChange,
}: {
  data: HouseholdProfile | undefined;
  onChange: (profile: HouseholdProfile) => void;
}) {
  const household = data
    ? getHouseholdProfile({ householdProfile: data })
    : emptyHouseholdProfile;

  function updateText(field: HouseholdTextField, value: string) {
    onChange({ ...household, [field]: value });
  }

  function updateCount(field: HouseholdCountField, value: number | null) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      return;
    }

    onChange({ ...household, [field]: value });
  }

  function updateChild(childId: string, child: HouseholdChild) {
    onChange({
      ...household,
      children: household.children.map((current) =>
        current.id === childId ? child : current,
      ),
    });
  }

  return (
    <div className="mt-8 space-y-6">
      <section
        aria-labelledby="household-identity-title"
        className="grid overflow-hidden rounded-[26px] border border-stone-200/80 bg-[#fbfaf7] shadow-[0_18px_55px_rgba(28,25,23,0.045)] lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:rounded-[30px]"
      >
        <div className="relative min-h-[230px] overflow-hidden bg-[#f1efe8] sm:min-h-[310px] lg:min-h-[560px]">
          <Image
            alt="Ljust nordiskt matbord som symboliserar hushållets gemensamma grund"
            className="object-contain p-4 sm:p-7 lg:p-9"
            fill
            sizes="(max-width: 1023px) calc(100vw - 48px), min(660px, 42vw)"
            src="/images/dashboard/household-preview.webp"
            unoptimized
          />
        </div>

        <div className="flex min-w-0 flex-col p-5 sm:p-7 lg:p-9 xl:p-11">
          <div>
            <h2
              className={`${mobileTypography.pageTitle} text-stone-950 lg:text-[28px]`}
              id="household-identity-title"
            >
              Hushållets grund
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-stone-500">
              Gemensamma uppgifter som får följa med hushållets ekonomi och användas där de skapar värde.
            </p>
          </div>

          <fieldset className="mt-7 grid gap-4 sm:grid-cols-2">
            <legend className="sr-only">Hushållets gemensamma uppgifter</legend>
            <div className="sm:col-span-2">
              <HouseholdTextInput
                field="householdDisplayName"
                label="Hushållsnamn"
                onChange={updateText}
                placeholder="Till exempel Familjen Solgläntan"
                value={household.householdDisplayName}
              />
            </div>
            <div className="sm:col-span-2">
              <HouseholdTextInput
                autoComplete="street-address"
                field="address"
                label="Adress"
                onChange={updateText}
                placeholder="Gatuadress"
                value={household.address}
              />
            </div>
            <HouseholdTextInput
              autoComplete="postal-code"
              field="postalCode"
              label="Postnummer"
              onChange={updateText}
              placeholder="123 45"
              value={household.postalCode}
            />
            <HouseholdTextInput
              autoComplete="address-level2"
              field="city"
              label="Ort"
              onChange={updateText}
              placeholder="Ort"
              value={household.city}
            />
          </fieldset>

          <div className="mt-auto border-t border-stone-200/80 pt-7 lg:mt-9">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#71816d]">
              Hushållet, inte personerna
            </p>
            <p className="mt-2 max-w-xl text-xs leading-5 text-stone-500">
              Inga namn, personnummer eller kontaktuppgifter behövs. Adressen hör till hushållet och är skild från boendets ekonomi.
            </p>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="household-size-title"
        className="rounded-[24px] border border-stone-200/80 bg-white p-5 sm:p-7"
      >
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold tracking-[-0.025em] text-stone-950" id="household-size-title">
            Hushållets storlek
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            Antalet räcker. Du behöver inte registrera vilka personerna är.
          </p>
        </div>
        <fieldset className="mt-6 grid gap-5 sm:max-w-2xl sm:grid-cols-2">
          <legend className="sr-only">Antal personer i hushållet</legend>
          <HouseholdCountInput
            field="adultCount"
            label="Antal vuxna"
            onChange={updateCount}
            value={household.adultCount}
          />
          <HouseholdCountInput
            field="childCount"
            label="Antal barn"
            onChange={updateCount}
            value={household.childCount}
          />
        </fieldset>
      </section>

      <section
        aria-labelledby="household-children-title"
        className="rounded-[24px] border border-stone-200/80 bg-white p-5 sm:p-7"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#71816d]">Valfritt</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-stone-950" id="household-children-title">
              Barn
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Lägg bara till ålder eller födelseår om det hjälper planeringen. Inga namn eller andra identifierande uppgifter sparas.
            </p>
          </div>
          <button
            className="min-h-10 shrink-0 rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:text-stone-950 disabled:cursor-not-allowed disabled:text-stone-300"
            disabled={household.children.length >= householdCountMax}
            onClick={() => onChange(createHouseholdChild(household))}
            type="button"
          >
            + Lägg till barnuppgift
          </button>
        </div>

        {household.children.length ? (
          <ul className="mt-6 grid gap-3 lg:grid-cols-2">
            {household.children.map((child, index) => (
              <ChildDetailRow
                child={child}
                index={index}
                key={child.id}
                onChange={(nextChild) => updateChild(child.id, nextChild)}
                onRemove={() =>
                  onChange({
                    ...household,
                    children: household.children.filter((item) => item.id !== child.id),
                  })
                }
              />
            ))}
          </ul>
        ) : (
          <p className="mt-6 rounded-[18px] bg-[#f8f7f3] px-4 py-5 text-sm leading-6 text-stone-500">
            Inga barnuppgifter tillagda. Antal barn ovan kan fortfarande användas i hushållets översikt.
          </p>
        )}
      </section>
    </div>
  );
}
