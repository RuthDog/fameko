"use client";

import Image from "next/image";

import {
  emptyHouseholdProfile,
  getHouseholdProfile,
  householdCountMax,
  type HouseholdProfile,
} from "../../shared/planning/household.ts";
import { mobileTypography } from "./mobile-design-system.ts";

type HouseholdTextField = "householdDisplayName";
type HouseholdCountField = "adultCount" | "childCount";

const textFieldLengths: Record<HouseholdTextField, number> = {
  householdDisplayName: 120,
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
          </fieldset>

          <div className="mt-auto border-t border-stone-200/80 pt-7 lg:mt-9">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#71816d]">
              Hushållet, inte personerna
            </p>
            <p className="mt-2 max-w-xl text-xs leading-5 text-stone-500">
              Inga namn på personer, personnummer, kontaktuppgifter eller adresser behövs.
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

    </div>
  );
}
