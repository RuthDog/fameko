export type CarData = {
  annualInsurance: number | null;
  annualService: number | null;
  averageInterestRate: number | null;
  carName: string | null;
  carValue: number | null;
  currentLoanBalance: number | null;
  monthlyAmortization: number | null;
};

export type CarEconomics = {
  annualInterestCost: number | null;
  monthlyInsurance: number | null;
  monthlyInterestCost: number | null;
  monthlyLoanCost: number | null;
  monthlyService: number | null;
};

export type CarLoanMode = "loanFree" | "unknown" | "withLoan";

export type CarPlanningEconomics = {
  annualPlannedCost: number;
  hasPlannedLoan: boolean;
  monthlyPlannedCost: number;
  monthlyPlannedLoanPayment: number;
};

export type CarPlanningSource = {
  expenseItems: Array<{
    category: string;
    id: string;
    monthlyValues: Record<string, number>;
    name: string;
  }>;
  labels?: {
    expenseItems?: Record<string, string>;
  };
};

const carDataKeys: (keyof CarData)[] = [
  "annualInsurance",
  "annualService",
  "averageInterestRate",
  "carName",
  "carValue",
  "currentLoanBalance",
  "monthlyAmortization",
];
const maxCarAmount = 1_000_000_000_000;
const maxCarNameLength = 80;

export const emptyCarData: CarData = {
  annualInsurance: null,
  annualService: null,
  averageInterestRate: null,
  carName: null,
  carValue: null,
  currentLoanBalance: null,
  monthlyAmortization: null,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNullableAmount(value: unknown) {
  return (
    value === null ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= maxCarAmount)
  );
}

function isNullableInterestRate(value: unknown) {
  return (
    value === null ||
    (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100)
  );
}

function isNullableName(value: unknown) {
  return (
    value === null ||
    (typeof value === "string" && value.trim().length > 0 && value.length <= maxCarNameLength)
  );
}

export function isCarData(value: unknown): value is CarData {
  if (!isObject(value)) {
    return false;
  }

  const keys = Object.keys(value);
  if (
    keys.length !== carDataKeys.length ||
    !keys.every((key) => carDataKeys.includes(key as keyof CarData))
  ) {
    return false;
  }

  return (
    isNullableAmount(value.annualInsurance) &&
    isNullableAmount(value.annualService) &&
    isNullableInterestRate(value.averageInterestRate) &&
    isNullableName(value.carName) &&
    isNullableAmount(value.carValue) &&
    isNullableAmount(value.currentLoanBalance) &&
    isNullableAmount(value.monthlyAmortization)
  );
}

export function calculateCarEconomics(data: CarData): CarEconomics {
  const annualInterestCost =
    data.currentLoanBalance === 0
      ? 0
      : data.currentLoanBalance !== null && data.averageInterestRate !== null
        ? data.currentLoanBalance * (data.averageInterestRate / 100)
        : null;
  const monthlyInterestCost = annualInterestCost === null ? null : annualInterestCost / 12;
  const monthlyLoanCost =
    data.currentLoanBalance === 0
      ? 0
      : monthlyInterestCost === null
      ? null
      : monthlyInterestCost + (data.monthlyAmortization ?? 0);

  return {
    annualInterestCost,
    monthlyInsurance:
      data.annualInsurance === null ? null : data.annualInsurance / 12,
    monthlyInterestCost,
    monthlyLoanCost,
    monthlyService: data.annualService === null ? null : data.annualService / 12,
  };
}

export function getCarLoanMode(data: CarData | undefined): CarLoanMode {
  if (!data || data.currentLoanBalance === null) {
    return "unknown";
  }

  return data.currentLoanBalance === 0 ? "loanFree" : "withLoan";
}

function isPlannedLoanItem(
  item: CarPlanningSource["expenseItems"][number],
  labels: CarPlanningSource["labels"],
) {
  const label = labels?.expenseItems?.[item.id] ?? item.name;
  return item.id === "bil-billan" || label.toLocaleLowerCase("sv-SE").includes("billån");
}

export function getCarPlanningEconomics(
  data: CarPlanningSource,
  monthId: string,
): CarPlanningEconomics {
  const carItems = data.expenseItems.filter((item) => item.category === "bil");
  const plannedLoanItems = carItems.filter((item) => isPlannedLoanItem(item, data.labels));

  return {
    annualPlannedCost: carItems.reduce(
      (annualTotal, item) =>
        annualTotal + Object.values(item.monthlyValues).reduce((total, amount) => total + amount, 0),
      0,
    ),
    hasPlannedLoan: plannedLoanItems.some((item) =>
      Object.values(item.monthlyValues).some((amount) => amount > 0),
    ),
    monthlyPlannedCost: carItems.reduce(
      (total, item) => total + (item.monthlyValues[monthId] ?? 0),
      0,
    ),
    monthlyPlannedLoanPayment: plannedLoanItems.reduce(
      (total, item) => total + (item.monthlyValues[monthId] ?? 0),
      0,
    ),
  };
}
