import {
  calculateCarEconomics,
  getCarLoanMode,
  type CarData,
  type CarLoanMode,
} from "./car.ts";
import { getEffectiveExpenseItemAmount } from "./effective-values.ts";
import { getExpenseItemPresentation } from "./expense-item-identity.ts";
import type { FinancialAssetsData } from "./financial-assets.ts";
import {
  evaluateFinancialHealth,
  type FinancialHealthPlanningData,
} from "./financial-health.ts";
import type {
  FinancialHealthDataCompleteness,
  FinancialHealthObservation,
  FinancialHealthStatus,
} from "./financial-health-types.ts";
import { calculateHousingEconomics, type HousingData } from "./housing.ts";
import {
  getEmploymentTypeLabel,
  incomeLineKeys,
  type EmploymentType,
  type HouseholdProfile,
  type IncomeLineKey,
  type IncomeMetadata,
} from "./income-metadata.ts";
import {
  getMajorHouseholdExpenses,
  type MajorHouseholdExpense,
} from "./major-household-expenses.ts";
import { getSavingsOverview, savingsMonthIds } from "./savings.ts";

export const bankReportSectionOrder = [
  "summary",
  "financialHealth",
  "income",
  "assets",
  "debts",
  "majorExpenses",
  "dataQuality",
] as const;

export type BankReportSectionId = (typeof bankReportSectionOrder)[number];

export type BankReportPlanningData = FinancialHealthPlanningData & {
  carData?: CarData;
  financialAssetsData?: FinancialAssetsData;
  housingData?: HousingData;
  householdProfile?: HouseholdProfile;
  incomeMetadata?: Partial<Record<IncomeLineKey, IncomeMetadata>>;
  labels?: FinancialHealthPlanningData["labels"] & {
    incomeLines?: Record<string, string>;
  };
};

export type BankReportMissingMetadata = {
  field:
    | "householdDisplayName"
    | "incomeComment"
    | "incomeEmployer"
    | "incomeEmploymentType"
    | "incomeOccupation";
  label: string;
  section: "income" | "summary";
  status: "notCollected";
};

export type BankReportIncome = {
  annualAmount: number;
  comment: string | null;
  displayName: string;
  employer: string | null;
  employmentType: EmploymentType | null;
  employmentTypeLabel: string | null;
  incomeLineKey: IncomeLineKey;
  monthlyAmount: number | null;
  monthlyAmounts: Array<{
    amount: number;
    monthId: string;
  }>;
  occupation: string | null;
};

export type BankReportPlanningItem = {
  annualAmount: number;
  categoryId: string;
  company: string | null;
  description: string | null;
  displayName: string;
  id: string;
  monthlyAmounts: Array<{
    amount: number;
    monthId: string;
  }>;
};

export type BankReportModel = {
  car: {
    annualInsurance: number | null;
    annualPlannedCosts: number;
    annualService: number | null;
    averageInterestRate: number | null;
    carName: string | null;
    carValue: number | null;
    currentLoanBalance: number | null;
    hasData: boolean;
    loanStatus: CarLoanMode;
    monthlyAmortization: number | null;
    monthlyInsurance: number | null;
    monthlyInterestCost: number | null;
    monthlyLoanCost: number | null;
    monthlyService: number | null;
  };
  document: {
    currency: "SEK";
    generatedAt: string;
    locale: "sv-SE";
    planningYear: number;
    reportVersion: 1;
    title: "Hushållets ekonomiska översikt";
  };
  financialHealth: {
    completeness: FinancialHealthDataCompleteness;
    missingInputs: FinancialHealthObservation[];
    status: FinancialHealthStatus;
    statusLabel: string;
    strengths: FinancialHealthObservation[];
    summary: string;
    watchItems: FinancialHealthObservation[];
  };
  housing: {
    annualInterestCost: number | null;
    annualPlannedCosts: number;
    averageInterestRate: number | null;
    hasData: boolean;
    loanToValue: number | null;
    monthlyAmortization: number | null;
    monthlyInterestCost: number | null;
    monthlyMortgageCost: number | null;
    propertyValue: number | null;
    totalMortgage: number | null;
    valuationDate: string | null;
  };
  income: {
    annualAmount: number;
    averageMonthlyAmount: number;
    items: BankReportIncome[];
    monthlyAmounts: Array<{
      amount: number;
      monthId: string;
    }>;
  };
  majorExpenses: MajorHouseholdExpense[];
  metadata: {
    householdDisplayName: string | null;
    missing: BankReportMissingMetadata[];
  };
  savings: {
    assets: {
      investments: number | null;
      liquidBuffer: number | null;
      otherFinancialAssets: number | null;
      privatePension: number | null;
    };
    averageMonthlyAmount: number;
    financialAssetsTotal: number | null;
    goals: Array<{
      annualAmount: number;
      averageMonthlyAmount: number;
      id: string;
      name: string;
    }>;
    plannedAnnualAmount: number;
    savingsRate: number | null;
  };
  sectionOrder: readonly BankReportSectionId[];
  sourceDetails: {
    planningItems: BankReportPlanningItem[];
  };
  summary: {
    annualHouseholdCosts: number | null;
    annualIncome: number | null;
    annualMargin: number | null;
    annualPlannedSavings: number | null;
    financialHealthStatus: FinancialHealthStatus;
    financialHealthSummary: string;
    householdDisplayName: string | null;
    financialAssetsTotal: number | null;
    liquidAssets: number | null;
    savingsRate: number | null;
  };
};

export type BuildBankReportOptions = {
  generatedAt: Date | string;
  planningYear: number;
};

const missingMetadata: BankReportMissingMetadata[] = [
  {
    field: "householdDisplayName",
    label: "Hushåll",
    section: "summary",
    status: "notCollected",
  },
  {
    field: "incomeEmployer",
    label: "Arbetsgivare",
    section: "income",
    status: "notCollected",
  },
  {
    field: "incomeEmploymentType",
    label: "Anställningsform",
    section: "income",
    status: "notCollected",
  },
  {
    field: "incomeOccupation",
    label: "Yrke",
    section: "income",
    status: "notCollected",
  },
  {
    field: "incomeComment",
    label: "Kommentar",
    section: "income",
    status: "notCollected",
  },
];

function normalizeGeneratedAt(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError("generatedAt must be a valid date");
  }

  return date.toISOString();
}

function metricValue(
  result: ReturnType<typeof evaluateFinancialHealth>,
  code: string,
) {
  return result.metrics.find((metric) => metric.code === code)?.value ?? null;
}

function annualCostsForCategory(
  expenses: readonly MajorHouseholdExpense[],
  categoryId: string,
) {
  return expenses.reduce((total, expense) => {
    if (
      expense.source.type === "planningData" &&
      expense.source.categoryId === categoryId
    ) {
      return total + expense.annualAmount;
    }

    return total;
  }, 0);
}

function hasKnownValue(values: readonly unknown[]) {
  return values.some((value) =>
    typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined,
  );
}

function getFinancialAssetsTotal(data: FinancialAssetsData | undefined) {
  if (!data) {
    return null;
  }

  const knownValues = Object.values(data).filter(
    (value): value is number => value !== null,
  );

  return knownValues.length
    ? knownValues.reduce((total, value) => total + value, 0)
    : null;
}

function getPlanningItems(
  planningData: BankReportPlanningData,
): BankReportPlanningItem[] {
  return planningData.expenseItems.map((item) => {
    const presentation = getExpenseItemPresentation(
      item,
      planningData.labels?.expenseItems?.[item.id],
    );
    const monthlyAmounts = savingsMonthIds.map((monthId) => ({
      amount: getEffectiveExpenseItemAmount(planningData, item, monthId),
      monthId,
    }));

    return {
      annualAmount: monthlyAmounts.reduce(
        (total, month) => total + month.amount,
        0,
      ),
      categoryId: item.category,
      company: presentation.company,
      description: presentation.description,
      displayName: presentation.primaryLabel,
      id: item.id,
      monthlyAmounts,
    };
  });
}

const defaultIncomeLineLabels: Record<IncomeLineKey, string> = {
  salaryOne: "Lön 1",
  salaryTwo: "Lön 2",
  benefits: "Bidrag",
  other: "Övrigt",
};

function incomeLineAmounts(
  planningData: BankReportPlanningData,
  incomeLineKey: IncomeLineKey,
) {
  return savingsMonthIds.map((monthId) => {
    const explicitAmount = planningData.incomeLineValues?.[incomeLineKey]?.[monthId];

    if (explicitAmount !== undefined) {
      return explicitAmount;
    }

    if (incomeLineKey !== "salaryOne") {
      return 0;
    }

    return planningData.incomes.reduce(
      (total, income) => total + (income.monthlyValues[monthId] ?? 0),
      0,
    );
  });
}

function normalizedMetadataText(value: string | null | undefined) {
  return value?.trim() || null;
}

function getReportIncomes(planningData: BankReportPlanningData): BankReportIncome[] {
  return incomeLineKeys.flatMap((incomeLineKey) => {
    const amounts = incomeLineAmounts(planningData, incomeLineKey);
    const metadata = planningData.incomeMetadata?.[incomeLineKey];
    const hasMetadata = Boolean(
      metadata && Object.values(metadata).some((value) => value !== null && value !== ""),
    );
    const hasPlannedAmount = amounts.some((amount) => amount !== 0);

    if (!hasPlannedAmount && !hasMetadata) {
      return [];
    }

    const firstAmount = amounts[0] ?? 0;
    const hasStableMonthlyAmount = amounts.every((amount) => amount === firstAmount);
    const employmentType = metadata?.employmentType ?? null;

    return [{
      annualAmount: amounts.reduce((total, amount) => total + amount, 0),
      comment: normalizedMetadataText(metadata?.incomeComment),
      displayName:
        planningData.labels?.incomeLines?.[incomeLineKey] ??
        defaultIncomeLineLabels[incomeLineKey],
      employer: normalizedMetadataText(metadata?.employer),
      employmentType,
      employmentTypeLabel: getEmploymentTypeLabel(employmentType),
      incomeLineKey,
      monthlyAmount: hasStableMonthlyAmount ? firstAmount : null,
      monthlyAmounts: savingsMonthIds.map((monthId, index) => ({
        amount: amounts[index] ?? 0,
        monthId,
      })),
      occupation: normalizedMetadataText(metadata?.occupation),
    }];
  });
}

function getMissingMetadata(
  planningData: BankReportPlanningData,
  incomes: readonly BankReportIncome[],
) {
  const householdDisplayName = normalizedMetadataText(
    planningData.householdProfile?.householdDisplayName,
  );

  return missingMetadata.filter(({ field }) => {
    if (field === "householdDisplayName") {
      return householdDisplayName === null;
    }

    const incomeField = {
      incomeComment: "comment",
      incomeEmployer: "employer",
      incomeEmploymentType: "employmentType",
      incomeOccupation: "occupation",
    }[field] as "comment" | "employer" | "employmentType" | "occupation";

    return incomes.length === 0 || incomes.some((income) => income[incomeField] === null);
  });
}

export function buildBankReportModel(
  planningData: BankReportPlanningData,
  options: BuildBankReportOptions,
): BankReportModel {
  if (!Number.isInteger(options.planningYear) || options.planningYear < 1) {
    throw new RangeError("planningYear must be a positive integer");
  }

  const savings = getSavingsOverview(planningData);
  const financialHealth = evaluateFinancialHealth(
    planningData,
    savingsMonthIds,
  );
  const allMajorExpenses = getMajorHouseholdExpenses({
    limit: Number.MAX_SAFE_INTEGER,
    monthIds: savingsMonthIds,
    planningData,
  });
  const housingEconomics = planningData.housingData
    ? calculateHousingEconomics(planningData.housingData)
    : null;
  const carEconomics = planningData.carData
    ? calculateCarEconomics(planningData.carData)
    : null;
  const annualIncome = metricValue(financialHealth, "ANNUAL_INCOME");
  const annualHouseholdCosts = metricValue(
    financialHealth,
    "ANNUAL_HOUSEHOLD_COSTS",
  );
  const annualPlannedSavings = metricValue(
    financialHealth,
    "ANNUAL_PLANNED_SAVINGS",
  );
  const annualMargin = metricValue(financialHealth, "ANNUAL_MARGIN");
  const reportIncomes = getReportIncomes(planningData);
  const householdDisplayName = normalizedMetadataText(
    planningData.householdProfile?.householdDisplayName,
  );
  const financialAssetsTotal = getFinancialAssetsTotal(
    planningData.financialAssetsData,
  );

  return {
    car: {
      annualInsurance: planningData.carData?.annualInsurance ?? null,
      annualPlannedCosts: annualCostsForCategory(allMajorExpenses, "bil"),
      annualService: planningData.carData?.annualService ?? null,
      averageInterestRate: planningData.carData?.averageInterestRate ?? null,
      carName: planningData.carData?.carName ?? null,
      carValue: planningData.carData?.carValue ?? null,
      currentLoanBalance: planningData.carData?.currentLoanBalance ?? null,
      hasData: hasKnownValue([
        planningData.carData?.annualInsurance,
        planningData.carData?.annualService,
        planningData.carData?.averageInterestRate,
        planningData.carData?.carName,
        planningData.carData?.carValue,
        planningData.carData?.currentLoanBalance,
        planningData.carData?.monthlyAmortization,
      ]),
      loanStatus: getCarLoanMode(planningData.carData),
      monthlyAmortization: planningData.carData?.monthlyAmortization ?? null,
      monthlyInsurance: carEconomics?.monthlyInsurance ?? null,
      monthlyInterestCost: carEconomics?.monthlyInterestCost ?? null,
      monthlyLoanCost: carEconomics?.monthlyLoanCost ?? null,
      monthlyService: carEconomics?.monthlyService ?? null,
    },
    document: {
      currency: "SEK",
      generatedAt: normalizeGeneratedAt(options.generatedAt),
      locale: "sv-SE",
      planningYear: options.planningYear,
      reportVersion: 1,
      title: "Hushållets ekonomiska översikt",
    },
    financialHealth: {
      completeness: financialHealth.dataCompleteness.level,
      missingInputs: financialHealth.missingInputs,
      status: financialHealth.status,
      statusLabel: financialHealth.statusLabel,
      strengths: financialHealth.strengths,
      summary: financialHealth.summary,
      watchItems: financialHealth.watchItems,
    },
    housing: {
      annualInterestCost: housingEconomics?.annualInterestCost ?? null,
      annualPlannedCosts:
        annualCostsForCategory(allMajorExpenses, "boende") +
        allMajorExpenses
          .filter(
            (expense) =>
              expense.source.type === "housingData" ||
              expense.id === "planning-mortgage-interest",
          )
          .reduce((total, expense) => total + expense.annualAmount, 0),
      averageInterestRate:
        planningData.housingData?.averageInterestRate ?? null,
      hasData: hasKnownValue([
        planningData.housingData?.averageInterestRate,
        planningData.housingData?.monthlyAmortization,
        planningData.housingData?.propertyValue,
        planningData.housingData?.totalMortgage,
        planningData.housingData?.valuationDate,
      ]),
      loanToValue: housingEconomics?.loanToValue ?? null,
      monthlyAmortization:
        planningData.housingData?.monthlyAmortization ?? null,
      monthlyInterestCost: housingEconomics?.monthlyInterestCost ?? null,
      monthlyMortgageCost: housingEconomics?.monthlyMortgageCost ?? null,
      propertyValue: planningData.housingData?.propertyValue ?? null,
      totalMortgage: planningData.housingData?.totalMortgage ?? null,
      valuationDate: planningData.housingData?.valuationDate ?? null,
    },
    income: {
      annualAmount: savings.monthlyIncome.reduce(
        (total, amount) => total + amount,
        0,
      ),
      averageMonthlyAmount:
        savings.monthlyIncome.length > 0
          ? savings.monthlyIncome.reduce((total, amount) => total + amount, 0) /
            savings.monthlyIncome.length
          : 0,
      items: reportIncomes,
      monthlyAmounts: savingsMonthIds.map((monthId, index) => ({
        amount: savings.monthlyIncome[index] ?? 0,
        monthId,
      })),
    },
    majorExpenses: allMajorExpenses.slice(0, 3),
    metadata: {
      householdDisplayName,
      missing: getMissingMetadata(planningData, reportIncomes).map((metadata) => ({
        ...metadata,
      })),
    },
    savings: {
      assets: {
        investments: planningData.financialAssetsData?.investments ?? null,
        liquidBuffer:
          planningData.financialAssetsData?.liquidSavings ?? null,
        otherFinancialAssets:
          planningData.financialAssetsData?.otherFinancialAssets ?? null,
        privatePension:
          planningData.financialAssetsData?.privatePension ?? null,
      },
      averageMonthlyAmount: savings.averageMonthlySavings,
      financialAssetsTotal,
      goals: savings.goals.map((goal) => ({
        annualAmount: goal.totalPlannedSavings,
        averageMonthlyAmount: goal.averageMonthlySavings,
        id: goal.id,
        name: goal.name,
      })),
      plannedAnnualAmount: savings.totalPlannedSavings,
      savingsRate: savings.savingsRate,
    },
    sectionOrder: [...bankReportSectionOrder],
    sourceDetails: {
      planningItems: getPlanningItems(planningData),
    },
    summary: {
      annualHouseholdCosts,
      annualIncome,
      annualMargin,
      annualPlannedSavings,
      financialHealthStatus: financialHealth.status,
      financialHealthSummary: financialHealth.summary,
      householdDisplayName,
      financialAssetsTotal,
      liquidAssets: planningData.financialAssetsData?.liquidSavings ?? null,
      savingsRate: savings.savingsRate,
    },
  };
}
