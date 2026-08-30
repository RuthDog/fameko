export type HousingData = {
  propertyValue: number | null;
  valuationDate: string | null;
  totalMortgage: number | null;
  averageInterestRate: number | null;
  monthlyAmortization: number | null;
};

export type HousingEconomics = {
  annualInterestCost: number | null;
  loanToValue: number | null;
  monthlyInterestCost: number | null;
  monthlyMortgageCost: number | null;
};

export type LoanToValueBand = "green" | "yellow" | "orange" | "red";

const housingDataKeys: (keyof HousingData)[] = [
  "propertyValue",
  "valuationDate",
  "totalMortgage",
  "averageInterestRate",
  "monthlyAmortization",
];
const maxHousingAmount = 1_000_000_000_000;

export const emptyHousingData: HousingData = {
  propertyValue: null,
  valuationDate: null,
  totalMortgage: null,
  averageInterestRate: null,
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
      value <= maxHousingAmount)
  );
}

function isNullableInterestRate(value: unknown) {
  return (
    value === null ||
    (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100)
  );
}

function isNullableDate(value: unknown) {
  if (value === null) {
    return true;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function isHousingData(value: unknown): value is HousingData {
  if (!isObject(value)) {
    return false;
  }

  const keys = Object.keys(value);
  if (
    keys.length !== housingDataKeys.length ||
    !keys.every((key) => housingDataKeys.includes(key as keyof HousingData))
  ) {
    return false;
  }

  return (
    isNullableAmount(value.propertyValue) &&
    isNullableDate(value.valuationDate) &&
    isNullableAmount(value.totalMortgage) &&
    isNullableInterestRate(value.averageInterestRate) &&
    isNullableAmount(value.monthlyAmortization)
  );
}

export function calculateHousingEconomics(data: HousingData): HousingEconomics {
  const loanToValue =
    data.propertyValue !== null && data.propertyValue > 0 && data.totalMortgage !== null
      ? (data.totalMortgage / data.propertyValue) * 100
      : null;
  const annualInterestCost =
    data.totalMortgage !== null && data.averageInterestRate !== null
      ? data.totalMortgage * (data.averageInterestRate / 100)
      : null;
  const monthlyInterestCost = annualInterestCost === null ? null : annualInterestCost / 12;
  const monthlyMortgageCost =
    monthlyInterestCost === null
      ? null
      : monthlyInterestCost + (data.monthlyAmortization ?? 0);

  return {
    annualInterestCost,
    loanToValue,
    monthlyInterestCost,
    monthlyMortgageCost,
  };
}

export function getLoanToValueBand(loanToValue: number | null): LoanToValueBand | null {
  if (loanToValue === null) {
    return null;
  }

  if (loanToValue < 60) {
    return "green";
  }

  if (loanToValue <= 75) {
    return "yellow";
  }

  if (loanToValue <= 85) {
    return "orange";
  }

  return "red";
}

export function getHousingSummary(loanToValue: number | null) {
  const band = getLoanToValueBand(loanToValue);

  if (band === null) {
    return "Fyll i bostadsvärde och bolån för att se belåningsgrad och kostnad.";
  }

  if (band === "green") {
    return "Din belåningsgrad är låg och ger god motståndskraft.";
  }

  if (band === "yellow") {
    return "Din belåningsgrad är balanserad. Fortsatt amortering stärker motståndskraften.";
  }

  if (band === "orange") {
    return "Belåningsgraden börjar bli hög. Ökad amortering förbättrar motståndskraften.";
  }

  return "Belåningsgraden är hög. En tydlig amorteringsplan stärker motståndskraften.";
}
