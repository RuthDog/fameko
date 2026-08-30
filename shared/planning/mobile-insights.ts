export type MobileInsightFrequency =
  | "once"
  | "monthly"
  | "everyTwoMonths"
  | "quarterly"
  | "twiceYearly"
  | "yearly";

export type MobileInsightsPlanningSource = {
  expenseItems: Array<{
    frequency?: MobileInsightFrequency;
    id: string;
    monthlyValues: Record<string, number>;
    name: string;
    recurring: boolean;
  }>;
  labels?: {
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
  detail?: string;
  id: string;
  kind: "annual" | "ending" | "negative" | "new" | "oneOff" | "stable" | "unusual";
  title: string;
};

export type MobileUpcomingInsight = {
  events: MobileInsightEvent[];
  headline: string;
  id: string;
  name: string;
  remaining: number;
};

const currencyFormatter = new Intl.NumberFormat("sv-SE", {
  maximumFractionDigits: 0,
});

const eventPriority: Record<MobileInsightEvent["kind"], number> = {
  negative: 0,
  annual: 1,
  oneOff: 2,
  new: 3,
  unusual: 4,
  ending: 5,
  stable: 6,
};

function formatCurrency(value: number) {
  return `${currencyFormatter.format(Math.round(value))} kr`;
}

function average(values: number[]) {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0;
}

function headlineForEvents(events: MobileInsightEvent[]) {
  if (events.some((event) => event.kind === "negative")) {
    return "Behöver uppmärksamhet";
  }

  if (events.some((event) => ["annual", "oneOff", "unusual"].includes(event.kind))) {
    return "Extra kostnader";
  }

  if (events.some((event) => event.kind === "new")) {
    return "Nytt denna månad";
  }

  if (events.some((event) => event.kind === "ending")) {
    return "Förändringar";
  }

  return "Stabil månad";
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
    const events: MobileInsightEvent[] = [];

    if (month.remaining < 0) {
      events.push({
        id: `${month.id}-negative`,
        kind: "negative",
        title: `Månaden går ${formatCurrency(Math.abs(month.remaining))} back.`,
      });
    }

    const largeOneOffThreshold = Math.max(5_000, month.income * 0.08);

    for (const item of planningData.expenseItems) {
      const amount = item.monthlyValues[month.id] ?? 0;
      const previousAmount =
        monthIndex > 0 ? item.monthlyValues[monthIds[monthIndex - 1]] ?? 0 : 0;
      const priorAmounts = monthIds
        .slice(0, Math.max(monthIndex, 0))
        .map((monthId) => item.monthlyValues[monthId] ?? 0);
      const futureAmounts = monthIds
        .slice(monthIndex + 1)
        .map((monthId) => item.monthlyValues[monthId] ?? 0);
      const otherPositiveAmounts = monthIds
        .filter((monthId) => monthId !== month.id)
        .map((monthId) => item.monthlyValues[monthId] ?? 0)
        .filter((value) => value > 0);
      const label = planningData.labels?.expenseItems?.[item.id] ?? item.name;
      let primaryEventAdded = false;

      if (item.frequency === "yearly" && amount > 0) {
        events.push({
          detail: "Kontrollera gärna om priset fortfarande är bra.",
          id: `${month.id}-${item.id}-annual`,
          kind: "annual",
          title: `${label} förfaller den här månaden.`,
        });
        primaryEventAdded = true;
      } else if (
        amount >= largeOneOffThreshold &&
        (item.frequency === "once" || !item.recurring)
      ) {
        events.push({
          id: `${month.id}-${item.id}-one-off`,
          kind: "oneOff",
          title: `${label}: ${formatCurrency(amount)} i en engångskostnad.`,
        });
        primaryEventAdded = true;
      } else if (
        amount >= 500 &&
        priorAmounts.every((value) => value === 0) &&
        (item.frequency === "monthly" || futureAmounts.slice(0, 2).every((value) => value > 0))
      ) {
        events.push({
          id: `${month.id}-${item.id}-new`,
          kind: "new",
          title: `${label} börjar den här månaden.`,
        });
        primaryEventAdded = true;
      }

      const recentPriorAmounts = monthIds
        .slice(Math.max(0, monthIndex - 3), monthIndex)
        .map((monthId) => item.monthlyValues[monthId] ?? 0);
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
          id: `${month.id}-${item.id}-ending`,
          kind: "ending",
          title: `${label} finns inte längre med.`,
        });
      }

      const normalActiveAmount = average(otherPositiveAmounts);

      if (
        !primaryEventAdded &&
        amount > 0 &&
        normalActiveAmount > 0 &&
        amount >= normalActiveAmount * 1.5 &&
        amount - normalActiveAmount >= 1_000
      ) {
        events.push({
          id: `${month.id}-${item.id}-unusual`,
          kind: "unusual",
          title: `${label} är ovanligt hög: ${formatCurrency(amount)}.`,
        });
      }
    }

    if (
      averageMonthlyCost > 0 &&
      month.costTotal >= averageMonthlyCost * 1.2 &&
      month.costTotal - averageMonthlyCost >= 5_000
    ) {
      events.push({
        id: `${month.id}-unusual-total`,
        kind: "unusual",
        title: `Planerade kostnader är ${formatCurrency(month.costTotal - averageMonthlyCost)} över månadssnittet.`,
      });
    }

    const notableEvents = events
      .sort((first, second) => eventPriority[first.kind] - eventPriority[second.kind])
      .slice(0, 3);
    const displayedEvents = notableEvents.length
      ? notableEvents
      : [
          {
            id: `${month.id}-stable`,
            kind: "stable" as const,
            title: "Inga större förändringar i planeringen.",
          },
        ];

    return {
      events: displayedEvents,
      headline: headlineForEvents(displayedEvents),
      id: month.id,
      name: month.name,
      remaining: month.remaining,
    };
  });
}
