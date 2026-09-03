import type {
  FinancialHealthCompleteness,
  FinancialHealthObservation,
  FinancialHealthStatus,
} from "./financial-health-types.ts";

export const financialHealthRules = {
  bufferMonths: {
    lowBelow: 1,
    resilientAtLeast: 3,
  },
  carLoanToValue: {
    watchAbove: 100,
  },
  cashFlow: {
    negativeMonthsVulnerableAtLeast: 6,
    negativeMonthsWatchAtLeast: 2,
  },
  completeness: {
    highAtLeastSources: 4,
    mediumAtLeastSources: 2,
  },
  debts: {
    explicitConsumerCreditTerms: [
      "blancolan",
      "kreditkort",
      "konsumtionskredit",
      "konsumtionslan",
      "privatlan",
      "snabblan",
    ],
  },
  housingLoanToValue: {
    resilientAtMost: 60,
    watchAbove: 75,
  },
  savings: {
    regularMonthsAtLeast: 9,
  },
} as const;

type ObservationInput = Omit<FinancialHealthObservation, "condition"> & {
  condition: string;
};

function observation(input: ObservationInput): FinancialHealthObservation {
  return input;
}

export function evaluateCashFlowRules({
  annualMargin,
  negativeMonthCount,
}: {
  annualMargin: number;
  negativeMonthCount: number;
}) {
  const strengths: FinancialHealthObservation[] = [];
  const watchItems: FinancialHealthObservation[] = [];

  if (annualMargin > 0) {
    strengths.push(
      observation({
        code: "POSITIVE_ANNUAL_MARGIN",
        condition: "annualMargin > 0",
        message: "Planeringen har positiv marginal över året.",
        metric: "annualMargin",
        source: "cashFlow",
        value: annualMargin,
      }),
    );
  } else if (annualMargin < 0) {
    watchItems.push(
      observation({
        code: "NEGATIVE_ANNUAL_MARGIN",
        condition: "annualMargin < 0",
        message: "De planerade utflödena är större än inkomsterna över året.",
        metric: "annualMargin",
        source: "cashFlow",
        value: annualMargin,
      }),
    );
  }

  if (
    negativeMonthCount >=
    financialHealthRules.cashFlow.negativeMonthsWatchAtLeast
  ) {
    watchItems.push(
      observation({
        code: "SEVERAL_NEGATIVE_MONTHS",
        condition: `negativeMonthCount >= ${financialHealthRules.cashFlow.negativeMonthsWatchAtLeast}`,
        message: `${negativeMonthCount} månader har negativt planerat kassaflöde.`,
        metric: "negativeMonthCount",
        source: "cashFlow",
        value: negativeMonthCount,
      }),
    );
  }

  return { strengths, watchItems };
}

export function evaluateSavingsRules({
  monthsWithSavings,
  totalPlannedSavings,
}: {
  monthsWithSavings: number;
  totalPlannedSavings: number;
}) {
  if (
    totalPlannedSavings <= 0 ||
    monthsWithSavings < financialHealthRules.savings.regularMonthsAtLeast
  ) {
    return [];
  }

  return [
    observation({
      code: "REGULAR_PLANNED_SAVINGS",
      condition: `monthsWithSavings >= ${financialHealthRules.savings.regularMonthsAtLeast}`,
      message: "Planeringen innehåller ett regelbundet sparande.",
      metric: "monthsWithSavings",
      source: "savings",
      value: monthsWithSavings,
    }),
  ];
}

export function evaluateBufferRules(bufferMonths: number | null) {
  const strengths: FinancialHealthObservation[] = [];
  const watchItems: FinancialHealthObservation[] = [];

  if (bufferMonths === null) {
    return { strengths, watchItems };
  }

  if (bufferMonths >= financialHealthRules.bufferMonths.resilientAtLeast) {
    strengths.push(
      observation({
        code: "RESILIENT_LIQUID_BUFFER",
        condition: `bufferMonths >= ${financialHealthRules.bufferMonths.resilientAtLeast}`,
        message: "Den privata bufferten täcker flera månaders planerade utgifter.",
        metric: "bufferMonths",
        source: "buffer",
        value: bufferMonths,
      }),
    );
  } else if (bufferMonths < financialHealthRules.bufferMonths.lowBelow) {
    watchItems.push(
      observation({
        code: "LIMITED_LIQUID_BUFFER",
        condition: `bufferMonths < ${financialHealthRules.bufferMonths.lowBelow}`,
        message: "Den uppgivna bufferten motsvarar mindre än en månads planerade utgifter.",
        metric: "bufferMonths",
        source: "buffer",
        value: bufferMonths,
      }),
    );
  }

  return { strengths, watchItems };
}

export function evaluateHousingRules({
  loanToValue,
  monthlyAmortization,
  totalMortgage,
}: {
  loanToValue: number | null;
  monthlyAmortization: number | null;
  totalMortgage: number | null;
}) {
  const strengths: FinancialHealthObservation[] = [];
  const watchItems: FinancialHealthObservation[] = [];

  if (
    loanToValue !== null &&
    loanToValue <= financialHealthRules.housingLoanToValue.resilientAtMost
  ) {
    strengths.push(
      observation({
        code: "LOW_HOUSING_LTV",
        condition: `loanToValue <= ${financialHealthRules.housingLoanToValue.resilientAtMost}`,
        message: "Boendets belåningsgrad är låg.",
        metric: "loanToValue",
        source: "housing",
        value: loanToValue,
      }),
    );
  } else if (
    loanToValue !== null &&
    loanToValue > financialHealthRules.housingLoanToValue.watchAbove
  ) {
    watchItems.push(
      observation({
        code: "HIGH_HOUSING_LTV",
        condition: `loanToValue > ${financialHealthRules.housingLoanToValue.watchAbove}`,
        message: "Boendets belåningsgrad är relativt hög.",
        metric: "loanToValue",
        source: "housing",
        value: loanToValue,
      }),
    );
  }

  if (
    totalMortgage !== null &&
    totalMortgage > 0 &&
    monthlyAmortization !== null &&
    monthlyAmortization > 0
  ) {
    strengths.push(
      observation({
        code: "ACTIVE_MORTGAGE_AMORTIZATION",
        condition: "totalMortgage > 0 && monthlyAmortization > 0",
        message: "Amorteringen minskar bolåneskulden över tid.",
        metric: "monthlyAmortization",
        source: "housing",
        value: monthlyAmortization,
      }),
    );
  }

  return { strengths, watchItems };
}

export function evaluateCarRules({
  carValue,
  currentLoanBalance,
}: {
  carValue: number | null;
  currentLoanBalance: number | null;
}) {
  const strengths: FinancialHealthObservation[] = [];
  const watchItems: FinancialHealthObservation[] = [];

  if (currentLoanBalance === 0) {
    strengths.push(
      observation({
        code: "LOAN_FREE_CAR",
        condition: "currentLoanBalance === 0",
        message: "Bilen är lånefri.",
        metric: "currentLoanBalance",
        source: "car",
        value: currentLoanBalance,
      }),
    );
  }

  if (
    currentLoanBalance !== null &&
    currentLoanBalance > 0 &&
    carValue !== null &&
    carValue > 0
  ) {
    const loanToValue = (currentLoanBalance / carValue) * 100;
    if (loanToValue > financialHealthRules.carLoanToValue.watchAbove) {
      watchItems.push(
        observation({
          code: "CAR_LOAN_ABOVE_VALUE",
          condition: `carLoanToValue > ${financialHealthRules.carLoanToValue.watchAbove}`,
          message: "Bilskulden är högre än bilens uppgivna värde.",
          metric: "carLoanToValue",
          source: "car",
          value: loanToValue,
        }),
      );
    }
  }

  return { strengths, watchItems };
}

export function evaluateLongTermAssetRules({
  investments,
  privatePension,
}: {
  investments: number | null;
  privatePension: number | null;
}) {
  const strengths: FinancialHealthObservation[] = [];

  if (investments !== null && investments > 0) {
    strengths.push(
      observation({
        code: "PRIVATE_INVESTMENTS",
        condition: "investments > 0",
        message: "Privata investeringar bidrar till den långsiktiga ekonomiska grunden.",
        metric: "investments",
        source: "assets",
        value: investments,
      }),
    );
  }

  if (privatePension !== null && privatePension > 0) {
    strengths.push(
      observation({
        code: "PRIVATE_PENSION_SAVINGS",
        condition: "privatePension > 0",
        message: "Privat pensionssparande stärker den långsiktiga bilden.",
        metric: "privatePension",
        source: "assets",
        value: privatePension,
      }),
    );
  }

  return strengths;
}

export function evaluateDebtRules(consumerCreditAnnualPayment: number) {
  if (consumerCreditAnnualPayment <= 0) {
    return [];
  }

  return [
    observation({
      code: "PLANNED_CONSUMER_CREDIT_PAYMENTS",
      condition: "consumerCreditAnnualPayment > 0",
      message:
        "Planeringen innehåller betalningar för privatlån eller konsumentkrediter.",
      metric: "consumerCreditAnnualPayment",
      source: "debts",
      value: consumerCreditAnnualPayment,
    }),
  ];
}

export function getFinancialHealthCompleteness(
  availableSources: FinancialHealthCompleteness["availableSources"],
): FinancialHealthCompleteness {
  const uniqueSources = [...new Set(availableSources)];
  const level =
    uniqueSources.length >= financialHealthRules.completeness.highAtLeastSources
      ? "HIGH"
      : uniqueSources.length >=
          financialHealthRules.completeness.mediumAtLeastSources
        ? "MEDIUM"
        : "LOW";

  return {
    availableSources: uniqueSources,
    level,
    message:
      level === "HIGH"
        ? "Bedömningen bygger på ett brett underlag från din planering."
        : level === "MEDIUM"
          ? "Bedömningen bygger på de uppgifter du har lagt in."
          : "Underlaget är ännu begränsat och bedömningen hålls därför försiktig.",
  };
}

export function determineFinancialHealthStatus({
  annualMargin,
  completeness,
  hasCorePlanning,
  negativeMonthCount,
  strengths,
  watchItems,
}: {
  annualMargin: number;
  completeness: FinancialHealthCompleteness;
  hasCorePlanning: boolean;
  negativeMonthCount: number;
  strengths: FinancialHealthObservation[];
  watchItems: FinancialHealthObservation[];
}): FinancialHealthStatus {
  if (!hasCorePlanning) {
    return "INSUFFICIENT_DATA";
  }

  if (
    annualMargin < 0 ||
    negativeMonthCount >=
      financialHealthRules.cashFlow.negativeMonthsVulnerableAtLeast
  ) {
    return "VULNERABLE";
  }

  if (watchItems.length > 0) {
    return "NEEDS_ATTENTION";
  }

  if (completeness.level === "HIGH" && strengths.length >= 3) {
    return "STABLE";
  }

  return "GOOD_FOUNDATION";
}

export const financialHealthStatusLabels: Record<
  FinancialHealthStatus,
  string
> = {
  GOOD_FOUNDATION: "God grund",
  INSUFFICIENT_DATA: "Behöver mer underlag",
  NEEDS_ATTENTION: "Behöver uppmärksamhet",
  STABLE: "Stabil",
  VULNERABLE: "Sårbar",
};
