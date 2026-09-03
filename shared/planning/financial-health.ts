import type { CarData } from "./car.ts";
import { getEffectiveExpenseItemAmount } from "./effective-values.ts";
import type { FinancialAssetsData } from "./financial-assets.ts";
import {
  determineFinancialHealthStatus,
  evaluateBufferRules,
  evaluateCarRules,
  evaluateCashFlowRules,
  evaluateDebtRules,
  evaluateHousingRules,
  evaluateLongTermAssetRules,
  evaluateSavingsRules,
  financialHealthRules,
  financialHealthStatusLabels,
  getFinancialHealthCompleteness,
} from "./financial-health-rules.ts";
import type {
  FinancialHealthMetric,
  FinancialHealthObservation,
  FinancialHealthResult,
  FinancialHealthSource,
  FinancialHealthStatus,
} from "./financial-health-types.ts";
import {
  calculateHousingEconomics,
  type HousingData,
} from "./housing.ts";
import {
  getMajorHouseholdExpenses,
} from "./major-household-expenses.ts";
import { getSavingsOverview, savingsMonthIds } from "./savings.ts";

type MonthValues = Record<string, number>;

type FinancialHealthExpenseItem = {
  category: string;
  company?: string;
  description?: string;
  frequency?: string;
  id: string;
  monthlyValues: MonthValues;
  name: string;
  recurring: boolean;
};

export type FinancialHealthPlanningData = {
  allocationOverrides?: Record<string, Partial<MonthValues>>;
  areaItemValues?: Record<string, Partial<MonthValues>>;
  carData?: CarData;
  expenseCategories?: Array<{
    id: string;
    name: string;
  }>;
  expenseItems: FinancialHealthExpenseItem[];
  financialAssetsData?: FinancialAssetsData;
  housingData?: HousingData;
  incomes: Array<{
    monthlyValues: MonthValues;
  }>;
  incomeLineValues?: Partial<
    Record<string, Partial<Record<string, number>>>
  >;
  labels?: {
    expenseCategories?: Record<string, string>;
    expenseItems?: Record<string, string>;
    [key: string]: unknown;
  };
};

function normalizeIdentity(value: string | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sv-SE")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isDebtCategory(
  data: FinancialHealthPlanningData,
  item: FinancialHealthExpenseItem,
) {
  const category = data.expenseCategories?.find(
    (candidate) => candidate.id === item.category,
  );
  const identity = [
    item.category,
    category?.name,
    data.labels?.expenseCategories?.[item.category],
  ]
    .map(normalizeIdentity)
    .join(" ");

  return (
    identity.includes("lan och krediter") ||
    identity.includes("loans and credit")
  );
}

function isExplicitConsumerCredit(
  data: FinancialHealthPlanningData,
  item: FinancialHealthExpenseItem,
) {
  if (!isDebtCategory(data, item)) {
    return false;
  }

  const identity = [
    item.id,
    item.name,
    item.company,
    item.description,
    data.labels?.expenseItems?.[item.id],
  ]
    .map(normalizeIdentity)
    .join(" ")
    .replaceAll(" ", "");

  return financialHealthRules.debts.explicitConsumerCreditTerms.some((term) =>
    identity.includes(term),
  );
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function hasKnownFinancialAssetValue(data: FinancialAssetsData | undefined) {
  return Boolean(
    data &&
      Object.values(data).some(
        (value) => value !== null && value !== undefined,
      ),
  );
}

function hasKnownHousingValue(data: HousingData | undefined) {
  return Boolean(
    data &&
      [
        data.averageInterestRate,
        data.monthlyAmortization,
        data.propertyValue,
        data.totalMortgage,
      ].some((value) => value !== null),
  );
}

function hasKnownCarValue(data: CarData | undefined) {
  return Boolean(
    data &&
      [
        data.annualInsurance,
        data.annualService,
        data.averageInterestRate,
        data.carValue,
        data.currentLoanBalance,
        data.monthlyAmortization,
      ].some((value) => value !== null),
  );
}

function missingInput(
  code: string,
  source: FinancialHealthSource,
  metric: string,
  message: string,
): FinancialHealthObservation {
  return {
    code,
    condition: `${metric} is unknown`,
    message,
    metric,
    source,
    value: null,
  };
}

function getStatusSummary(
  status: FinancialHealthStatus,
  strengths: FinancialHealthObservation[],
  watchItems: FinancialHealthObservation[],
) {
  if (status === "INSUFFICIENT_DATA") {
    return "Underlaget är ännu begränsat. Lägg till planerade inkomster och kostnader för att få en första försiktig bedömning.";
  }

  if (status === "VULNERABLE") {
    return "Planeringen visar en ansträngd marginal. Det kan vara värt att följa kassaflödet och de största utflödena närmare.";
  }

  if (status === "NEEDS_ATTENTION") {
    const foundation = strengths[0]?.message ?? "Flera delar av ekonomin är kartlagda.";
    const watch = watchItems[0]?.message ?? "Någon del behöver följas närmare.";
    return `${foundation} ${watch}`;
  }

  if (status === "STABLE") {
    return "Planeringen visar positiv marginal och flera delar som stärker hushållets ekonomiska motståndskraft.";
  }

  return strengths[0]
    ? `Din ekonomi har en god grund. ${strengths[0].message}`
    : "Din ekonomi har en god grund utifrån den planering som finns i dag.";
}

export function evaluateFinancialHealth(
  planningData: FinancialHealthPlanningData,
  monthIds: readonly string[],
): FinancialHealthResult {
  const savings = getSavingsOverview(planningData);
  const annualExpenses = getMajorHouseholdExpenses({
    limit: Number.MAX_SAFE_INTEGER,
    monthIds,
    planningData,
  });
  const annualHouseholdCosts = annualExpenses.reduce(
    (total, expense) => total + expense.annualAmount,
    0,
  );
  const housingSupplement =
    annualExpenses.find((expense) => expense.source.type === "housingData")
      ?.annualAmount ?? 0;
  const monthlyHouseholdCosts = monthIds.map((monthId) => {
    const plannedMonthCost = getMajorHouseholdExpenses({
      limit: Number.MAX_SAFE_INTEGER,
      monthIds: [monthId],
      planningData,
    })
      .filter((expense) => expense.source.type !== "housingData")
      .reduce((total, expense) => total + expense.annualAmount, 0);

    return plannedMonthCost + housingSupplement / monthIds.length;
  });
  const monthlyIncome = monthIds.map((monthId) => {
    const savingsMonthIndex = savingsMonthIds.findIndex(
      (candidate) => candidate === monthId,
    );
    return savings.monthlyIncome[savingsMonthIndex] ?? 0;
  });
  const monthlySavings = monthIds.map((monthId) => {
    const savingsMonthIndex = savingsMonthIds.findIndex(
      (candidate) => candidate === monthId,
    );
    return savings.monthlySavings[savingsMonthIndex] ?? 0;
  });
  const monthlyMargins = monthIds.map(
    (_, index) =>
      monthlyIncome[index] -
      monthlyHouseholdCosts[index] -
      monthlySavings[index],
  );
  const annualIncome = sum(monthlyIncome);
  const annualPlannedSavings = sum(monthlySavings);
  const annualMargin = sum(monthlyMargins);
  const negativeMonthCount = monthlyMargins.filter((margin) => margin < 0).length;
  const averageMonthlyHouseholdCost =
    monthIds.length > 0 ? annualHouseholdCosts / monthIds.length : 0;
  const liquidSavings = planningData.financialAssetsData?.liquidSavings ?? null;
  const bufferMonths =
    liquidSavings === null || averageMonthlyHouseholdCost <= 0
      ? null
      : liquidSavings / averageMonthlyHouseholdCost;
  const housingEconomics = planningData.housingData
    ? calculateHousingEconomics(planningData.housingData)
    : null;
  const carLoanToValue =
    planningData.carData?.currentLoanBalance !== null &&
    planningData.carData?.currentLoanBalance !== undefined &&
    planningData.carData.carValue !== null &&
    planningData.carData.carValue > 0
      ? (planningData.carData.currentLoanBalance /
          planningData.carData.carValue) *
        100
      : null;
  const representedMortgageInterest = annualExpenses.find(
    (expense) =>
      expense.id === "planning-mortgage-interest" ||
      expense.id === "housing-mortgage-interest",
  )?.annualAmount;
  const mortgageInterestShare =
    representedMortgageInterest !== undefined && annualHouseholdCosts > 0
      ? (representedMortgageInterest / annualHouseholdCosts) * 100
      : null;
  const consumerCreditAnnualPayment = planningData.expenseItems
    .filter((item) => isExplicitConsumerCredit(planningData, item))
    .reduce(
      (total, item) =>
        total +
        monthIds.reduce(
          (itemTotal, monthId) =>
            itemTotal +
            Math.max(
              0,
              getEffectiveExpenseItemAmount(planningData, item, monthId),
            ),
          0,
        ),
      0,
    );
  const hasCorePlanning =
    annualIncome > 0 || annualHouseholdCosts > 0 || annualPlannedSavings > 0;

  const cashFlowRules = evaluateCashFlowRules({
    annualMargin,
    negativeMonthCount,
  });
  const bufferRules = evaluateBufferRules(bufferMonths);
  const housingRules = evaluateHousingRules({
    loanToValue: housingEconomics?.loanToValue ?? null,
    monthlyAmortization:
      planningData.housingData?.monthlyAmortization ?? null,
    totalMortgage: planningData.housingData?.totalMortgage ?? null,
  });
  const carRules = evaluateCarRules({
    carValue: planningData.carData?.carValue ?? null,
    currentLoanBalance: planningData.carData?.currentLoanBalance ?? null,
  });
  const strengths = [
    ...cashFlowRules.strengths,
    ...evaluateSavingsRules({
      monthsWithSavings: savings.monthlySavings.filter((amount) => amount > 0)
        .length,
      totalPlannedSavings: annualPlannedSavings,
    }),
    ...bufferRules.strengths,
    ...housingRules.strengths,
    ...carRules.strengths,
    ...evaluateLongTermAssetRules({
      investments: planningData.financialAssetsData?.investments ?? null,
      privatePension:
        planningData.financialAssetsData?.privatePension ?? null,
    }),
  ];
  const watchItems = [
    ...cashFlowRules.watchItems,
    ...bufferRules.watchItems,
    ...housingRules.watchItems,
    ...carRules.watchItems,
    ...evaluateDebtRules(consumerCreditAnnualPayment),
  ];
  const missingInputs: FinancialHealthObservation[] = [];

  if (!hasCorePlanning) {
    missingInputs.push(
      missingInput(
        "MISSING_CORE_PLANNING",
        "cashFlow",
        "annualIncomeAndCosts",
        "Planerade inkomster och kostnader saknas.",
      ),
    );
  }

  if (liquidSavings === null) {
    missingInputs.push(
      missingInput(
        "MISSING_LIQUID_SAVINGS",
        "buffer",
        "liquidSavings",
        "Privat buffert saknas i underlaget.",
      ),
    );
  }

  if (
    planningData.housingData &&
    (planningData.housingData.propertyValue === null ||
      planningData.housingData.totalMortgage === null)
  ) {
    missingInputs.push(
      missingInput(
        "INCOMPLETE_HOUSING_DATA",
        "housing",
        "loanToValue",
        "Bostadsvärde eller bolån saknas för att bedöma belåningsgraden.",
      ),
    );
  }

  if (
    planningData.carData &&
    (planningData.carData.carValue === null ||
      planningData.carData.currentLoanBalance === null)
  ) {
    missingInputs.push(
      missingInput(
        "INCOMPLETE_CAR_DATA",
        "car",
        "carLoanToValue",
        "Bilvärde eller bilskuld saknas för att jämföra lån och värde.",
      ),
    );
  }

  const availableSources: FinancialHealthSource[] = [];
  if (hasCorePlanning) availableSources.push("cashFlow");
  if (annualIncome > 0 || annualPlannedSavings > 0)
    availableSources.push("savings");
  if (liquidSavings !== null) availableSources.push("buffer");
  if (hasKnownHousingValue(planningData.housingData))
    availableSources.push("housing");
  if (hasKnownCarValue(planningData.carData)) availableSources.push("car");
  if (hasKnownFinancialAssetValue(planningData.financialAssetsData))
    availableSources.push("assets");
  if (consumerCreditAnnualPayment > 0) availableSources.push("debts");

  const dataCompleteness = getFinancialHealthCompleteness(availableSources);
  const status = determineFinancialHealthStatus({
    annualMargin,
    completeness: dataCompleteness,
    hasCorePlanning,
    negativeMonthCount,
    strengths,
    watchItems,
  });
  const metrics: FinancialHealthMetric[] = [];

  if (hasCorePlanning) {
    metrics.push(
      {
        code: "ANNUAL_INCOME",
        label: "Årsinkomster",
        source: "cashFlow",
        unit: "currency",
        value: annualIncome,
      },
      {
        caveat:
          "Planerade hushållskostnader exklusive sparande och amortering, kompletterade med känd bolåneränta.",
        code: "ANNUAL_HOUSEHOLD_COSTS",
        label: "Årskostnader",
        source: "cashFlow",
        unit: "currency",
        value: annualHouseholdCosts,
      },
      {
        code: "ANNUAL_PLANNED_SAVINGS",
        label: "Planerat sparande",
        source: "savings",
        unit: "currency",
        value: annualPlannedSavings,
      },
      {
        code: "ANNUAL_MARGIN",
        label: "Årsmarginal",
        source: "cashFlow",
        unit: "currency",
        value: annualMargin,
      },
      {
        code: "NEGATIVE_MONTHS",
        label: "Negativa månader",
        source: "cashFlow",
        unit: "count",
        value: negativeMonthCount,
      },
    );
  }

  if (savings.savingsRate !== null) {
    metrics.push({
      caveat: "Sparkvoten är en faktor i helhetsbilden, inte ett betyg.",
      code: "SAVINGS_RATE",
      label: "Sparkvot",
      source: "savings",
      unit: "percent",
      value: savings.savingsRate,
    });
  }

  metrics.push({
    caveat:
      "Beräknas mot genomsnittliga planerade hushållskostnader exklusive sparande och amortering.",
    code: "BUFFER_MONTHS",
    label: "Buffert i månader",
    source: "buffer",
    unit: "months",
    value: bufferMonths,
  });

  if (housingEconomics?.loanToValue !== null && housingEconomics?.loanToValue !== undefined) {
    metrics.push({
      code: "HOUSING_LTV",
      label: "Belåningsgrad",
      source: "housing",
      unit: "percent",
      value: housingEconomics.loanToValue,
    });
  }

  if (mortgageInterestShare !== null) {
    metrics.push({
      code: "MORTGAGE_INTEREST_SHARE",
      label: "Bolåneräntans kostnadsandel",
      source: "housing",
      unit: "percent",
      value: mortgageInterestShare,
    });
  }

  if (carLoanToValue !== null) {
    metrics.push({
      code: "CAR_LOAN_TO_VALUE",
      label: "Bilskuld jämfört med bilvärde",
      source: "car",
      unit: "percent",
      value: carLoanToValue,
    });
  }

  if (consumerCreditAnnualPayment > 0) {
    metrics.push({
      caveat: "Visar planerade betalningar, inte skuldens storlek eller ränta.",
      code: "CONSUMER_CREDIT_PAYMENTS",
      label: "Betalningar för konsumentkrediter",
      source: "debts",
      unit: "currency",
      value: consumerCreditAnnualPayment,
    });
  }

  if (liquidSavings !== null) {
    metrics.push({
      caveat: "Endast detta värde används som likvid buffert.",
      code: "LIQUID_SAVINGS",
      label: "Privat buffert",
      source: "buffer",
      unit: "currency",
      value: liquidSavings,
    });
  }

  if (planningData.financialAssetsData?.investments !== null && planningData.financialAssetsData?.investments !== undefined) {
    metrics.push({
      caveat: "Räknas inte automatiskt som lika likvid som privat buffert.",
      code: "PRIVATE_INVESTMENTS",
      label: "Privata investeringar",
      source: "assets",
      unit: "currency",
      value: planningData.financialAssetsData.investments,
    });
  }

  if (planningData.financialAssetsData?.privatePension !== null && planningData.financialAssetsData?.privatePension !== undefined) {
    metrics.push({
      caveat: "Behandlas långsiktigt och räknas inte som likvid buffert.",
      code: "PRIVATE_PENSION",
      label: "Privat pensionssparande",
      source: "assets",
      unit: "currency",
      value: planningData.financialAssetsData.privatePension,
    });
  }

  if (
    planningData.financialAssetsData?.otherFinancialAssets !== null &&
    planningData.financialAssetsData?.otherFinancialAssets !== undefined
  ) {
    metrics.push({
      code: "OTHER_FINANCIAL_ASSETS",
      label: "Andra finansiella tillgångar",
      source: "assets",
      unit: "currency",
      value: planningData.financialAssetsData.otherFinancialAssets,
    });
  }

  return {
    dataCompleteness,
    metrics,
    missingInputs,
    status,
    statusLabel: financialHealthStatusLabels[status],
    strengths,
    summary: getStatusSummary(status, strengths, watchItems),
    watchItems,
  };
}
