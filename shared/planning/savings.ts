import {
  buildExpenseItemMonthValues,
  getExpenseItemEditDraft,
  isExpenseItemFrequency,
  type ExpenseItemFrequency,
} from "./expense-item-edit.ts";

export const savingsMonthIds = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
] as const;

export const standardSavingsGoals = [
  { id: "sparmal-buffert", name: "Buffert" },
  { id: "sparmal-pension", name: "Pension" },
  { id: "sparmal-investeringar", name: "Investeringar" },
] as const;

const legacyGenericSavingsId = "sparande-sparande";
const legacySavingsKeys = [
  "savingsBuffer",
  "savingsVacation",
  "savingsIsk",
  "savingsPension",
] as const;

type MonthValues = Record<string, number>;

export type SavingsOverviewGoal = {
  averageMonthlySavings: number;
  id: string;
  name: string;
  totalPlannedSavings: number;
};

export type SavingsOverview = {
  averageMonthlySavings: number;
  goals: SavingsOverviewGoal[];
  monthlyIncome: number[];
  monthlySavings: number[];
  savingsRate: number | null;
  totalPlannedSavings: number;
};

export type SavingsGoalEditDraft = {
  amount: number;
  frequency: ExpenseItemFrequency;
  monthId: string;
  name: string;
};

export type SavingsExpenseItem = {
  category: string;
  frequency?: string;
  id: string;
  monthlyValues: MonthValues;
  name: string;
  recurring: boolean;
  [key: string]: unknown;
};

export type SavingsPlanningData = {
  allocationOverrides?: Record<string, Partial<MonthValues>>;
  areaItemValues?: Record<string, Partial<MonthValues>>;
  expenseItems: SavingsExpenseItem[];
  labels?: {
    areaItems?: Record<string, string>;
    expenseItems?: Record<string, string>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type SavingsOverviewPlanningData = SavingsPlanningData & {
  incomeLineValues?: Partial<Record<string, Partial<MonthValues>>>;
  incomes: Array<{
    monthlyValues: MonthValues;
  }>;
};

function zeroMonthValues(): MonthValues {
  return Object.fromEntries(savingsMonthIds.map((monthId) => [monthId, 0]));
}

function valuesFor(
  values: Record<string, Partial<MonthValues>> | undefined,
  key: string,
): MonthValues {
  return Object.fromEntries(
    savingsMonthIds.map((monthId) => [monthId, values?.[key]?.[monthId] ?? 0]),
  );
}

function hasAnyValue(values: MonthValues): boolean {
  return Object.values(values).some((value) => value !== 0);
}

function savingsItemName(data: SavingsPlanningData, item: SavingsExpenseItem): string {
  return data.labels?.expenseItems?.[item.id] ?? item.name;
}

export function calculateSavingsRate(
  plannedSavings: number,
  totalIncome: number,
): number | null {
  return totalIncome === 0 ? null : (plannedSavings / totalIncome) * 100;
}

export function selectMonthlySavingsMetrics(plannedSavings: number, totalIncome: number) {
  return {
    plannedSavings,
    savingsRate: calculateSavingsRate(plannedSavings, totalIncome),
  };
}

export function getSavingsGoals(data: SavingsPlanningData): SavingsExpenseItem[] {
  return data.expenseItems.filter(
    (item) => item.category === "sparande" && item.id !== legacyGenericSavingsId,
  );
}

export function sumSavingsGoalsForMonth(
  data: SavingsPlanningData,
  monthId: string,
): number {
  return getSavingsGoals(data).reduce(
    (total, item) => total + (item.monthlyValues[monthId] ?? 0),
    0,
  );
}

export function getSavingsOverview(data: SavingsOverviewPlanningData): SavingsOverview {
  const sourceGoals = getSavingsGoals(data);
  const goals = sourceGoals.map((goal) => {
    const totalPlannedSavings = savingsMonthIds.reduce(
      (total, monthId) => total + (goal.monthlyValues[monthId] ?? 0),
      0,
    );

    return {
      averageMonthlySavings: totalPlannedSavings / savingsMonthIds.length,
      id: goal.id,
      name: savingsItemName(data, goal),
      totalPlannedSavings,
    };
  });
  const monthlySavings = savingsMonthIds.map((monthId) =>
    sourceGoals.reduce((total, goal) => total + (goal.monthlyValues[monthId] ?? 0), 0),
  );
  const monthlyIncome = savingsMonthIds.map((monthId) => {
    const storedIncome = data.incomes.reduce(
      (total, income) => total + (income.monthlyValues[monthId] ?? 0),
      0,
    );
    return ["salaryOne", "salaryTwo", "benefits", "other"].reduce(
      (total, key) =>
        total + (data.incomeLineValues?.[key]?.[monthId] ?? (key === "salaryOne" ? storedIncome : 0)),
      0,
    );
  });
  const totalPlannedSavings = monthlySavings.reduce((total, amount) => total + amount, 0);
  const totalIncome = monthlyIncome.reduce((total, amount) => total + amount, 0);

  return {
    averageMonthlySavings: totalPlannedSavings / savingsMonthIds.length,
    goals,
    monthlyIncome,
    monthlySavings,
    savingsRate: calculateSavingsRate(totalPlannedSavings, totalIncome),
    totalPlannedSavings,
  };
}

export function createSavingsGoal<T extends SavingsPlanningData>(
  data: T,
  name: string,
  createId: () => string = () => crypto.randomUUID(),
): T {
  const normalizedName = name.trim().slice(0, 48);

  if (!normalizedName) {
    return data;
  }

  const item: SavingsExpenseItem = {
    category: "sparande",
    id: `sparmal-${createId()}`,
    monthlyValues: zeroMonthValues(),
    name: normalizedName,
    recurring: true,
  };

  return { ...data, expenseItems: [...data.expenseItems, item] };
}

export function isStandardSavingsGoalId(goalId: string): boolean {
  return standardSavingsGoals.some((goal) => goal.id === goalId);
}

export function getSavingsGoalEditDraft(
  data: SavingsPlanningData,
  goalId: string,
  monthIds: readonly string[],
): SavingsGoalEditDraft | null {
  const goal = getSavingsGoals(data).find((item) => item.id === goalId);

  if (!goal) return null;

  const expenseDraft = getExpenseItemEditDraft(
    {
      ...goal,
      frequency: isExpenseItemFrequency(goal.frequency) ? goal.frequency : undefined,
    },
    monthIds,
    data.labels?.expenseItems?.[goal.id],
  );

  return {
    amount: expenseDraft.amount,
    frequency: expenseDraft.frequency,
    monthId: expenseDraft.monthId,
    name: savingsItemName(data, goal),
  };
}

export function updateSavingsGoal<T extends SavingsPlanningData>(
  data: T,
  goalId: string,
  draft: SavingsGoalEditDraft,
  monthIds: readonly string[],
): T {
  const goal = getSavingsGoals(data).find((item) => item.id === goalId);
  const name = draft.name.trim().slice(0, 48);

  if (
    !goal ||
    !name ||
    !monthIds.includes(draft.monthId) ||
    !Number.isFinite(draft.amount) ||
    draft.amount < 0 ||
    !isExpenseItemFrequency(draft.frequency)
  ) {
    return data;
  }

  return {
    ...data,
    expenseItems: data.expenseItems.map((item) =>
      item.id === goalId
        ? {
            ...item,
            frequency: draft.frequency,
            monthlyValues: buildExpenseItemMonthValues(
              monthIds,
              draft.amount,
              draft.monthId,
              draft.frequency,
            ),
            name,
            recurring: draft.frequency !== "once",
          }
        : item,
    ),
    labels: {
      ...data.labels,
      expenseItems: {
        ...data.labels?.expenseItems,
        [goalId]: name,
      },
    },
  };
}

export function removeSavingsGoal<T extends SavingsPlanningData>(
  data: T,
  goalId: string,
): T {
  if (
    isStandardSavingsGoalId(goalId) ||
    !getSavingsGoals(data).some((item) => item.id === goalId)
  ) {
    return data;
  }

  const expenseItemLabels = { ...data.labels?.expenseItems };
  delete expenseItemLabels[goalId];

  return {
    ...data,
    expenseItems: data.expenseItems.filter((item) => item.id !== goalId),
    labels: {
      ...data.labels,
      expenseItems: expenseItemLabels,
    },
  };
}

export function renameSavingsGoal<T extends SavingsPlanningData>(
  data: T,
  goalId: string,
  name: string,
): T {
  const normalizedName = name.trim().slice(0, 48);
  const goal = getSavingsGoals(data).find((item) => item.id === goalId);

  if (!goal || !normalizedName) {
    return data;
  }

  return {
    ...data,
    labels: {
      ...data.labels,
      expenseItems: { ...data.labels?.expenseItems, [goalId]: normalizedName },
    },
  };
}

export function migrateLegacySavingsStructure<T extends SavingsPlanningData>(data: T): T {
  const genericItem = data.expenseItems.find((item) => item.id === legacyGenericSavingsId);
  const currentGoals = getSavingsGoals(data);
  const currentGoalIds = new Set(currentGoals.map((item) => item.id));
  const legacyValues = Object.fromEntries(
    legacySavingsKeys.map((key) => [key, valuesFor(data.areaItemValues, key)]),
  ) as Record<(typeof legacySavingsKeys)[number], MonthValues>;
  const legacyLabels = data.labels?.areaItems;
  const hasLegacyValues = Object.values(legacyValues).some(hasAnyValue);
  const hasLegacyLabels = legacySavingsKeys.some((key) => legacyLabels?.[key] !== undefined);
  const hasEveryStandardGoal = standardSavingsGoals.every((goal) => currentGoalIds.has(goal.id));

  if (!genericItem && !hasLegacyValues && !hasLegacyLabels && hasEveryStandardGoal) {
    return data;
  }

  const originalSavingsByMonth = Object.fromEntries(
    savingsMonthIds.map((monthId) => {
      const override = data.allocationOverrides?.savings?.[monthId];
      const categoryTotal = data.expenseItems
        .filter((item) => item.category === "sparande")
        .reduce((total, item) => total + (item.monthlyValues[monthId] ?? 0), 0);
      return [monthId, override ?? categoryTotal];
    }),
  );
  const existingById = new Map(currentGoals.map((item) => [item.id, item]));
  const goalSourceValues: Record<string, MonthValues> = {
    "sparmal-buffert": hasLegacyValues
      ? legacyValues.savingsBuffer
      : (genericItem?.monthlyValues ?? zeroMonthValues()),
    "sparmal-investeringar": legacyValues.savingsIsk,
    "sparmal-pension": legacyValues.savingsPension,
  };
  const legacyNames: Record<string, string> = {
    "sparmal-buffert": legacyLabels?.savingsBuffer ?? "Buffert",
    "sparmal-investeringar":
      legacyLabels?.savingsIsk && legacyLabels.savingsIsk !== "ISK"
        ? legacyLabels.savingsIsk
        : "Investeringar",
    "sparmal-pension": legacyLabels?.savingsPension ?? "Pension",
  };
  const standardGoals = standardSavingsGoals.map((goal) =>
    existingById.get(goal.id) ?? {
      category: "sparande",
      id: goal.id,
      monthlyValues: goalSourceValues[goal.id],
      name: legacyNames[goal.id] ?? goal.name,
      recurring: true,
    },
  );
  const vacationName = legacyLabels?.savingsVacation ?? "Semester";
  const preserveVacation =
    hasAnyValue(legacyValues.savingsVacation) || vacationName !== "Semester";
  const vacationGoal: SavingsExpenseItem[] = preserveVacation
    ? [
        existingById.get("sparmal-semester-legacy") ?? {
          category: "sparande",
          id: "sparmal-semester-legacy",
          monthlyValues: legacyValues.savingsVacation,
          name: vacationName,
          recurring: true,
        },
      ]
    : [];
  const reservedIds = new Set([
    ...standardSavingsGoals.map((goal) => goal.id),
    "sparmal-semester-legacy",
  ]);
  const otherGoals = currentGoals.filter((item) => !reservedIds.has(item.id));
  const nextAreaItemValues = Object.fromEntries(
    Object.entries(data.areaItemValues ?? {}).filter(
      ([key]) => !legacySavingsKeys.includes(key as (typeof legacySavingsKeys)[number]),
    ),
  );
  const nextAreaLabels = Object.fromEntries(
    Object.entries(legacyLabels ?? {}).filter(
      ([key]) => !legacySavingsKeys.includes(key as (typeof legacySavingsKeys)[number]),
    ),
  );

  return {
    ...data,
    allocationOverrides: {
      ...data.allocationOverrides,
      savings: originalSavingsByMonth,
    },
    areaItemValues: nextAreaItemValues,
    expenseItems: [
      ...data.expenseItems.filter((item) => item.category !== "sparande"),
      ...standardGoals,
      ...vacationGoal,
      ...otherGoals,
    ],
    labels: {
      ...data.labels,
      areaItems: nextAreaLabels,
      expenseItems: {
        ...data.labels?.expenseItems,
        ...Object.fromEntries(
          [...standardGoals, ...vacationGoal, ...otherGoals].map((item) => [
            item.id,
            savingsItemName(data, item),
          ]),
        ),
      },
    },
  };
}
