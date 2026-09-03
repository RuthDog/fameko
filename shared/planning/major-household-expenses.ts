import {
  getEffectiveExpenseCategoryTotals,
  getEffectiveExpenseItemAmount,
} from "./effective-values.ts";
import { calculateHousingEconomics, type HousingData } from "./housing.ts";

type MonthValues = Record<string, number>;

type MajorExpenseItem = {
  category?: string;
  company?: string;
  description?: string;
  id: string;
  monthlyValues: MonthValues;
  name: string;
};

export type MajorHouseholdExpensePlanningData = {
  allocationOverrides?: {
    food?: Partial<MonthValues>;
  };
  areaItemValues?: {
    mortgageAmortization?: Partial<MonthValues>;
    mortgageInterest?: Partial<MonthValues>;
  };
  expenseCategories?: Array<{
    id: string;
    name: string;
  }>;
  expenseItems: MajorExpenseItem[];
  housingData?: HousingData;
  labels?: {
    expenseCategories?: Record<string, string>;
    expenseItems?: Record<string, string>;
  };
};

export type MajorHouseholdExpenseSource =
  | {
      categoryId: string;
      type: "planningData";
    }
  | {
      field: "annualInterestCost";
      type: "housingData";
    }
  | {
      field: string;
      type: "carData";
    };

export type MajorHouseholdExpense = {
  annualAmount: number;
  id: string;
  name: string;
  percentage: number;
  source: MajorHouseholdExpenseSource;
};

type GetMajorHouseholdExpensesOptions = {
  limit?: number;
  monthIds: readonly string[];
  planningData: MajorHouseholdExpensePlanningData;
};

function normalizeIdentityPart(value: string | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sv-SE")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasIdentityWord(
  value: string,
  words: readonly string[],
  position: "exact" | "start" | "end" = "exact",
) {
  const tokens = value.split(" ").filter(Boolean);

  return tokens.some((token) =>
    words.some((word) => {
      if (position === "start") {
        return token.startsWith(word);
      }

      if (position === "end") {
        return token.endsWith(word);
      }

      return token === word;
    }),
  );
}

function getItemIdentityParts(
  data: MajorHouseholdExpensePlanningData,
  item: MajorExpenseItem,
) {
  return [
    item.id,
    item.name,
    item.company,
    item.description,
    data.labels?.expenseItems?.[item.id],
  ].map(normalizeIdentityPart);
}

function isAmortizationItem(
  data: MajorHouseholdExpensePlanningData,
  item: MajorExpenseItem,
) {
  return getItemIdentityParts(data, item).some((part) =>
    part.split(" ").some((word) => word.startsWith("amorter")),
  );
}

function isMortgageInterestItem(
  data: MajorHouseholdExpensePlanningData,
  item: MajorExpenseItem,
) {
  const itemIdentity = getItemIdentityParts(data, item).join(" ");
  const category = data.expenseCategories?.find(
    (candidate) => candidate.id === item.category,
  );
  const categoryIdentity = [
    item.category,
    category?.name,
    item.category ? data.labels?.expenseCategories?.[item.category] : undefined,
  ]
    .map(normalizeIdentityPart)
    .join(" ");
  const hasInterest = hasIdentityWord(
    itemIdentity,
    ["ranta", "interest"],
    "end",
  );
  const hasMortgageContext = hasIdentityWord(
    `${itemIdentity} ${categoryIdentity}`,
    ["boende", "bolan", "bostad", "housing", "mortgage"],
    "start",
  );

  return hasInterest && hasMortgageContext;
}

function getEffectiveItemAnnualAmount(
  data: MajorHouseholdExpensePlanningData,
  item: MajorExpenseItem,
  monthIds: readonly string[],
) {
  return monthIds.reduce(
    (total, monthId) =>
      total + Math.max(0, getEffectiveExpenseItemAmount(data, item, monthId)),
    0,
  );
}

function getAnnualAreaAmount(
  values: Partial<MonthValues> | undefined,
  monthIds: readonly string[],
) {
  return monthIds.reduce(
    (total, monthId) => total + Math.max(0, values?.[monthId] ?? 0),
    0,
  );
}

export function getMajorHouseholdExpenses({
  limit = 3,
  monthIds,
  planningData,
}: GetMajorHouseholdExpensesOptions): MajorHouseholdExpense[] {
  const amortizationByCategory = new Map<string, number>();
  let hasPlannedMortgageInterest = false;

  for (const item of planningData.expenseItems) {
    const annualAmount = getEffectiveItemAnnualAmount(planningData, item, monthIds);

    if (annualAmount <= 0) {
      continue;
    }

    if (isAmortizationItem(planningData, item) && item.category) {
      amortizationByCategory.set(
        item.category,
        (amortizationByCategory.get(item.category) ?? 0) + annualAmount,
      );
    }

    if (isMortgageInterestItem(planningData, item)) {
      hasPlannedMortgageInterest = true;
    }
  }

  const expenses: Omit<MajorHouseholdExpense, "percentage">[] =
    getEffectiveExpenseCategoryTotals(planningData, monthIds)
      .filter((category) => category.id !== "sparande")
      .map((category) => ({
        annualAmount: Math.max(
          0,
          category.total - (amortizationByCategory.get(category.id) ?? 0),
        ),
        id: `planning-category-${category.id}`,
        name: category.name,
        source: {
          categoryId: category.id,
          type: "planningData" as const,
        },
      }))
      .filter((expense) => expense.annualAmount > 0);

  const plannedMortgageInterest = getAnnualAreaAmount(
    planningData.areaItemValues?.mortgageInterest,
    monthIds,
  );

  if (!hasPlannedMortgageInterest && plannedMortgageInterest > 0) {
    expenses.push({
      annualAmount: plannedMortgageInterest,
      id: "planning-mortgage-interest",
      name: "Bolåneränta",
      source: {
        categoryId: "mortgageInterest",
        type: "planningData",
      },
    });
    hasPlannedMortgageInterest = true;
  }

  if (!hasPlannedMortgageInterest && planningData.housingData) {
    const annualInterestCost =
      calculateHousingEconomics(planningData.housingData).annualInterestCost ?? 0;

    if (annualInterestCost > 0) {
      expenses.push({
        annualAmount: annualInterestCost,
        id: "housing-mortgage-interest",
        name: "Bolåneränta",
        source: {
          field: "annualInterestCost",
          type: "housingData",
        },
      });
    }
  }

  const totalCosts = expenses.reduce(
    (total, expense) => total + expense.annualAmount,
    0,
  );

  return expenses
    .sort(
      (first, second) =>
        second.annualAmount - first.annualAmount ||
        first.name.localeCompare(second.name, "sv-SE"),
    )
    .slice(0, Math.max(0, limit))
    .map((expense) => ({
      ...expense,
      percentage:
        totalCosts > 0
          ? Math.round((expense.annualAmount / totalCosts) * 100)
          : 0,
    }));
}
