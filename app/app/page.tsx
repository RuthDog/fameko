"use client";

import { useEffect, useMemo, useState } from "react";

type Status = "green" | "yellow" | "red";
type ChangeScope = "single" | "future";
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
type CloudSaveState = "idle" | "saving" | "saved" | "error" | "conflict";

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
  short: {
    startBalance: string;
    income: string;
    expenses: string;
    calculatedBalance: string;
  };
  categories: ForecastExpenseCategory[];
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

const savingsRows: { key: AreaItemKey; label: string }[] = [
  { key: "savingsBuffer", label: "Buffert" },
  { key: "savingsVacation", label: "Semester" },
  { key: "savingsIsk", label: "ISK" },
  { key: "savingsPension", label: "Pension" },
];

const areaItemRows = [...mortgageRows, ...savingsRows];

const directAllocationCategoryIds = new Set(["mat", "sparande"]);
const rowNameMaxLength = 48;

const planningYear = 2026;
const planningYears = [2023, 2024, 2025, planningYear];

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

function createMonthValues(months: ForecastMonth[], values: (month: ForecastMonth) => number) {
  return months.reduce<MonthValue>((monthValues, month) => {
    monthValues[month.id] = values(month);
    return monthValues;
  }, {});
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

function createSeedPlanningData(months: ForecastMonth[]): PlanningData {
  const expenseCategories = months[0].categories.map((category, order) => ({
    id: makeId(category.name),
    name: category.name,
    order,
  }));

  const expenseItems = expenseCategories.flatMap((category) => {
    const categoryMonths = months.map((month) =>
      month.categories.find((currentCategory) => currentCategory.name === category.name),
    );
    const itemNames = [
      ...new Set(
        categoryMonths.flatMap((currentCategory) =>
          currentCategory?.items?.map((item) => item.name) ?? [],
        ),
      ),
    ];

    if (!itemNames.length) {
      return [
        {
          id: `${category.id}-${category.id}`,
          category: category.id,
          name: category.name,
          monthlyValues: createMonthValues(
            months,
            (month) =>
              parseAmount(
                month.categories.find((currentCategory) => currentCategory.name === category.name)
                  ?.amount ?? "0 kr",
              ),
          ),
          recurring: true,
        },
      ];
    }

    return itemNames.map((itemName) => {
      const monthlyValues = createMonthValues(
        months,
        (month) =>
          parseAmount(
            month.categories
              .find((currentCategory) => currentCategory.name === category.name)
              ?.items?.find((item) => item.name === itemName)?.amount ?? "0 kr",
          ),
      );
      const nonZeroMonths = Object.values(monthlyValues).filter((value) => value > 0);

      return {
        id: `${category.id}-${makeId(itemName)}`,
        category: category.id,
        name: itemName,
        monthlyValues,
        recurring: nonZeroMonths.length > 1,
      };
    });
  });

  return {
    version: 3,
    openingBalance: parseAmount(months[0].startBalance),
    incomes: [
      {
        id: "income-salary",
        name: "Inkomster",
        monthlyValues: createMonthValues(months, (month) => parseAmount(month.income)),
        recurring: true,
      },
    ],
    expenseCategories,
    expenseItems,
  };
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
      const categoryTotal = items.reduce(
        (total, item) => total + (item.monthlyValues[metadata.id] ?? 0),
        0,
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
              amount: formatAmount(item.monthlyValues[metadata.id] ?? 0),
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

function getAffectedMonthIds(targetMonthId: string, scope: ChangeScope) {
  const targetIndex = monthIds.indexOf(targetMonthId);

  if (targetIndex < 0) {
    return [];
  }

  return scope === "single" ? [monthIds[targetIndex]] : monthIds.slice(targetIndex);
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
    const affectedMonthIds = getAffectedMonthIds(target.monthId, scope);
    const currentValues = data.incomeLineValues?.[target.incomeLineKey] ?? {};

    return {
      ...data,
      incomeLineValues: {
        ...data.incomeLineValues,
        [target.incomeLineKey]: {
          ...currentValues,
          ...Object.fromEntries(
            affectedMonthIds.map((monthId) => [monthId, parseAmount(nextAmount)]),
          ),
        },
      },
    };
  }

  if (target.type === "allocation") {
    const affectedMonthIds = getAffectedMonthIds(target.monthId, scope);
    const currentValues = data.allocationOverrides?.[target.allocationKey] ?? {};

    return {
      ...data,
      allocationOverrides: {
        ...data.allocationOverrides,
        [target.allocationKey]: {
          ...currentValues,
          ...Object.fromEntries(
            affectedMonthIds.map((monthId) => [monthId, parseAmount(nextAmount)]),
          ),
        },
      },
    };
  }

  if (target.type === "areaItem") {
    const affectedMonthIds = getAffectedMonthIds(target.monthId, scope);
    const currentValues = data.areaItemValues?.[target.areaItemKey] ?? {};

    return {
      ...data,
      areaItemValues: {
        ...data.areaItemValues,
        [target.areaItemKey]: {
          ...currentValues,
          ...Object.fromEntries(
            affectedMonthIds.map((monthId) => [monthId, parseAmount(nextAmount)]),
          ),
        },
      },
    };
  }

  const category = data.expenseCategories.find((currentCategory) => currentCategory.id === target.categoryId);

  if (!category) {
    return data;
  }

  const affectedMonthIds = getAffectedMonthIds(target.monthId, scope);

  if (target.type === "item") {
    return {
      ...data,
      expenseItems: data.expenseItems.map((item) =>
        item.id === target.itemId
          ? {
              ...item,
              monthlyValues: {
                ...item.monthlyValues,
                ...Object.fromEntries(affectedMonthIds.map((monthId) => [monthId, parseAmount(nextAmount)])),
              },
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

  return (
    data.version === 3 &&
    hasValidLabels &&
    hasValidAllocationOverrides &&
    hasValidAreaItemValues &&
    hasValidIncomeLineValues &&
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
    return isPlanningData(data) ? data : null;
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

const seedPlanningData = createSeedPlanningData(seedSourceMonths);

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

  return result as CloudPlanningYear;
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

function getAreaRemainingAmount(month: ForecastMonth, area: "mortgage" | "savings") {
  const allocationKey: AllocationKey = area;
  const rows = area === "mortgage" ? mortgageRows : savingsRows;
  const placed = rows.reduce(
    (total, row) => total + parseAmount(getAreaItemAmount(month, row.key)),
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

function DesktopSectionHeading({ first = false, label }: { first?: boolean; label: string }) {
  return (
    <div className={`col-span-full flex items-center gap-4 pb-3 ${first ? "pt-6" : "pt-10"}`}>
      <h2 className="shrink-0 text-[13px] font-semibold uppercase leading-none tracking-[0.08em] text-stone-700">
        {label}
      </h2>
      <span aria-hidden="true" className="h-px min-w-8 flex-1 bg-stone-300/80" />
    </div>
  );
}

function DesktopFutureArea({
  currentMonthId,
  currentMonthIndex,
  months,
  selectedMonthId,
}: {
  currentMonthId: string | null;
  currentMonthIndex: number;
  months: ForecastMonth[];
  selectedMonthId: string;
}) {
  return (
    <div className="contents">
      <div className="flex items-center border-b border-stone-100 py-3 pr-2 text-sm text-stone-400">
        <span className="truncate">Investeringar</span>
      </div>
      <div className="border-b border-stone-100 bg-stone-50/80 px-1 py-3 text-center text-xs text-stone-400 lg:text-sm">
        —
      </div>
      {months.map((month, monthIndex) => {
        const background =
          month.id === currentMonthId
            ? "bg-[#edf2ec]"
            : month.id === selectedMonthId
              ? "bg-stone-950/[0.045]"
              : currentMonthIndex >= 0 && monthIndex < currentMonthIndex
                ? "bg-stone-50/70"
                : "";

        return (
          <div
            className={`min-w-0 border-b border-stone-100 px-1 py-3 text-center text-xs text-stone-400 lg:text-sm ${background}`}
            key={`investments-${month.id}`}
          >
            —
          </div>
        );
      })}
    </div>
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
          className={`flex items-center gap-2 border-b border-stone-100 pr-2 text-left transition hover:text-stone-950 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${rowTextSize} ${rowPadding} ${toggleIndent} ${weight} ${tone} ${divider} ${groupMarker} ${resultEdge}`}
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
          <span className="truncate" title={label}>{label}</span>
        </button>
      ) : (
        <div
          className={`flex items-center border-b border-stone-100 pr-2 ${rowTextSize} ${rowPadding} ${labelIndent} ${weight} ${tone} ${divider} ${resultEdge}`}
        >
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
      <div className="flex items-center border-b border-l border-stone-100 border-l-stone-200 py-3 pl-10 pr-2 text-sm text-stone-700">
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
      <div className="flex items-center border-b border-stone-100 py-3 pl-6 pr-2 text-sm text-stone-700">
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
      <div className={`flex items-center border-b border-stone-100 py-3 pl-6 pr-2 text-sm ${tone}`}>
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
      <div className={`flex items-center border-b border-l border-stone-100 border-l-stone-200 py-3 pl-10 pr-2 text-sm ${tone}`}>
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
  currentMonthId,
  onAddExpense,
  onBeginEdit,
  onCancelEdit,
  onChangeEdit,
  onRequestDelete,
  onSelectMonth,
  onSaveEdit,
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
  currentMonthId: string | null;
  onAddExpense: (categoryName: string) => void;
  onBeginEdit: (target: AmountTarget, amount: string) => void;
  onCancelEdit: () => void;
  onChangeEdit: (value: string) => void;
  onRequestDelete: (target: DeleteTarget) => void;
  onSelectMonth: (monthId: string) => void;
  onSaveEdit: () => void;
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

    return (
      <div className="contents" key={`category-${categoryId}`}>
        <div
          className={`flex items-center gap-1 border-b border-stone-100 py-3 pr-2 text-left text-sm font-semibold ${groupRail} ${
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
                <div className={`border-b border-stone-100 py-2.5 pr-2 text-sm text-stone-500 ${groupRail}`}>
                  <div className={`${itemIndent} flex min-w-0 items-center justify-between gap-2`}>
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
              <div className={`border-b border-stone-100 py-2.5 pr-2 ${groupRail}`}>
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
      <div className="mx-auto grid max-w-[1560px] grid-cols-[60px_repeat(3,minmax(0,1fr))] sm:hidden">
        <div className="border-b border-stone-200 pb-3" />
        {yearRows.map((row) => (
          <div
            className="border-b border-stone-200 pb-3 text-center text-[11px] font-medium text-stone-500"
            key={row.key}
          >
            {row.shortLabel}
          </div>
        ))}

        <div className="flex items-center border-b border-stone-200 py-3 text-[11px] font-semibold leading-none text-stone-500">
          ÅRET
        </div>
        {yearRows.map((row) => {
          const summary = getYearSummary(row, months);

          return (
            <div
              className={`border-b border-stone-200 bg-stone-50/80 px-1 py-3 text-center text-[11px] text-stone-800 ${
                row.key === "remaining" ? "font-semibold" : "font-medium"
              }`}
              key={`year-${row.key}`}
              title={summary}
            >
              {shortAmount(summary)}
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
                className={`flex items-center gap-1.5 border-b border-stone-100 py-3 text-left text-[11px] font-semibold leading-none transition focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${
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
                    className={`border-b border-stone-100 px-1 py-3 text-center text-[11px] transition focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${cellClass}`}
                    key={`${month.id}-${row.key}`}
                    onClick={() => onSelectMonth(month.id)}
                    tabIndex={-1}
                    type="button"
                  >
                    {shortAmount(getMonthFlowValue(month, row.key))}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="mx-auto hidden max-w-[1560px] sm:grid sm:grid-cols-[168px_96px_repeat(12,minmax(0,1fr))]">
        <div className="min-h-14 border-b border-stone-200" />
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
            {savingsRows.map((row) => (
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
                saving
              />
            ))}
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

        <DesktopFutureArea
          currentMonthId={currentMonthId}
          currentMonthIndex={currentMonthIndex}
          months={months}
          selectedMonthId={selectedMonthId}
        />
      </div>
    </section>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-stone-100 py-4 sm:border-b-0 sm:py-0">
      <p className="text-xs text-stone-400">{label}</p>
      <p className="mt-1 text-base font-medium text-stone-950">{value}</p>
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
        className={`flex min-h-12 w-full items-center justify-between gap-4 text-left font-medium ${
          saving ? "text-emerald-900" : "text-stone-950"
        }`}
        onClick={onToggle}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className={`grid h-6 w-6 shrink-0 place-items-center text-lg leading-none text-stone-400 transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
          >
            ›
          </span>
          <span className="truncate" title={label}>{label}</span>
        </span>
        <span className={`shrink-0 text-sm tabular-nums ${saving ? "text-emerald-900" : "text-stone-600"}`}>
          {amount}
        </span>
      </button>
      {expanded && children ? (
        <div className="mb-3 ml-3 border-l border-stone-200 pl-4">{children}</div>
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
      <div className="flex min-h-12 items-center justify-between gap-4 border-b border-stone-100 font-medium text-stone-950">
        <h4>{label}</h4>
        <span className="shrink-0 text-sm tabular-nums text-stone-600">{amount}</span>
      </div>
      <div className="pl-4">{children}</div>
    </section>
  );
}

function PlanningSectionHeading({ first = false, label }: { first?: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-3 pb-3 ${first ? "" : "pt-10"}`}>
      <h3 className="shrink-0 text-xs font-semibold uppercase leading-none tracking-[0.08em] text-stone-700">
        {label}
      </h3>
      <span aria-hidden="true" className="h-px min-w-6 flex-1 bg-stone-300/80" />
    </div>
  );
}

function PlanningFutureArea({ label }: { label: string }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-b border-stone-100 text-sm text-stone-400">
      <span>{label}</span>
      <span className="text-xs">Framtida område</span>
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
        result ? "min-h-11 border-y border-stone-200 text-[13px] font-medium" : "text-sm"
      } ${muted ? "text-stone-400" : saving ? (result ? "text-emerald-800" : "text-emerald-900") : result ? "text-stone-700" : "text-stone-600"}`}
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
    <div className="flex min-h-11 items-center justify-between gap-4 border-b border-stone-100 text-sm text-stone-600">
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
    <div className="flex min-h-11 items-center justify-between gap-4 border-b border-stone-100 text-sm text-stone-600">
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
      className={`flex min-h-11 items-center justify-between gap-4 border-b border-stone-100 text-sm ${
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
      className={`flex min-h-11 items-center justify-between gap-4 border-b border-stone-100 text-sm ${
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
              <div className={`flex min-w-0 flex-1 items-center gap-1 text-sm font-semibold ${
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
                  <span
                    aria-hidden="true"
                    className={`transition-transform ${expanded ? "rotate-90" : ""}`}
                  >
                    {canExpand ? "›" : ""}
                  </span>
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
                      className="flex min-h-8 items-center justify-between gap-4 text-sm text-stone-500"
                      key={itemId}
                    >
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
                  className="mt-2 min-h-9 text-left text-sm font-medium text-stone-500 transition hover:text-stone-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-900"
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

function MonthlySnapshot({ billAccountLabel, month }: { billAccountLabel: string; month: ForecastMonth }) {
  const metrics = [
    { label: "Inkomster", value: month.income },
    { label: "Fördelat", value: month.expenses },
    { label: "Kvar att fördela", value: getRemainingAmount(month) },
    { label: billAccountLabel, value: getAllocationAmount(month, "billAccount") },
    { label: "Sparkvot", value: "—" },
  ];

  return (
    <aside
      aria-label={`Översikt för denna månad, ${month.name}`}
      className="overflow-hidden rounded-lg border border-stone-200/90 bg-white shadow-[0_14px_40px_rgba(28,25,23,0.045)]"
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-stone-100 px-4 py-3">
        <p className="text-sm font-medium text-stone-950">Denna månad</p>
        <p className="text-xs text-stone-400">{month.name}</p>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-5">
        {metrics.map((metric, index) => (
          <div
            className={`min-w-0 px-3 py-3 ${index % 2 ? "border-l border-stone-100" : ""} ${
              index < 4 ? "border-b border-stone-100 sm:border-b-0" : "col-span-2 sm:col-span-1"
            } ${index > 0 ? "sm:border-l sm:border-stone-100" : "sm:border-l-0"}`}
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

function YearNavigation() {
  return (
    <nav
      aria-label="Välj planeringsår"
      className="mx-auto flex w-full max-w-[1560px] flex-col gap-3 px-4 pb-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"
    >
      <div className="flex items-center justify-between gap-3 sm:justify-start">
        <span className="text-xs font-medium text-stone-400">År</span>
        <div className="inline-flex items-center rounded-lg border border-stone-200 bg-white p-1">
          {planningYears.map((year) => {
            const selected = year === planningYear;

            return (
              <button
                aria-current={selected ? "page" : undefined}
                aria-disabled="true"
                className={`min-h-8 min-w-11 cursor-default rounded-md px-2 text-xs font-medium transition sm:min-w-12 sm:text-sm ${
                  selected ? "bg-[#e9eee7] text-stone-950" : "text-stone-400"
                }`}
                disabled
                key={year}
                type="button"
              >
                {year}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <button
          aria-disabled="true"
          className="min-h-9 cursor-default px-1 text-left text-xs text-stone-400 sm:px-2 sm:text-sm"
          disabled
          type="button"
        >
          Uppdatera från föregående år
        </button>
        <button
          aria-disabled="true"
          className="min-h-9 shrink-0 cursor-default rounded-md border border-stone-200 bg-white px-3 text-xs font-medium text-stone-500 sm:text-sm"
          disabled
          type="button"
        >
          + Nytt år
        </button>
      </div>
    </nav>
  );
}

function ProductFooter() {
  return (
    <footer className="mt-16 border-t border-stone-200/80 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-4 text-xs text-stone-400 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-semibold text-stone-700">Fameko</p>
          <p className="mt-1">Familjens ekonomi, tydligt framåt.</p>
        </div>
        <div className="flex items-center gap-4">
          <span>Version: Workspace 1.0</span>
          <span>© 2026 Fameko</span>
        </div>
      </div>
    </footer>
  );
}

function MonthDetail({
  editingKey,
  editingValue,
  expandedCategories,
  expandedCostAccount,
  expandedMortgage,
  expandedSavings,
  labels,
  month,
  nameEditor,
  openingBalance,
  onAddExpense,
  onBeginEdit,
  onCancelEdit,
  onChangeEdit,
  onRequestDelete,
  onSaveEdit,
  onToggleCategory,
  onToggleCostAccount,
  onToggleMortgage,
  onToggleSavings,
}: {
  editingKey: string | null;
  editingValue: string;
  expandedCategories: Record<string, boolean>;
  expandedCostAccount: boolean;
  expandedMortgage: boolean;
  expandedSavings: boolean;
  labels: ResolvedPlanningLabels;
  month: ForecastMonth;
  nameEditor: NameEditor;
  openingBalance: string;
  onAddExpense: (categoryName: string) => void;
  onBeginEdit: (target: AmountTarget, amount: string) => void;
  onCancelEdit: () => void;
  onChangeEdit: (value: string) => void;
  onRequestDelete: (target: DeleteTarget) => void;
  onSaveEdit: () => void;
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
    <section className="mx-auto mt-10 max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div>
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <span className={`h-2 w-2 rounded-full ${statusDot[month.status]}`} />
            <span>{month.label}</span>
          </div>
          <h2 className="mt-3 text-4xl font-semibold text-stone-950">{month.name}</h2>
        </div>

        <div className="min-w-0">
          <div className="grid border-y border-stone-200 sm:grid-cols-3 sm:gap-8 sm:py-5">
            <DetailMetric label="Inkomster" value={month.income} />
            <DetailMetric label="Fördelat" value={month.expenses} />
            <DetailMetric label="Kvar att fördela" value={remainingAmount} />
          </div>

          <div className="mt-8">
            <PlanningSectionHeading first label="Inkomster & fördelningar" />

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

            <PlanningSectionHeading label="Räkningskonto & lån" />

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

            <PlanningSectionHeading label="Sparande & investeringar" />

            <PlanningGroup
              amount={savingAllocation}
              expanded={expandedSavings}
              label={labels.allocations.savings}
              onToggle={onToggleSavings}
              saving
            >
              <PlanningLine amount={savingAllocation} label="Tillfört" saving />
              {savingsRows.map((row) => (
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
                  saving
                />
              ))}
              <PlanningLine
                amount={getAreaRemainingAmount(month, "savings")}
                label="Kvar att placera"
                result
                saving
              />
            </PlanningGroup>

            <PlanningFutureArea label="Investeringar" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [planningData, setPlanningData] = useState(seedPlanningData);
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
          storedData && JSON.stringify(storedData) !== JSON.stringify(seedPlanningData);
        if (hasLocalChanges && !readImportDecision()) {
          setPlanningData(storedData);
          setImportCandidate(storedData);
          setCloudLoadState("import");
          setCloudMessage("Välj om din lokala data ska importeras.");
          return;
        }

        const created = await saveCloudPlanningYear(seedPlanningData, null);
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
  const hasUnsavedChanges =
    cloudLoadState === "ready" && savedSnapshot !== null && currentSnapshot !== savedSnapshot;

  const months = useMemo(() => buildForecastMonths(planningData), [planningData]);
  const labels = useMemo(() => getResolvedPlanningLabels(planningData), [planningData]);

  const selectedMonth =
    months.find((month) => month.id === selectedMonthId) ?? months[0];
  const currentMonth =
    months.find((month) => month.id === currentMonthId) ?? selectedMonth;

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
        importLocalData ? importCandidate : seedPlanningData,
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

  function openAddDialog(categoryId?: string) {
    setAddDraft({
      categoryId:
        categoryId && categoryOptions.some((category) => category.id === categoryId)
          ? categoryId
          : categoryOptions[0]?.id ?? "boende",
      description: "",
      amount: "",
      monthId: selectedMonth.id,
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
            <p className="hidden max-w-72 text-right text-xs text-stone-500 sm:block" role="status">
              {hasUnsavedChanges &&
              (cloudSaveState === "idle" || cloudSaveState === "saved")
                ? "Osparade ändringar"
                : cloudMessage}
            </p>
            {showDevelopmentReset ? (
              <button
                className="hidden rounded-md px-2 py-1 text-xs text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 md:block"
                onClick={resetSeedData}
                type="button"
              >
                Återställ testdata
              </button>
            ) : null}
            <button
              className="min-h-9 rounded-lg bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
              disabled={
                cloudLoadState !== "ready" ||
                !hasUnsavedChanges ||
                cloudSaveState === "saving" ||
                cloudSaveState === "conflict"
              }
              onClick={() => void saveToCloud()}
              type="button"
            >
              {cloudSaveState === "saving" ? "Sparar…" : "Spara"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1560px] px-4 pb-6 pt-7 sm:px-6 sm:pb-7 sm:pt-8 lg:px-8">
        <section className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(460px,560px)]">
          <div>
            <p className="text-sm font-medium text-stone-500">Kommande 12 månader</p>
            <h1 className="mt-2 max-w-5xl text-3xl font-semibold leading-tight text-stone-950 sm:text-4xl">
              Ditt ekonomiska år
            </h1>
          </div>
          <div className="hidden sm:block">
            <MonthlySnapshot billAccountLabel={labels.allocations.billAccount} month={currentMonth} />
          </div>
        </section>
      </div>

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
        onAddExpense={openAddDialog}
        onBeginEdit={beginEdit}
        onCancelEdit={cancelEdit}
        onChangeEdit={setEditingValue}
        onRequestDelete={requestDelete}
        onSelectMonth={selectMonth}
        onSaveEdit={saveEdit}
        onToggleCostAccount={() => setExpandedCostAccount((current) => !current)}
        onToggleGridCategory={toggleGridCategory}
        onToggleMortgage={() => setExpandedMortgage((current) => !current)}
        onToggleSavings={() => setExpandedSavings((current) => !current)}
        selectedMonthId={selectedMonth.id}
      />

      <div className="mx-auto w-full max-w-[1560px] px-4 pt-6 sm:hidden">
        <MonthlySnapshot billAccountLabel={labels.allocations.billAccount} month={currentMonth} />
      </div>

      <div className="sm:hidden">
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
          onAddExpense={openAddDialog}
          onBeginEdit={beginEdit}
          onCancelEdit={cancelEdit}
          onChangeEdit={setEditingValue}
          onRequestDelete={requestDelete}
          onSaveEdit={saveEdit}
          onToggleCategory={toggleCategory}
          onToggleCostAccount={() => setExpandedCostAccount((current) => !current)}
          onToggleMortgage={() => setExpandedMortgage((current) => !current)}
          onToggleSavings={() => setExpandedSavings((current) => !current)}
        />
      </div>

      <ProductFooter />

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
