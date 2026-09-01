import { emptyCarData, type CarData } from "./car.ts";
import type { GuidedSetupGuideId } from "./guided-setup.ts";
import { emptyHousingData, type HousingData } from "./housing.ts";
import { savingsMonthIds, standardSavingsGoals } from "./savings.ts";

export type OnboardingIncomeKey = "salaryOne" | "salaryTwo" | "other";
export type OnboardingSavingsGoalId = (typeof standardSavingsGoals)[number]["id"];

type MonthValues = Record<string, number>;

export type OnboardingPlanningData = {
  allocationOverrides?: Record<string, Partial<MonthValues>>;
  areaItemValues?: Record<string, Partial<MonthValues>>;
  carData?: CarData;
  expenseItems: Array<{
    category: string;
    id: string;
    monthlyValues: MonthValues;
    name: string;
  }>;
  housingData?: HousingData;
  incomeLineValues?: Partial<Record<string, Partial<MonthValues>>>;
  incomes: Array<{
    monthlyValues: MonthValues;
  }>;
  openingBalance: number;
};

export type PlanningCompletionSuggestion = {
  actionLabel: string;
  description: string;
  guideId: GuidedSetupGuideId;
  title: string;
};

function normalizedAmount(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function hasNonZeroValue(values: Record<string, number | undefined> | undefined): boolean {
  return Boolean(values && Object.values(values).some((value) => value !== undefined && value !== 0));
}

function hasNestedNonZeroValue(
  values: Partial<Record<string, Partial<MonthValues>>> | undefined,
): boolean {
  return Boolean(values && Object.values(values).some((monthValues) => hasNonZeroValue(monthValues)));
}

function hasCarInformation(data: CarData | undefined): boolean {
  return Boolean(
    data &&
      Object.values(data).some((value) =>
        typeof value === "string" ? value.trim().length > 0 : value !== null,
      ),
  );
}

function hasHousingInformation(data: HousingData | undefined): boolean {
  return Boolean(data && Object.values(data).some((value) => value !== null));
}

export function getOnboardingIncomeAmount(
  data: OnboardingPlanningData,
  key: OnboardingIncomeKey,
): number {
  const lineValue = data.incomeLineValues?.[key]?.jan;

  if (lineValue !== undefined) {
    return lineValue;
  }

  if (key !== "salaryOne") {
    return 0;
  }

  return data.incomes.reduce(
    (total, income) => total + (income.monthlyValues.jan ?? 0),
    0,
  );
}

export function setOnboardingIncomeAmount<T extends OnboardingPlanningData>(
  data: T,
  key: OnboardingIncomeKey,
  value: number,
): T {
  const amount = normalizedAmount(value);

  return {
    ...data,
    incomeLineValues: {
      ...data.incomeLineValues,
      [key]: Object.fromEntries(savingsMonthIds.map((monthId) => [monthId, amount])),
    },
  };
}

export function getOnboardingSavingsAmount(
  data: OnboardingPlanningData,
  goalId: OnboardingSavingsGoalId,
): number {
  return data.expenseItems.find((item) => item.id === goalId)?.monthlyValues.jan ?? 0;
}

export function setOnboardingSavingsAmount<T extends OnboardingPlanningData>(
  data: T,
  goalId: OnboardingSavingsGoalId,
  value: number,
): T {
  const amount = normalizedAmount(value);

  return {
    ...data,
    expenseItems: data.expenseItems.map((item) =>
      item.id === goalId
        ? {
            ...item,
            monthlyValues: Object.fromEntries(
              savingsMonthIds.map((monthId) => [monthId, amount]),
            ),
          }
        : item,
    ),
  };
}

export function hasMeaningfulPlanningInformation(data: OnboardingPlanningData): boolean {
  return (
    data.openingBalance !== 0 ||
    data.incomes.some((income) => hasNonZeroValue(income.monthlyValues)) ||
    hasNestedNonZeroValue(data.incomeLineValues) ||
    data.expenseItems.some((item) => hasNonZeroValue(item.monthlyValues)) ||
    hasNestedNonZeroValue(data.allocationOverrides) ||
    hasNestedNonZeroValue(data.areaItemValues) ||
    hasHousingInformation(data.housingData) ||
    hasCarInformation(data.carData)
  );
}

export function shouldOfferPlanningOnboarding(data: OnboardingPlanningData): boolean {
  return (
    !hasMeaningfulPlanningInformation(data) &&
    data.housingData === undefined &&
    data.carData === undefined
  );
}

export function finalizePlanningOnboarding<T extends OnboardingPlanningData>(data: T): T {
  return {
    ...data,
    carData: data.carData ?? { ...emptyCarData },
    housingData: data.housingData ?? { ...emptyHousingData },
  };
}

function hasIncome(data: OnboardingPlanningData): boolean {
  return ["salaryOne", "salaryTwo", "benefits", "other"].some((key) => {
    const values = data.incomeLineValues?.[key];
    if (values) {
      return hasNonZeroValue(values);
    }

    return key === "salaryOne" && data.incomes.some((income) => hasNonZeroValue(income.monthlyValues));
  });
}

function hasSavings(data: OnboardingPlanningData): boolean {
  const goalIds = new Set(standardSavingsGoals.map((goal) => goal.id));
  return data.expenseItems.some(
    (item) => goalIds.has(item.id as OnboardingSavingsGoalId) && hasNonZeroValue(item.monthlyValues),
  );
}

function hasInsurance(data: OnboardingPlanningData): boolean {
  return data.expenseItems.some((item) => {
    const searchable = `${item.id} ${item.category} ${item.name}`.toLocaleLowerCase("sv-SE");
    return (
      (searchable.includes("forsak") || searchable.includes("försäk")) &&
      hasNonZeroValue(item.monthlyValues)
    );
  });
}

function hasPlannedCategory(
  data: OnboardingPlanningData,
  categoryIds: readonly string[],
): boolean {
  return data.expenseItems.some(
    (item) => categoryIds.includes(item.category) && hasNonZeroValue(item.monthlyValues),
  );
}

function hasDebtInformation(data: OnboardingPlanningData): boolean {
  return data.expenseItems.some((item) => {
    const isGuidedDebt =
      item.id.includes("guided-csn") ||
      item.id.includes("guided-private-loan") ||
      item.id.includes("guided-other-debt") ||
      item.id.includes("guided-credit-card") ||
      item.id.includes("guided-unsecured-loan") ||
      item.id.includes("guided-consumer-loan");

    return (
      (item.category === "lan-och-krediter" || isGuidedDebt) &&
      hasNonZeroValue(item.monthlyValues)
    );
  });
}

export function getPlanningCompletionSuggestion(
  data: OnboardingPlanningData,
): PlanningCompletionSuggestion | null {
  if (!hasIncome(data)) {
    return {
      actionLabel: "Lägg till dina inkomster",
      title: "Lägg till dina inkomster när det passar",
      description: "Då kan Fameko visa vad du faktiskt har kvar att fördela varje månad.",
      guideId: "income",
    };
  }

  if (!hasSavings(data)) {
    return {
      actionLabel: "Lägg till sparande",
      title: "Lägg till ditt sparande när du har tid",
      description: "Då blir sparkvoten och årets sparplan mer träffsäkra.",
      guideId: "savings",
    };
  }

  if (!hasInsurance(data)) {
    return {
      actionLabel: "Gå igenom försäkringar",
      title: "Fameko blir mer träffsäkert när du lägger till försäkringar",
      description: "Du kan fylla i dem i årsplaneringen när det passar.",
      guideId: "insurance",
    };
  }

  if (!hasPlannedCategory(data, ["streaming"])) {
    return {
      actionLabel: "Gå igenom abonnemang",
      title: "Vill du lägga till hushållets abonnemang?",
      description: "Du väljer själv vilka tjänster som är aktuella och vad de kostar.",
      guideId: "subscriptions",
    };
  }

  if (!hasPlannedCategory(data, ["husdjur"])) {
    return {
      actionLabel: "Gå igenom husdjur",
      title: "Lägg till husdjurets kostnader när det passar",
      description: "Fameko hjälper dig med försäkring och löpande kostnader.",
      guideId: "pets",
    };
  }

  if (!hasDebtInformation(data)) {
    return {
      actionLabel: "Gå igenom lån och krediter",
      title: "Samla lån och krediter i planeringen",
      description: "Du kan lägga till CSN, privatlån och andra återkommande kostnader.",
      guideId: "debts",
    };
  }

  return null;
}
