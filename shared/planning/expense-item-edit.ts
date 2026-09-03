import {
  createExpenseItemIdentity,
  getExpenseItemPresentation,
} from "./expense-item-identity.ts";

export type ExpenseItemFrequency =
  | "once"
  | "monthly"
  | "everyTwoMonths"
  | "quarterly"
  | "twiceYearly"
  | "yearly";

export type ExpenseItemEditDraft = {
  amount: number;
  categoryId: string;
  company: string;
  description: string;
  frequency: ExpenseItemFrequency;
  monthId: string;
};

export type EditableExpenseItem = {
  category: string;
  company?: string;
  description?: string;
  frequency?: ExpenseItemFrequency;
  id: string;
  monthlyValues: Record<string, number>;
  name: string;
  recurring: boolean;
};

export type ExpenseItemEditPlanningData = {
  expenseCategories: { id: string }[];
  expenseItems: EditableExpenseItem[];
};

const frequencyIntervals: Record<ExpenseItemFrequency, number | null> = {
  once: null,
  monthly: 1,
  everyTwoMonths: 2,
  quarterly: 3,
  twiceYearly: 6,
  yearly: 12,
};

function isExpenseItemFrequency(value: string | undefined): value is ExpenseItemFrequency {
  return Boolean(value && value in frequencyIntervals);
}

export function buildExpenseItemMonthValues(
  monthIds: readonly string[],
  amount: number,
  startMonthId: string,
  frequency: ExpenseItemFrequency,
): Record<string, number> {
  const startIndex = monthIds.indexOf(startMonthId);
  const normalizedAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const interval = frequencyIntervals[frequency];

  return Object.fromEntries(
    monthIds.map((monthId, monthIndex) => [
      monthId,
      startIndex >= 0 &&
      normalizedAmount > 0 &&
      monthIndex >= startIndex &&
      (interval === null ? monthIndex === startIndex : (monthIndex - startIndex) % interval === 0)
        ? normalizedAmount
        : 0,
    ]),
  );
}

function inferExpenseItemFrequency(
  item: EditableExpenseItem,
  monthIds: readonly string[],
): ExpenseItemFrequency {
  if (isExpenseItemFrequency(item.frequency)) {
    return item.frequency;
  }

  const occurrenceIndexes = monthIds
    .map((monthId, monthIndex) => ({ amount: item.monthlyValues[monthId] ?? 0, monthIndex }))
    .filter(({ amount }) => amount > 0)
    .map(({ monthIndex }) => monthIndex);

  if (occurrenceIndexes.length <= 1) {
    return item.recurring ? "yearly" : "once";
  }

  const interval = occurrenceIndexes[1] - occurrenceIndexes[0];
  const hasConsistentInterval = occurrenceIndexes.every(
    (monthIndex, index) => index === 0 || monthIndex - occurrenceIndexes[index - 1] === interval,
  );

  if (hasConsistentInterval) {
    const matchingFrequency = Object.entries(frequencyIntervals).find(
      ([, candidateInterval]) => candidateInterval === interval,
    )?.[0];

    if (isExpenseItemFrequency(matchingFrequency)) {
      return matchingFrequency;
    }
  }

  return item.recurring ? "monthly" : "once";
}

export function getExpenseItemEditDraft(
  item: EditableExpenseItem,
  monthIds: readonly string[],
  legacyLabelOverride?: string,
): ExpenseItemEditDraft {
  const firstPlannedMonthId =
    monthIds.find((monthId) => (item.monthlyValues[monthId] ?? 0) > 0) ?? monthIds[0] ?? "";
  const presentation = getExpenseItemPresentation(item, legacyLabelOverride);
  const hasStructuredIdentity = item.company !== undefined || item.description !== undefined;

  return {
    amount: item.monthlyValues[firstPlannedMonthId] ?? 0,
    categoryId: item.category,
    company: hasStructuredIdentity ? (presentation.company ?? "") : item.name.trim(),
    description: hasStructuredIdentity
      ? (presentation.description ?? "")
      : presentation.primaryLabel !== item.name.trim()
        ? presentation.primaryLabel
        : "",
    frequency: inferExpenseItemFrequency(item, monthIds),
    monthId: firstPlannedMonthId,
  };
}

export function updateExpenseItemInPlanningData<T extends ExpenseItemEditPlanningData>(
  data: T,
  itemId: string,
  draft: ExpenseItemEditDraft,
  monthIds: readonly string[],
): T {
  if (
    !data.expenseItems.some((item) => item.id === itemId) ||
    !data.expenseCategories.some((category) => category.id === draft.categoryId) ||
    !monthIds.includes(draft.monthId) ||
    !Number.isFinite(draft.amount) ||
    draft.amount <= 0 ||
    !isExpenseItemFrequency(draft.frequency)
  ) {
    return data;
  }

  const identity = createExpenseItemIdentity(draft.company, draft.description);

  return {
    ...data,
    expenseItems: data.expenseItems.map((item) =>
      item.id === itemId
        ? {
            ...item,
            category: draft.categoryId,
            company: identity.company,
            description: identity.description,
            frequency: draft.frequency,
            monthlyValues: buildExpenseItemMonthValues(
              monthIds,
              draft.amount,
              draft.monthId,
              draft.frequency,
            ),
            name: identity.name,
            recurring: draft.frequency !== "once",
          }
        : item,
    ),
  };
}
