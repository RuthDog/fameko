"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import {
  currentPlanningYear,
  emptyPlanningDataV3,
  seedPlanningDataV3,
} from "../../shared/planning/seed-planning-data.ts";
import {
  getCarPlanningEconomics,
  isCarData,
  type CarData,
} from "../../shared/planning/car.ts";
import {
  applyScopedMonthValue,
  getAffectedMonthIds,
  getEffectiveExpenseCategoryAmount,
  getEffectiveExpenseCategoryTotals,
  getEffectiveExpenseItemAmount,
  type PlanningEditScope,
} from "../../shared/planning/effective-values.ts";
import { isHousingData, type HousingData } from "../../shared/planning/housing.ts";
import {
  createSavingsGoal,
  getSavingsGoals,
  getSavingsOverview,
  migrateLegacySavingsStructure,
  renameSavingsGoal,
  selectMonthlySavingsMetrics,
} from "../../shared/planning/savings.ts";
import {
  buildMobileUpcomingInsights,
  type MobileInsightEvent,
  type MobileUpcomingInsight,
} from "../../shared/planning/mobile-insights.ts";
import { mobileRhythm, mobileTypography } from "./mobile-design-system.ts";
import { PersonalEconomySection } from "./personal-economy-section.tsx";
import {
  WorkspaceSaveButton,
  WorkspaceSaveStatusBar,
} from "./workspace-save-controls.tsx";
import {
  hasUnsavedWorkspaceChanges,
  type WorkspaceSaveOperationState,
} from "../../shared/workspace/save-experience.ts";
import {
  finalizePlanningOnboarding,
  getPlanningCompletionSuggestion,
  setOnboardingIncomeAmount,
  setOnboardingSavingsAmount,
  shouldOfferPlanningOnboarding,
} from "../../shared/planning/onboarding.ts";
import {
  OnboardingFlow,
  OnboardingWelcome,
  WorkspaceCompletionHint,
} from "./onboarding.tsx";
import {
  upsertGuidedSetupExpense,
  type GuidedSetupFrequency,
  type GuidedSetupGuideId,
} from "../../shared/planning/guided-setup.ts";
import {
  GuidedSetupEntryPoint,
  GuidedSetupPlatform,
} from "./guided-setup.tsx";
import {
  famekoMainSectionSymbols,
  getExpenseCategoryMainSectionId,
  type FamekoMainSectionId,
} from "../../shared/ui/fameko-symbols.ts";
import { RecognizedBrandLogo } from "../components/brand-logo.tsx";

type Status = "green" | "yellow" | "red";
type ChangeScope = PlanningEditScope;
type ExpenseFrequency =
  | "once"
  | "monthly"
  | "everyTwoMonths"
  | "quarterly"
  | "twiceYearly"
  | "yearly";
type MonthValue = Record<string, number>;
type IncomeLineKey = "salaryOne" | "salaryTwo" | "benefits" | "other";
type IncomeLineValues = Partial<Record<IncomeLineKey, Partial<MonthValue>>>;
type AllocationKey = "food" | "spending" | "billAccount" | "mortgage" | "savings";
type AllocationOverrides = Partial<Record<AllocationKey, Partial<MonthValue>>>;
type AreaItemKey =
  | "mortgageInterest"
  | "mortgageAmortization"
  | "savingsBuffer"
  | "savingsVacation"
  | "savingsIsk"
  | "savingsPension";
type AreaItemValues = Partial<Record<AreaItemKey, Partial<MonthValue>>>;
type PlanningLabels = {
  incomeLines?: Partial<Record<IncomeLineKey, string>>;
  allocations?: Partial<Record<AllocationKey, string>>;
  areaItems?: Partial<Record<AreaItemKey, string>>;
  expenseCategories?: Record<string, string>;
  expenseItems?: Record<string, string>;
};
type ResolvedPlanningLabels = {
  incomeLines: Record<IncomeLineKey, string>;
  allocations: Record<AllocationKey, string>;
  areaItems: Record<AreaItemKey, string>;
};
type NameTarget =
  | { type: "incomeLine"; key: IncomeLineKey }
  | { type: "allocation"; key: AllocationKey }
  | { type: "areaItem"; key: AreaItemKey }
  | { type: "expenseCategory"; id: string }
  | { type: "expenseItem"; id: string };
type AmountTarget =
  | { type: "openingBalance" }
  | { type: "incomeLine"; monthId: string; incomeLineKey: IncomeLineKey }
  | { type: "allocation"; monthId: string; allocationKey: AllocationKey }
  | { type: "areaItem"; monthId: string; areaItemKey: AreaItemKey }
  | { type: "category"; monthId: string; categoryId: string }
  | { type: "item"; monthId: string; categoryId: string; itemId: string };
type DeleteTarget = Extract<AmountTarget, { type: "item" }> & { itemLabel: string };
type SavingsGoalView = { id: string; name: string };

type Income = {
  id: string;
  name: string;
  monthlyValues: MonthValue;
  recurring: boolean;
};

type ExpenseCategory = {
  id: string;
  name: string;
  order: number;
};

type ExpenseItem = {
  id: string;
  category: string;
  name: string;
  monthlyValues: MonthValue;
  recurring: boolean;
  frequency?: ExpenseFrequency;
};

type PlanningData = {
  version: 3;
  openingBalance: number;
  incomes: Income[];
  expenseCategories: ExpenseCategory[];
  expenseItems: ExpenseItem[];
  carData?: CarData;
  housingData?: HousingData;
  allocationOverrides?: AllocationOverrides;
  areaItemValues?: AreaItemValues;
  incomeLineValues?: IncomeLineValues;
  labels?: PlanningLabels;
};

type CloudPlanningYear = {
  data: PlanningData;
  revision: number;
  schemaVersion: number;
  updatedAt: string;
  year: number;
};

type CloudLoadState = "loading" | "import" | "ready" | "error";
type CloudSaveState = WorkspaceSaveOperationState;

type ForecastExpenseItem = {
  id?: string;
  name: string;
  amount: string;
};

type ForecastExpenseCategory = {
  id?: string;
  name: string;
  amount: string;
  items?: ForecastExpenseItem[];
};

type ForecastMonth = {
  id: string;
  label: string;
  name: string;
  status: Status;
  startBalance: string;
  income: string;
  expenses: string;
  calculatedBalance: string;
  allocations?: Record<AllocationKey, string>;
  areaItemValues?: Record<AreaItemKey, string>;
  incomeLineValues?: Record<IncomeLineKey, string>;
  savingsGoalValues?: Record<string, string>;
  short: {
    startBalance: string;
    income: string;
    expenses: string;
    calculatedBalance: string;
  };
  categories: ForecastExpenseCategory[];
};

type LargestCost = {
  amount: string;
  icon: string;
  id: string;
  insight: string;
  name: string;
  percentage: number;
};

type YearRow = {
  label: string;
  shortLabel: string;
  key: "income" | "expenses" | "remaining";
};

type AddExpenseDraft = {
  categoryId: string;
  description: string;
  amount: string;
  monthId: string;
  frequency: ExpenseFrequency;
};
type ExpenseCategoryOption = { id: string; label: string };

type PendingEdit = {
  target: AmountTarget;
  amount: string;
};

type PendingDelete = {
  target: DeleteTarget;
  recurring: boolean;
};

type NameEditor = {
  editingKey: string | null;
  editingValue: string;
  onBeginEdit: (target: NameTarget, label: string) => void;
  onCancelEdit: () => void;
  onChangeEdit: (value: string) => void;
  onSaveEdit: () => void;
};

const statusDot: Record<Status, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-rose-400",
};

const yearRows: YearRow[] = [
  { label: "Inkomster", shortLabel: "In", key: "income" },
  { label: "Fördelat", shortLabel: "Förd.", key: "expenses" },
  { label: "Kvar att fördela", shortLabel: "Kvar", key: "remaining" },
];

const incomeLines: { key: IncomeLineKey; label: string }[] = [
  { key: "salaryOne", label: "Lön 1" },
  { key: "salaryTwo", label: "Lön 2" },
  { key: "benefits", label: "Bidrag" },
  { key: "other", label: "Övrigt" },
];

const allocationRows: { key: AllocationKey; label: string }[] = [
  { key: "food", label: "Mat" },
  { key: "spending", label: "Ströpengar" },
  { key: "billAccount", label: "Räkningskonto" },
  { key: "mortgage", label: "Bolån" },
  { key: "savings", label: "Sparande" },
];

const mortgageRows: { key: AreaItemKey; label: string }[] = [
  { key: "mortgageInterest", label: "Ränta" },
  { key: "mortgageAmortization", label: "Amortering" },
];

const areaItemRows = mortgageRows;

const directAllocationCategoryIds = new Set(["mat", "sparande"]);
const rowNameMaxLength = 48;

const planningYear = currentPlanningYear;
const expenseFrequencyOptions: { value: ExpenseFrequency; label: string; interval: number | null }[] = [
  { value: "once", label: "Engångskostnad", interval: null },
  { value: "monthly", label: "Varje månad", interval: 1 },
  { value: "everyTwoMonths", label: "Varannan månad", interval: 2 },
  { value: "quarterly", label: "Var tredje månad", interval: 3 },
  { value: "twiceYearly", label: "Var sjätte månad", interval: 6 },
  { value: "yearly", label: "Varje år", interval: 12 },
];

const initialMonths: ForecastMonth[] = [
  {
    id: "jan",
    label: "JAN",
    name: "Januari",
    status: "green",
    startBalance: "68 400 kr",
    income: "54 800 kr",
    expenses: "41 900 kr",
    calculatedBalance: "81 300 kr",
    short: { startBalance: "68", income: "55", expenses: "42", calculatedBalance: "81" },
    categories: [
      { name: "Boende", amount: "16 400 kr" },
      {
        name: "Bil",
        amount: "6 200 kr",
        items: [
          { name: "Billån", amount: "3 850 kr" },
          { name: "Försäkring", amount: "1 250 kr" },
          { name: "Service", amount: "1 100 kr" },
          { name: "Bränsle", amount: "0 kr" },
        ],
      },
      { name: "Mat", amount: "7 800 kr" },
      { name: "Streaming", amount: "520 kr" },
      { name: "Försäkringar", amount: "2 100 kr" },
      { name: "Husdjur", amount: "1 250 kr" },
      { name: "Sparande", amount: "5 000 kr" },
      { name: "Övrigt", amount: "2 630 kr" },
    ],
  },
  {
    id: "feb",
    label: "FEB",
    name: "Februari",
    status: "green",
    startBalance: "81 300 kr",
    income: "54 800 kr",
    expenses: "42 600 kr",
    calculatedBalance: "93 500 kr",
    short: { startBalance: "81", income: "55", expenses: "43", calculatedBalance: "94" },
    categories: [
      { name: "Boende", amount: "16 400 kr" },
      {
        name: "Bil",
        amount: "5 100 kr",
        items: [
          { name: "Billån", amount: "3 850 kr" },
          { name: "Försäkring", amount: "1 250 kr" },
          { name: "Service", amount: "0 kr" },
          { name: "Bränsle", amount: "0 kr" },
        ],
      },
      { name: "Mat", amount: "7 600 kr" },
      { name: "Streaming", amount: "520 kr" },
      { name: "Försäkringar", amount: "2 100 kr" },
      { name: "Husdjur", amount: "1 280 kr" },
      { name: "Sparande", amount: "6 000 kr" },
      { name: "Övrigt", amount: "3 600 kr" },
    ],
  },
  {
    id: "mar",
    label: "MAR",
    name: "Mars",
    status: "green",
    startBalance: "93 500 kr",
    income: "54 800 kr",
    expenses: "44 200 kr",
    calculatedBalance: "104 100 kr",
    short: { startBalance: "94", income: "55", expenses: "44", calculatedBalance: "104" },
    categories: [
      { name: "Boende", amount: "16 400 kr" },
      {
        name: "Bil",
        amount: "5 100 kr",
        items: [
          { name: "Billån", amount: "3 850 kr" },
          { name: "Försäkring", amount: "1 250 kr" },
          { name: "Service", amount: "0 kr" },
          { name: "Bränsle", amount: "0 kr" },
        ],
      },
      { name: "Mat", amount: "7 900 kr" },
      { name: "Streaming", amount: "520 kr" },
      { name: "Försäkringar", amount: "2 100 kr" },
      { name: "Husdjur", amount: "1 480 kr" },
      { name: "Sparande", amount: "6 000 kr" },
      { name: "Övrigt", amount: "4 700 kr" },
    ],
  },
  {
    id: "apr",
    label: "APR",
    name: "April",
    status: "yellow",
    startBalance: "104 100 kr",
    income: "54 800 kr",
    expenses: "53 900 kr",
    calculatedBalance: "105 000 kr",
    short: { startBalance: "104", income: "55", expenses: "54", calculatedBalance: "105" },
    categories: [
      { name: "Boende", amount: "16 400 kr" },
      {
        name: "Bil",
        amount: "13 800 kr",
        items: [
          { name: "Billån", amount: "3 850 kr" },
          { name: "Försäkring", amount: "1 250 kr" },
          { name: "Service", amount: "6 500 kr" },
          { name: "Bränsle", amount: "2 200 kr" },
        ],
      },
      { name: "Mat", amount: "8 200 kr" },
      { name: "Streaming", amount: "520 kr" },
      { name: "Försäkringar", amount: "2 100 kr" },
      { name: "Husdjur", amount: "1 280 kr" },
      { name: "Sparande", amount: "8 000 kr" },
      { name: "Övrigt", amount: "3 600 kr" },
    ],
  },
  {
    id: "maj",
    label: "MAJ",
    name: "Maj",
    status: "green",
    startBalance: "105 000 kr",
    income: "54 800 kr",
    expenses: "43 800 kr",
    calculatedBalance: "116 000 kr",
    short: { startBalance: "105", income: "55", expenses: "44", calculatedBalance: "116" },
    categories: [
      { name: "Boende", amount: "16 400 kr" },
      {
        name: "Bil",
        amount: "5 100 kr",
        items: [
          { name: "Billån", amount: "3 850 kr" },
          { name: "Försäkring", amount: "1 250 kr" },
          { name: "Service", amount: "0 kr" },
          { name: "Bränsle", amount: "0 kr" },
        ],
      },
      { name: "Mat", amount: "7 700 kr" },
      { name: "Streaming", amount: "520 kr" },
      { name: "Försäkringar", amount: "2 100 kr" },
      { name: "Husdjur", amount: "1 280 kr" },
      { name: "Sparande", amount: "7 000 kr" },
      { name: "Övrigt", amount: "3 700 kr" },
    ],
  },
  {
    id: "jun",
    label: "JUN",
    name: "Juni",
    status: "yellow",
    startBalance: "116 000 kr",
    income: "54 800 kr",
    expenses: "58 700 kr",
    calculatedBalance: "112 100 kr",
    short: { startBalance: "116", income: "55", expenses: "59", calculatedBalance: "112" },
    categories: [
      { name: "Boende", amount: "16 400 kr" },
      {
        name: "Bil",
        amount: "5 100 kr",
        items: [
          { name: "Billån", amount: "3 850 kr" },
          { name: "Försäkring", amount: "1 250 kr" },
          { name: "Service", amount: "0 kr" },
          { name: "Bränsle", amount: "0 kr" },
        ],
      },
      { name: "Mat", amount: "8 800 kr" },
      { name: "Streaming", amount: "520 kr" },
      { name: "Försäkringar", amount: "2 100 kr" },
      { name: "Husdjur", amount: "1 480 kr" },
      { name: "Sparande", amount: "6 000 kr" },
      { name: "Övrigt", amount: "18 300 kr" },
    ],
  },
  {
    id: "jul",
    label: "JUL",
    name: "Juli",
    status: "red",
    startBalance: "112 100 kr",
    income: "54 800 kr",
    expenses: "72 600 kr",
    calculatedBalance: "94 300 kr",
    short: { startBalance: "112", income: "55", expenses: "73", calculatedBalance: "94" },
    categories: [
      { name: "Boende", amount: "16 400 kr" },
      {
        name: "Bil",
        amount: "10 100 kr",
        items: [
          { name: "Billån", amount: "3 850 kr" },
          { name: "Försäkring", amount: "1 250 kr" },
          { name: "Service", amount: "3 300 kr" },
          { name: "Bränsle", amount: "1 700 kr" },
        ],
      },
      { name: "Mat", amount: "10 600 kr" },
      { name: "Streaming", amount: "520 kr" },
      { name: "Försäkringar", amount: "2 100 kr" },
      { name: "Husdjur", amount: "1 480 kr" },
      { name: "Sparande", amount: "4 000 kr" },
      { name: "Övrigt", amount: "27 500 kr" },
    ],
  },
  {
    id: "aug",
    label: "AUG",
    name: "Augusti",
    status: "yellow",
    startBalance: "94 300 kr",
    income: "54 800 kr",
    expenses: "55 200 kr",
    calculatedBalance: "93 900 kr",
    short: { startBalance: "94", income: "55", expenses: "55", calculatedBalance: "94" },
    categories: [
      { name: "Boende", amount: "16 400 kr" },
      {
        name: "Bil",
        amount: "5 100 kr",
        items: [
          { name: "Billån", amount: "3 850 kr" },
          { name: "Försäkring", amount: "1 250 kr" },
          { name: "Service", amount: "0 kr" },
          { name: "Bränsle", amount: "0 kr" },
        ],
      },
      { name: "Mat", amount: "8 500 kr" },
      { name: "Streaming", amount: "520 kr" },
      { name: "Försäkringar", amount: "2 100 kr" },
      { name: "Husdjur", amount: "1 280 kr" },
      { name: "Sparande", amount: "5 000 kr" },
      { name: "Övrigt", amount: "16 300 kr" },
    ],
  },
  {
    id: "sep",
    label: "SEP",
    name: "September",
    status: "green",
    startBalance: "93 900 kr",
    income: "54 800 kr",
    expenses: "43 700 kr",
    calculatedBalance: "105 000 kr",
    short: { startBalance: "94", income: "55", expenses: "44", calculatedBalance: "105" },
    categories: [
      { name: "Boende", amount: "16 400 kr" },
      {
        name: "Bil",
        amount: "7 050 kr",
        items: [
          { name: "Billån", amount: "3 850 kr" },
          { name: "Försäkring", amount: "1 250 kr" },
          { name: "Service", amount: "0 kr" },
          { name: "Bränsle", amount: "1 950 kr" },
        ],
      },
      { name: "Mat", amount: "7 800 kr" },
      { name: "Streaming", amount: "520 kr" },
      { name: "Försäkringar", amount: "2 100 kr" },
      { name: "Husdjur", amount: "1 280 kr" },
      { name: "Sparande", amount: "7 000 kr" },
      { name: "Övrigt", amount: "1 600 kr" },
    ],
  },
  {
    id: "okt",
    label: "OKT",
    name: "Oktober",
    status: "green",
    startBalance: "105 000 kr",
    income: "54 800 kr",
    expenses: "45 300 kr",
    calculatedBalance: "114 500 kr",
    short: { startBalance: "105", income: "55", expenses: "45", calculatedBalance: "115" },
    categories: [
      { name: "Boende", amount: "16 400 kr" },
      {
        name: "Bil",
        amount: "5 100 kr",
        items: [
          { name: "Billån", amount: "3 850 kr" },
          { name: "Försäkring", amount: "1 250 kr" },
          { name: "Service", amount: "0 kr" },
          { name: "Bränsle", amount: "0 kr" },
        ],
      },
      { name: "Mat", amount: "7 900 kr" },
      { name: "Streaming", amount: "520 kr" },
      { name: "Försäkringar", amount: "2 100 kr" },
      { name: "Husdjur", amount: "1 280 kr" },
      { name: "Sparande", amount: "8 000 kr" },
      { name: "Övrigt", amount: "4 000 kr" },
    ],
  },
  {
    id: "nov",
    label: "NOV",
    name: "November",
    status: "yellow",
    startBalance: "114 500 kr",
    income: "54 800 kr",
    expenses: "61 900 kr",
    calculatedBalance: "107 400 kr",
    short: { startBalance: "115", income: "55", expenses: "62", calculatedBalance: "107" },
    categories: [
      { name: "Boende", amount: "16 400 kr" },
      {
        name: "Bil",
        amount: "5 100 kr",
        items: [
          { name: "Billån", amount: "3 850 kr" },
          { name: "Försäkring", amount: "1 250 kr" },
          { name: "Service", amount: "0 kr" },
          { name: "Bränsle", amount: "0 kr" },
        ],
      },
      { name: "Mat", amount: "8 700 kr" },
      { name: "Streaming", amount: "520 kr" },
      { name: "Försäkringar", amount: "2 100 kr" },
      { name: "Husdjur", amount: "1 280 kr" },
      { name: "Sparande", amount: "6 000 kr" },
      { name: "Övrigt", amount: "21 800 kr" },
    ],
  },
  {
    id: "dec",
    label: "DEC",
    name: "December",
    status: "red",
    startBalance: "107 400 kr",
    income: "54 800 kr",
    expenses: "75 100 kr",
    calculatedBalance: "87 100 kr",
    short: { startBalance: "107", income: "55", expenses: "75", calculatedBalance: "87" },
    categories: [
      { name: "Boende", amount: "16 400 kr" },
      {
        name: "Bil",
        amount: "5 100 kr",
        items: [
          { name: "Billån", amount: "3 850 kr" },
          { name: "Försäkring", amount: "1 250 kr" },
          { name: "Service", amount: "0 kr" },
          { name: "Bränsle", amount: "0 kr" },
        ],
      },
      { name: "Mat", amount: "10 800 kr" },
      { name: "Streaming", amount: "520 kr" },
      { name: "Försäkringar", amount: "2 100 kr" },
      { name: "Husdjur", amount: "1 480 kr" },
      { name: "Sparande", amount: "3 000 kr" },
      { name: "Övrigt", amount: "35 700 kr" },
    ],
  },
];

function formatAmountInput(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "0 kr";
  }

  return formatAmount(Number(digits));
}

function formatAmount(value: number) {
  return `${value.toLocaleString("sv-SE")} kr`;
}

function parseAmount(value: string) {
  return Number(value.replace(/\D/g, "")) || 0;
}

function parseSignedAmount(value: string) {
  const amount = parseAmount(value);
  return /[-−]/.test(value) ? -amount : amount;
}

function makeId(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "post"
  );
}

function shortAmount(value: string) {
  return String(Math.round(parseSignedAmount(value) / 1000));
}

function sumCategories(categories: ForecastExpenseCategory[]) {
  return categories.reduce((total, category) => total + parseAmount(category.amount), 0);
}

function refreshMonthSummary(month: ForecastMonth): ForecastMonth {
  const expenses = formatAmount(sumCategories(month.categories));
  const calculatedBalance = formatAmount(
    parseAmount(month.startBalance) + parseAmount(month.income) - parseAmount(expenses),
  );

  return {
    ...month,
    expenses,
    calculatedBalance,
    short: {
      ...month.short,
      expenses: shortAmount(expenses),
      calculatedBalance: shortAmount(calculatedBalance),
    },
  };
}

function withFastEditTargets(month: ForecastMonth): ForecastMonth {
  return {
    ...month,
    categories: month.categories.map((category) => {
      if (category.name === "Boende" && !category.items) {
        return {
          ...category,
          items: [
            { name: "Hyra", amount: "13 900 kr" },
            { name: "El", amount: "1 450 kr" },
            { name: "Internet", amount: "1 050 kr" },
          ],
        };
      }

      if (category.name === "Streaming" && !category.items) {
        return {
          ...category,
          items: [
            { name: "Netflix", amount: "179 kr" },
            { name: "Spotify", amount: "119 kr" },
            { name: "TV", amount: "222 kr" },
          ],
        };
      }

      return category;
    }),
  };
}

const seedSourceMonths = initialMonths.map(withFastEditTargets).map(refreshMonthSummary);
const monthMetadata = seedSourceMonths.map(({ id, label, name, status }) => ({
  id,
  label,
  name,
  status,
}));
const monthIds = monthMetadata.map((month) => month.id);
const defaultMonthId = monthIds[0];
const storageKey = "fameko.planning-data.v3";
const importDecisionKey = `fameko.cloud-import.v1.${planningYear}`;
const showDevelopmentReset = process.env.NODE_ENV === "development";

function getCurrentMonthId() {
  const today = new Date();
  return today.getFullYear() === planningYear ? monthIds[today.getMonth()] : null;
}

function getDefaultAllocationValue(
  categories: ForecastExpenseCategory[],
  allocationKey: AllocationKey,
) {
  if (allocationKey === "food") {
    return parseAmount(categories.find((category) => category.id === "mat")?.amount ?? "0 kr");
  }

  if (allocationKey === "savings") {
    return parseAmount(categories.find((category) => category.id === "sparande")?.amount ?? "0 kr");
  }

  if (allocationKey === "billAccount") {
    return categories
      .filter((category) => category.id && !directAllocationCategoryIds.has(category.id))
      .reduce((total, category) => total + parseAmount(category.amount), 0);
  }

  return 0;
}

function buildForecastMonths(data: PlanningData): ForecastMonth[] {
  let nextStartBalance = data.openingBalance;
  const sortedCategories = [...data.expenseCategories].sort((first, second) => first.order - second.order);
  const savingsGoals = getSavingsGoals(data);

  return monthMetadata.map((metadata) => {
    const storedIncomeTotal = data.incomes.reduce(
      (total, incomeItem) => total + (incomeItem.monthlyValues[metadata.id] ?? 0),
      0,
    );
    const incomeLineValues = Object.fromEntries(
      incomeLines.map(({ key }) => [
        key,
        formatAmount(
          data.incomeLineValues?.[key]?.[metadata.id] ??
            (key === "salaryOne" ? storedIncomeTotal : 0),
        ),
      ]),
    ) as Record<IncomeLineKey, string>;
    const income = incomeLines.reduce(
      (total, { key }) => total + parseAmount(incomeLineValues[key]),
      0,
    );
    const categories = sortedCategories.map((category) => {
      const items = data.expenseItems.filter((item) => item.category === category.id);
      const categoryTotal = getEffectiveExpenseCategoryAmount(
        data,
        category.id,
        metadata.id,
      );
      const primaryItemId = `${category.id}-${category.id}`;
      const shouldShowItems = items.length > 1 || items.some((item) => item.id !== primaryItemId);

      return {
        id: category.id,
        name:
          data.labels?.expenseCategories?.[category.id] ?? displayCategoryName(category.name),
        amount: formatAmount(categoryTotal),
        items: shouldShowItems
          ? items.map((item) => ({
              id: item.id,
              name: data.labels?.expenseItems?.[item.id] ?? item.name,
              amount: formatAmount(
                getEffectiveExpenseItemAmount(data, item, metadata.id),
              ),
            }))
          : undefined,
      };
    });
    const allocations = Object.fromEntries(
      allocationRows.map(({ key }) => [
        key,
        formatAmount(
          data.allocationOverrides?.[key]?.[metadata.id] ?? getDefaultAllocationValue(categories, key),
        ),
      ]),
    ) as Record<AllocationKey, string>;
    const areaItemValues = Object.fromEntries(
      areaItemRows.map(({ key }) => [
        key,
        formatAmount(data.areaItemValues?.[key]?.[metadata.id] ?? 0),
      ]),
    ) as Record<AreaItemKey, string>;
    const savingsGoalValues = Object.fromEntries(
      savingsGoals.map((goal) => [
        goal.id,
        formatAmount(goal.monthlyValues[metadata.id] ?? 0),
      ]),
    );
    const totalAllocated = allocationRows.reduce(
      (total, { key }) => total + parseAmount(allocations[key]),
      0,
    );
    const billAccountCosts = getDefaultAllocationValue(categories, "billAccount");
    const calculatedBalance =
      nextStartBalance + parseAmount(allocations.billAccount) - billAccountCosts;
    const expenses = totalAllocated;
    const month: ForecastMonth = {
      id: metadata.id,
      label: metadata.label,
      name: metadata.name,
      status: metadata.status,
      startBalance: formatAmount(nextStartBalance),
      income: formatAmount(income),
      expenses: formatAmount(expenses),
      calculatedBalance: formatAmount(calculatedBalance),
      allocations,
      areaItemValues,
      incomeLineValues,
      savingsGoalValues,
      short: {
        startBalance: shortAmount(formatAmount(nextStartBalance)),
        income: shortAmount(formatAmount(income)),
        expenses: shortAmount(formatAmount(expenses)),
        calculatedBalance: shortAmount(formatAmount(calculatedBalance)),
      },
      categories,
    };

    nextStartBalance = calculatedBalance;
    return month;
  });
}

function getFrequencyMonthIds(targetMonthId: string, frequency: ExpenseFrequency) {
  const targetIndex = monthIds.indexOf(targetMonthId);

  if (targetIndex < 0) {
    return [];
  }

  const option = expenseFrequencyOptions.find((currentOption) => currentOption.value === frequency);
  const interval = option?.interval;

  if (!interval) {
    return [targetMonthId];
  }

  return monthIds.filter((_, index) => index >= targetIndex && (index - targetIndex) % interval === 0);
}

function updatePlanningAmount(data: PlanningData, target: AmountTarget, nextAmount: string, scope: ChangeScope) {
  if (target.type === "openingBalance") {
    return {
      ...data,
      openingBalance: parseAmount(nextAmount),
    };
  }

  if (target.type === "incomeLine") {
    const currentValues = data.incomeLineValues?.[target.incomeLineKey] ?? {};

    return {
      ...data,
      incomeLineValues: {
        ...data.incomeLineValues,
        [target.incomeLineKey]: {
          ...applyScopedMonthValue(
            currentValues,
            monthIds,
            target.monthId,
            parseAmount(nextAmount),
            scope,
          ),
        },
      },
    };
  }

  if (target.type === "allocation") {
    const currentValues = data.allocationOverrides?.[target.allocationKey] ?? {};

    return {
      ...data,
      allocationOverrides: {
        ...data.allocationOverrides,
        [target.allocationKey]: {
          ...applyScopedMonthValue(
            currentValues,
            monthIds,
            target.monthId,
            parseAmount(nextAmount),
            scope,
          ),
        },
      },
    };
  }

  if (target.type === "areaItem") {
    const currentValues = data.areaItemValues?.[target.areaItemKey] ?? {};

    return {
      ...data,
      areaItemValues: {
        ...data.areaItemValues,
        [target.areaItemKey]: {
          ...applyScopedMonthValue(
            currentValues,
            monthIds,
            target.monthId,
            parseAmount(nextAmount),
            scope,
          ),
        },
      },
    };
  }

  const category = data.expenseCategories.find((currentCategory) => currentCategory.id === target.categoryId);

  if (!category) {
    return data;
  }

  const affectedMonthIds = getAffectedMonthIds(monthIds, target.monthId, scope);

  if (target.type === "item") {
    return {
      ...data,
      expenseItems: data.expenseItems.map((item) =>
        item.id === target.itemId
          ? {
              ...item,
              monthlyValues: applyScopedMonthValue(
                item.monthlyValues,
                monthIds,
                target.monthId,
                parseAmount(nextAmount),
                scope,
              ),
            }
          : item,
      ),
    };
  }

  const categoryItems = data.expenseItems.filter((item) => item.category === category.id);
  const primaryItem =
    categoryItems.find((item) => item.id === `${category.id}-${category.id}`) ?? categoryItems[0];

  if (!primaryItem) {
    return data;
  }

  return {
    ...data,
    expenseItems: data.expenseItems.map((item) => {
      if (item.id !== primaryItem.id) {
        return item;
      }

      const monthlyValues = { ...item.monthlyValues };

      affectedMonthIds.forEach((monthId) => {
        const currentTotal = categoryItems.reduce(
          (total, categoryItem) => total + (categoryItem.monthlyValues[monthId] ?? 0),
          0,
        );
        monthlyValues[monthId] = Math.max(0, (monthlyValues[monthId] ?? 0) + parseAmount(nextAmount) - currentTotal);
      });

      return { ...item, monthlyValues };
    }),
  };
}

function findExpenseItem(data: PlanningData, target: DeleteTarget) {
  return data.expenseItems.find((item) => item.id === target.itemId) ?? null;
}

function hasMultipleOccurrences(item: ExpenseItem) {
  return Object.values(item.monthlyValues).filter((amount) => amount > 0).length > 1;
}

function removePlanningExpenseItem(data: PlanningData, target: DeleteTarget, scope: ChangeScope) {
  if (!data.expenseCategories.some((category) => category.id === target.categoryId)) {
    return data;
  }

  const updatedData = updatePlanningAmount(data, target, "0 kr", scope);
  const expenseItems = updatedData.expenseItems.filter((item) => {
    if (item.id !== target.itemId) {
      return true;
    }

    return Object.values(item.monthlyValues).some((amount) => amount > 0);
  });

  return {
    ...updatedData,
    expenseItems,
  };
}

function createUniqueExpenseId(items: ExpenseItem[], baseId: string) {
  if (!items.some((item) => item.id === baseId)) {
    return baseId;
  }

  let index = 2;
  let nextId = `${baseId}-${index}`;

  while (items.some((item) => item.id === nextId)) {
    index += 1;
    nextId = `${baseId}-${index}`;
  }

  return nextId;
}

function createUniqueExpenseName(items: ExpenseItem[], categoryId: string, baseName: string) {
  const name = baseName.trim() || "Ny kostnad";
  const existingNames = new Set(items.filter((item) => item.category === categoryId).map((item) => item.name));

  if (!existingNames.has(name)) {
    return name;
  }

  let index = 2;
  let nextName = `${name} ${index}`;

  while (existingNames.has(nextName)) {
    index += 1;
    nextName = `${name} ${index}`;
  }

  return nextName;
}

function isValidAddExpenseDraft(draft: AddExpenseDraft, categoryIds: string[]) {
  return (
    categoryIds.includes(draft.categoryId) &&
    monthIds.includes(draft.monthId) &&
    expenseFrequencyOptions.some((option) => option.value === draft.frequency) &&
    parseAmount(draft.amount) > 0
  );
}

function addExpenseToPlanningData(data: PlanningData, draft: AddExpenseDraft) {
  const category = data.expenseCategories.find((currentCategory) => currentCategory.id === draft.categoryId);
  const amount = parseAmount(draft.amount);

  if (!category || !monthIds.includes(draft.monthId) || amount <= 0) {
    return data;
  }

  const description = createUniqueExpenseName(data.expenseItems, category.id, draft.description);
  const affectedMonthIds = getFrequencyMonthIds(draft.monthId, draft.frequency);
  const monthlyValues = monthIds.reduce<MonthValue>((values, monthId) => {
    values[monthId] = affectedMonthIds.includes(monthId) ? amount : 0;
    return values;
  }, {});
  const id = createUniqueExpenseId(data.expenseItems, `${category.id}-${makeId(description)}`);

  return {
    ...data,
    expenseItems: [
      ...data.expenseItems,
      {
        id,
        category: category.id,
        name: description,
        monthlyValues,
        recurring: draft.frequency !== "once",
        frequency: draft.frequency,
      },
    ],
  };
}

function isPlanningData(value: unknown): value is PlanningData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Partial<PlanningData>;
  const hasValidMonthValues = (monthValues: unknown) =>
    Boolean(monthValues) &&
    typeof monthValues === "object" &&
    monthIds.every((monthId) => typeof (monthValues as MonthValue)[monthId] === "number");
  const hasValidLabelMap = (labels: unknown) =>
    labels === undefined ||
    (Boolean(labels) &&
      typeof labels === "object" &&
      Object.values(labels as Record<string, unknown>).every(
        (label) =>
          typeof label === "string" &&
          label.trim().length > 0 &&
          label.length <= rowNameMaxLength,
      ));
  const hasValidLabels =
    data.labels === undefined ||
    (Boolean(data.labels) &&
      typeof data.labels === "object" &&
      hasValidLabelMap(data.labels?.incomeLines) &&
      hasValidLabelMap(data.labels?.allocations) &&
      hasValidLabelMap(data.labels?.areaItems) &&
      hasValidLabelMap(data.labels?.expenseCategories) &&
      hasValidLabelMap(data.labels?.expenseItems));
  const hasValidAllocationOverrides =
    data.allocationOverrides === undefined ||
    (typeof data.allocationOverrides === "object" &&
      allocationRows.every(({ key }) => {
        const values = data.allocationOverrides?.[key];
        return (
          values === undefined ||
          (typeof values === "object" &&
            Object.values(values).every((amount) => typeof amount === "number"))
        );
      }));
  const hasValidAreaItemValues =
    data.areaItemValues === undefined ||
    (typeof data.areaItemValues === "object" &&
      areaItemRows.every(({ key }) => {
        const values = data.areaItemValues?.[key];
        return (
          values === undefined ||
          (typeof values === "object" &&
            Object.values(values).every((amount) => typeof amount === "number"))
        );
      }));
  const hasValidIncomeLineValues =
    data.incomeLineValues === undefined ||
    (typeof data.incomeLineValues === "object" &&
      incomeLines.every(({ key }) => {
        const values = data.incomeLineValues?.[key];
        return (
          values === undefined ||
          (typeof values === "object" &&
            Object.values(values).every((amount) => typeof amount === "number"))
        );
      }));
  const hasValidHousingData =
    data.housingData === undefined || isHousingData(data.housingData);
  const hasValidCarData = data.carData === undefined || isCarData(data.carData);

  return (
    data.version === 3 &&
    hasValidLabels &&
    hasValidAllocationOverrides &&
    hasValidAreaItemValues &&
    hasValidIncomeLineValues &&
    hasValidHousingData &&
    hasValidCarData &&
    typeof data.openingBalance === "number" &&
    Array.isArray(data.incomes) &&
    Array.isArray(data.expenseCategories) &&
    Array.isArray(data.expenseItems) &&
    data.incomes.every(
      (income) =>
        typeof income.id === "string" &&
        typeof income.name === "string" &&
        hasValidMonthValues(income.monthlyValues),
    ) &&
    data.expenseCategories.every(
      (category) =>
        typeof category.id === "string" &&
        typeof category.name === "string" &&
        typeof category.order === "number",
    ) &&
    data.expenseItems.every(
      (item) =>
        typeof item.id === "string" &&
        typeof item.category === "string" &&
        typeof item.name === "string" &&
        typeof item.recurring === "boolean" &&
        hasValidMonthValues(item.monthlyValues),
    )
  );
}

function readStoredPlanningData() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawData = window.localStorage.getItem(storageKey);
    if (!rawData) {
      return null;
    }

    const data = JSON.parse(rawData);
    return isPlanningData(data) ? migrateLegacySavingsStructure(data) : null;
  } catch {
    return null;
  }
}

function savePlanningData(data: PlanningData) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      // The server is authoritative; a cache write must never block cloud save.
    }
  }
}

const seedPlanningData: PlanningData = seedPlanningDataV3;
const emptyPlanningData: PlanningData = emptyPlanningDataV3;

function readImportDecision() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(importDecisionKey);
  } catch {
    return null;
  }
}

function saveImportDecision(decision: "imported" | "declined") {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(importDecisionKey, decision);
    } catch {
      // Import remains safe even when the optional local marker is unavailable.
    }
  }
}

class PlanningApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PlanningApiError";
  }
}

async function parsePlanningYearResponse(response: Response): Promise<CloudPlanningYear> {
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : "Ekonomin kunde inte hämtas just nu.";
    throw new PlanningApiError(message, response.status);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PlanningApiError("Servern skickade ett ogiltigt svar.", 500);
  }

  const result = body as Record<string, unknown>;
  if (
    !isPlanningData(result.data) ||
    result.schemaVersion !== 3 ||
    !Number.isInteger(result.revision) ||
    (result.revision as number) < 1 ||
    result.year !== planningYear ||
    typeof result.updatedAt !== "string"
  ) {
    throw new PlanningApiError("Servern skickade ett ogiltigt svar.", 500);
  }

  const planningYearResult = result as CloudPlanningYear;
  return {
    ...planningYearResult,
    data: migrateLegacySavingsStructure(planningYearResult.data),
  };
}

async function loadCloudPlanningYear(): Promise<CloudPlanningYear | null> {
  const response = await fetch(`/app/api/planning-years/${planningYear}`, {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (response.status === 404) {
    return null;
  }

  return parsePlanningYearResponse(response);
}

async function saveCloudPlanningYear(
  data: PlanningData,
  expectedRevision: number | null,
): Promise<CloudPlanningYear> {
  const response = await fetch(`/app/api/planning-years/${planningYear}`, {
    body: JSON.stringify({ data, expectedRevision }),
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });

  const saved = await parsePlanningYearResponse(response);
  const verified = await loadCloudPlanningYear();

  if (!verified) {
    throw new PlanningApiError("Den sparade ekonomin kunde inte verifieras.", 500);
  }

  if (
    verified.revision !== saved.revision ||
    JSON.stringify(verified.data) !== JSON.stringify(saved.data)
  ) {
    throw new PlanningApiError(
      "Ekonomin ändrades på en annan plats innan sparningen kunde verifieras.",
      409,
    );
  }

  return verified;
}

function getResolvedPlanningLabels(data: PlanningData): ResolvedPlanningLabels {
  return {
    incomeLines: Object.fromEntries(
      incomeLines.map(({ key, label }) => [key, data.labels?.incomeLines?.[key] ?? label]),
    ) as Record<IncomeLineKey, string>,
    allocations: Object.fromEntries(
      allocationRows.map(({ key, label }) => [key, data.labels?.allocations?.[key] ?? label]),
    ) as Record<AllocationKey, string>,
    areaItems: Object.fromEntries(
      areaItemRows.map(({ key, label }) => [key, data.labels?.areaItems?.[key] ?? label]),
    ) as Record<AreaItemKey, string>,
  };
}

function normalizeRowName(value: string) {
  return value.trim().slice(0, rowNameMaxLength);
}

function updatePlanningLabel(data: PlanningData, target: NameTarget, label: string): PlanningData {
  const labels = data.labels ?? {};

  if (target.type === "incomeLine") {
    return {
      ...data,
      labels: {
        ...labels,
        incomeLines: { ...labels.incomeLines, [target.key]: label },
      },
    };
  }

  if (target.type === "allocation") {
    return {
      ...data,
      labels: {
        ...labels,
        allocations: { ...labels.allocations, [target.key]: label },
      },
    };
  }

  if (target.type === "areaItem") {
    return {
      ...data,
      labels: {
        ...labels,
        areaItems: { ...labels.areaItems, [target.key]: label },
      },
    };
  }

  if (target.type === "expenseCategory") {
    return {
      ...data,
      labels: {
        ...labels,
        expenseCategories: { ...labels.expenseCategories, [target.id]: label },
      },
    };
  }

  if (target.type === "expenseItem") {
    const renamedSavingsData = renameSavingsGoal(data, target.id, label);

    if (renamedSavingsData !== data) {
      return renamedSavingsData;
    }
  }

  return {
    ...data,
    labels: {
      ...labels,
      expenseItems: { ...labels.expenseItems, [target.id]: label },
    },
  };
}

function amountKey(target: AmountTarget) {
  if (target.type === "openingBalance") {
    return "opening-balance";
  }

  if (target.type === "incomeLine") {
    return `${target.monthId}:income:${target.incomeLineKey}`;
  }

  if (target.type === "allocation") {
    return `${target.monthId}:allocation:${target.allocationKey}`;
  }

  if (target.type === "areaItem") {
    return `${target.monthId}:area:${target.areaItemKey}`;
  }

  return target.type === "category"
    ? `${target.monthId}:${target.categoryId}`
    : `${target.monthId}:${target.categoryId}:${target.itemId}`;
}

function nameKey(target: NameTarget) {
  return target.type === "incomeLine" || target.type === "allocation" || target.type === "areaItem"
    ? `${target.type}:${target.key}`
    : `${target.type}:${target.id}`;
}

function focusAmountCell(key: string) {
  window.requestAnimationFrame(() => {
    const target = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-edit-key]")).find(
      (element) => element.dataset.editKey === key && element.getClientRects().length > 0,
    );

    target?.focus();
  });
}

function focusNameCell(key: string) {
  window.requestAnimationFrame(() => {
    const target = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-name-key]")).find(
      (element) => element.dataset.nameKey === key && element.getClientRects().length > 0,
    );

    target?.focus();
  });
}

function getYearSummary(row: YearRow, months: ForecastMonth[]) {
  if (!months.length) {
    return "0 kr";
  }

  if (row.key === "remaining") {
    return getRemainingYearTotal(months);
  }

  return formatAmount(
    months.reduce((total, month) => total + parseAmount(getMonthFlowValue(month, row.key)), 0),
  );
}

function getMonthFlowValue(month: ForecastMonth, key: YearRow["key"]) {
  return key === "remaining" ? getRemainingAmount(month) : month[key];
}

function getCategoryYearTotal(months: ForecastMonth[], categoryId: string) {
  return formatAmount(
    months.reduce((total, month) => {
      const category = month.categories.find((currentCategory) => currentCategory.id === categoryId);
      return total + parseAmount(category?.amount ?? "0 kr");
    }, 0),
  );
}

function getLargestCosts(data: PlanningData): LargestCost[] {
  const categoryIcons: Record<string, string> = {
    bil: "🚗",
    boende: famekoMainSectionSymbols.mortgage,
    forsakringar: famekoMainSectionSymbols.insurance,
    husdjur: famekoMainSectionSymbols.pets,
    "lan-och-krediter": famekoMainSectionSymbols.debts,
    mat: "🍽️",
    streaming: "📺",
    ovrigt: "•••",
  };
  const categories = getEffectiveExpenseCategoryTotals(data, monthIds)
    .filter((category) => category.id !== "sparande")
    .filter((category) => category.total > 0);
  const totalCosts = categories.reduce((total, category) => total + category.total, 0);

  return categories
    .sort((first, second) => second.total - first.total)
    .slice(0, 3)
    .map((category, index) => {
      const percentage =
        totalCosts > 0 ? Math.round((category.total / totalCosts) * 100) : 0;

      return {
        amount: formatAmount(category.total),
        icon: categoryIcons[category.id] ?? "•",
        id: category.id,
        insight:
          index === 0
            ? `${category.name} är den största kostnaden och står för ${percentage} % av årets planerade kostnader.`
            : `${category.name} står för ${percentage} % av årets planerade kostnader.`,
        name: category.name,
        percentage,
      };
    });
}

function getItemYearTotal(months: ForecastMonth[], categoryId: string, itemId: string) {
  return formatAmount(
    months.reduce((total, month) => {
      const item = month.categories
        .find((category) => category.id === categoryId)
        ?.items?.find((currentItem) => currentItem.id === itemId);

      return total + parseAmount(item?.amount ?? "0 kr");
    }, 0),
  );
}

function getCategoryAmount(month: ForecastMonth, categoryId: string) {
  return month.categories.find((category) => category.id === categoryId)?.amount ?? "0 kr";
}

function getBillAccountCategories(month: ForecastMonth) {
  return month.categories.filter(
    (category) => category.id && !directAllocationCategoryIds.has(category.id),
  );
}

function getBillAccountCosts(month: ForecastMonth) {
  return formatAmount(
    getBillAccountCategories(month).reduce(
      (total, category) => total + parseAmount(category.amount),
      0,
    ),
  );
}

function getBillAccountCostsYearTotal(months: ForecastMonth[]) {
  return formatAmount(
    months.reduce((total, month) => total + parseAmount(getBillAccountCosts(month)), 0),
  );
}

function getAllocationAmount(month: ForecastMonth, allocationKey: AllocationKey) {
  return (
    month.allocations?.[allocationKey] ??
    formatAmount(getDefaultAllocationValue(month.categories, allocationKey))
  );
}

function getAllocationYearTotal(months: ForecastMonth[], allocationKey: AllocationKey) {
  return formatAmount(
    months.reduce(
      (total, month) => total + parseAmount(getAllocationAmount(month, allocationKey)),
      0,
    ),
  );
}

function getAreaItemAmount(month: ForecastMonth, areaItemKey: AreaItemKey) {
  return month.areaItemValues?.[areaItemKey] ?? "0 kr";
}

function getAreaItemYearTotal(months: ForecastMonth[], areaItemKey: AreaItemKey) {
  return formatAmount(
    months.reduce(
      (total, month) => total + parseAmount(getAreaItemAmount(month, areaItemKey)),
      0,
    ),
  );
}

function getSavingsGoalAmount(month: ForecastMonth, goalId: string) {
  return month.savingsGoalValues?.[goalId] ?? "0 kr";
}

function getSavingsGoalYearTotal(months: ForecastMonth[], goalId: string) {
  return formatAmount(
    months.reduce(
      (total, month) => total + parseAmount(getSavingsGoalAmount(month, goalId)),
      0,
    ),
  );
}

function getAreaRemainingAmount(month: ForecastMonth, area: "mortgage" | "savings") {
  const allocationKey: AllocationKey = area;
  const placed =
    area === "mortgage"
      ? mortgageRows.reduce(
          (total, row) => total + parseAmount(getAreaItemAmount(month, row.key)),
          0,
        )
      : Object.values(month.savingsGoalValues ?? {}).reduce(
          (total, amount) => total + parseAmount(amount),
          0,
        );

  return formatAmount(parseAmount(getAllocationAmount(month, allocationKey)) - placed);
}

function getAreaRemainingYearTotal(
  months: ForecastMonth[],
  area: "mortgage" | "savings",
) {
  return formatAmount(
    months.reduce(
      (total, month) => total + parseSignedAmount(getAreaRemainingAmount(month, area)),
      0,
    ),
  );
}

function getRemainingAmount(month: ForecastMonth) {
  return formatAmount(parseAmount(month.income) - parseAmount(month.expenses));
}

function getRemainingYearTotal(months: ForecastMonth[]) {
  return formatAmount(
    months.reduce((total, month) => total + parseSignedAmount(getRemainingAmount(month)), 0),
  );
}

function getMonthlySavingsMetrics(month: ForecastMonth) {
  const amount = getAllocationAmount(month, "savings");
  const metrics = selectMonthlySavingsMetrics(
    parseAmount(amount),
    parseAmount(month.income),
  );

  return {
    amount,
    rate: metrics.savingsRate,
  };
}

function formatSavingsRate(rate: number | null) {
  if (rate === null) {
    return "—";
  }

  return `${rate.toLocaleString("sv-SE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`;
}

function getIncomeLineAmount(month: ForecastMonth, key: IncomeLineKey) {
  return month.incomeLineValues?.[key] ?? (key === "salaryOne" ? month.income : "0 kr");
}

function getIncomeLineYearTotal(months: ForecastMonth[], key: IncomeLineKey) {
  return formatAmount(
    months.reduce((total, month) => total + parseAmount(getIncomeLineAmount(month, key)), 0),
  );
}

function displayCategoryName(name: string) {
  return name === "Streaming" ? "Streaming & abonnemang" : name;
}

function getMonthName(monthId: string) {
  return monthMetadata.find((month) => month.id === monthId)?.name ?? "vald månad";
}

function getScopeOptions(monthId: string): { value: ChangeScope; label: string }[] {
  const monthName = getMonthName(monthId);

  return [
    { value: "single", label: `Bara ${monthName.toLowerCase()}` },
    { value: "future", label: `${monthName} och resten av året` },
  ];
}

const desktopStickyLabelCell =
  "sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(214,211,209,0.8)]";

function DesktopSectionHeading({ first = false, label }: { first?: boolean; label: string }) {
  const spacing = first ? "pt-6" : "pt-10";

  return (
    <>
      <div className={`${desktopStickyLabelCell} flex items-center pb-3 ${spacing}`}>
        <h2 className="shrink-0 text-[13px] font-semibold uppercase leading-none tracking-[0.08em] text-stone-700">
          {label}
        </h2>
      </div>
      <div className={`col-span-13 flex items-center pb-3 pl-4 ${spacing}`}>
        <span aria-hidden="true" className="h-px min-w-8 flex-1 bg-stone-300/80" />
      </div>
    </>
  );
}

function DesktopGridRow({
  chapter = false,
  depth = 0,
  expanded,
  label,
  monthCellTone,
  months,
  muted = false,
  onSelectMonth,
  onToggle,
  saving = false,
  symbol,
  result = false,
  summary = false,
  values,
  yearTotal,
}: {
  chapter?: boolean;
  depth?: 0 | 1 | 2;
  expanded?: boolean;
  label: string;
  monthCellTone: (monthId: string, monthIndex: number) => string;
  months: ForecastMonth[];
  muted?: boolean;
  onSelectMonth: (monthId: string) => void;
  onToggle?: () => void;
  saving?: boolean;
  symbol?: FamekoMainSectionId;
  result?: boolean;
  summary?: boolean;
  values: string[];
  yearTotal: string;
}) {
  const rowPadding = chapter ? "py-4" : result ? "py-3.5" : summary ? "py-4" : "py-3";
  const rowTextSize = result ? "text-[13px]" : "text-sm";
  const cellTextSize = result ? "text-xs lg:text-[13px]" : "text-xs lg:text-sm";
  const toggleIndent =
    depth === 0
      ? ""
      : depth === 1
        ? "border-l border-l-stone-200 pl-4"
        : "border-l border-l-stone-200 pl-8";
  const labelIndent =
    depth === 0
      ? ""
      : depth === 1
        ? "border-l border-l-stone-200 pl-10"
        : "border-l border-l-stone-200 pl-14";
  const weight = chapter ? "font-semibold" : result || summary ? "font-medium" : "font-normal";
  const tone = muted
    ? "text-stone-400"
    : saving
      ? result
        ? "text-emerald-800"
        : "text-emerald-900"
      : chapter
        ? "text-stone-950"
        : "text-stone-700";
  const divider = chapter || result ? "border-t border-stone-200" : "";
  const groupMarker = chapter && expanded ? "border-l-2 border-l-stone-300 pl-2" : "";
  const resultEdge = result ? "border-b-stone-200" : "";

  return (
    <div className="contents">
      {onToggle ? (
        <button
          aria-expanded={expanded}
          className={`${desktopStickyLabelCell} flex items-center gap-2 border-b border-stone-100 pr-2 text-left transition hover:text-stone-950 focus-visible:z-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${rowTextSize} ${rowPadding} ${toggleIndent} ${weight} ${tone} ${divider} ${groupMarker} ${resultEdge}`}
          onClick={onToggle}
          type="button"
        >
          <span
            aria-hidden="true"
            className={`w-4 shrink-0 text-base leading-none text-stone-400 transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
          >
            ›
          </span>
          {symbol ? (
            <span aria-hidden="true" className="w-5 shrink-0 text-center text-sm leading-none">
              {famekoMainSectionSymbols[symbol]}
            </span>
          ) : null}
          <span className="truncate" title={label}>{label}</span>
        </button>
      ) : (
        <div
          className={`${desktopStickyLabelCell} flex items-center border-b border-stone-100 pr-2 ${rowTextSize} ${rowPadding} ${labelIndent} ${weight} ${tone} ${divider} ${resultEdge}`}
        >
          {symbol ? (
            <span aria-hidden="true" className="mr-2 w-5 shrink-0 text-center text-sm leading-none">
              {famekoMainSectionSymbols[symbol]}
            </span>
          ) : null}
          <span className="truncate" title={label}>{label}</span>
        </div>
      )}
      <div
        className={`border-b border-stone-100 bg-stone-50/80 px-1 text-center ${cellTextSize} ${rowPadding} ${weight} ${tone} ${divider} ${resultEdge}`}
        title={yearTotal}
      >
        {yearTotal.replace(" kr", "")}
      </div>
      {months.map((month, monthIndex) => (
        <button
          aria-label={`${month.name}, ${label}: ${values[monthIndex]}`}
          className={`min-w-0 border-b border-stone-100 px-1 text-center transition focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${cellTextSize} ${rowPadding} ${weight} ${monthCellTone(
            month.id,
            monthIndex,
          )} ${muted ? "text-stone-400" : ""} ${divider} ${resultEdge}`}
          key={`${label}-${month.id}`}
          onClick={() => onSelectMonth(month.id)}
          tabIndex={-1}
          type="button"
        >
          {values[monthIndex].replace(" kr", "")}
        </button>
      ))}
    </div>
  );
}

function DesktopOpeningBalanceRow({
  editingKey,
  editingValue,
  monthCellTone,
  months,
  onBeginEdit,
  onCancelEdit,
  onChangeEdit,
  onSelectMonth,
  onSaveEdit,
}: {
  editingKey: string | null;
  editingValue: string;
  monthCellTone: (monthId: string, monthIndex: number) => string;
  months: ForecastMonth[];
  onBeginEdit: (target: AmountTarget, amount: string) => void;
  onCancelEdit: () => void;
  onChangeEdit: (value: string) => void;
  onSelectMonth: (monthId: string) => void;
  onSaveEdit: () => void;
}) {
  const target: AmountTarget = { type: "openingBalance" };
  const openingBalance = months[0]?.startBalance ?? "0 kr";

  return (
    <div className="contents">
      <div
        className={`${desktopStickyLabelCell} flex items-center border-b border-l border-stone-100 border-l-stone-200 py-3 pl-10 pr-2 text-sm text-stone-700`}
      >
        <span className="truncate">Startsaldo</span>
      </div>
      <div className="grid min-w-0 place-items-center border-b border-stone-100 bg-stone-50/80 px-1 py-2 text-xs lg:text-sm">
        <EditableAmount
          amount={openingBalance.replace(" kr", "")}
          ariaLabel={`Redigera Räkningskontots startsaldo, nu ${openingBalance}`}
          cell
          editing={editingKey === amountKey(target)}
          editKey={amountKey(target)}
          onBeginEdit={() => onBeginEdit(target, openingBalance)}
          onCancel={onCancelEdit}
          onChange={onChangeEdit}
          onSave={onSaveEdit}
          value={editingValue}
        />
      </div>
      {months.map((month, monthIndex) => (
        <button
          aria-label={`${month.name}, Räkningskontots startsaldo: ${month.startBalance}`}
          className={`min-w-0 border-b border-stone-100 px-1 py-3 text-center text-xs transition focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 lg:text-sm ${monthCellTone(
            month.id,
            monthIndex,
          )}`}
          key={`opening-balance-${month.id}`}
          onClick={() => onSelectMonth(month.id)}
          tabIndex={-1}
          type="button"
        >
          {month.startBalance.replace(" kr", "")}
        </button>
      ))}
    </div>
  );
}

function DesktopIncomeLineRow({
  editingKey,
  editingValue,
  incomeLineKey,
  label,
  monthCellTone,
  months,
  nameEditor,
  onBeginEdit,
  onCancelEdit,
  onChangeEdit,
  onSelectMonth,
  onSaveEdit,
}: {
  editingKey: string | null;
  editingValue: string;
  incomeLineKey: IncomeLineKey;
  label: string;
  monthCellTone: (monthId: string, monthIndex: number) => string;
  months: ForecastMonth[];
  nameEditor: NameEditor;
  onBeginEdit: (target: AmountTarget, amount: string) => void;
  onCancelEdit: () => void;
  onChangeEdit: (value: string) => void;
  onSelectMonth: (monthId: string) => void;
  onSaveEdit: () => void;
}) {
  const nameTarget: NameTarget = { type: "incomeLine", key: incomeLineKey };

  return (
    <div className="contents">
      <div
        className={`${desktopStickyLabelCell} flex items-center border-b border-stone-100 py-3 pl-6 pr-2 text-sm text-stone-700`}
      >
        <EditableName
          ariaLabel={`Redigera namnet ${label}`}
          cell
          editing={nameEditor.editingKey === nameKey(nameTarget)}
          editKey={nameKey(nameTarget)}
          label={label}
          onBeginEdit={() => nameEditor.onBeginEdit(nameTarget, label)}
          onCancel={nameEditor.onCancelEdit}
          onChange={nameEditor.onChangeEdit}
          onSave={nameEditor.onSaveEdit}
          value={nameEditor.editingValue}
        />
      </div>
      <div
        className="border-b border-stone-100 bg-stone-50/80 px-1 py-3 text-center text-xs font-medium text-stone-700 lg:text-sm"
        title={getIncomeLineYearTotal(months, incomeLineKey)}
      >
        {getIncomeLineYearTotal(months, incomeLineKey).replace(" kr", "")}
      </div>
      {months.map((month, monthIndex) => {
        const target: AmountTarget = { type: "incomeLine", monthId: month.id, incomeLineKey };
        const amount = getIncomeLineAmount(month, incomeLineKey);

        return (
          <div
            className={`grid min-w-0 place-items-center border-b border-stone-100 px-1 py-2 text-xs lg:text-sm ${monthCellTone(
              month.id,
              monthIndex,
            )}`}
            key={`${incomeLineKey}-${month.id}`}
          >
            <EditableAmount
              amount={amount.replace(" kr", "")}
              ariaLabel={`Redigera ${label} i ${month.name}, nu ${amount}`}
              cell
              editing={editingKey === amountKey(target)}
              editKey={amountKey(target)}
              onBeginEdit={() => {
                onSelectMonth(month.id);
                onBeginEdit(target, amount);
              }}
              onCancel={onCancelEdit}
              onChange={onChangeEdit}
              onSave={onSaveEdit}
              value={editingValue}
            />
          </div>
        );
      })}
    </div>
  );
}

function DesktopAllocationRow({
  allocationKey,
  editingKey,
  editingValue,
  label,
  monthCellTone,
  months,
  nameEditor,
  onBeginEdit,
  onCancelEdit,
  onChangeEdit,
  onSelectMonth,
  onSaveEdit,
  saving = false,
}: {
  allocationKey: AllocationKey;
  editingKey: string | null;
  editingValue: string;
  label: string;
  monthCellTone: (monthId: string, monthIndex: number) => string;
  months: ForecastMonth[];
  nameEditor: NameEditor;
  onBeginEdit: (target: AmountTarget, amount: string) => void;
  onCancelEdit: () => void;
  onChangeEdit: (value: string) => void;
  onSelectMonth: (monthId: string) => void;
  onSaveEdit: () => void;
  saving?: boolean;
}) {
  const tone = saving ? "text-emerald-900" : "text-stone-700";
  const nameTarget: NameTarget = { type: "allocation", key: allocationKey };

  return (
    <div className="contents">
      <div
        className={`${desktopStickyLabelCell} flex items-center border-b border-stone-100 py-3 pl-6 pr-2 text-sm ${tone}`}
      >
        <EditableName
          ariaLabel={`Redigera namnet ${label}`}
          cell
          editing={nameEditor.editingKey === nameKey(nameTarget)}
          editKey={nameKey(nameTarget)}
          label={label}
          onBeginEdit={() => nameEditor.onBeginEdit(nameTarget, label)}
          onCancel={nameEditor.onCancelEdit}
          onChange={nameEditor.onChangeEdit}
          onSave={nameEditor.onSaveEdit}
          value={nameEditor.editingValue}
        />
      </div>
      <div
        className={`border-b border-stone-100 bg-stone-50/80 px-1 py-3 text-center text-xs font-medium lg:text-sm ${tone}`}
        title={getAllocationYearTotal(months, allocationKey)}
      >
        {getAllocationYearTotal(months, allocationKey).replace(" kr", "")}
      </div>
      {months.map((month, monthIndex) => {
        const target: AmountTarget = { type: "allocation", monthId: month.id, allocationKey };
        const amount = getAllocationAmount(month, allocationKey);

        return (
          <div
            className={`grid min-w-0 place-items-center border-b border-stone-100 px-1 py-2 text-xs lg:text-sm ${monthCellTone(
              month.id,
              monthIndex,
            )}`}
            key={`${allocationKey}-${month.id}`}
          >
            <EditableAmount
              amount={amount.replace(" kr", "")}
              ariaLabel={`Redigera ${label} i ${month.name}, nu ${amount}`}
              cell
              editing={editingKey === amountKey(target)}
              editKey={amountKey(target)}
              onBeginEdit={() => {
                onSelectMonth(month.id);
                onBeginEdit(target, amount);
              }}
              onCancel={onCancelEdit}
              onChange={onChangeEdit}
              onSave={onSaveEdit}
              value={editingValue}
            />
          </div>
        );
      })}
    </div>
  );
}

function DesktopAreaItemRow({
  areaItemKey,
  editingKey,
  editingValue,
  label,
  monthCellTone,
  months,
  nameEditor,
  onBeginEdit,
  onCancelEdit,
  onChangeEdit,
  onSelectMonth,
  onSaveEdit,
  saving = false,
}: {
  areaItemKey: AreaItemKey;
  editingKey: string | null;
  editingValue: string;
  label: string;
  monthCellTone: (monthId: string, monthIndex: number) => string;
  months: ForecastMonth[];
  nameEditor: NameEditor;
  onBeginEdit: (target: AmountTarget, amount: string) => void;
  onCancelEdit: () => void;
  onChangeEdit: (value: string) => void;
  onSelectMonth: (monthId: string) => void;
  onSaveEdit: () => void;
  saving?: boolean;
}) {
  const tone = saving ? "text-emerald-900" : "text-stone-700";
  const nameTarget: NameTarget = { type: "areaItem", key: areaItemKey };

  return (
    <div className="contents">
      <div
        className={`${desktopStickyLabelCell} flex items-center border-b border-l border-stone-100 border-l-stone-200 py-3 pl-10 pr-2 text-sm ${tone}`}
      >
        <EditableName
          ariaLabel={`Redigera namnet ${label}`}
          cell
          editing={nameEditor.editingKey === nameKey(nameTarget)}
          editKey={nameKey(nameTarget)}
          label={label}
          onBeginEdit={() => nameEditor.onBeginEdit(nameTarget, label)}
          onCancel={nameEditor.onCancelEdit}
          onChange={nameEditor.onChangeEdit}
          onSave={nameEditor.onSaveEdit}
          value={nameEditor.editingValue}
        />
      </div>
      <div
        className={`border-b border-stone-100 bg-stone-50/80 px-1 py-3 text-center text-xs font-medium lg:text-sm ${tone}`}
        title={getAreaItemYearTotal(months, areaItemKey)}
      >
        {getAreaItemYearTotal(months, areaItemKey).replace(" kr", "")}
      </div>
      {months.map((month, monthIndex) => {
        const target: AmountTarget = { type: "areaItem", monthId: month.id, areaItemKey };
        const amount = getAreaItemAmount(month, areaItemKey);

        return (
          <div
            className={`grid min-w-0 place-items-center border-b border-stone-100 px-1 py-2 text-xs lg:text-sm ${monthCellTone(
              month.id,
              monthIndex,
            )}`}
            key={`${areaItemKey}-${month.id}`}
          >
            <EditableAmount
              amount={amount.replace(" kr", "")}
              ariaLabel={`Redigera ${label} i ${month.name}, nu ${amount}`}
              cell
              editing={editingKey === amountKey(target)}
              editKey={amountKey(target)}
              onBeginEdit={() => {
                onSelectMonth(month.id);
                onBeginEdit(target, amount);
              }}
              onCancel={onCancelEdit}
              onChange={onChangeEdit}
              onSave={onSaveEdit}
              value={editingValue}
            />
          </div>
        );
      })}
    </div>
  );
}

function DesktopSavingsGoalRow({
  editingKey,
  editingValue,
  goal,
  monthCellTone,
  months,
  nameEditor,
  onBeginEdit,
  onCancelEdit,
  onChangeEdit,
  onSelectMonth,
  onSaveEdit,
}: {
  editingKey: string | null;
  editingValue: string;
  goal: SavingsGoalView;
  monthCellTone: (monthId: string, monthIndex: number) => string;
  months: ForecastMonth[];
  nameEditor: NameEditor;
  onBeginEdit: (target: AmountTarget, amount: string) => void;
  onCancelEdit: () => void;
  onChangeEdit: (value: string) => void;
  onSelectMonth: (monthId: string) => void;
  onSaveEdit: () => void;
}) {
  const nameTarget: NameTarget = { type: "expenseItem", id: goal.id };

  return (
    <div className="contents">
      <div
        className={`${desktopStickyLabelCell} flex items-center border-b border-l border-stone-100 border-l-stone-200 py-3 pl-10 pr-2 text-sm text-emerald-900`}
      >
        <EditableName
          ariaLabel={`Redigera namnet ${goal.name}`}
          cell
          editing={nameEditor.editingKey === nameKey(nameTarget)}
          editKey={nameKey(nameTarget)}
          label={goal.name}
          onBeginEdit={() => nameEditor.onBeginEdit(nameTarget, goal.name)}
          onCancel={nameEditor.onCancelEdit}
          onChange={nameEditor.onChangeEdit}
          onSave={nameEditor.onSaveEdit}
          value={nameEditor.editingValue}
        />
      </div>
      <div
        className="border-b border-stone-100 bg-stone-50/80 px-1 py-3 text-center text-xs font-medium text-emerald-900 lg:text-sm"
        title={getSavingsGoalYearTotal(months, goal.id)}
      >
        {getSavingsGoalYearTotal(months, goal.id).replace(" kr", "")}
      </div>
      {months.map((month, monthIndex) => {
        const target: AmountTarget = {
          type: "item",
          monthId: month.id,
          categoryId: "sparande",
          itemId: goal.id,
        };
        const amount = getSavingsGoalAmount(month, goal.id);

        return (
          <div
            className={`grid min-w-0 place-items-center border-b border-stone-100 px-1 py-2 text-xs lg:text-sm ${monthCellTone(
              month.id,
              monthIndex,
            )}`}
            key={`${goal.id}-${month.id}`}
          >
            <EditableAmount
              amount={amount.replace(" kr", "")}
              ariaLabel={`Redigera ${goal.name} i ${month.name}, nu ${amount}`}
              cell
              editing={editingKey === amountKey(target)}
              editKey={amountKey(target)}
              onBeginEdit={() => {
                onSelectMonth(month.id);
                onBeginEdit(target, amount);
              }}
              onCancel={onCancelEdit}
              onChange={onChangeEdit}
              onSave={onSaveEdit}
              value={editingValue}
            />
          </div>
        );
      })}
    </div>
  );
}

function DesktopSavingsGoalAddRow({
  draft,
  open,
  onCancel,
  onChange,
  onOpen,
  onSave,
  months,
}: {
  draft: string;
  open: boolean;
  onCancel: () => void;
  onChange: (value: string) => void;
  onOpen: () => void;
  onSave: () => void;
  months: ForecastMonth[];
}) {
  return (
    <div className="contents">
      <div
        className={`${desktopStickyLabelCell} border-b border-l border-stone-100 border-l-stone-200 py-2.5 pl-10 pr-2`}
      >
        {open ? (
          <form
            className="flex min-w-0 items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              onSave();
            }}
          >
            <input
              aria-label="Namn på nytt sparmål"
              autoFocus
              className="min-h-8 min-w-0 flex-1 rounded-md border border-stone-200 bg-white px-2 text-xs text-stone-900 outline-none focus:border-[#9aaa97] focus:ring-2 focus:ring-[#dce4da]"
              maxLength={48}
              onChange={(event) => onChange(event.target.value)}
              placeholder="Nytt sparmål"
              value={draft}
            />
            <button
              className="min-h-8 rounded-md bg-stone-950 px-2 text-xs font-medium text-white disabled:bg-stone-300"
              disabled={!draft.trim()}
              type="submit"
            >
              Lägg till
            </button>
            <button
              aria-label="Avbryt nytt sparmål"
              className="min-h-8 px-1 text-xs text-stone-400 hover:text-stone-700"
              onClick={onCancel}
              type="button"
            >
              Avbryt
            </button>
          </form>
        ) : (
          <button
            className="min-h-8 text-left text-sm font-medium text-emerald-800 transition hover:text-emerald-950"
            onClick={onOpen}
            type="button"
          >
            + Lägg till sparmål
          </button>
        )}
      </div>
      <div className="border-b border-stone-100 bg-stone-50/80" />
      {months.map((month) => (
        <div className="border-b border-stone-100" key={`add-savings-goal-${month.id}`} />
      ))}
    </div>
  );
}

function YearOverview({
  editingKey,
  editingValue,
  expandedCostAccount,
  expandedGridCategories,
  expandedMortgage,
  expandedSavings,
  labels,
  months,
  nameEditor,
  savingsGoalDraft,
  savingsGoalFormOpen,
  savingsGoals,
  currentMonthId,
  onAddExpense,
  onCancelSavingsGoal,
  onChangeSavingsGoalDraft,
  onBeginEdit,
  onCancelEdit,
  onChangeEdit,
  onRequestDelete,
  onOpenSavingsGoal,
  onSelectMonth,
  onSaveEdit,
  onSaveSavingsGoal,
  onToggleCostAccount,
  onToggleGridCategory,
  onToggleMortgage,
  onToggleSavings,
  selectedMonthId,
}: {
  editingKey: string | null;
  editingValue: string;
  expandedCostAccount: boolean;
  expandedGridCategories: Record<string, boolean>;
  expandedMortgage: boolean;
  expandedSavings: boolean;
  labels: ResolvedPlanningLabels;
  months: ForecastMonth[];
  nameEditor: NameEditor;
  savingsGoalDraft: string;
  savingsGoalFormOpen: boolean;
  savingsGoals: SavingsGoalView[];
  currentMonthId: string | null;
  onAddExpense: (categoryName: string) => void;
  onCancelSavingsGoal: () => void;
  onChangeSavingsGoalDraft: (value: string) => void;
  onBeginEdit: (target: AmountTarget, amount: string) => void;
  onCancelEdit: () => void;
  onChangeEdit: (value: string) => void;
  onRequestDelete: (target: DeleteTarget) => void;
  onOpenSavingsGoal: () => void;
  onSelectMonth: (monthId: string) => void;
  onSaveEdit: () => void;
  onSaveSavingsGoal: () => void;
  onToggleCostAccount: () => void;
  onToggleGridCategory: (categoryName: string) => void;
  onToggleMortgage: () => void;
  onToggleSavings: () => void;
  selectedMonthId: string;
}) {
  const expenseCategories = months[0]?.categories ?? [];
  const billAccountCategories = expenseCategories.filter(
    (category) => category.id && !directAllocationCategoryIds.has(category.id),
  );
  const remainingValues = months.map(getRemainingAmount);
  const billAccountAllocationValues = months.map((month) =>
    getAllocationAmount(month, "billAccount"),
  );
  const mortgageAllocationValues = months.map((month) => getAllocationAmount(month, "mortgage"));
  const savingAllocationValues = months.map((month) => getAllocationAmount(month, "savings"));
  const billAccountCostValues = months.map(getBillAccountCosts);
  const currentMonthIndex = currentMonthId
    ? months.findIndex((month) => month.id === currentMonthId)
    : -1;

  function monthCellTone(monthId: string, monthIndex: number) {
    if (monthId === currentMonthId) {
      return "bg-[#edf2ec] text-stone-950";
    }

    if (monthId === selectedMonthId) {
      return "bg-stone-950/[0.045] text-stone-950";
    }

    if (currentMonthIndex >= 0 && monthIndex < currentMonthIndex) {
      return "bg-stone-50/70 text-stone-400 hover:bg-stone-100/70 hover:text-stone-600";
    }

    return "text-stone-700 hover:bg-stone-50";
  }

  function renderCategoryRow(category: ForecastExpenseCategory, depth: 0 | 1) {
    const categoryId = category.id!;
    const categoryExpanded = Boolean(expandedGridCategories[categoryId]);
    const saving = categoryId === "sparande";
    const categoryNameTarget: NameTarget = { type: "expenseCategory", id: categoryId };
    const groupRail = depth === 0 ? "" : "border-l border-l-stone-200 pl-4";
    const toggleIndent = "";
    const itemIndent = depth === 0 ? "ml-8" : "ml-12";
    const mainSectionId = getExpenseCategoryMainSectionId(categoryId);

    return (
      <div className="contents" key={`category-${categoryId}`}>
        <div
          className={`${desktopStickyLabelCell} flex items-center gap-1 border-b border-stone-100 py-3 pr-2 text-left text-sm font-semibold ${groupRail} ${
            saving ? "text-emerald-900 hover:text-emerald-950" : "text-stone-800 hover:text-stone-950"
          }`}
        >
          <button
            aria-expanded={categoryExpanded}
            aria-label={`${categoryExpanded ? "Stäng" : "Öppna"} ${category.name}`}
            className={`${toggleIndent} grid h-8 w-6 shrink-0 place-items-center rounded-[4px] text-base leading-none text-stone-400 transition hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stone-900`}
            onClick={() => onToggleGridCategory(categoryId)}
            type="button"
          >
            <span
              aria-hidden="true"
              className={`transition-transform ${categoryExpanded ? "rotate-90" : ""}`}
            >
              ›
            </span>
          </button>
          {mainSectionId ? (
            <span aria-hidden="true" className="w-5 shrink-0 text-center text-sm leading-none">
              {famekoMainSectionSymbols[mainSectionId]}
            </span>
          ) : null}
          <EditableName
            ariaLabel={`Redigera namnet ${category.name}`}
            cell
            editing={nameEditor.editingKey === nameKey(categoryNameTarget)}
            editKey={nameKey(categoryNameTarget)}
            label={category.name}
            onBeginEdit={() => nameEditor.onBeginEdit(categoryNameTarget, category.name)}
            onCancel={nameEditor.onCancelEdit}
            onChange={nameEditor.onChangeEdit}
            onSave={nameEditor.onSaveEdit}
            value={nameEditor.editingValue}
          />
        </div>
        <div
          className={`border-b border-stone-100 bg-stone-50/80 px-1 py-3 text-center text-xs font-semibold lg:text-sm ${
            saving ? "text-emerald-900" : "text-stone-800"
          }`}
          title={getCategoryYearTotal(months, categoryId)}
        >
          {getCategoryYearTotal(months, categoryId).replace(" kr", "")}
        </div>
        {months.map((month, monthIndex) => {
          const amount = getCategoryAmount(month, categoryId);

          return (
            <button
              aria-label={`${month.name}, ${category.name}: ${amount}`}
              className={`min-w-0 border-b border-stone-100 px-1 py-3 text-center text-xs font-semibold transition focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 lg:text-sm ${monthCellTone(
                month.id,
                monthIndex,
              )}`}
              key={`${categoryId}-${month.id}`}
              onClick={() => onSelectMonth(month.id)}
              tabIndex={-1}
              type="button"
            >
              {amount.replace(" kr", "")}
            </button>
          );
        })}

        {categoryExpanded ? (
          <>
            {category.items?.map((item) => {
              const itemId = item.id!;
              const itemNameTarget: NameTarget = { type: "expenseItem", id: itemId };

              return (
                <div className="contents" key={`${categoryId}-${itemId}`}>
                <div
                  className={`${desktopStickyLabelCell} border-b border-stone-100 py-2.5 pr-2 text-sm text-stone-500 ${groupRail}`}
                >
                  <div className={`${itemIndent} flex min-w-0 items-center justify-between gap-2`}>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <RecognizedBrandLogo name={item.name} size={18} />
                      <div className="min-w-0 flex-1">
                        <EditableName
                          ariaLabel={`Redigera namnet ${item.name}`}
                          cell
                          editing={nameEditor.editingKey === nameKey(itemNameTarget)}
                          editKey={nameKey(itemNameTarget)}
                          label={item.name}
                          onBeginEdit={() => nameEditor.onBeginEdit(itemNameTarget, item.name)}
                          onCancel={nameEditor.onCancelEdit}
                          onChange={nameEditor.onChangeEdit}
                          onSave={nameEditor.onSaveEdit}
                          value={nameEditor.editingValue}
                        />
                      </div>
                    </div>
                    <button
                      aria-label={`Ta bort ${item.name} från vald månad`}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-stone-300 transition hover:bg-stone-100 hover:text-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
                      onClick={() =>
                        onRequestDelete({
                          type: "item",
                          monthId: selectedMonthId,
                          categoryId,
                          itemId,
                          itemLabel: item.name,
                        })
                      }
                      title="Ta bort"
                      type="button"
                    >
                      ...
                    </button>
                  </div>
                </div>
                <div
                  className="border-b border-stone-100 bg-stone-50/80 px-1 py-2.5 text-center text-xs font-medium text-stone-600 lg:text-sm"
                  title={getItemYearTotal(months, categoryId, itemId)}
                >
                  {getItemYearTotal(months, categoryId, itemId).replace(" kr", "")}
                </div>
                {months.map((month, monthIndex) => {
                  const target: AmountTarget = {
                    type: "item",
                    monthId: month.id,
                    categoryId,
                    itemId,
                  };
                  const amount =
                    month.categories
                      .find((currentCategory) => currentCategory.id === categoryId)
                      ?.items?.find((currentItem) => currentItem.id === itemId)
                      ?.amount ?? "0 kr";

                  return (
                    <div
                      className={`grid min-w-0 place-items-center border-b border-stone-100 px-1 py-2.5 text-xs lg:text-sm ${monthCellTone(
                        month.id,
                        monthIndex,
                      )}`}
                      key={`${categoryId}-${itemId}-${month.id}`}
                    >
                      <EditableAmount
                        amount={amount.replace(" kr", "")}
                        ariaLabel={`Redigera ${item.name} i ${month.name}, nu ${amount}`}
                        cell
                        editing={editingKey === amountKey(target)}
                        editKey={amountKey(target)}
                        onBeginEdit={() => {
                          onSelectMonth(month.id);
                          onBeginEdit(target, amount);
                        }}
                        onCancel={onCancelEdit}
                        onChange={onChangeEdit}
                        onSave={onSaveEdit}
                        value={editingValue}
                      />
                    </div>
                  );
                })}
                </div>
              );
            })}
            <div className="contents">
              <div
                className={`${desktopStickyLabelCell} border-b border-stone-100 py-2.5 pr-2 ${groupRail}`}
              >
                <button
                  className={`${itemIndent} text-left text-sm font-medium text-stone-500 transition hover:text-stone-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-900`}
                  onClick={() => onAddExpense(categoryId)}
                  type="button"
                >
                  + Lägg till post
                </button>
              </div>
              <div className="border-b border-stone-100 bg-stone-50/80" />
              {months.map((month, monthIndex) => (
                <div
                  className={`border-b border-stone-100 ${monthCellTone(month.id, monthIndex)}`}
                  key={`add-${categoryId}-${month.id}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <section
      aria-label="Ekonomisk plan för kommande 12 månader"
      className="border-y border-stone-200 bg-white/82 px-3 py-5 shadow-[0_18px_64px_rgba(28,25,23,0.045)] backdrop-blur sm:px-5 lg:px-7"
    >
      <div className="mx-auto grid max-w-[1560px] grid-cols-[56px_repeat(3,minmax(0,1fr))] lg:hidden">
        <div className="border-b border-stone-200 pb-3" />
        {yearRows.map((row) => (
          <div
            className={`border-b border-stone-200 pb-3 text-center ${mobileTypography.metadata} text-stone-500`}
            key={row.key}
          >
            {row.shortLabel}
          </div>
        ))}

        <div className={`flex items-center border-b border-stone-200 py-3 ${mobileTypography.metadata} text-stone-500`}>
          Året
        </div>
        {yearRows.map((row) => {
          const summary = getYearSummary(row, months);

          return (
            <div
              className={`border-b border-stone-200 bg-stone-50/80 px-1 py-3 text-center ${mobileTypography.metadata} text-stone-800 ${
                row.key === "remaining" ? "font-semibold" : "font-medium"
              }`}
              key={`year-${row.key}`}
              title={summary}
            >
              {summary}
            </div>
          );
        })}

        {months.map((month, monthIndex) => {
          const selected = month.id === selectedMonthId;
          const current = month.id === currentMonthId;
          const past = currentMonthIndex >= 0 && monthIndex < currentMonthIndex;

          return (
            <div className="contents" key={month.id}>
              <button
                aria-pressed={selected}
                className={`flex items-center gap-1.5 border-b border-stone-100 py-3 text-left ${mobileTypography.metadata} transition focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${
                  current
                    ? "border-l-2 border-l-emerald-700 pl-1 text-stone-950"
                    : selected
                      ? "text-stone-950"
                      : past
                        ? "text-stone-400"
                        : "text-stone-500"
                }`}
                onClick={() => onSelectMonth(month.id)}
                type="button"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${statusDot[month.status]} ${past ? "opacity-45" : ""}`}
                />
                <span>{month.label}</span>
              </button>
              {yearRows.map((row) => {
                const cellClass = `${monthCellTone(month.id, monthIndex)} ${
                  row.key === "remaining" ? "font-semibold" : "font-medium"
                }`;

                return (
                  <button
                    aria-label={`${month.name}, ${row.label}: ${getMonthFlowValue(month, row.key)}`}
                    className={`border-b border-stone-100 px-1 py-3 text-center ${mobileTypography.metadata} transition focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${cellClass}`}
                    key={`${month.id}-${row.key}`}
                    onClick={() => onSelectMonth(month.id)}
                    tabIndex={-1}
                    type="button"
                  >
                    {getMonthFlowValue(month, row.key)}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div
        aria-label="Helårsöversikt, horisontellt rullningsbar vid behov"
        className="mx-auto hidden max-w-[1560px] overflow-x-auto overscroll-x-contain lg:block"
        role="region"
        tabIndex={0}
      >
        <div className="grid w-full min-w-[1384px] grid-cols-[208px_96px_repeat(12,minmax(90px,1fr))]">
          <div className={`${desktopStickyLabelCell} z-30 min-h-14 border-b border-stone-200`} />
        <div className="flex min-h-14 flex-col items-center border-b border-stone-200 pb-3 pt-1 text-center text-[11px] font-semibold leading-none text-stone-500">
          <span className="flex h-4 items-center">ÅRET</span>
          <span aria-hidden="true" className="mt-1 h-3 text-[9px]">
            &nbsp;
          </span>
        </div>
        {months.map((month, monthIndex) => {
          const selected = month.id === selectedMonthId;
          const current = month.id === currentMonthId;
          const past = currentMonthIndex >= 0 && monthIndex < currentMonthIndex;

          return (
            <button
              aria-pressed={selected}
              className={`group relative flex min-h-14 flex-col items-center border-b border-stone-200 pb-3 pt-1 text-center text-[11px] font-semibold leading-none transition focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${
                current
                  ? "bg-[#edf2ec] text-stone-950"
                  : selected
                    ? "bg-stone-950/[0.045] text-stone-950"
                    : past
                      ? "text-stone-400 hover:text-stone-600"
                      : "text-stone-500 hover:text-stone-950"
              }`}
              key={month.id}
              onClick={() => onSelectMonth(month.id)}
              type="button"
            >
              <span className="flex h-4 items-center justify-center gap-1.5">
                <span>{month.label}</span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${statusDot[month.status]} ${past ? "opacity-45" : ""}`}
                />
              </span>
              <span
                className={`mt-1 block h-3 text-[9px] font-medium leading-none text-emerald-800 ${
                  current ? "visible" : "invisible"
                }`}
              >
                NU
              </span>
              {current || selected ? (
                <span
                  className={`absolute inset-x-1 bottom-0 ${current ? "h-0.5 bg-emerald-800" : "h-px bg-stone-950"}`}
                />
              ) : null}
            </button>
          );
        })}

        <DesktopSectionHeading first label="Inkomster & fördelningar" />

        <DesktopGridRow
          chapter
          label="Inkomster"
          monthCellTone={monthCellTone}
          months={months}
          onSelectMonth={onSelectMonth}
          summary
          symbol="income"
          values={months.map((month) => month.income)}
          yearTotal={getYearSummary(yearRows[0], months)}
        />

        {incomeLines.map((line) => (
          <DesktopIncomeLineRow
            editingKey={editingKey}
            editingValue={editingValue}
            incomeLineKey={line.key}
            key={line.key}
            label={labels.incomeLines[line.key]}
            monthCellTone={monthCellTone}
            months={months}
            nameEditor={nameEditor}
            onBeginEdit={onBeginEdit}
            onCancelEdit={onCancelEdit}
            onChangeEdit={onChangeEdit}
            onSelectMonth={onSelectMonth}
            onSaveEdit={onSaveEdit}
          />
        ))}

        <DesktopGridRow
          chapter
          label="Fördelningar"
          monthCellTone={monthCellTone}
          months={months}
          onSelectMonth={onSelectMonth}
          summary
          symbol="allocations"
          values={months.map((month) => month.expenses)}
          yearTotal={getYearSummary(yearRows[1], months)}
        />

        {allocationRows.map((allocation) => (
          <DesktopAllocationRow
            allocationKey={allocation.key}
            editingKey={editingKey}
            editingValue={editingValue}
            key={allocation.key}
            label={labels.allocations[allocation.key]}
            monthCellTone={monthCellTone}
            months={months}
            nameEditor={nameEditor}
            onBeginEdit={onBeginEdit}
            onCancelEdit={onCancelEdit}
            onChangeEdit={onChangeEdit}
            onSelectMonth={onSelectMonth}
            onSaveEdit={onSaveEdit}
            saving={allocation.key === "savings"}
          />
        ))}

        <DesktopGridRow
          label="Kvar att fördela"
          monthCellTone={monthCellTone}
          months={months}
          onSelectMonth={onSelectMonth}
          result
          values={remainingValues}
          yearTotal={getYearSummary(yearRows[2], months)}
        />

        <DesktopSectionHeading label="Räkningskonto & lån" />

        <DesktopGridRow
          chapter
          expanded={expandedCostAccount}
          label={labels.allocations.billAccount}
          monthCellTone={monthCellTone}
          months={months}
          onSelectMonth={onSelectMonth}
          onToggle={onToggleCostAccount}
          summary
          symbol="billAccount"
          values={billAccountAllocationValues}
          yearTotal={getAllocationYearTotal(months, "billAccount")}
        />
        {expandedCostAccount ? (
          <>
            <DesktopGridRow
              depth={1}
              label="Tillfört konto"
              monthCellTone={monthCellTone}
              months={months}
              onSelectMonth={onSelectMonth}
              values={billAccountAllocationValues}
              yearTotal={getAllocationYearTotal(months, "billAccount")}
            />
            <DesktopOpeningBalanceRow
              editingKey={editingKey}
              editingValue={editingValue}
              monthCellTone={monthCellTone}
              months={months}
              onBeginEdit={onBeginEdit}
              onCancelEdit={onCancelEdit}
              onChangeEdit={onChangeEdit}
              onSelectMonth={onSelectMonth}
              onSaveEdit={onSaveEdit}
            />
            {billAccountCategories.map((category) => renderCategoryRow(category, 1))}
            <DesktopGridRow
              depth={1}
              label="Kostnader"
              monthCellTone={monthCellTone}
              months={months}
              onSelectMonth={onSelectMonth}
              result
              values={billAccountCostValues}
              yearTotal={getBillAccountCostsYearTotal(months)}
            />
            <DesktopGridRow
              depth={1}
              label="Saldo"
              monthCellTone={monthCellTone}
              months={months}
              onSelectMonth={onSelectMonth}
              result
              values={months.map((month) => month.calculatedBalance)}
              yearTotal={months[months.length - 1]?.calculatedBalance ?? "0 kr"}
            />
          </>
        ) : null}

        <DesktopGridRow
          chapter
          expanded={expandedMortgage}
          label={labels.allocations.mortgage}
          monthCellTone={monthCellTone}
          months={months}
          onSelectMonth={onSelectMonth}
          onToggle={onToggleMortgage}
          summary
          symbol="mortgage"
          values={mortgageAllocationValues}
          yearTotal={getAllocationYearTotal(months, "mortgage")}
        />
        {expandedMortgage ? (
          <>
            <DesktopGridRow
              depth={1}
              label="Tillfört"
              monthCellTone={monthCellTone}
              months={months}
              onSelectMonth={onSelectMonth}
              values={mortgageAllocationValues}
              yearTotal={getAllocationYearTotal(months, "mortgage")}
            />
            {mortgageRows.map((row) => (
              <DesktopAreaItemRow
                areaItemKey={row.key}
                editingKey={editingKey}
                editingValue={editingValue}
                key={row.key}
                label={labels.areaItems[row.key]}
                monthCellTone={monthCellTone}
                months={months}
                nameEditor={nameEditor}
                onBeginEdit={onBeginEdit}
                onCancelEdit={onCancelEdit}
                onChangeEdit={onChangeEdit}
                onSelectMonth={onSelectMonth}
                onSaveEdit={onSaveEdit}
              />
            ))}
            <DesktopGridRow
              depth={1}
              label="Kvar att placera"
              monthCellTone={monthCellTone}
              months={months}
              onSelectMonth={onSelectMonth}
              result
              values={months.map((month) => getAreaRemainingAmount(month, "mortgage"))}
              yearTotal={getAreaRemainingYearTotal(months, "mortgage")}
            />
          </>
        ) : null}

        <DesktopSectionHeading label="Sparande & investeringar" />

        <DesktopGridRow
          chapter
          expanded={expandedSavings}
          label={labels.allocations.savings}
          monthCellTone={monthCellTone}
          months={months}
          onSelectMonth={onSelectMonth}
          onToggle={onToggleSavings}
          saving
          summary
          symbol="savings"
          values={savingAllocationValues}
          yearTotal={getAllocationYearTotal(months, "savings")}
        />
        {expandedSavings ? (
          <>
            <DesktopGridRow
              depth={1}
              label="Tillfört"
              monthCellTone={monthCellTone}
              months={months}
              onSelectMonth={onSelectMonth}
              saving
              values={savingAllocationValues}
              yearTotal={getAllocationYearTotal(months, "savings")}
            />
            {savingsGoals.map((goal) => (
              <DesktopSavingsGoalRow
                editingKey={editingKey}
                editingValue={editingValue}
                goal={goal}
                key={goal.id}
                monthCellTone={monthCellTone}
                months={months}
                nameEditor={nameEditor}
                onBeginEdit={onBeginEdit}
                onCancelEdit={onCancelEdit}
                onChangeEdit={onChangeEdit}
                onSelectMonth={onSelectMonth}
                onSaveEdit={onSaveEdit}
              />
            ))}
            <DesktopSavingsGoalAddRow
              draft={savingsGoalDraft}
              months={months}
              onCancel={onCancelSavingsGoal}
              onChange={onChangeSavingsGoalDraft}
              onOpen={onOpenSavingsGoal}
              onSave={onSaveSavingsGoal}
              open={savingsGoalFormOpen}
            />
            <DesktopGridRow
              depth={1}
              label="Kvar att placera"
              monthCellTone={monthCellTone}
              months={months}
              onSelectMonth={onSelectMonth}
              saving
              result
              values={months.map((month) => getAreaRemainingAmount(month, "savings"))}
              yearTotal={getAreaRemainingYearTotal(months, "savings")}
            />
          </>
        ) : null}

        </div>
      </div>
    </section>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-stone-100 py-4 sm:border-b-0 sm:py-0">
      <p className={`${mobileTypography.metadata} text-stone-400`}>{label}</p>
      <p className={`mt-1 ${mobileTypography.sectionTitle} tabular-nums text-stone-950`}>{value}</p>
    </div>
  );
}

function EditableAmount({
  amount,
  ariaLabel,
  cell = false,
  editing,
  editKey,
  onBeginEdit,
  onCancel,
  onChange,
  onSave,
  value,
}: {
  amount: string;
  ariaLabel: string;
  cell?: boolean;
  editing: boolean;
  editKey: string;
  onBeginEdit: () => void;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  value: string;
}) {
  if (editing) {
    return (
      <input
        autoFocus
        aria-label={ariaLabel}
        className={`${
          cell ? "h-8 w-full min-w-0 px-1" : "h-9 w-28 px-2"
        } rounded-[4px] border border-stone-400 bg-white text-right text-sm text-stone-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.8)] outline-none focus:border-stone-950 focus:ring-2 focus:ring-stone-950/10`}
        data-edit-key={editKey}
        inputMode="numeric"
        onBlur={onSave}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }

          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        value={value}
      />
    );
  }

  return (
    <button
      aria-label={ariaLabel}
      className={`${
        cell ? "min-h-8 w-full min-w-0 px-1" : "min-h-9 px-2"
      } rounded-[4px] text-right text-sm text-stone-600 transition hover:bg-white hover:text-stone-950 hover:shadow-[inset_0_0_0_1px_rgba(168,162,158,0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stone-900`}
      data-edit-key={editKey}
      onClick={onBeginEdit}
      type="button"
    >
      {amount}
    </button>
  );
}

function EditableName({
  ariaLabel,
  cell = false,
  editing,
  editKey,
  label,
  onBeginEdit,
  onCancel,
  onChange,
  onSave,
  value,
}: {
  ariaLabel: string;
  cell?: boolean;
  editing: boolean;
  editKey: string;
  label: string;
  onBeginEdit: () => void;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  value: string;
}) {
  if (editing) {
    return (
      <input
        autoFocus
        aria-label={ariaLabel}
        className={`h-8 min-w-0 rounded-[4px] border border-stone-400 bg-white px-2 text-sm text-stone-950 outline-none focus:border-stone-950 focus:ring-2 focus:ring-stone-950/10 ${
          cell ? "w-full" : "w-full max-w-52"
        }`}
        maxLength={rowNameMaxLength}
        onBlur={onSave}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }

          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        value={value}
      />
    );
  }

  return (
    <button
      aria-label={ariaLabel}
      className={`min-w-0 rounded-[4px] text-left transition hover:bg-stone-100 hover:text-stone-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stone-900 ${
        cell ? "min-h-7 w-full px-1" : "min-h-9 w-full px-1"
      }`}
      data-name-key={editKey}
      onClick={onBeginEdit}
      title={label}
      type="button"
    >
      <span className="block truncate">{label}</span>
    </button>
  );
}

function MobileDisclosureChevron({ expanded }: { expanded: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-6 w-5 shrink-0 place-items-center text-lg leading-none text-stone-400 transition-transform duration-200 ease-out ${
        expanded ? "rotate-90" : ""
      }`}
    >
      ›
    </span>
  );
}

function PlanningGroup({
  amount,
  children,
  expanded,
  label,
  onToggle,
  saving = false,
}: {
  amount: string;
  children?: React.ReactNode;
  expanded: boolean;
  label: string;
  onToggle: () => void;
  saving?: boolean;
}) {
  return (
    <div className="border-b border-stone-100">
      <button
        aria-expanded={expanded}
        className={`flex ${mobileRhythm.disclosureButton} w-full items-center justify-between gap-4 text-left ${mobileTypography.sectionTitle} ${
          saving ? "text-emerald-900" : "text-stone-950"
        }`}
        onClick={onToggle}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <MobileDisclosureChevron expanded={expanded} />
          <span className="truncate" title={label}>{label}</span>
        </span>
        <span className={`shrink-0 ${mobileTypography.item} tabular-nums ${saving ? "text-emerald-900" : "text-stone-600"}`}>
          {amount}
        </span>
      </button>
      {expanded && children ? (
        <div className={mobileRhythm.disclosureContent}>{children}</div>
      ) : null}
    </div>
  );
}

function PlanningPrimaryGroup({
  amount,
  children,
  label,
}: {
  amount: string;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <section aria-label={label} className="border-b border-stone-200">
      <div className={`flex ${mobileRhythm.disclosureButton} items-center justify-between gap-4 border-b border-stone-100 text-stone-950`}>
        <h4 className={mobileTypography.sectionTitle}>{label}</h4>
        <span className={`shrink-0 ${mobileTypography.item} tabular-nums text-stone-600`}>{amount}</span>
      </div>
      <div className={mobileRhythm.disclosureContent}>{children}</div>
    </section>
  );
}

function PlanningSectionHeading({ first = false, label }: { first?: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-3 pb-4 ${first ? "" : "pt-10"}`}>
      <h3 className={`shrink-0 ${mobileTypography.sectionTitle} text-stone-800`}>
        {label}
      </h3>
      <span aria-hidden="true" className="h-px min-w-6 flex-1 bg-stone-300/80" />
    </div>
  );
}

function PlanningLine({
  amount,
  label,
  muted = false,
  result = false,
  saving = false,
}: {
  amount: string;
  label: string;
  muted?: boolean;
  result?: boolean;
  saving?: boolean;
}) {
  return (
    <div
      className={`flex min-h-10 items-center justify-between gap-4 border-b border-stone-100 ${
        result ? "min-h-11 border-y border-stone-200" : ""
      } ${mobileTypography.metadata} ${muted ? "text-stone-400" : saving ? (result ? "text-emerald-800" : "text-emerald-900") : result ? "text-stone-700" : "text-stone-600"}`}
    >
      <span className="truncate">{label}</span>
      <span className="shrink-0 tabular-nums">{amount}</span>
    </div>
  );
}

function MobileOpeningBalance({
  amount,
  editingKey,
  editingValue,
  onBeginEdit,
  onCancelEdit,
  onChangeEdit,
  onSaveEdit,
}: {
  amount: string;
  editingKey: string | null;
  editingValue: string;
  onBeginEdit: (target: AmountTarget, amount: string) => void;
  onCancelEdit: () => void;
  onChangeEdit: (value: string) => void;
  onSaveEdit: () => void;
}) {
  const target: AmountTarget = { type: "openingBalance" };

  return (
    <div className={`flex min-h-11 items-center justify-between gap-4 border-b border-stone-100 ${mobileTypography.metadata} text-stone-600`}>
      <span className="truncate">Årets startsaldo</span>
      <EditableAmount
        amount={amount}
        ariaLabel={`Redigera Räkningskontots startsaldo, nu ${amount}`}
        editing={editingKey === amountKey(target)}
        editKey={amountKey(target)}
        onBeginEdit={() => onBeginEdit(target, amount)}
        onCancel={onCancelEdit}
        onChange={onChangeEdit}
        onSave={onSaveEdit}
        value={editingValue}
      />
    </div>
  );
}

function MobileIncomeLine({
  editingKey,
  editingValue,
  incomeLineKey,
  label,
  month,
  nameEditor,
  onBeginEdit,
  onCancelEdit,
  onChangeEdit,
  onSaveEdit,
}: {
  editingKey: string | null;
  editingValue: string;
  incomeLineKey: IncomeLineKey;
  label: string;
  month: ForecastMonth;
  nameEditor: NameEditor;
  onBeginEdit: (target: AmountTarget, amount: string) => void;
  onCancelEdit: () => void;
  onChangeEdit: (value: string) => void;
  onSaveEdit: () => void;
}) {
  const target: AmountTarget = { type: "incomeLine", monthId: month.id, incomeLineKey };
  const nameTarget: NameTarget = { type: "incomeLine", key: incomeLineKey };
  const amount = getIncomeLineAmount(month, incomeLineKey);

  return (
    <div className={`flex min-h-11 items-center justify-between gap-4 border-b border-stone-100 ${mobileTypography.item} text-stone-600`}>
      <div className="min-w-0 flex-1">
        <EditableName
          ariaLabel={`Redigera namnet ${label}`}
          editing={nameEditor.editingKey === nameKey(nameTarget)}
          editKey={nameKey(nameTarget)}
          label={label}
          onBeginEdit={() => nameEditor.onBeginEdit(nameTarget, label)}
          onCancel={nameEditor.onCancelEdit}
          onChange={nameEditor.onChangeEdit}
          onSave={nameEditor.onSaveEdit}
          value={nameEditor.editingValue}
        />
      </div>
      <EditableAmount
        amount={amount}
        ariaLabel={`Redigera ${label} i ${month.name}, nu ${amount}`}
        editing={editingKey === amountKey(target)}
        editKey={amountKey(target)}
        onBeginEdit={() => onBeginEdit(target, amount)}
        onCancel={onCancelEdit}
        onChange={onChangeEdit}
        onSave={onSaveEdit}
        value={editingValue}
      />
    </div>
  );
}

function MobileAllocationLine({
  allocationKey,
  editingKey,
  editingValue,
  label,
  month,
  nameEditor,
  onBeginEdit,
  onCancelEdit,
  onChangeEdit,
  onSaveEdit,
  saving = false,
}: {
  allocationKey: AllocationKey;
  editingKey: string | null;
  editingValue: string;
  label: string;
  month: ForecastMonth;
  nameEditor: NameEditor;
  onBeginEdit: (target: AmountTarget, amount: string) => void;
  onCancelEdit: () => void;
  onChangeEdit: (value: string) => void;
  onSaveEdit: () => void;
  saving?: boolean;
}) {
  const target: AmountTarget = { type: "allocation", monthId: month.id, allocationKey };
  const nameTarget: NameTarget = { type: "allocation", key: allocationKey };
  const amount = getAllocationAmount(month, allocationKey);

  return (
    <div
      className={`flex min-h-11 items-center justify-between gap-4 border-b border-stone-100 ${mobileTypography.item} ${
        saving ? "text-emerald-900" : "text-stone-600"
      }`}
    >
      <div className="min-w-0 flex-1">
        <EditableName
          ariaLabel={`Redigera namnet ${label}`}
          editing={nameEditor.editingKey === nameKey(nameTarget)}
          editKey={nameKey(nameTarget)}
          label={label}
          onBeginEdit={() => nameEditor.onBeginEdit(nameTarget, label)}
          onCancel={nameEditor.onCancelEdit}
          onChange={nameEditor.onChangeEdit}
          onSave={nameEditor.onSaveEdit}
          value={nameEditor.editingValue}
        />
      </div>
      <EditableAmount
        amount={amount}
        ariaLabel={`Redigera ${label} i ${month.name}, nu ${amount}`}
        editing={editingKey === amountKey(target)}
        editKey={amountKey(target)}
        onBeginEdit={() => onBeginEdit(target, amount)}
        onCancel={onCancelEdit}
        onChange={onChangeEdit}
        onSave={onSaveEdit}
        value={editingValue}
      />
    </div>
  );
}

function MobileAreaItemLine({
  areaItemKey,
  editingKey,
  editingValue,
  label,
  month,
  nameEditor,
  onBeginEdit,
  onCancelEdit,
  onChangeEdit,
  onSaveEdit,
  saving = false,
}: {
  areaItemKey: AreaItemKey;
  editingKey: string | null;
  editingValue: string;
  label: string;
  month: ForecastMonth;
  nameEditor: NameEditor;
  onBeginEdit: (target: AmountTarget, amount: string) => void;
  onCancelEdit: () => void;
  onChangeEdit: (value: string) => void;
  onSaveEdit: () => void;
  saving?: boolean;
}) {
  const target: AmountTarget = { type: "areaItem", monthId: month.id, areaItemKey };
  const nameTarget: NameTarget = { type: "areaItem", key: areaItemKey };
  const amount = getAreaItemAmount(month, areaItemKey);

  return (
    <div
      className={`flex min-h-11 items-center justify-between gap-4 border-b border-stone-100 ${mobileTypography.item} ${
        saving ? "text-emerald-900" : "text-stone-600"
      }`}
    >
      <div className="min-w-0 flex-1">
        <EditableName
          ariaLabel={`Redigera namnet ${label}`}
          editing={nameEditor.editingKey === nameKey(nameTarget)}
          editKey={nameKey(nameTarget)}
          label={label}
          onBeginEdit={() => nameEditor.onBeginEdit(nameTarget, label)}
          onCancel={nameEditor.onCancelEdit}
          onChange={nameEditor.onChangeEdit}
          onSave={nameEditor.onSaveEdit}
          value={nameEditor.editingValue}
        />
      </div>
      <EditableAmount
        amount={amount}
        ariaLabel={`Redigera ${label} i ${month.name}, nu ${amount}`}
        editing={editingKey === amountKey(target)}
        editKey={amountKey(target)}
        onBeginEdit={() => onBeginEdit(target, amount)}
        onCancel={onCancelEdit}
        onChange={onChangeEdit}
        onSave={onSaveEdit}
        value={editingValue}
      />
    </div>
  );
}

function MobileSavingsGoalLine({
  editingKey,
  editingValue,
  goal,
  month,
  nameEditor,
  onBeginEdit,
  onCancelEdit,
  onChangeEdit,
  onSaveEdit,
}: {
  editingKey: string | null;
  editingValue: string;
  goal: SavingsGoalView;
  month: ForecastMonth;
  nameEditor: NameEditor;
  onBeginEdit: (target: AmountTarget, amount: string) => void;
  onCancelEdit: () => void;
  onChangeEdit: (value: string) => void;
  onSaveEdit: () => void;
}) {
  const target: AmountTarget = {
    type: "item",
    monthId: month.id,
    categoryId: "sparande",
    itemId: goal.id,
  };
  const nameTarget: NameTarget = { type: "expenseItem", id: goal.id };
  const amount = getSavingsGoalAmount(month, goal.id);

  return (
    <div className={`flex min-h-11 items-center justify-between gap-4 border-b border-stone-100 ${mobileTypography.item} text-emerald-900`}>
      <div className="min-w-0 flex-1">
        <EditableName
          ariaLabel={`Redigera namnet ${goal.name}`}
          editing={nameEditor.editingKey === nameKey(nameTarget)}
          editKey={nameKey(nameTarget)}
          label={goal.name}
          onBeginEdit={() => nameEditor.onBeginEdit(nameTarget, goal.name)}
          onCancel={nameEditor.onCancelEdit}
          onChange={nameEditor.onChangeEdit}
          onSave={nameEditor.onSaveEdit}
          value={nameEditor.editingValue}
        />
      </div>
      <EditableAmount
        amount={amount}
        ariaLabel={`Redigera ${goal.name} i ${month.name}, nu ${amount}`}
        editing={editingKey === amountKey(target)}
        editKey={amountKey(target)}
        onBeginEdit={() => onBeginEdit(target, amount)}
        onCancel={onCancelEdit}
        onChange={onChangeEdit}
        onSave={onSaveEdit}
        value={editingValue}
      />
    </div>
  );
}

function MobileSavingsGoalControl({
  draft,
  open,
  onCancel,
  onChange,
  onOpen,
  onSave,
}: {
  draft: string;
  open: boolean;
  onCancel: () => void;
  onChange: (value: string) => void;
  onOpen: () => void;
  onSave: () => void;
}) {
  if (!open) {
    return (
      <button
        className={`min-h-11 w-full border-b border-stone-100 text-left ${mobileTypography.item} text-emerald-800`}
        onClick={onOpen}
        type="button"
      >
        + Lägg till sparmål
      </button>
    );
  }

  return (
    <form
      className="border-b border-stone-100 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <label className={`${mobileTypography.metadata} text-stone-500`} htmlFor="mobile-savings-goal-name">
        Namn på sparmål
      </label>
      <input
        autoFocus
        className="mt-1.5 min-h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none focus:border-[#9aaa97] focus:ring-2 focus:ring-[#dce4da]"
        id="mobile-savings-goal-name"
        maxLength={48}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Till exempel Japan 2030"
        value={draft}
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          className="min-h-9 px-3 text-sm text-stone-500"
          onClick={onCancel}
          type="button"
        >
          Avbryt
        </button>
        <button
          className="min-h-9 rounded-lg bg-stone-950 px-3 text-sm font-medium text-white disabled:bg-stone-300"
          disabled={!draft.trim()}
          type="submit"
        >
          Lägg till
        </button>
      </div>
    </form>
  );
}

function ExpenseList({
  categories,
  editingKey,
  editingValue,
  embedded = false,
  expandedCategories,
  month,
  nameEditor,
  onAddExpense,
  onBeginEdit,
  onCancelEdit,
  onChangeEdit,
  onRequestDelete,
  onSaveEdit,
  onToggleCategory,
}: {
  categories?: ForecastExpenseCategory[];
  editingKey: string | null;
  editingValue: string;
  embedded?: boolean;
  expandedCategories: Record<string, boolean>;
  month: ForecastMonth;
  nameEditor: NameEditor;
  onAddExpense: (categoryId: string) => void;
  onBeginEdit: (target: AmountTarget, amount: string) => void;
  onCancelEdit: () => void;
  onChangeEdit: (value: string) => void;
  onRequestDelete: (target: DeleteTarget) => void;
  onSaveEdit: () => void;
  onToggleCategory: (monthId: string, categoryId: string) => void;
}) {
  const visibleCategories = categories ?? month.categories;

  return (
    <div className={embedded ? "" : "mt-3 border-t border-stone-100"}>
      {visibleCategories.map((category) => {
        const categoryId = category.id!;
        const key = `${month.id}:${categoryId}`;
        const canExpand = true;
        const expanded = Boolean(expandedCategories[key]);
        const saving = categoryId === "sparande";
        const target: AmountTarget = {
          type: "category",
          monthId: month.id,
          categoryId,
        };
        const categoryNameTarget: NameTarget = { type: "expenseCategory", id: categoryId };

        return (
          <div className="border-b border-stone-100 py-3" key={categoryId}>
            <div className="flex min-h-10 items-center justify-between gap-4">
              <div className={`flex min-w-0 flex-1 items-center gap-1 ${mobileTypography.item} ${
                saving ? "text-emerald-900" : "text-stone-800"
              }`}>
                <button
                  aria-expanded={canExpand ? expanded : undefined}
                  aria-label={`${expanded ? "Stäng" : "Öppna"} ${category.name}`}
                  className="group grid h-9 w-8 shrink-0 place-items-center rounded-[4px] text-lg leading-none text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stone-900"
                  disabled={!canExpand}
                  onClick={() => onToggleCategory(month.id, categoryId)}
                  type="button"
                >
                  {canExpand ? <MobileDisclosureChevron expanded={expanded} /> : null}
                </button>
                <EditableName
                  ariaLabel={`Redigera namnet ${category.name}`}
                  editing={nameEditor.editingKey === nameKey(categoryNameTarget)}
                  editKey={nameKey(categoryNameTarget)}
                  label={category.name}
                  onBeginEdit={() => nameEditor.onBeginEdit(categoryNameTarget, category.name)}
                  onCancel={nameEditor.onCancelEdit}
                  onChange={nameEditor.onChangeEdit}
                  onSave={nameEditor.onSaveEdit}
                  value={nameEditor.editingValue}
                />
              </div>
              <EditableAmount
                amount={category.amount}
                ariaLabel={`Redigera ${category.name} i ${month.name}, nu ${category.amount}`}
                editing={editingKey === amountKey(target)}
                editKey={amountKey(target)}
                onBeginEdit={() => onBeginEdit(target, category.amount)}
                onCancel={onCancelEdit}
                onChange={onChangeEdit}
                onSave={onSaveEdit}
                value={editingValue}
              />
            </div>

            {canExpand && expanded ? (
              <div className="ml-9 mt-2 space-y-2 border-l border-stone-200 pl-4">
                {category.items?.map((item) => {
                  const itemId = item.id!;
                  const itemTarget: AmountTarget = {
                    type: "item",
                    monthId: month.id,
                    categoryId,
                    itemId,
                  };
                  const itemNameTarget: NameTarget = { type: "expenseItem", id: itemId };

                  return (
                    <div
                      className={`flex min-h-8 items-center justify-between gap-4 ${mobileTypography.metadata} text-stone-500`}
                      key={itemId}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <RecognizedBrandLogo name={item.name} size={18} />
                        <div className="min-w-0 flex-1">
                          <EditableName
                            ariaLabel={`Redigera namnet ${item.name}`}
                            editing={nameEditor.editingKey === nameKey(itemNameTarget)}
                            editKey={nameKey(itemNameTarget)}
                            label={item.name}
                            onBeginEdit={() => nameEditor.onBeginEdit(itemNameTarget, item.name)}
                            onCancel={nameEditor.onCancelEdit}
                            onChange={nameEditor.onChangeEdit}
                            onSave={nameEditor.onSaveEdit}
                            value={nameEditor.editingValue}
                          />
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          aria-label={`Ta bort ${item.name}`}
                          className="grid h-7 w-7 place-items-center rounded-full text-stone-300 transition hover:bg-stone-100 hover:text-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
                          onClick={() => onRequestDelete({ ...itemTarget, itemLabel: item.name })}
                          title="Ta bort"
                          type="button"
                        >
                          ...
                        </button>
                        <EditableAmount
                          amount={item.amount}
                          ariaLabel={`Redigera ${item.name} i ${month.name}, nu ${item.amount}`}
                          editing={editingKey === amountKey(itemTarget)}
                          editKey={amountKey(itemTarget)}
                          onBeginEdit={() => onBeginEdit(itemTarget, item.amount)}
                          onCancel={onCancelEdit}
                          onChange={onChangeEdit}
                          onSave={onSaveEdit}
                          value={editingValue}
                        />
                      </div>
                    </div>
                  );
                })}
                <button
                  className={`mt-2 min-h-9 text-left ${mobileTypography.metadata} text-stone-500 transition hover:text-stone-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-900`}
                  onClick={() => onAddExpense(categoryId)}
                  type="button"
                >
                  + Lägg till post
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ScopeDialog({
  monthId,
  onCancel,
  onConfirm,
}: {
  monthId: string;
  onCancel: () => void;
  onConfirm: (scope: ChangeScope) => void;
}) {
  const [scope, setScope] = useState<ChangeScope>("single");

  return (
    <div
      className="fixed inset-0 z-20 grid place-items-end bg-stone-950/10 px-3 py-4 backdrop-blur-[2px] sm:place-items-center"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <form
        aria-modal="true"
        className="w-full max-w-sm rounded-lg border border-stone-200 bg-[#fbfaf7] p-5 shadow-[0_24px_80px_rgba(28,25,23,0.18)]"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(scope);
        }}
        role="dialog"
      >
        <p className="text-sm text-stone-500">Du ändrade beloppet.</p>
        <h3 className="mt-1 text-xl font-semibold text-stone-950">Hur vill du göra?</h3>
        <div className="mt-5 space-y-3">
          {getScopeOptions(monthId).map((option) => (
            <label className="flex items-center gap-3 text-sm text-stone-700" key={option.value}>
              <input
                autoFocus={option.value === "single"}
                checked={scope === option.value}
                className="h-4 w-4 accent-stone-950"
                name="change-scope"
                onChange={() => setScope(option.value)}
                type="radio"
                value={option.value}
              />
              {option.label}
            </label>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            className="min-h-11 rounded-lg border border-stone-200 bg-white px-4 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-950"
            onClick={onCancel}
            type="button"
          >
            Avbryt
          </button>
          <button
            className="min-h-11 rounded-lg bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800"
            type="submit"
          >
            Klar
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteConfirmDialog({
  itemName,
  onCancel,
  onConfirm,
}: {
  itemName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-20 grid place-items-end bg-stone-950/10 px-3 py-4 backdrop-blur-[2px] sm:place-items-center"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <form
        aria-modal="true"
        className="w-full max-w-sm rounded-lg border border-stone-200 bg-[#fbfaf7] p-5 shadow-[0_24px_80px_rgba(28,25,23,0.18)]"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
        role="dialog"
      >
        <p className="text-sm text-stone-500">Planerad kostnad</p>
        <h3 className="mt-1 text-xl font-semibold text-stone-950">Ta bort {itemName}?</h3>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            autoFocus
            className="min-h-11 rounded-lg border border-stone-200 px-4 text-sm font-medium text-stone-600 transition hover:bg-white hover:text-stone-950"
            onClick={onCancel}
            type="button"
          >
            Avbryt
          </button>
          <button
            className="min-h-11 rounded-lg bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800"
            type="submit"
          >
            Ta bort
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteScopeDialog({
  target,
  onCancel,
  onConfirm,
}: {
  target: DeleteTarget;
  onCancel: () => void;
  onConfirm: (scope: ChangeScope) => void;
}) {
  const [scope, setScope] = useState<ChangeScope>("single");
  const monthName = getMonthName(target.monthId).toLowerCase();

  return (
    <div
      className="fixed inset-0 z-20 grid place-items-end bg-stone-950/10 px-3 py-4 backdrop-blur-[2px] sm:place-items-center"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <form
        aria-modal="true"
        className="w-full max-w-sm rounded-lg border border-stone-200 bg-[#fbfaf7] p-5 shadow-[0_24px_80px_rgba(28,25,23,0.18)]"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(scope);
        }}
        role="dialog"
      >
        <p className="text-sm text-stone-500">Du tar bort {target.itemLabel} från {monthName}.</p>
        <h3 className="mt-1 text-xl font-semibold text-stone-950">Hur vill du göra?</h3>
        <div className="mt-5 space-y-3">
          {getScopeOptions(target.monthId).map((option) => (
            <label className="flex items-center gap-3 text-sm text-stone-700" key={option.value}>
              <input
                autoFocus={option.value === "single"}
                checked={scope === option.value}
                className="h-4 w-4 accent-stone-950"
                name="delete-scope"
                onChange={() => setScope(option.value)}
                type="radio"
                value={option.value}
              />
              {option.label}
            </label>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            className="min-h-11 rounded-lg border border-stone-200 px-4 text-sm font-medium text-stone-600 transition hover:bg-white hover:text-stone-950"
            onClick={onCancel}
            type="button"
          >
            Avbryt
          </button>
          <button
            className="min-h-11 rounded-lg bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800"
            type="submit"
          >
            Ta bort
          </button>
        </div>
      </form>
    </div>
  );
}

function AddExpenseDialog({
  categories,
  draft,
  months,
  onChangeDraft,
  onClose,
  onSave,
}: {
  categories: ExpenseCategoryOption[];
  draft: AddExpenseDraft;
  months: ForecastMonth[];
  onChangeDraft: (draft: AddExpenseDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const canSave = isValidAddExpenseDraft(draft, categories.map((category) => category.id));

  return (
    <div
      className="fixed inset-0 z-20 grid place-items-end bg-stone-950/10 px-3 py-4 backdrop-blur-[2px] sm:place-items-center"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <form
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-stone-200 bg-[#fbfaf7] p-5 shadow-[0_24px_80px_rgba(28,25,23,0.18)]"
        onSubmit={(event) => {
          event.preventDefault();

          if (canSave) {
            onSave();
          }
        }}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-stone-500">Planerad utgift</p>
            <h3 className="mt-1 text-2xl font-semibold text-stone-950">Lägg till post</h3>
          </div>
          <button className="text-sm text-stone-400 hover:text-stone-950" onClick={onClose} type="button">
            Stäng
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-stone-200 bg-white">
          <label className="grid grid-cols-[96px_minmax(0,1fr)] items-center border-b border-stone-100 px-3 py-3 text-sm text-stone-500">
            Kategori
            <select
              autoFocus
              className="min-h-9 min-w-0 bg-white text-stone-950 outline-none"
              onChange={(event) => onChangeDraft({ ...draft, categoryId: event.target.value })}
              required
              value={draft.categoryId}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid grid-cols-[96px_minmax(0,1fr)] items-center border-b border-stone-100 px-3 py-3 text-sm text-stone-500">
            Beskrivning
            <input
              className="min-h-9 min-w-0 bg-white text-stone-950 outline-none placeholder:text-stone-300"
              onChange={(event) => onChangeDraft({ ...draft, description: event.target.value })}
              placeholder="Valfri"
              value={draft.description}
            />
          </label>

          <label className="grid grid-cols-[96px_minmax(0,1fr)] items-center border-b border-stone-100 px-3 py-3 text-sm text-stone-500">
            Belopp
            <input
              className="min-h-9 min-w-0 bg-white text-stone-950 outline-none placeholder:text-stone-300"
              inputMode="numeric"
              onChange={(event) => onChangeDraft({ ...draft, amount: event.target.value })}
              placeholder="2500"
              required
              value={draft.amount}
            />
          </label>

          <label className="grid grid-cols-[96px_minmax(0,1fr)] items-center border-b border-stone-100 px-3 py-3 text-sm text-stone-500">
            Månad
            <select
              className="min-h-9 min-w-0 bg-white text-stone-950 outline-none"
              onChange={(event) => onChangeDraft({ ...draft, monthId: event.target.value })}
              required
              value={draft.monthId}
            >
              {months.map((month) => (
                <option key={month.id} value={month.id}>
                  {month.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="px-3 py-3">
            <legend className="text-sm text-stone-500">Hur ofta?</legend>
            <div className="mt-3 grid gap-2">
              {expenseFrequencyOptions.map((option) => (
                <label className="flex min-h-8 items-center gap-3 text-sm text-stone-700" key={option.value}>
                  <input
                    checked={draft.frequency === option.value}
                    className="h-4 w-4 accent-stone-950"
                    name="expense-frequency"
                    onChange={() => onChangeDraft({ ...draft, frequency: option.value })}
                    required
                    type="radio"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <button
          className="mt-6 min-h-11 w-full rounded-lg bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
          disabled={!canSave}
          type="submit"
        >
          Spara
        </button>
      </form>
    </div>
  );
}

function ImportPlanningDataDialog({
  busy,
  onImport,
  onSkip,
}: {
  busy: boolean;
  onImport: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-end bg-stone-950/10 px-3 py-4 backdrop-blur-[2px] sm:place-items-center">
      <section
        aria-labelledby="import-planning-data-title"
        aria-modal="true"
        className="w-full max-w-sm rounded-lg border border-stone-200 bg-[#fbfaf7] p-5 shadow-[0_24px_80px_rgba(28,25,23,0.18)]"
        role="dialog"
      >
        <p className="text-sm text-stone-500">Vi hittade lokal data.</p>
        <h2 className="mt-1 text-xl font-semibold text-stone-950" id="import-planning-data-title">
          Vill du importera den till ditt konto?
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-500">
          Ditt val gäller planeringsåret {planningYear}. Ingen data slås ihop automatiskt.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            className="min-h-11 rounded-lg border border-stone-200 bg-white px-4 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-950 disabled:cursor-wait disabled:opacity-60"
            disabled={busy}
            onClick={onSkip}
            type="button"
          >
            Nej
          </button>
          <button
            autoFocus
            className="min-h-11 rounded-lg bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-wait disabled:bg-stone-400"
            disabled={busy}
            onClick={onImport}
            type="button"
          >
            {busy ? "Sparar…" : "Ja"}
          </button>
        </div>
      </section>
    </div>
  );
}

function MonthlySnapshot({ month }: { month: ForecastMonth }) {
  const savings = getMonthlySavingsMetrics(month);
  const metrics = [
    { label: "Inkomster", value: month.income },
    { label: "Fördelat", value: month.expenses },
    { label: "Kvar att fördela", value: getRemainingAmount(month) },
    { label: "Sparande", value: savings.amount },
    { label: "Sparkvot", value: formatSavingsRate(savings.rate) },
  ];

  return (
    <aside
      aria-label={`Översikt för denna månad, ${month.name}`}
      className="overflow-hidden rounded-[16px] border border-white/80 bg-white/78 shadow-[0_14px_40px_rgba(28,25,23,0.08)] backdrop-blur-md"
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-stone-200/70 px-4 py-3">
        <p className="text-sm font-medium text-stone-950">Denna månad</p>
        <p className="text-xs text-stone-400">{month.name}</p>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-5">
        {metrics.map((metric, index) => (
          <div
            className={`min-w-0 px-3 py-3 ${index % 2 ? "border-l border-stone-200/70" : ""} ${
              index < 4
                ? "border-b border-stone-200/70 sm:border-b-0"
                : "col-span-2 sm:col-span-1"
            } ${index > 0 ? "sm:border-l sm:border-stone-200/70" : "sm:border-l-0"}`}
            key={metric.label}
          >
            <dt className="truncate text-[11px] text-stone-400" title={metric.label}>{metric.label}</dt>
            <dd className="mt-1 truncate text-sm font-medium tabular-nums text-stone-800">
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function EconomicOverview({ month }: { month: ForecastMonth }) {
  const savings = getMonthlySavingsMetrics(month);
  const savingsRate = savings.rate;
  const savingsProgress = savingsRate === null ? 0 : Math.min(Math.max(savingsRate, 0), 100);
  const metrics = [
    { label: "Inkomster", value: month.income, detail: "Efter skatt" },
    { label: "Fördelat", value: month.expenses, detail: "Till månadens områden" },
    {
      label: "Kvar att fördela",
      value: getRemainingAmount(month),
      detail: "Efter fördelningar",
    },
    { label: "Sparande", value: savings.amount, detail: "Planerat sparande" },
    {
      label: "Sparkvot",
      value: formatSavingsRate(savingsRate),
      detail: savingsRate === null ? "Ingen inkomst denna månad" : "Sparande / inkomster",
      visual: true,
    },
  ];

  return (
    <section
      aria-labelledby="economic-overview-title"
      className="mx-auto w-full max-w-[1560px] px-4 pb-7 sm:px-6 sm:pb-8 lg:px-8"
    >
      <div className="mb-3 flex items-baseline justify-between gap-4 px-1">
        <h2
          className="text-sm font-semibold tracking-[-0.01em] text-stone-800"
          id="economic-overview-title"
        >
          Översikt
        </h2>
        <p className="text-xs text-stone-400">{month.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-stone-200/80 bg-stone-200/80 shadow-[0_10px_30px_rgba(28,25,23,0.025)] lg:grid-cols-5">
        {metrics.map((metric, index) => (
          <dl
            className={`min-w-0 bg-white px-4 py-4 sm:px-5 sm:py-5 ${
              index === metrics.length - 1 ? "col-span-2 lg:col-span-1" : ""
            }`}
            key={metric.label}
          >
            <dt className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-stone-400">
              {metric.label}
            </dt>
            <dd className="mt-2 truncate text-xl font-semibold tracking-[-0.025em] tabular-nums text-stone-900 sm:text-[22px]">
              {metric.value}
            </dd>
            <dd className="mt-1 text-xs text-stone-400">
              <span className="block truncate">{metric.detail}</span>
              {metric.visual ? (
                <div
                  aria-hidden="true"
                  className="mt-3 h-1 overflow-hidden rounded-full bg-stone-100"
                >
                  <div
                    className="h-full rounded-full bg-[#7f927d]"
                    style={{ width: `${savingsProgress}%` }}
                  />
                </div>
              ) : null}
            </dd>
          </dl>
        ))}
      </div>
    </section>
  );
}

function MobileInsightHeading({
  description,
  id,
  illustrationSrc,
  title,
}: {
  description: string;
  id: string;
  illustrationSrc: string;
  title: string;
}) {
  return (
    <div className="flex max-w-2xl items-start gap-3">
      <div className="relative mt-0.5 h-9 w-9 shrink-0" aria-hidden="true">
        <Image
          alt=""
          className="object-contain"
          fill
          sizes="36px"
          src={illustrationSrc}
          unoptimized
        />
      </div>
      <div className="min-w-0">
        <h2
          className={`${mobileTypography.pageTitle} text-stone-950`}
          id={id}
        >
          {title}
        </h2>
        <p
          className={`${mobileRhythm.headingToDescription} ${mobileTypography.metadata} text-stone-500`}
        >
          {description}
        </p>
      </div>
    </div>
  );
}

function MobileInsightEventMarker({ event }: { event: MobileInsightEvent }) {
  const fallback =
    event.kind === "new" || event.kind === "negative" ? (
      <span aria-hidden="true" className="mt-0.5 w-4 shrink-0 text-center text-xs">
        {event.kind === "new" ? "🆕" : "⚠"}
      </span>
    ) : (
      <span
        aria-hidden="true"
        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#899986]"
      />
    );

  return event.itemLabel ? (
    <RecognizedBrandLogo
      className="mt-0.5"
      fallback={fallback}
      name={event.itemLabel}
      size={18}
    />
  ) : (
    fallback
  );
}

function MobileUpcomingInsights({ insights }: { insights: MobileUpcomingInsight[] }) {
  return (
    <section
      aria-labelledby="mobile-upcoming-insights-title"
      className={`mx-auto w-full max-w-[1560px] ${mobileRhythm.section} pt-0`}
    >
      <MobileInsightHeading
        description="Förändringar och kostnader som kan behöva din uppmärksamhet de närmaste månaderna."
        id="mobile-upcoming-insights-title"
        illustrationSrc="/images/mobile-insights/upcoming-events.webp"
        title="Det här väntar"
      />

      {insights.length ? (
        <div className={`${mobileRhythm.headingToContent} grid gap-3 sm:grid-cols-3`}>
          {insights.map((insight) => (
            <article
              aria-label={`Kommande händelser i ${insight.name}`}
              className="min-w-0 rounded-[18px] border border-stone-200/80 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(28,25,23,0.025)]"
              key={insight.id}
            >
              <div className="flex items-baseline justify-between gap-4 border-b border-stone-100 pb-3">
                <h3 className={`${mobileTypography.sectionTitle} text-stone-950`}>
                  {insight.name}
                </h3>
                <div className="shrink-0 text-right">
                  <p className={`${mobileTypography.metadata} text-stone-400`}>
                    Kvar att fördela
                  </p>
                  <p
                    className={`${mobileTypography.item} tabular-nums ${
                      insight.remaining < 0 ? "text-rose-700" : "text-stone-900"
                    }`}
                  >
                    {formatAmount(insight.remaining)}
                  </p>
                </div>
              </div>
              <p className={`mt-3 ${mobileTypography.metadata} text-stone-500`}>
                {insight.headline}
              </p>
              <ul className="mt-2 space-y-3">
                {insight.events.map((event) => (
                  <li className="flex gap-2.5" key={event.id}>
                    <MobileInsightEventMarker event={event} />
                    <div className="min-w-0">
                      <p className={`${mobileTypography.item} text-stone-700`}>{event.title}</p>
                      {event.detail ? (
                        <p className={`mt-1 ${mobileTypography.metadata} text-stone-400`}>
                          {event.detail}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : (
        <p className={`${mobileRhythm.headingToContent} rounded-[18px] border border-stone-200/80 bg-white px-4 py-5 ${mobileTypography.item} text-stone-500`}>
          Det finns inga fler månader i årets planering.
        </p>
      )}
    </section>
  );
}

type MobileCurrentSection = "allocations" | "bills" | "income" | "mortgage" | "savings";

function MobileCurrentDisclosure({
  amount,
  children,
  expanded,
  id,
  illustrationSrc,
  label,
  onToggle,
  saving = false,
}: {
  amount: string;
  children: React.ReactNode;
  expanded: boolean;
  id: string;
  illustrationSrc?: string;
  label: string;
  onToggle: () => void;
  saving?: boolean;
}) {
  const contentId = `mobile-current-${id}-content`;

  return (
    <div className="border-b border-stone-100 last:border-b-0">
      <button
        aria-controls={contentId}
        aria-expanded={expanded}
        className={`flex ${mobileRhythm.disclosureButton} w-full items-center justify-between gap-4 text-left ${mobileTypography.sectionTitle} ${
          saving ? "text-emerald-900" : "text-stone-950"
        }`}
        onClick={onToggle}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <MobileDisclosureChevron expanded={expanded} />
          {illustrationSrc ? (
            <span className="relative h-8 w-8 shrink-0" aria-hidden="true">
              <Image
                alt=""
                className="object-contain"
                fill
                sizes="32px"
                src={illustrationSrc}
                unoptimized
              />
            </span>
          ) : (
            <span aria-hidden="true" className="h-8 w-8 shrink-0" />
          )}
          <span className="truncate" title={label}>
            {label}
          </span>
        </span>
        <span
          className={`shrink-0 ${mobileTypography.item} tabular-nums ${
            saving ? "text-emerald-900" : "text-stone-600"
          }`}
        >
          {amount}
        </span>
      </button>
      {expanded ? (
        <div className={mobileRhythm.disclosureContent} id={contentId}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function MobileLargestCosts({ costs }: { costs: LargestCost[] }) {
  return (
    <section
      aria-labelledby="mobile-largest-costs-title"
      className={`mx-auto w-full max-w-[1560px] ${mobileRhythm.section} pt-0`}
    >
      <MobileInsightHeading
        description="De tre kostnadsområden som väger tyngst i årsplaneringen."
        id="mobile-largest-costs-title"
        illustrationSrc="/images/mobile-insights/largest-costs.webp"
        title="Mina största kostnader"
      />

      <div className={`${mobileRhythm.headingToContent} overflow-hidden rounded-[20px] border border-stone-200/80 bg-white px-4 shadow-[0_10px_30px_rgba(28,25,23,0.025)] sm:px-5`}>
        {costs.map((cost, index) => (
          <article
            className={`py-5 ${index ? "border-t border-stone-100" : ""}`}
            key={cost.id}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f1f3ed] text-lg"
              >
                {cost.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className={`truncate ${mobileTypography.item} text-stone-900`}>{cost.name}</h3>
                  <p className={`shrink-0 ${mobileTypography.item} tabular-nums text-stone-950`}>
                    {cost.amount}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div
                    aria-hidden="true"
                    className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-stone-100"
                  >
                    <div
                      className="h-full rounded-full bg-[#899986]"
                      style={{ width: `${Math.min(cost.percentage, 100)}%` }}
                    />
                  </div>
                  <p className={`w-10 shrink-0 text-right ${mobileTypography.metadata} tabular-nums text-stone-500`}>
                    {cost.percentage} %
                  </p>
                </div>
                <p className={`mt-2 ${mobileTypography.metadata} text-stone-400`}>{cost.insight}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function YearNavigation() {
  return (
    <section
      aria-label="Aktivt planeringsår"
      className="mx-auto flex w-full max-w-[1560px] items-center gap-3 px-4 pb-5 sm:px-6 lg:px-8"
    >
      <span className={`${mobileTypography.metadata} text-stone-400 lg:text-xs lg:font-medium lg:leading-4`}>År</span>
      <span
        aria-current="date"
        className={`rounded-md bg-[#e9eee7] px-3 py-1.5 ${mobileTypography.metadata} font-semibold text-stone-950 lg:text-sm`}
      >
        {planningYear}
      </span>
    </section>
  );
}

function ProductFooter() {
  return (
    <footer className="mt-16 border-t border-stone-200/80 px-4 py-8 sm:px-6 lg:px-8">
      <div className={`mx-auto flex w-full max-w-[1560px] flex-col gap-4 ${mobileTypography.metadata} text-stone-400 sm:flex-row sm:items-end sm:justify-between lg:text-xs lg:leading-4`}>
        <div>
          <p className="font-semibold text-stone-700">Fameko</p>
          <p className="mt-1">Familjens ekonomi, tydligt framåt.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
          <span>Version: Workspace 1.0</span>
          <a
            className="transition hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-700"
            href="https://logo.dev"
            rel="noreferrer"
          >
            Logos provided by Logo.dev
          </a>
          <span>© 2026 Fameko</span>
        </div>
      </div>
    </footer>
  );
}

function MonthDetail({
  editingKey,
  editingValue,
  embedded = false,
  expandedCategories,
  expandedCostAccount,
  expandedMortgage,
  expandedSavings,
  labels,
  month,
  nameEditor,
  openingBalance,
  savingsGoalDraft,
  savingsGoalFormOpen,
  savingsGoals,
  onAddExpense,
  onBeginEdit,
  onCancelEdit,
  onChangeEdit,
  onRequestDelete,
  onCancelSavingsGoal,
  onChangeSavingsGoalDraft,
  onOpenSavingsGoal,
  onSaveEdit,
  onSaveSavingsGoal,
  onToggleCategory,
  onToggleCostAccount,
  onToggleMortgage,
  onToggleSavings,
}: {
  editingKey: string | null;
  editingValue: string;
  embedded?: boolean;
  expandedCategories: Record<string, boolean>;
  expandedCostAccount: boolean;
  expandedMortgage: boolean;
  expandedSavings: boolean;
  labels: ResolvedPlanningLabels;
  month: ForecastMonth;
  nameEditor: NameEditor;
  openingBalance: string;
  savingsGoalDraft: string;
  savingsGoalFormOpen: boolean;
  savingsGoals: SavingsGoalView[];
  onAddExpense: (categoryName: string) => void;
  onBeginEdit: (target: AmountTarget, amount: string) => void;
  onCancelEdit: () => void;
  onChangeEdit: (value: string) => void;
  onRequestDelete: (target: DeleteTarget) => void;
  onCancelSavingsGoal: () => void;
  onChangeSavingsGoalDraft: (value: string) => void;
  onOpenSavingsGoal: () => void;
  onSaveEdit: () => void;
  onSaveSavingsGoal: () => void;
  onToggleCategory: (monthId: string, categoryName: string) => void;
  onToggleCostAccount: () => void;
  onToggleMortgage: () => void;
  onToggleSavings: () => void;
}) {
  const billAccountCategories = getBillAccountCategories(month);
  const billAccountAllocation = getAllocationAmount(month, "billAccount");
  const billAccountCosts = getBillAccountCosts(month);
  const mortgageAllocation = getAllocationAmount(month, "mortgage");
  const savingAllocation = getAllocationAmount(month, "savings");
  const remainingAmount = getRemainingAmount(month);

  return (
    <section
      aria-label={embedded ? `Planering för ${month.name}` : undefined}
      className={embedded ? "py-5 sm:py-6" : "mx-auto mt-10 max-w-6xl px-4 pb-12 sm:px-6 lg:px-8"}
    >
      <div className={embedded ? "" : "grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]"}>
        {embedded ? null : (
          <div>
            <div className={`flex items-center gap-2 ${mobileTypography.metadata} text-stone-500`}>
              <span className={`h-2 w-2 rounded-full ${statusDot[month.status]}`} />
              <span>{month.label}</span>
            </div>
            <h2 className={`mt-2 ${mobileTypography.pageTitle} text-stone-950`}>{month.name}</h2>
          </div>
        )}

        <div className="min-w-0">
          <div className="grid border-y border-stone-200 sm:grid-cols-3 sm:gap-8 sm:py-5">
            <DetailMetric label="Inkomster" value={month.income} />
            <DetailMetric label="Fördelat" value={month.expenses} />
            <DetailMetric label="Kvar att fördela" value={remainingAmount} />
          </div>

          <div className="mt-8">
            <PlanningSectionHeading first label="Inkomster och fördelningar" />

            <PlanningPrimaryGroup amount={month.income} label="Inkomster">
              {incomeLines.map((line) => (
                <MobileIncomeLine
                  editingKey={editingKey}
                  editingValue={editingValue}
                  incomeLineKey={line.key}
                  key={line.key}
                  label={labels.incomeLines[line.key]}
                  month={month}
                  nameEditor={nameEditor}
                  onBeginEdit={onBeginEdit}
                  onCancelEdit={onCancelEdit}
                  onChangeEdit={onChangeEdit}
                  onSaveEdit={onSaveEdit}
                />
              ))}
            </PlanningPrimaryGroup>

            <PlanningPrimaryGroup amount={month.expenses} label="Fördelningar">
              {allocationRows.map((allocation) => (
                <MobileAllocationLine
                  allocationKey={allocation.key}
                  editingKey={editingKey}
                  editingValue={editingValue}
                  key={allocation.key}
                  label={labels.allocations[allocation.key]}
                  month={month}
                  nameEditor={nameEditor}
                  onBeginEdit={onBeginEdit}
                  onCancelEdit={onCancelEdit}
                  onChangeEdit={onChangeEdit}
                  onSaveEdit={onSaveEdit}
                  saving={allocation.key === "savings"}
                />
              ))}
            </PlanningPrimaryGroup>

            <PlanningLine amount={remainingAmount} label="Kvar att fördela" result />

            <PlanningSectionHeading label="Räkningskonto och lån" />

            <PlanningGroup
              amount={billAccountAllocation}
              expanded={expandedCostAccount}
              label={labels.allocations.billAccount}
              onToggle={onToggleCostAccount}
            >
              <PlanningLine amount={billAccountAllocation} label="Tillfört konto" />
              <MobileOpeningBalance
                amount={openingBalance}
                editingKey={editingKey}
                editingValue={editingValue}
                onBeginEdit={onBeginEdit}
                onCancelEdit={onCancelEdit}
                onChangeEdit={onChangeEdit}
                onSaveEdit={onSaveEdit}
              />
              <PlanningLine amount={month.startBalance} label={`Startsaldo ${month.label}`} />
              <ExpenseList
                categories={billAccountCategories}
                editingKey={editingKey}
                editingValue={editingValue}
                embedded
                expandedCategories={expandedCategories}
                month={month}
                nameEditor={nameEditor}
                onAddExpense={onAddExpense}
                onBeginEdit={onBeginEdit}
                onCancelEdit={onCancelEdit}
                onChangeEdit={onChangeEdit}
                onRequestDelete={onRequestDelete}
                onSaveEdit={onSaveEdit}
                onToggleCategory={onToggleCategory}
              />
              <PlanningLine amount={billAccountCosts} label="Kostnader" result />
              <PlanningLine amount={month.calculatedBalance} label="Saldo" result />
            </PlanningGroup>

            <PlanningGroup
              amount={mortgageAllocation}
              expanded={expandedMortgage}
              label={labels.allocations.mortgage}
              onToggle={onToggleMortgage}
            >
              <PlanningLine amount={mortgageAllocation} label="Tillfört" />
              {mortgageRows.map((row) => (
                <MobileAreaItemLine
                  areaItemKey={row.key}
                  editingKey={editingKey}
                  editingValue={editingValue}
                  key={row.key}
                  label={labels.areaItems[row.key]}
                  month={month}
                  nameEditor={nameEditor}
                  onBeginEdit={onBeginEdit}
                  onCancelEdit={onCancelEdit}
                  onChangeEdit={onChangeEdit}
                  onSaveEdit={onSaveEdit}
                />
              ))}
              <PlanningLine
                amount={getAreaRemainingAmount(month, "mortgage")}
                label="Kvar att placera"
                result
              />
            </PlanningGroup>

            <PlanningSectionHeading label="Sparande och investeringar" />

            <PlanningGroup
              amount={savingAllocation}
              expanded={expandedSavings}
              label={labels.allocations.savings}
              onToggle={onToggleSavings}
              saving
            >
              <PlanningLine amount={savingAllocation} label="Tillfört" saving />
              {savingsGoals.map((goal) => (
                <MobileSavingsGoalLine
                  editingKey={editingKey}
                  editingValue={editingValue}
                  goal={goal}
                  key={goal.id}
                  month={month}
                  nameEditor={nameEditor}
                  onBeginEdit={onBeginEdit}
                  onCancelEdit={onCancelEdit}
                  onChangeEdit={onChangeEdit}
                  onSaveEdit={onSaveEdit}
                />
              ))}
              <MobileSavingsGoalControl
                draft={savingsGoalDraft}
                onCancel={onCancelSavingsGoal}
                onChange={onChangeSavingsGoalDraft}
                onOpen={onOpenSavingsGoal}
                onSave={onSaveSavingsGoal}
                open={savingsGoalFormOpen}
              />
              <PlanningLine
                amount={getAreaRemainingAmount(month, "savings")}
                label="Kvar att placera"
                result
                saving
              />
            </PlanningGroup>
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileCurrentMonthPlanning(props: Parameters<typeof MonthDetail>[0]) {
  const [expandedSection, setExpandedSection] = useState<MobileCurrentSection | null>(null);
  const {
    editingKey,
    editingValue,
    expandedCategories,
    labels,
    month,
    nameEditor,
    openingBalance,
    savingsGoalDraft,
    savingsGoalFormOpen,
    savingsGoals,
    onAddExpense,
    onBeginEdit,
    onCancelEdit,
    onChangeEdit,
    onRequestDelete,
    onCancelSavingsGoal,
    onChangeSavingsGoalDraft,
    onOpenSavingsGoal,
    onSaveEdit,
    onSaveSavingsGoal,
    onToggleCategory,
  } = props;
  const billAccountCategories = getBillAccountCategories(month);
  const billAccountAllocation = getAllocationAmount(month, "billAccount");
  const billAccountCosts = getBillAccountCosts(month);
  const mortgageAllocation = getAllocationAmount(month, "mortgage");
  const savingAllocation = getAllocationAmount(month, "savings");
  const remainingAmount = getRemainingAmount(month);

  function toggleSection(section: MobileCurrentSection) {
    setExpandedSection((current) => (current === section ? null : section));
  }

  return (
    <section
      aria-labelledby="mobile-current-month-title"
      className={`mx-auto w-full max-w-[1560px] ${mobileRhythm.section} pt-6 sm:pt-8`}
    >
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2
            className={`${mobileTypography.pageTitle} text-stone-950`}
            id="mobile-current-month-title"
          >
            Den här månaden
          </h2>
          <p
            className={`${mobileRhythm.headingToDescription} ${mobileTypography.metadata} text-stone-500`}
          >
            Börja med överblicken och öppna det du vill förstå eller ändra.
          </p>
        </div>
        <div className={`mb-0.5 flex shrink-0 items-center gap-2 ${mobileTypography.metadata} text-stone-500`}>
          <span className={`h-2 w-2 rounded-full ${statusDot[props.month.status]}`} />
          <span>{props.month.name}</span>
        </div>
      </div>

      <div className={`${mobileRhythm.headingToContent} overflow-hidden rounded-[20px] border border-stone-200/80 bg-white px-4 shadow-[0_12px_36px_rgba(28,25,23,0.03)] sm:px-6`}>
        <MobileCurrentDisclosure
          amount={month.income}
          expanded={expandedSection === "income"}
          id="income"
          illustrationSrc="/images/mobile-insights/income.webp"
          label="Inkomster"
          onToggle={() => toggleSection("income")}
        >
          {incomeLines.map((line) => (
            <MobileIncomeLine
              editingKey={editingKey}
              editingValue={editingValue}
              incomeLineKey={line.key}
              key={line.key}
              label={labels.incomeLines[line.key]}
              month={month}
              nameEditor={nameEditor}
              onBeginEdit={onBeginEdit}
              onCancelEdit={onCancelEdit}
              onChangeEdit={onChangeEdit}
              onSaveEdit={onSaveEdit}
            />
          ))}
        </MobileCurrentDisclosure>

        <MobileCurrentDisclosure
          amount={month.expenses}
          expanded={expandedSection === "allocations"}
          id="allocations"
          illustrationSrc="/images/mobile-insights/allocations.png"
          label="Fördelningar"
          onToggle={() => toggleSection("allocations")}
        >
          {allocationRows.map((allocation) => (
            <MobileAllocationLine
              allocationKey={allocation.key}
              editingKey={editingKey}
              editingValue={editingValue}
              key={allocation.key}
              label={labels.allocations[allocation.key]}
              month={month}
              nameEditor={nameEditor}
              onBeginEdit={onBeginEdit}
              onCancelEdit={onCancelEdit}
              onChangeEdit={onChangeEdit}
              onSaveEdit={onSaveEdit}
              saving={allocation.key === "savings"}
            />
          ))}
        </MobileCurrentDisclosure>

        <PlanningLine amount={remainingAmount} label="Kvar att fördela" result />

        <MobileCurrentDisclosure
          amount={billAccountAllocation}
          expanded={expandedSection === "bills"}
          id="bills"
          illustrationSrc="/images/mobile-insights/bills.webp"
          label={labels.allocations.billAccount}
          onToggle={() => toggleSection("bills")}
        >
          <PlanningLine amount={billAccountAllocation} label="Tillfört konto" />
          <MobileOpeningBalance
            amount={openingBalance}
            editingKey={editingKey}
            editingValue={editingValue}
            onBeginEdit={onBeginEdit}
            onCancelEdit={onCancelEdit}
            onChangeEdit={onChangeEdit}
            onSaveEdit={onSaveEdit}
          />
          <PlanningLine amount={month.startBalance} label={`Startsaldo ${month.label}`} />
          <ExpenseList
            categories={billAccountCategories}
            editingKey={editingKey}
            editingValue={editingValue}
            embedded
            expandedCategories={expandedCategories}
            month={month}
            nameEditor={nameEditor}
            onAddExpense={onAddExpense}
            onBeginEdit={onBeginEdit}
            onCancelEdit={onCancelEdit}
            onChangeEdit={onChangeEdit}
            onRequestDelete={onRequestDelete}
            onSaveEdit={onSaveEdit}
            onToggleCategory={onToggleCategory}
          />
          <PlanningLine amount={billAccountCosts} label="Kostnader" result />
          <PlanningLine amount={month.calculatedBalance} label="Saldo" result />
        </MobileCurrentDisclosure>

        <MobileCurrentDisclosure
          amount={mortgageAllocation}
          expanded={expandedSection === "mortgage"}
          id="mortgage"
          illustrationSrc="/images/mobile-insights/mortgage.png"
          label={labels.allocations.mortgage}
          onToggle={() => toggleSection("mortgage")}
        >
          <PlanningLine amount={mortgageAllocation} label="Tillfört" />
          {mortgageRows.map((row) => (
            <MobileAreaItemLine
              areaItemKey={row.key}
              editingKey={editingKey}
              editingValue={editingValue}
              key={row.key}
              label={labels.areaItems[row.key]}
              month={month}
              nameEditor={nameEditor}
              onBeginEdit={onBeginEdit}
              onCancelEdit={onCancelEdit}
              onChangeEdit={onChangeEdit}
              onSaveEdit={onSaveEdit}
            />
          ))}
          <PlanningLine
            amount={getAreaRemainingAmount(month, "mortgage")}
            label="Kvar att placera"
            result
          />
        </MobileCurrentDisclosure>

        <MobileCurrentDisclosure
          amount={savingAllocation}
          expanded={expandedSection === "savings"}
          id="savings"
          illustrationSrc="/images/mobile-insights/savings.webp"
          label={labels.allocations.savings}
          onToggle={() => toggleSection("savings")}
          saving
        >
          <PlanningLine amount={savingAllocation} label="Tillfört" saving />
          {savingsGoals.map((goal) => (
            <MobileSavingsGoalLine
              editingKey={editingKey}
              editingValue={editingValue}
              goal={goal}
              key={goal.id}
              month={month}
              nameEditor={nameEditor}
              onBeginEdit={onBeginEdit}
              onCancelEdit={onCancelEdit}
              onChangeEdit={onChangeEdit}
              onSaveEdit={onSaveEdit}
            />
          ))}
          <MobileSavingsGoalControl
            draft={savingsGoalDraft}
            onCancel={onCancelSavingsGoal}
            onChange={onChangeSavingsGoalDraft}
            onOpen={onOpenSavingsGoal}
            onSave={onSaveSavingsGoal}
            open={savingsGoalFormOpen}
          />
          <PlanningLine
            amount={getAreaRemainingAmount(month, "savings")}
            label="Kvar att placera"
            result
            saving
          />
        </MobileCurrentDisclosure>
      </div>
    </section>
  );
}

export default function Home() {
  const [planningData, setPlanningData] = useState(emptyPlanningData);
  const [cloudLoadState, setCloudLoadState] = useState<CloudLoadState>("loading");
  const [cloudSaveState, setCloudSaveState] = useState<CloudSaveState>("idle");
  const [cloudMessage, setCloudMessage] = useState("Hämtar din ekonomi…");
  const [cloudRevision, setCloudRevision] = useState<number | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [importCandidate, setImportCandidate] = useState<PlanningData | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [currentMonthId, setCurrentMonthId] = useState<string | null>(null);
  const [selectedMonthId, setSelectedMonthId] = useState(defaultMonthId);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    [`${defaultMonthId}:boende`]: true,
    [`${defaultMonthId}:bil`]: true,
    [`${defaultMonthId}:streaming`]: true,
  });
  const [expandedMortgage, setExpandedMortgage] = useState(false);
  const [expandedSavings, setExpandedSavings] = useState(false);
  const [expandedCostAccount, setExpandedCostAccount] = useState(false);
  const [expandedGridCategories, setExpandedGridCategories] = useState<Record<string, boolean>>({});
  const [editingTarget, setEditingTarget] = useState<AmountTarget | null>(null);
  const [editingInitialAmount, setEditingInitialAmount] = useState(0);
  const [editingValue, setEditingValue] = useState("");
  const [editingNameTarget, setEditingNameTarget] = useState<NameTarget | null>(null);
  const [editingNameInitialValue, setEditingNameInitialValue] = useState("");
  const [editingNameValue, setEditingNameValue] = useState("");
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [annualPlanningOpen, setAnnualPlanningOpen] = useState(false);
  const [savingsGoalFormOpen, setSavingsGoalFormOpen] = useState(false);
  const [savingsGoalDraft, setSavingsGoalDraft] = useState("");
  const [onboardingStarted, setOnboardingStarted] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [guidedSetupOpen, setGuidedSetupOpen] = useState(false);
  const [guidedSetupInitialGuide, setGuidedSetupInitialGuide] =
    useState<GuidedSetupGuideId | null>(null);
  const [addDraft, setAddDraft] = useState<AddExpenseDraft>({
    categoryId: "bil",
    description: "",
    amount: "",
    monthId: defaultMonthId,
    frequency: "once",
  });

  useEffect(() => {
    const storedData = readStoredPlanningData();
    const activeMonthId = getCurrentMonthId();
    let cancelled = false;

    if (activeMonthId) {
      setCurrentMonthId(activeMonthId);
      setSelectedMonthId(activeMonthId);
      setExpandedCategories({
        [`${activeMonthId}:boende`]: true,
        [`${activeMonthId}:bil`]: true,
        [`${activeMonthId}:streaming`]: true,
      });
      setAddDraft((current) => ({ ...current, monthId: activeMonthId }));
    }

    async function loadPlanningYear() {
      try {
        const serverPlanningYear = await loadCloudPlanningYear();

        if (cancelled) {
          return;
        }

        if (serverPlanningYear) {
          setPlanningData(serverPlanningYear.data);
          setCloudRevision(serverPlanningYear.revision);
          setSavedSnapshot(JSON.stringify(serverPlanningYear.data));
          savePlanningData(serverPlanningYear.data);
          setCloudLoadState("ready");
          setCloudMessage("");
          return;
        }

        const hasLocalChanges =
          storedData && JSON.stringify(storedData) !== JSON.stringify(emptyPlanningData);
        if (hasLocalChanges && !readImportDecision()) {
          setPlanningData(storedData);
          setImportCandidate(storedData);
          setCloudLoadState("import");
          setCloudMessage("Välj om din lokala data ska importeras.");
          return;
        }

        const created = await saveCloudPlanningYear(emptyPlanningData, null);
        if (cancelled) {
          return;
        }

        setPlanningData(created.data);
        setCloudRevision(created.revision);
        setSavedSnapshot(JSON.stringify(created.data));
        savePlanningData(created.data);
        setCloudLoadState("ready");
        setCloudMessage("Sparat i molnet");
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof PlanningApiError && error.status === 409) {
          try {
            const serverPlanningYear = await loadCloudPlanningYear();
            if (serverPlanningYear && !cancelled) {
              setPlanningData(serverPlanningYear.data);
              setCloudRevision(serverPlanningYear.revision);
              setSavedSnapshot(JSON.stringify(serverPlanningYear.data));
              savePlanningData(serverPlanningYear.data);
              setCloudLoadState("ready");
              setCloudMessage("");
              return;
            }
          } catch {
            // The calm load error below is used for a failed race readback.
          }
        }

        setCloudLoadState("error");
        setCloudMessage("Din ekonomi kunde inte hämtas. Försök ladda om sidan om en liten stund.");
      }
    }

    void loadPlanningYear();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (cloudLoadState === "ready") {
      savePlanningData(planningData);
    }
  }, [planningData, cloudLoadState]);

  const currentSnapshot = JSON.stringify(planningData);
  const hasUnsavedChanges = hasUnsavedWorkspaceChanges(
    cloudLoadState === "ready",
    savedSnapshot,
    currentSnapshot,
  );

  const months = useMemo(() => buildForecastMonths(planningData), [planningData]);
  const largestCosts = useMemo(() => getLargestCosts(planningData), [planningData]);
  const labels = useMemo(() => getResolvedPlanningLabels(planningData), [planningData]);
  const savingsGoals = useMemo(
    () =>
      getSavingsGoals(planningData).map((goal) => ({
        id: goal.id,
        name: planningData.labels?.expenseItems?.[goal.id] ?? goal.name,
      })),
    [planningData],
  );

  const selectedMonth =
    months.find((month) => month.id === selectedMonthId) ?? months[0];
  const currentMonth =
    months.find((month) => month.id === currentMonthId) ?? selectedMonth;
  const upcomingInsights = useMemo(
    () =>
      buildMobileUpcomingInsights({
        currentMonthId: currentMonth.id,
        monthIds,
        months: months.map((month) => ({
          costTotal: month.categories
            .filter((category) => category.id !== "sparande")
            .reduce((total, category) => total + parseAmount(category.amount), 0),
          id: month.id,
          income: parseAmount(month.income),
          name: month.name,
          remaining: parseSignedAmount(getRemainingAmount(month)),
        })),
        planningData,
      }),
    [currentMonth.id, months, planningData],
  );
  const carPlanning = useMemo(
    () => getCarPlanningEconomics(planningData, currentMonth.id),
    [currentMonth.id, planningData],
  );
  const savingsOverview = useMemo(() => getSavingsOverview(planningData), [planningData]);
  const completionSuggestion = useMemo(
    () => getPlanningCompletionSuggestion(planningData),
    [planningData],
  );
  const savingsPreview = {
    monthlyIncome: savingsOverview.monthlyIncome,
    monthlySavings: savingsOverview.monthlySavings,
  };

  const categoryOptions = useMemo(
    () =>
      getBillAccountCategories(selectedMonth).map((category) => ({
        id: category.id!,
        label: category.name,
      })),
    [selectedMonth],
  );

  function applyCloudPlanningYear(result: CloudPlanningYear, message = "") {
    setPlanningData(result.data);
    setCloudRevision(result.revision);
    setSavedSnapshot(JSON.stringify(result.data));
    savePlanningData(result.data);
    setImportCandidate(null);
    setCloudLoadState("ready");
    setCloudSaveState("saved");
    setCloudMessage(message);
  }

  async function resolveLocalImport(importLocalData: boolean) {
    if (!importCandidate || importBusy) {
      return;
    }

    setImportBusy(true);
    setCloudMessage(importLocalData ? "Importerar lokal data…" : "Skapar ditt planeringsår…");

    try {
      const result = await saveCloudPlanningYear(
        importLocalData ? importCandidate : emptyPlanningData,
        null,
      );
      saveImportDecision(importLocalData ? "imported" : "declined");
      applyCloudPlanningYear(
        result,
        importLocalData ? "Lokal data importerad och sparad" : "Planeringsåret är klart",
      );
    } catch (error) {
      if (error instanceof PlanningApiError && error.status === 409) {
        try {
          const serverPlanningYear = await loadCloudPlanningYear();
          if (serverPlanningYear) {
            applyCloudPlanningYear(serverPlanningYear, "Planeringsåret hämtades från molnet");
            return;
          }
        } catch {
          // Keep the import choice open and show the calm error below.
        }
      }

      setCloudMessage("Ditt val kunde inte sparas. Försök igen om en liten stund.");
    } finally {
      setImportBusy(false);
    }
  }

  async function saveToCloud() {
    if (
      cloudLoadState !== "ready" ||
      cloudRevision === null ||
      !hasUnsavedChanges ||
      cloudSaveState === "saving" ||
      cloudSaveState === "conflict"
    ) {
      return;
    }

    const dataToSave = planningData;
    const snapshotToSave = JSON.stringify(dataToSave);
    setCloudSaveState("saving");
    setCloudMessage("Sparar…");

    try {
      const result = await saveCloudPlanningYear(dataToSave, cloudRevision);
      setCloudRevision(result.revision);
      setSavedSnapshot(snapshotToSave);
      setCloudSaveState("saved");
      setCloudMessage("Sparat i molnet");
    } catch (error) {
      if (error instanceof PlanningApiError && error.status === 409) {
        setCloudSaveState("conflict");
        setCloudMessage("Nyare data finns i molnet. Ladda om sidan innan du sparar igen.");
        return;
      }

      setCloudSaveState("error");
      setCloudMessage("Det gick inte att spara. Dina ändringar finns kvar på den här enheten.");
    }
  }

  function selectMonth(monthId: string) {
    setSelectedMonthId(monthId);
    setAddDraft((current) => ({ ...current, monthId }));
  }

  function toggleCategory(monthId: string, categoryId: string) {
    const key = `${monthId}:${categoryId}`;

    setExpandedCategories((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function toggleGridCategory(categoryId: string) {
    setExpandedGridCategories((current) => ({
      ...current,
      [categoryId]: !current[categoryId],
    }));
  }

  function beginEdit(target: AmountTarget, amount: string) {
    setEditingTarget(target);
    setEditingInitialAmount(parseAmount(amount));
    setEditingValue(amount.replace(/\D/g, ""));
  }

  function clearEdit() {
    setEditingTarget(null);
    setEditingInitialAmount(0);
    setEditingValue("");
  }

  function cancelEdit() {
    const key = editingTarget ? amountKey(editingTarget) : null;
    clearEdit();

    if (key) {
      focusAmountCell(key);
    }
  }

  function beginNameEdit(target: NameTarget, label: string) {
    setEditingNameTarget(target);
    setEditingNameInitialValue(label);
    setEditingNameValue(label);
  }

  function cancelNameEdit() {
    const key = editingNameTarget ? nameKey(editingNameTarget) : null;
    setEditingNameTarget(null);
    setEditingNameInitialValue("");
    setEditingNameValue("");

    if (key) {
      focusNameCell(key);
    }
  }

  function saveNameEdit() {
    if (!editingNameTarget) {
      return;
    }

    const target = editingNameTarget;
    const nextLabel = normalizeRowName(editingNameValue);
    const previousLabel = normalizeRowName(editingNameInitialValue);

    setEditingNameTarget(null);
    setEditingNameInitialValue("");
    setEditingNameValue("");

    if (!nextLabel || nextLabel === previousLabel) {
      return;
    }

    setPlanningData((currentData) => updatePlanningLabel(currentData, target, nextLabel));
  }

  function saveEdit() {
    if (!editingTarget) {
      return;
    }

    const nextAmount = formatAmountInput(editingValue);
    const target = editingTarget;
    const key = amountKey(target);

    if (parseAmount(nextAmount) === editingInitialAmount) {
      clearEdit();
      focusAmountCell(key);
      return;
    }

    if (target.type === "openingBalance") {
      setPlanningData((currentData) => updatePlanningAmount(currentData, target, nextAmount, "single"));
      clearEdit();
      focusAmountCell(key);
      return;
    }

    setPendingEdit({ target, amount: nextAmount });
    setScopeDialogOpen(true);
    clearEdit();
  }

  function applyPendingEdit(scope: ChangeScope) {
    if (!pendingEdit) {
      setScopeDialogOpen(false);
      return;
    }

    const key = amountKey(pendingEdit.target);

    setPlanningData((currentData) =>
      updatePlanningAmount(currentData, pendingEdit.target, pendingEdit.amount, scope),
    );

    setPendingEdit(null);
    setScopeDialogOpen(false);
    focusAmountCell(key);
  }

  function cancelPendingEdit() {
    const key = pendingEdit ? amountKey(pendingEdit.target) : null;
    setPendingEdit(null);
    setScopeDialogOpen(false);

    if (key) {
      focusAmountCell(key);
    }
  }

  function requestDelete(target: DeleteTarget) {
    const item = findExpenseItem(planningData, target);

    if (!item) {
      return;
    }

    setPendingDelete({
      target,
      recurring: hasMultipleOccurrences(item),
    });
  }

  function cancelDelete() {
    setPendingDelete(null);
  }

  function confirmDelete(scope: ChangeScope) {
    if (!pendingDelete) {
      return;
    }

    setPlanningData((currentData) => removePlanningExpenseItem(currentData, pendingDelete.target, scope));
    setPendingDelete(null);
  }

  function openAddDialog(categoryId?: string, monthId = selectedMonth.id) {
    setAddDraft({
      categoryId:
        categoryId && categoryOptions.some((category) => category.id === categoryId)
          ? categoryId
          : categoryOptions[0]?.id ?? "boende",
      description: "",
      amount: "",
      monthId,
      frequency: "once",
    });
    setAddDialogOpen(true);
  }

  function saveAddedExpense() {
    if (!isValidAddExpenseDraft(addDraft, categoryOptions.map((category) => category.id))) {
      return;
    }

    setPlanningData((currentData) => addExpenseToPlanningData(currentData, addDraft));

    setExpandedCategories((current) => ({
      ...current,
      [`${addDraft.monthId}:${addDraft.categoryId}`]: true,
    }));
    if (!directAllocationCategoryIds.has(addDraft.categoryId)) {
      setExpandedCostAccount(true);
    }
    setExpandedGridCategories((current) => ({
      ...current,
      [addDraft.categoryId]: true,
    }));
    setSelectedMonthId(addDraft.monthId);
    setAddDialogOpen(false);
  }

  function openSavingsGoalForm() {
    setSavingsGoalDraft("");
    setSavingsGoalFormOpen(true);
  }

  function cancelSavingsGoalForm() {
    setSavingsGoalDraft("");
    setSavingsGoalFormOpen(false);
  }

  function saveSavingsGoal() {
    if (!savingsGoalDraft.trim()) {
      return;
    }

    setPlanningData((currentData) => createSavingsGoal(currentData, savingsGoalDraft));
    setExpandedSavings(true);
    setSavingsGoalDraft("");
    setSavingsGoalFormOpen(false);
  }

  function resetSeedData() {
    setPlanningData(seedPlanningData);
    savePlanningData(seedPlanningData);
    setSelectedMonthId(currentMonthId ?? defaultMonthId);
    setExpandedMortgage(false);
    setExpandedSavings(false);
    setExpandedCostAccount(false);
    setExpandedGridCategories({});
    setEditingNameTarget(null);
    setEditingNameInitialValue("");
    setEditingNameValue("");
    setPendingEdit(null);
    setPendingDelete(null);
    setScopeDialogOpen(false);
    setAddDialogOpen(false);
    setAnnualPlanningOpen(false);
    setSavingsGoalDraft("");
    setSavingsGoalFormOpen(false);
    setOnboardingStarted(false);
    setOnboardingDismissed(true);
    setGuidedSetupOpen(false);
    setGuidedSetupInitialGuide(null);
  }

  function completeOnboarding() {
    setPlanningData((currentData) => finalizePlanningOnboarding(currentData));
    setOnboardingStarted(false);
    setOnboardingDismissed(true);
  }

  function applyGuidedSetupExpense(
    templateId: string,
    value: {
      amount: number;
      frequency: GuidedSetupFrequency;
      paymentMonth: string;
    },
  ) {
    setPlanningData((currentData) =>
      upsertGuidedSetupExpense(currentData, templateId, value),
    );
  }

  function openGuidedSetup(guideId?: GuidedSetupGuideId) {
    setGuidedSetupInitialGuide(guideId ?? null);
    setGuidedSetupOpen(true);
  }

  function closeGuidedSetup() {
    setGuidedSetupOpen(false);
    setGuidedSetupInitialGuide(null);
  }

  const nameEditor: NameEditor = {
    editingKey: editingNameTarget ? nameKey(editingNameTarget) : null,
    editingValue: editingNameValue,
    onBeginEdit: beginNameEdit,
    onCancelEdit: cancelNameEdit,
    onChangeEdit: setEditingNameValue,
    onSaveEdit: saveNameEdit,
  };

  if (cloudLoadState === "loading" || cloudLoadState === "error") {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[#f7f5ef] text-stone-950">
        <header className="border-b border-stone-200/70 bg-[#faf9f6]/80 px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1560px] items-center">
            <div className="flex items-center gap-2.5" aria-label="Fameko">
              <div
                aria-hidden="true"
                className="h-8 w-8 shrink-0 bg-center bg-no-repeat"
                style={{
                  backgroundImage: "url('/brand/fameko-wordmark.png.png')",
                  backgroundSize: "118%",
                }}
              />
              <p className="text-base font-semibold leading-none text-[#1d252d]">Fameko</p>
            </div>
          </div>
        </header>
        <section className="mx-auto grid min-h-[60vh] max-w-lg place-items-center px-6 text-center">
          <div>
            <p className="text-sm font-medium text-stone-500">
              {cloudLoadState === "loading" ? "Fameko" : "Molnlagring"}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-stone-950">
              {cloudLoadState === "loading" ? "Hämtar din ekonomi" : "Din ekonomi kunde inte hämtas"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-stone-500" role="status">
              {cloudMessage}
            </p>
          </div>
        </section>
      </main>
    );
  }

  const showOnboarding =
    cloudLoadState === "ready" &&
    (onboardingStarted ||
      (!onboardingDismissed && shouldOfferPlanningOnboarding(planningData)));

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f5ef] text-stone-950">
      <header className="border-b border-stone-200/70 bg-[#faf9f6]/80 px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1560px] items-center">
          <div className="flex items-center gap-2.5" aria-label="Fameko">
            <div
              aria-hidden="true"
              className="h-8 w-8 shrink-0 bg-center bg-no-repeat"
              style={{
                backgroundImage: "url('/brand/fameko-wordmark.png.png')",
                backgroundSize: "118%",
              }}
            />
            <p className="text-base font-semibold leading-none text-[#1d252d]">Fameko</p>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {showDevelopmentReset ? (
              <button
                className="hidden rounded-md px-2 py-1 text-xs text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 md:block"
                onClick={resetSeedData}
                type="button"
              >
                Återställ testdata
              </button>
            ) : null}
            <WorkspaceSaveButton
              disabled={
                cloudLoadState !== "ready" ||
                !hasUnsavedChanges ||
                cloudSaveState === "saving" ||
                cloudSaveState === "conflict"
              }
              hasUnsavedChanges={hasUnsavedChanges}
              onSave={() => void saveToCloud()}
              operationState={cloudSaveState}
            />
          </div>
        </div>
      </header>
      <WorkspaceSaveStatusBar
        hasUnsavedChanges={hasUnsavedChanges}
        message={cloudMessage}
        operationState={cloudSaveState}
        ready={cloudLoadState === "ready"}
      />

      {showOnboarding ? (
        onboardingStarted ? (
          <OnboardingFlow
            data={planningData}
            onCarChange={(carData) =>
              setPlanningData((currentData) => ({ ...currentData, carData }))
            }
            onComplete={completeOnboarding}
            onHousingChange={(housingData) =>
              setPlanningData((currentData) => ({ ...currentData, housingData }))
            }
            onIncomeChange={(key, value) =>
              setPlanningData((currentData) =>
                setOnboardingIncomeAmount(currentData, key, value),
              )
            }
            onSavingsChange={(key, value) =>
              setPlanningData((currentData) =>
                setOnboardingSavingsAmount(currentData, key, value),
              )
            }
          />
        ) : (
          <OnboardingWelcome onStart={() => setOnboardingStarted(true)} />
        )
      ) : guidedSetupOpen ? (
        <GuidedSetupPlatform
          data={planningData}
          initialGuideId={guidedSetupInitialGuide ?? undefined}
          onApply={applyGuidedSetupExpense}
          onClose={closeGuidedSetup}
          onIncomeChange={(key, value) =>
            setPlanningData((currentData) =>
              setOnboardingIncomeAmount(currentData, key, value),
            )
          }
          onSavingsChange={(key, value) =>
            setPlanningData((currentData) =>
              setOnboardingSavingsAmount(currentData, key, value),
            )
          }
        />
      ) : (
        <>
      <section
        aria-labelledby="workspace-hero-title"
        className="mx-auto w-full max-w-[1560px] px-4 pb-6 pt-4 sm:px-6 sm:pb-7 sm:pt-5 lg:px-8 lg:pt-6"
      >
        <div className="relative h-[340px] overflow-hidden rounded-[22px] border border-white/70 bg-stone-200 shadow-[0_18px_56px_rgba(28,25,23,0.065)] sm:h-[360px] sm:rounded-[26px] lg:h-[380px] xl:h-[396px]">
          <Image
            alt=""
            aria-hidden="true"
            className="object-cover object-[68%_52%] sm:object-[47%_52%]"
            fill
            priority
            sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1024px) calc(100vw - 48px), min(1496px, calc(100vw - 64px))"
            src="/images/dashboard/hero-dashboard.webp"
            unoptimized
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#f7f5ef]/95 via-[#f7f5ef]/60 via-[56%] to-[#f7f5ef]/10 sm:via-[#f7f5ef]/45 sm:to-transparent lg:via-[#f7f5ef]/30"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#f7f5ef]/20 via-transparent to-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]"
          />

          <div className="relative z-10 grid h-full content-center gap-5 px-5 py-6 sm:px-8 sm:py-7 lg:grid-cols-[minmax(0,1fr)_minmax(460px,560px)] lg:items-center lg:gap-10 lg:px-12 xl:px-16">
            <div className="max-w-[520px]">
              <h1
                className="max-w-5xl text-[28px] font-semibold leading-[1.08] tracking-[-0.035em] text-stone-950 sm:text-3xl lg:text-4xl"
                id="workspace-hero-title"
              >
              Ditt ekonomiska år
              </h1>
              <p className="mt-4 max-w-[480px] text-sm leading-6 text-stone-700 sm:text-[15px]">
                Planera hela årets ekonomi och se hur dina beslut påverkar resten av året.
              </p>
              <p className="mt-3 text-xs text-stone-500">Alla belopp visas efter skatt.</p>
            </div>

            <div className="hidden w-full translate-y-3 self-center lg:block lg:max-w-[560px] lg:justify-self-end">
              <MonthlySnapshot month={currentMonth} />
            </div>
          </div>
        </div>
      </section>

      <EconomicOverview month={currentMonth} />

      <div className="hidden lg:block">
        <YearNavigation />
        <YearOverview
          currentMonthId={currentMonthId}
          editingKey={editingTarget ? amountKey(editingTarget) : null}
          editingValue={editingValue}
          expandedCostAccount={expandedCostAccount}
          expandedGridCategories={expandedGridCategories}
          expandedMortgage={expandedMortgage}
          expandedSavings={expandedSavings}
          labels={labels}
          months={months}
          nameEditor={nameEditor}
          savingsGoalDraft={savingsGoalDraft}
          savingsGoalFormOpen={savingsGoalFormOpen}
          savingsGoals={savingsGoals}
          onAddExpense={openAddDialog}
          onBeginEdit={beginEdit}
          onCancelEdit={cancelEdit}
          onChangeEdit={setEditingValue}
          onRequestDelete={requestDelete}
          onCancelSavingsGoal={cancelSavingsGoalForm}
          onChangeSavingsGoalDraft={setSavingsGoalDraft}
          onOpenSavingsGoal={openSavingsGoalForm}
          onSelectMonth={selectMonth}
          onSaveEdit={saveEdit}
          onSaveSavingsGoal={saveSavingsGoal}
          onToggleCostAccount={() => setExpandedCostAccount((current) => !current)}
          onToggleGridCategory={toggleGridCategory}
          onToggleMortgage={() => setExpandedMortgage((current) => !current)}
          onToggleSavings={() => setExpandedSavings((current) => !current)}
          selectedMonthId={selectedMonth.id}
        />
      </div>

      <div className="lg:hidden">
        <MobileCurrentMonthPlanning
          editingKey={editingTarget ? amountKey(editingTarget) : null}
          editingValue={editingValue}
          expandedCategories={expandedCategories}
          expandedCostAccount={expandedCostAccount}
          expandedMortgage={expandedMortgage}
          expandedSavings={expandedSavings}
          labels={labels}
          month={currentMonth}
          nameEditor={nameEditor}
          openingBalance={months[0].startBalance}
          savingsGoalDraft={savingsGoalDraft}
          savingsGoalFormOpen={savingsGoalFormOpen}
          savingsGoals={savingsGoals}
          onAddExpense={(categoryId) => openAddDialog(categoryId, currentMonth.id)}
          onBeginEdit={beginEdit}
          onCancelEdit={cancelEdit}
          onChangeEdit={setEditingValue}
          onRequestDelete={requestDelete}
          onCancelSavingsGoal={cancelSavingsGoalForm}
          onChangeSavingsGoalDraft={setSavingsGoalDraft}
          onOpenSavingsGoal={openSavingsGoalForm}
          onSaveEdit={saveEdit}
          onSaveSavingsGoal={saveSavingsGoal}
          onToggleCategory={toggleCategory}
          onToggleCostAccount={() => setExpandedCostAccount((current) => !current)}
          onToggleMortgage={() => setExpandedMortgage((current) => !current)}
          onToggleSavings={() => setExpandedSavings((current) => !current)}
        />
        <MobileUpcomingInsights insights={upcomingInsights} />
        <MobileLargestCosts costs={largestCosts} />
      </div>

      <PersonalEconomySection
        carData={planningData.carData}
        carPlanning={carPlanning}
        housingData={planningData.housingData}
        savingsPreview={savingsPreview}
      />

      <GuidedSetupEntryPoint
        onStart={openGuidedSetup}
        suggestion={completionSuggestion}
      />

      <section
        aria-label="Fullständig årsplanering"
        className="mx-auto w-full max-w-[1560px] px-4 pb-3 pt-0 sm:px-6 lg:hidden"
      >
        <button
          aria-controls="mobile-full-year-planning"
          aria-expanded={annualPlanningOpen}
          className={`flex ${mobileRhythm.disclosureButton} w-full items-center justify-between gap-4 rounded-[16px] border border-stone-300 bg-white px-5 text-left ${mobileTypography.sectionTitle} text-stone-900 shadow-[0_10px_30px_rgba(28,25,23,0.025)] transition hover:border-stone-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900`}
          onClick={() => setAnnualPlanningOpen((open) => !open)}
          type="button"
        >
          <span>{annualPlanningOpen ? "Dölj hela årsplaneringen" : "Visa hela årsplaneringen"}</span>
          <MobileDisclosureChevron expanded={annualPlanningOpen} />
        </button>

        {annualPlanningOpen ? (
          <div className="-mx-4 mt-7 sm:-mx-6" id="mobile-full-year-planning">
            <YearNavigation />
            <YearOverview
              currentMonthId={currentMonthId}
              editingKey={editingTarget ? amountKey(editingTarget) : null}
              editingValue={editingValue}
              expandedCostAccount={expandedCostAccount}
              expandedGridCategories={expandedGridCategories}
              expandedMortgage={expandedMortgage}
              expandedSavings={expandedSavings}
              labels={labels}
              months={months}
              nameEditor={nameEditor}
              savingsGoalDraft={savingsGoalDraft}
              savingsGoalFormOpen={savingsGoalFormOpen}
              savingsGoals={savingsGoals}
              onAddExpense={openAddDialog}
              onBeginEdit={beginEdit}
              onCancelEdit={cancelEdit}
              onChangeEdit={setEditingValue}
              onRequestDelete={requestDelete}
              onCancelSavingsGoal={cancelSavingsGoalForm}
              onChangeSavingsGoalDraft={setSavingsGoalDraft}
              onOpenSavingsGoal={openSavingsGoalForm}
              onSelectMonth={selectMonth}
              onSaveEdit={saveEdit}
              onSaveSavingsGoal={saveSavingsGoal}
              onToggleCostAccount={() => setExpandedCostAccount((current) => !current)}
              onToggleGridCategory={toggleGridCategory}
              onToggleMortgage={() => setExpandedMortgage((current) => !current)}
              onToggleSavings={() => setExpandedSavings((current) => !current)}
              selectedMonthId={selectedMonth.id}
            />
            <MonthDetail
              editingKey={editingTarget ? amountKey(editingTarget) : null}
              editingValue={editingValue}
              expandedCategories={expandedCategories}
              expandedCostAccount={expandedCostAccount}
              expandedMortgage={expandedMortgage}
              expandedSavings={expandedSavings}
              labels={labels}
              month={selectedMonth}
              nameEditor={nameEditor}
              openingBalance={months[0].startBalance}
              savingsGoalDraft={savingsGoalDraft}
              savingsGoalFormOpen={savingsGoalFormOpen}
              savingsGoals={savingsGoals}
              onAddExpense={openAddDialog}
              onBeginEdit={beginEdit}
              onCancelEdit={cancelEdit}
              onChangeEdit={setEditingValue}
              onRequestDelete={requestDelete}
              onCancelSavingsGoal={cancelSavingsGoalForm}
              onChangeSavingsGoalDraft={setSavingsGoalDraft}
              onOpenSavingsGoal={openSavingsGoalForm}
              onSaveEdit={saveEdit}
              onSaveSavingsGoal={saveSavingsGoal}
              onToggleCategory={toggleCategory}
              onToggleCostAccount={() => setExpandedCostAccount((current) => !current)}
              onToggleMortgage={() => setExpandedMortgage((current) => !current)}
              onToggleSavings={() => setExpandedSavings((current) => !current)}
            />
          </div>
        ) : null}
      </section>

      {completionSuggestion ? (
        <WorkspaceCompletionHint
          onAction={() => openGuidedSetup(completionSuggestion.guideId)}
          suggestion={completionSuggestion}
        />
      ) : null}

      <ProductFooter />
        </>
      )}

      {scopeDialogOpen ? (
        <ScopeDialog
          monthId={
            pendingEdit && pendingEdit.target.type !== "openingBalance"
              ? pendingEdit.target.monthId
              : selectedMonth.id
          }
          onCancel={cancelPendingEdit}
          onConfirm={applyPendingEdit}
        />
      ) : null}

      {pendingDelete?.recurring ? (
        <DeleteScopeDialog
          onCancel={cancelDelete}
          onConfirm={confirmDelete}
          target={pendingDelete.target}
        />
      ) : null}

      {pendingDelete && !pendingDelete.recurring ? (
        <DeleteConfirmDialog
          itemName={pendingDelete.target.itemLabel}
          onCancel={cancelDelete}
          onConfirm={() => confirmDelete("single")}
        />
      ) : null}

      {addDialogOpen ? (
        <AddExpenseDialog
          categories={categoryOptions}
          draft={addDraft}
          months={months}
          onChangeDraft={setAddDraft}
          onClose={() => setAddDialogOpen(false)}
          onSave={saveAddedExpense}
        />
      ) : null}

      {cloudLoadState === "import" && importCandidate ? (
        <ImportPlanningDataDialog
          busy={importBusy}
          onImport={() => void resolveLocalImport(true)}
          onSkip={() => void resolveLocalImport(false)}
        />
      ) : null}
    </main>
  );
}
