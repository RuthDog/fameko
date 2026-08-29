import { isHousingData } from "../../shared/planning/housing.ts";

const monthIds = [
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

const allocationKeys = ["food", "spending", "billAccount", "mortgage", "savings"] as const;
const areaItemKeys = [
  "mortgageInterest",
  "mortgageAmortization",
  "savingsBuffer",
  "savingsVacation",
  "savingsIsk",
  "savingsPension",
] as const;
const incomeLineKeys = ["salaryOne", "salaryTwo", "benefits", "other"] as const;
const frequencies = [
  "once",
  "monthly",
  "everyTwoMonths",
  "quarterly",
  "twiceYearly",
  "yearly",
] as const;

const maxAmount = 1_000_000_000_000;
const maxIdLength = 120;
const maxNameLength = 120;
const maxLabelLength = 48;

export const planningDataVersion = 3;
export const planningPayloadMaxBytes = 256 * 1024;

export type PlanningDataJson = Record<string, unknown> & { version: 3 };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= maxAmount;
}

function isMonthValues(value: unknown, requireEveryMonth: boolean): boolean {
  if (!isObject(value) || !hasOnlyKeys(value, monthIds)) {
    return false;
  }

  if (requireEveryMonth && !monthIds.every((monthId) => monthId in value)) {
    return false;
  }

  return Object.values(value).every(isAmount);
}

function isOptionalValueMap(value: unknown, allowedKeys: readonly string[]): boolean {
  if (value === undefined) {
    return true;
  }

  if (!isObject(value) || !hasOnlyKeys(value, allowedKeys)) {
    return false;
  }

  return Object.values(value).every((monthValues) => isMonthValues(monthValues, false));
}

function isLabelMap(value: unknown, allowedKeys?: readonly string[]): boolean {
  if (value === undefined) {
    return true;
  }

  if (!isObject(value) || (allowedKeys && !hasOnlyKeys(value, allowedKeys))) {
    return false;
  }

  return Object.values(value).every((label) => isNonEmptyString(label, maxLabelLength));
}

function hasValidLabels(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  if (
    !isObject(value) ||
    !hasOnlyKeys(value, [
      "incomeLines",
      "allocations",
      "areaItems",
      "expenseCategories",
      "expenseItems",
    ])
  ) {
    return false;
  }

  return (
    isLabelMap(value.incomeLines, incomeLineKeys) &&
    isLabelMap(value.allocations, allocationKeys) &&
    isLabelMap(value.areaItems, areaItemKeys) &&
    isLabelMap(value.expenseCategories) &&
    isLabelMap(value.expenseItems)
  );
}

function isIncome(value: unknown): boolean {
  return (
    isObject(value) &&
    hasOnlyKeys(value, ["id", "name", "monthlyValues", "recurring"]) &&
    isNonEmptyString(value.id, maxIdLength) &&
    isNonEmptyString(value.name, maxNameLength) &&
    typeof value.recurring === "boolean" &&
    isMonthValues(value.monthlyValues, true)
  );
}

function isExpenseCategory(value: unknown): boolean {
  return (
    isObject(value) &&
    hasOnlyKeys(value, ["id", "name", "order"]) &&
    isNonEmptyString(value.id, maxIdLength) &&
    isNonEmptyString(value.name, maxNameLength) &&
    typeof value.order === "number" &&
    Number.isInteger(value.order) &&
    value.order >= 0 &&
    value.order <= 1_000
  );
}

function isExpenseItem(value: unknown): boolean {
  return (
    isObject(value) &&
    hasOnlyKeys(value, ["id", "category", "name", "monthlyValues", "recurring", "frequency"]) &&
    isNonEmptyString(value.id, maxIdLength) &&
    isNonEmptyString(value.category, maxIdLength) &&
    isNonEmptyString(value.name, maxNameLength) &&
    typeof value.recurring === "boolean" &&
    (value.frequency === undefined ||
      (typeof value.frequency === "string" && frequencies.includes(value.frequency as (typeof frequencies)[number]))) &&
    isMonthValues(value.monthlyValues, true)
  );
}

export function isPlanningData(value: unknown): value is PlanningDataJson {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, [
      "version",
      "openingBalance",
      "incomes",
      "expenseCategories",
      "expenseItems",
      "allocationOverrides",
      "areaItemValues",
      "incomeLineValues",
      "labels",
      "housingData",
    ])
  ) {
    return false;
  }

  return (
    value.version === planningDataVersion &&
    isAmount(value.openingBalance) &&
    Array.isArray(value.incomes) &&
    value.incomes.length <= 50 &&
    value.incomes.every(isIncome) &&
    Array.isArray(value.expenseCategories) &&
    value.expenseCategories.length <= 100 &&
    value.expenseCategories.every(isExpenseCategory) &&
    Array.isArray(value.expenseItems) &&
    value.expenseItems.length <= 1_000 &&
    value.expenseItems.every(isExpenseItem) &&
    isOptionalValueMap(value.allocationOverrides, allocationKeys) &&
    isOptionalValueMap(value.areaItemValues, areaItemKeys) &&
    isOptionalValueMap(value.incomeLineValues, incomeLineKeys) &&
    hasValidLabels(value.labels) &&
    (value.housingData === undefined || isHousingData(value.housingData))
  );
}

export function serializedPlanningDataSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
