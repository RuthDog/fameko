import {
  getEffectiveExpenseItemAmount,
  type EffectiveExpensePlanningSource,
} from "./effective-values.ts";
import { getExpenseItemPresentation } from "./expense-item-identity.ts";

export type MobileInsightFrequency =
  | "once"
  | "monthly"
  | "everyTwoMonths"
  | "quarterly"
  | "twiceYearly"
  | "yearly";

export type MobileInsightsPlanningSource = EffectiveExpensePlanningSource & {
  allocationOverrides?: {
    food?: Partial<Record<string, number>>;
  };
  expenseCategories?: Array<{
    id: string;
    name: string;
  }>;
  expenseItems: Array<{
    category?: string;
    company?: string;
    description?: string;
    frequency?: MobileInsightFrequency;
    id: string;
    monthlyValues: Record<string, number>;
    name: string;
    recurring: boolean;
  }>;
  labels?: {
    expenseCategories?: Record<string, string>;
    expenseItems?: Record<string, string>;
  };
};

export type MobileInsightMonthSource = {
  costTotal: number;
  id: string;
  income: number;
  name: string;
  remaining: number;
};

export type MobileInsightEvent = {
  brandLabel?: string;
  detail?: string;
  id: string;
  itemLabel?: string;
  kind: "annual" | "ending" | "negative" | "new" | "planned" | "unusual";
  title: string;
};

export type MobileUpcomingInsight = {
  events: MobileInsightEvent[];
  headline: string;
  id: string;
  name: string;
  remaining: number;
};

type RankedInsightEvent = MobileInsightEvent & {
  itemIds?: string[];
  sortAmount: number;
};

type PlannedCost = {
  amount: number;
  brandLabel?: string;
  id: string;
  itemLabel?: string;
  itemIds: string[];
  label: string;
};

const currencyFormatter = new Intl.NumberFormat("sv-SE", {
  maximumFractionDigits: 0,
});

const eventPriority: Record<MobileInsightEvent["kind"], number> = {
  new: 0,
  ending: 1,
  annual: 2,
  negative: 3,
  unusual: 4,
  planned: 5,
};

const minimumInsightCount = 3;
const defaultPlannedCostCount = 4;
const maximumInsightCount = 5;

function formatCurrency(value: number) {
  return `${currencyFormatter.format(Math.round(value))} kr`;
}

function average(values: number[]) {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0;
}

function headlineForEvents(events: MobileInsightEvent[]) {
  return events.some((event) => event.kind === "negative")
    ? "Behöver uppmärksamhet"
    : "Det viktigaste att känna till";
}

function getPlannedCosts(
  monthId: string,
  planningData: MobileInsightsPlanningSource,
): PlannedCost[] {
  const categoryLabels = new Map(
    (planningData.expenseCategories ?? []).map((category) => [
      category.id,
      planningData.labels?.expenseCategories?.[category.id] ?? category.name,
    ]),
  );
  const groupedCosts = new Map<string, PlannedCost>();

  for (const item of planningData.expenseItems) {
    const amount = getEffectiveExpenseItemAmount(planningData, item, monthId);

    if (amount <= 0 || item.category === "sparande") {
      continue;
    }

    const categoryLabel = item.category ? categoryLabels.get(item.category) : undefined;
    const groupId = categoryLabel && item.category ? `category-${item.category}` : `item-${item.id}`;
    const presentation = getExpenseItemPresentation(
      item,
      planningData.labels?.expenseItems?.[item.id],
    );
    const label = categoryLabel ?? presentation.primaryLabel;
    const existingCost = groupedCosts.get(groupId);

    if (existingCost) {
      existingCost.amount += amount;
      existingCost.itemIds.push(item.id);
    } else {
      groupedCosts.set(groupId, {
        amount,
        brandLabel: categoryLabel ? undefined : presentation.brandLabel,
        id: groupId,
        itemLabel: categoryLabel ? undefined : label,
        itemIds: [item.id],
        label,
      });
    }
  }

  return [...groupedCosts.values()].sort(
    (first, second) => second.amount - first.amount || first.label.localeCompare(second.label, "sv"),
  );
}

function toPublicEvent(event: RankedInsightEvent): MobileInsightEvent {
  return {
    brandLabel: event.brandLabel,
    detail: event.detail,
    id: event.id,
    itemLabel: event.itemLabel,
    kind: event.kind,
    title: event.title,
  };
}

export function buildMobileUpcomingInsights({
  currentMonthId,
  monthIds,
  months,
  planningData,
}: {
  currentMonthId: string;
  monthIds: string[];
  months: MobileInsightMonthSource[];
  planningData: MobileInsightsPlanningSource;
}): MobileUpcomingInsight[] {
  const currentMonthIndex = months.findIndex((month) => month.id === currentMonthId);

  if (currentMonthIndex < 0) {
    return [];
  }

  const averageMonthlyCost = average(months.map((month) => month.costTotal));

  return months.slice(currentMonthIndex + 1, currentMonthIndex + 4).map((month) => {
    const monthIndex = monthIds.indexOf(month.id);
    const events: RankedInsightEvent[] = [];

    for (const item of planningData.expenseItems) {
      const amount = getEffectiveExpenseItemAmount(planningData, item, month.id);
      const previousAmount =
        monthIndex > 0
          ? getEffectiveExpenseItemAmount(
              planningData,
              item,
              monthIds[monthIndex - 1],
            )
          : 0;
      const priorAmounts = monthIds
        .slice(0, Math.max(monthIndex, 0))
        .map((monthId) => getEffectiveExpenseItemAmount(planningData, item, monthId));
      const futureAmounts = monthIds
        .slice(monthIndex + 1)
        .map((monthId) => getEffectiveExpenseItemAmount(planningData, item, monthId));
      const otherPositiveAmounts = monthIds
        .filter((monthId) => monthId !== month.id)
        .map((monthId) => getEffectiveExpenseItemAmount(planningData, item, monthId))
        .filter((value) => value > 0);
      const presentation = getExpenseItemPresentation(
        item,
        planningData.labels?.expenseItems?.[item.id],
      );
      const label = presentation.primaryLabel;
      const futureStartsLikeMonthlyCost =
        item.frequency === undefined &&
        item.recurring &&
        futureAmounts.slice(0, 2).length === 2 &&
        futureAmounts.slice(0, 2).every((value) => value > 0);
      const isNewCost =
        amount >= 500 &&
        priorAmounts.every((value) => value === 0) &&
        (item.frequency === "monthly" || futureStartsLikeMonthlyCost);

      if (isNewCost) {
        events.push({
          brandLabel: presentation.brandLabel,
          detail: `${formatCurrency(amount)}/mån`,
          id: `${month.id}-${item.id}-new`,
          itemLabel: label,
          itemIds: [item.id],
          kind: "new",
          sortAmount: amount,
          title: `${label} börjar.`,
        });
        continue;
      }

      const recentPriorAmounts = monthIds
        .slice(Math.max(0, monthIndex - 3), monthIndex)
        .map((monthId) => getEffectiveExpenseItemAmount(planningData, item, monthId));
      const isRegularCost =
        item.frequency === "monthly" ||
        (recentPriorAmounts.length >= 2 && recentPriorAmounts.every((value) => value > 0));

      if (
        amount === 0 &&
        previousAmount >= 500 &&
        isRegularCost &&
        futureAmounts.every((value) => value === 0)
      ) {
        events.push({
          brandLabel: presentation.brandLabel,
          detail: `${formatCurrency(previousAmount)}/mån försvinner ur planeringen.`,
          id: `${month.id}-${item.id}-ending`,
          itemLabel: label,
          itemIds: [item.id],
          kind: "ending",
          sortAmount: previousAmount,
          title: `${label} avslutas.`,
        });
        continue;
      }

      if (item.frequency === "yearly" && amount > 0) {
        events.push({
          brandLabel: presentation.brandLabel,
          detail: `${formatCurrency(amount)} · Dags att se över priset.`,
          id: `${month.id}-${item.id}-annual`,
          itemLabel: label,
          itemIds: [item.id],
          kind: "annual",
          sortAmount: amount,
          title: `${label} betalas den här månaden.`,
        });
        continue;
      }

      const largeOneOffThreshold = Math.max(5_000, month.income * 0.08);

      if (
        amount >= largeOneOffThreshold &&
        (item.frequency === "once" || !item.recurring)
      ) {
        events.push({
          brandLabel: presentation.brandLabel,
          detail: formatCurrency(amount),
          id: `${month.id}-${item.id}-one-off`,
          itemLabel: label,
          itemIds: [item.id],
          kind: "unusual",
          sortAmount: amount,
          title: `${label} är en större engångskostnad.`,
        });
        continue;
      }

      const normalActiveAmount = average(otherPositiveAmounts);

      if (
        amount > 0 &&
        normalActiveAmount > 0 &&
        amount >= normalActiveAmount * 1.5 &&
        amount - normalActiveAmount >= 1_000
      ) {
        events.push({
          brandLabel: presentation.brandLabel,
          detail: formatCurrency(amount),
          id: `${month.id}-${item.id}-unusual`,
          itemLabel: label,
          itemIds: [item.id],
          kind: "unusual",
          sortAmount: amount - normalActiveAmount,
          title: `${label} är ovanligt hög.`,
        });
      }
    }

    if (month.remaining < 0) {
      events.push({
        detail: `${formatCurrency(Math.abs(month.remaining))} saknas för att månaden ska gå ihop.`,
        id: `${month.id}-negative`,
        kind: "negative",
        sortAmount: Math.abs(month.remaining),
        title: "Månaden går back.",
      });
    }

    if (
      averageMonthlyCost > 0 &&
      month.costTotal >= averageMonthlyCost * 1.2 &&
      month.costTotal - averageMonthlyCost >= 5_000
    ) {
      events.push({
        detail: `${formatCurrency(month.costTotal)} · ${formatCurrency(
          month.costTotal - averageMonthlyCost,
        )} över månadssnittet.`,
        id: `${month.id}-unusual-total`,
        kind: "unusual",
        sortAmount: month.costTotal - averageMonthlyCost,
        title: "Månadens planerade kostnader är ovanligt höga.",
      });
    }

    const rankedEvents = events.sort(
      (first, second) =>
        eventPriority[first.kind] - eventPriority[second.kind] ||
        second.sortAmount - first.sortAmount ||
        first.title.localeCompare(second.title, "sv"),
    );
    const targetCount =
      rankedEvents.length === 0
        ? defaultPlannedCostCount
        : Math.min(maximumInsightCount, Math.max(minimumInsightCount, rankedEvents.length));
    const selectedEvents = rankedEvents.slice(0, maximumInsightCount);
    const representedItemIds = new Set(selectedEvents.flatMap((event) => event.itemIds ?? []));

    for (const plannedCost of getPlannedCosts(month.id, planningData)) {
      if (selectedEvents.length >= targetCount) {
        break;
      }

      if (plannedCost.itemIds.some((itemId) => representedItemIds.has(itemId))) {
        continue;
      }

      selectedEvents.push({
        brandLabel: plannedCost.brandLabel,
        detail: formatCurrency(plannedCost.amount),
        id: `${month.id}-${plannedCost.id}-planned`,
        itemLabel: plannedCost.itemLabel,
        itemIds: plannedCost.itemIds,
        kind: "planned",
        sortAmount: plannedCost.amount,
        title: plannedCost.label,
      });
      plannedCost.itemIds.forEach((itemId) => representedItemIds.add(itemId));
    }

    if (selectedEvents.length === 0) {
      selectedEvents.push({
        detail: "Kontrollera att månadens planering är komplett.",
        id: `${month.id}-empty-plan`,
        kind: "planned",
        sortAmount: 0,
        title: "Inga kostnader är planerade den här månaden.",
      });
    }

    const displayedEvents = selectedEvents.map(toPublicEvent);

    return {
      events: displayedEvents,
      headline: headlineForEvents(displayedEvents),
      id: month.id,
      name: month.name,
      remaining: month.remaining,
    };
  });
}
