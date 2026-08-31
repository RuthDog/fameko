export type PlanningEditScope = "future" | "single";

type MonthValues = Record<string, number>;

export type EffectiveExpenseItem = {
  category?: string;
  id: string;
  monthlyValues: MonthValues;
  name: string;
};

export type EffectiveExpensePlanningSource = {
  allocationOverrides?: {
    food?: Partial<MonthValues>;
  };
  expenseCategories?: Array<{
    id: string;
    name: string;
  }>;
  expenseItems: EffectiveExpenseItem[];
  labels?: {
    expenseCategories?: Record<string, string>;
  };
};

export type EffectiveExpenseCategoryTotal = {
  id: string;
  name: string;
  total: number;
};

function getEffectiveCategoryOverride(
  data: EffectiveExpensePlanningSource,
  categoryId: string,
  monthId: string,
) {
  return categoryId === "mat" ? data.allocationOverrides?.food?.[monthId] : undefined;
}

function getCategoryItems(data: EffectiveExpensePlanningSource, categoryId: string) {
  return data.expenseItems.filter((item) => item.category === categoryId);
}

function getPrimaryCategoryItem(
  data: EffectiveExpensePlanningSource,
  categoryId: string,
) {
  const categoryItems = getCategoryItems(data, categoryId);
  return (
    categoryItems.find((item) => item.id === `${categoryId}-${categoryId}`) ??
    categoryItems[0]
  );
}

export function getEffectiveExpenseCategoryAmount(
  data: EffectiveExpensePlanningSource,
  categoryId: string,
  monthId: string,
) {
  const override = getEffectiveCategoryOverride(data, categoryId, monthId);

  if (override !== undefined) {
    return override;
  }

  return getCategoryItems(data, categoryId).reduce(
    (total, item) => total + (item.monthlyValues[monthId] ?? 0),
    0,
  );
}

export function getEffectiveExpenseItemAmount(
  data: EffectiveExpensePlanningSource,
  item: EffectiveExpenseItem,
  monthId: string,
) {
  const baseAmount = item.monthlyValues[monthId] ?? 0;

  if (!item.category) {
    return baseAmount;
  }

  const override = getEffectiveCategoryOverride(data, item.category, monthId);
  if (override === undefined) {
    return baseAmount;
  }

  const primaryItem = getPrimaryCategoryItem(data, item.category);
  if (primaryItem?.id !== item.id) {
    return baseAmount;
  }

  const otherItemsTotal = getCategoryItems(data, item.category).reduce(
    (total, categoryItem) =>
      categoryItem.id === item.id
        ? total
        : total + (categoryItem.monthlyValues[monthId] ?? 0),
    0,
  );

  return Math.max(0, override - otherItemsTotal);
}

export function getEffectiveExpenseCategoryTotals(
  data: EffectiveExpensePlanningSource,
  monthIds: readonly string[],
): EffectiveExpenseCategoryTotal[] {
  return (data.expenseCategories ?? []).map((category) => ({
    id: category.id,
    name: data.labels?.expenseCategories?.[category.id] ?? category.name,
    total: monthIds.reduce(
      (total, monthId) =>
        total + getEffectiveExpenseCategoryAmount(data, category.id, monthId),
      0,
    ),
  }));
}

export function getAffectedMonthIds(
  monthIds: readonly string[],
  targetMonthId: string,
  scope: PlanningEditScope,
) {
  const targetIndex = monthIds.indexOf(targetMonthId);

  if (targetIndex < 0) {
    return [];
  }

  return scope === "single" ? [monthIds[targetIndex]] : monthIds.slice(targetIndex);
}

export function applyScopedMonthValue(
  currentValues: Readonly<Record<string, number | undefined>> | undefined,
  monthIds: readonly string[],
  targetMonthId: string,
  amount: number,
  scope: PlanningEditScope,
): Record<string, number> {
  const definedCurrentValues = Object.fromEntries(
    Object.entries(currentValues ?? {}).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  );

  return {
    ...definedCurrentValues,
    ...Object.fromEntries(
      getAffectedMonthIds(monthIds, targetMonthId, scope).map((monthId) => [
        monthId,
        amount,
      ]),
    ),
  };
}
