import { resolveBrand } from "../brand/brand-recognition.ts";
import { getExpenseItemPresentation } from "./expense-item-identity.ts";

export const guidedSetupMonthIds = [
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

export type GuidedSetupFrequency = "monthly" | "quarterly" | "twiceYearly" | "yearly";
export type GuidedSetupGuideId =
  | "income"
  | "savings"
  | "subscriptions"
  | "insurance"
  | "pets"
  | "debts";
export type GuidedSetupQuestionType = "amount" | "boolean" | "multi-select";

type MonthValues = Record<string, number>;

export type GuidedSetupPlanningData = {
  expenseCategories: Array<{ id: string; name: string; order: number }>;
  expenseItems: Array<{
    category: string;
    company?: string;
    description?: string;
    frequency?: "once" | "monthly" | "everyTwoMonths" | "quarterly" | "twiceYearly" | "yearly";
    id: string;
    monthlyValues: MonthValues;
    name: string;
    recurring: boolean;
  }>;
  labels?: {
    expenseItems?: Record<string, string>;
    [key: string]: unknown;
  };
};

export type GuidedSetupTemplate = {
  categoryId: string;
  defaultFrequency: GuidedSetupFrequency;
  defaultItemName: string;
  displayName: string;
  guideId: GuidedSetupGuideId;
  id: string;
  itemId: string;
  legacyItemIds?: readonly string[];
  question: string;
  questionType: GuidedSetupQuestionType;
  supportsFrequency: boolean;
};

export type GuidedSetupExpenseValue = {
  amount: number;
  brandLabel: string;
  company: string | null;
  description: string | null;
  frequency: GuidedSetupFrequency;
  itemId: string;
  label: string;
  paymentMonth: string;
};

export const guidedSetupGuides: ReadonlyArray<{
  description: string;
  id: GuidedSetupGuideId;
  name: string;
}> = [
  {
    description: "Lön och andra inkomster",
    id: "income",
    name: "Inkomster",
  },
  {
    description: "Buffert, pension och investeringar",
    id: "savings",
    name: "Sparande",
  },
  {
    description: "Mobil och streamingtjänster",
    id: "subscriptions",
    name: "Abonnemang",
  },
  {
    description: "Hem, villa, bil och husdjur",
    id: "insurance",
    name: "Försäkringar",
  },
  {
    description: "Försäkring och löpande kostnader",
    id: "pets",
    name: "Husdjur",
  },
  {
    description: "CSN, privatlån, kreditkort och andra lån",
    id: "debts",
    name: "Lån och krediter",
  },
];

export const guidedSetupTemplates: readonly GuidedSetupTemplate[] = [
  {
    categoryId: "streaming",
    defaultFrequency: "monthly",
    defaultItemName: "Mobilabonnemang",
    displayName: "Mobilabonnemang",
    guideId: "subscriptions",
    id: "subscription.mobile",
    itemId: "streaming-guided-mobile",
    question: "Har hushållet mobilabonnemang?",
    questionType: "boolean",
    supportsFrequency: false,
  },
  {
    categoryId: "streaming",
    defaultFrequency: "monthly",
    defaultItemName: "Netflix",
    displayName: "Netflix",
    guideId: "subscriptions",
    id: "subscription.netflix",
    itemId: "streaming-netflix",
    question: "Använder hushållet Netflix?",
    questionType: "multi-select",
    supportsFrequency: false,
  },
  {
    categoryId: "streaming",
    defaultFrequency: "monthly",
    defaultItemName: "Spotify",
    displayName: "Spotify",
    guideId: "subscriptions",
    id: "subscription.spotify",
    itemId: "streaming-spotify",
    question: "Använder hushållet Spotify?",
    questionType: "multi-select",
    supportsFrequency: false,
  },
  {
    categoryId: "streaming",
    defaultFrequency: "monthly",
    defaultItemName: "Disney+",
    displayName: "Disney+",
    guideId: "subscriptions",
    id: "subscription.disney-plus",
    itemId: "streaming-guided-disney-plus",
    question: "Använder hushållet Disney+?",
    questionType: "multi-select",
    supportsFrequency: false,
  },
  {
    categoryId: "streaming",
    defaultFrequency: "monthly",
    defaultItemName: "Max",
    displayName: "Max",
    guideId: "subscriptions",
    id: "subscription.max",
    itemId: "streaming-guided-max",
    question: "Använder hushållet Max?",
    questionType: "multi-select",
    supportsFrequency: false,
  },
  {
    categoryId: "streaming",
    defaultFrequency: "monthly",
    defaultItemName: "TV4 Play",
    displayName: "TV4 Play",
    guideId: "subscriptions",
    id: "subscription.tv4-play",
    itemId: "streaming-guided-tv4-play",
    question: "Använder hushållet TV4 Play?",
    questionType: "multi-select",
    supportsFrequency: false,
  },
  {
    categoryId: "streaming",
    defaultFrequency: "monthly",
    defaultItemName: "Viaplay",
    displayName: "Viaplay",
    guideId: "subscriptions",
    id: "subscription.viaplay",
    itemId: "streaming-guided-viaplay",
    question: "Använder hushållet Viaplay?",
    questionType: "multi-select",
    supportsFrequency: false,
  },
  {
    categoryId: "streaming",
    defaultFrequency: "monthly",
    defaultItemName: "Annan streamingtjänst",
    displayName: "Annan",
    guideId: "subscriptions",
    id: "subscription.other-streaming",
    itemId: "streaming-guided-other",
    question: "Har hushållet någon annan streamingtjänst?",
    questionType: "multi-select",
    supportsFrequency: false,
  },
  {
    categoryId: "forsakringar",
    defaultFrequency: "monthly",
    defaultItemName: "Hemförsäkring",
    displayName: "Hemförsäkring",
    guideId: "insurance",
    id: "insurance.home",
    itemId: "forsakringar-guided-home",
    legacyItemIds: ["forsakringar-hemforsakring"],
    question: "Har hushållet hemförsäkring?",
    questionType: "boolean",
    supportsFrequency: true,
  },
  {
    categoryId: "forsakringar",
    defaultFrequency: "yearly",
    defaultItemName: "Villaförsäkring",
    displayName: "Villaförsäkring",
    guideId: "insurance",
    id: "insurance.villa",
    itemId: "forsakringar-guided-villa",
    question: "Har hushållet villaförsäkring?",
    questionType: "boolean",
    supportsFrequency: true,
  },
  {
    categoryId: "bil",
    defaultFrequency: "monthly",
    defaultItemName: "Bilförsäkring",
    displayName: "Bilförsäkring",
    guideId: "insurance",
    id: "insurance.car",
    itemId: "bil-forsakring",
    question: "Har hushållet bilförsäkring?",
    questionType: "boolean",
    supportsFrequency: true,
  },
  {
    categoryId: "husdjur",
    defaultFrequency: "yearly",
    defaultItemName: "Husdjursförsäkring",
    displayName: "Husdjursförsäkring",
    guideId: "insurance",
    id: "insurance.pet",
    itemId: "husdjur-guided-insurance",
    question: "Har djuret försäkring?",
    questionType: "boolean",
    supportsFrequency: true,
  },
  {
    categoryId: "husdjur",
    defaultFrequency: "monthly",
    defaultItemName: "Foder",
    displayName: "Foder",
    guideId: "pets",
    id: "pet.food",
    itemId: "husdjur-guided-food",
    question: "Vill du lägga till löpande kostnad för foder?",
    questionType: "boolean",
    supportsFrequency: false,
  },
  {
    categoryId: "lan-och-krediter",
    defaultFrequency: "monthly",
    defaultItemName: "CSN",
    displayName: "CSN",
    guideId: "debts",
    id: "debt.csn",
    itemId: "lan-och-krediter-guided-csn",
    legacyItemIds: ["ovrigt-guided-csn"],
    question: "Betalar hushållet till CSN?",
    questionType: "boolean",
    supportsFrequency: false,
  },
  {
    categoryId: "lan-och-krediter",
    defaultFrequency: "monthly",
    defaultItemName: "Privatlån",
    displayName: "Privatlån",
    guideId: "debts",
    id: "debt.private-loan",
    itemId: "lan-och-krediter-guided-private-loan",
    legacyItemIds: ["ovrigt-guided-private-loan"],
    question: "Har hushållet återkommande kostnad för privatlån?",
    questionType: "boolean",
    supportsFrequency: false,
  },
  {
    categoryId: "lan-och-krediter",
    defaultFrequency: "monthly",
    defaultItemName: "Övrig lånekostnad",
    displayName: "Övrig lånekostnad",
    guideId: "debts",
    id: "debt.other",
    itemId: "lan-och-krediter-guided-other-debt",
    legacyItemIds: ["ovrigt-guided-other-debt"],
    question: "Har hushållet någon annan återkommande lånekostnad?",
    questionType: "boolean",
    supportsFrequency: false,
  },
  {
    categoryId: "lan-och-krediter",
    defaultFrequency: "monthly",
    defaultItemName: "Kreditkort",
    displayName: "Kreditkort",
    guideId: "debts",
    id: "debt.credit-card",
    itemId: "lan-och-krediter-guided-credit-card",
    question: "Har hushållet en återkommande kreditkortskostnad?",
    questionType: "boolean",
    supportsFrequency: false,
  },
  {
    categoryId: "lan-och-krediter",
    defaultFrequency: "monthly",
    defaultItemName: "Blancolån",
    displayName: "Blancolån",
    guideId: "debts",
    id: "debt.unsecured-loan",
    itemId: "lan-och-krediter-guided-unsecured-loan",
    question: "Har hushållet kostnad för blancolån?",
    questionType: "boolean",
    supportsFrequency: false,
  },
  {
    categoryId: "lan-och-krediter",
    defaultFrequency: "monthly",
    defaultItemName: "Övrigt konsumentlån",
    displayName: "Övrigt konsumentlån",
    guideId: "debts",
    id: "debt.consumer-loan",
    itemId: "lan-och-krediter-guided-consumer-loan",
    question: "Har hushållet någon annan konsumentlånekostnad?",
    questionType: "boolean",
    supportsFrequency: false,
  },
] as const;

export const guidedSetupFrequencyOptions: ReadonlyArray<{
  id: GuidedSetupFrequency;
  label: string;
}> = [
  { id: "monthly", label: "Varje månad" },
  { id: "quarterly", label: "Var tredje månad" },
  { id: "twiceYearly", label: "Var sjätte månad" },
  { id: "yearly", label: "En gång per år" },
];

export function getGuidedSetupCurrentMonthId(
  date = new Date(),
): (typeof guidedSetupMonthIds)[number] {
  return guidedSetupMonthIds[date.getMonth()] ?? "jan";
}

export function getGuidedSetupTemplate(templateId: string): GuidedSetupTemplate | null {
  return guidedSetupTemplates.find((template) => template.id === templateId) ?? null;
}

function templateItemIds(template: GuidedSetupTemplate): Set<string> {
  return new Set([template.itemId, ...(template.legacyItemIds ?? [])]);
}

function frequencyInterval(frequency: GuidedSetupFrequency): number {
  if (frequency === "quarterly") {
    return 3;
  }

  if (frequency === "twiceYearly") {
    return 6;
  }

  if (frequency === "yearly") {
    return 12;
  }

  return 1;
}

export function buildGuidedSetupMonthValues(
  amount: number,
  frequency: GuidedSetupFrequency,
  paymentMonth: string,
): MonthValues {
  const normalizedAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const paymentIndex = Math.max(0, guidedSetupMonthIds.indexOf(paymentMonth as typeof guidedSetupMonthIds[number]));
  const interval = frequencyInterval(frequency);

  return Object.fromEntries(
    guidedSetupMonthIds.map((monthId, monthIndex) => [
      monthId,
      monthIndex >= paymentIndex && (monthIndex - paymentIndex) % interval === 0
        ? normalizedAmount
        : 0,
    ]),
  );
}

export function getGuidedSetupExpense(
  data: GuidedSetupPlanningData,
  templateId: string,
  date = new Date(),
): GuidedSetupExpenseValue | null {
  const template = getGuidedSetupTemplate(templateId);

  if (!template) {
    return null;
  }

  const ids = templateItemIds(template);
  const item = data.expenseItems.find((expenseItem) => ids.has(expenseItem.id));

  if (!item) {
    return null;
  }

  const amountMonth = guidedSetupMonthIds.find(
    (monthId) => (item.monthlyValues[monthId] ?? 0) > 0,
  );

  if (!amountMonth) {
    return null;
  }

  const currentMonth = getGuidedSetupCurrentMonthId(date);
  const currentMonthIndex = guidedSetupMonthIds.indexOf(currentMonth);
  const paymentMonth =
    guidedSetupMonthIds.find(
      (monthId, monthIndex) =>
        monthIndex >= currentMonthIndex && (item.monthlyValues[monthId] ?? 0) > 0,
    ) ?? currentMonth;
  const presentation = getExpenseItemPresentation(
    item,
    data.labels?.expenseItems?.[item.id],
  );

  return {
    amount: item.monthlyValues[amountMonth] ?? 0,
    brandLabel: presentation.brandLabel,
    company: presentation.company,
    description: presentation.description,
    frequency:
      item.frequency === "quarterly" ||
      item.frequency === "twiceYearly" ||
      item.frequency === "yearly"
        ? item.frequency
        : "monthly",
    itemId: item.id,
    label: presentation.primaryLabel,
    paymentMonth,
  };
}

export function upsertGuidedSetupExpense<T extends GuidedSetupPlanningData>(
  data: T,
  templateId: string,
  value: {
    amount: number;
    frequency?: GuidedSetupFrequency;
    paymentMonth?: string;
  },
): T {
  const template = getGuidedSetupTemplate(templateId);
  const categoryExists = template
    ? data.expenseCategories.some((category) => category.id === template.categoryId)
    : false;
  const canCreateDebtCategory =
    template?.categoryId === "lan-och-krediter" && !categoryExists;

  if (
    !template ||
    (!categoryExists && !canCreateDebtCategory) ||
    !Number.isFinite(value.amount) ||
    value.amount <= 0
  ) {
    return data;
  }

  const expenseCategories = canCreateDebtCategory
    ? [
        ...data.expenseCategories,
        {
          id: "lan-och-krediter",
          name: "Lån och krediter",
          order:
            data.expenseCategories.reduce(
              (highest, category) => Math.max(highest, category.order),
              -1,
            ) + 1,
        },
      ]
    : data.expenseCategories;
  const ids = templateItemIds(template);
  const existing = data.expenseItems.find((item) => ids.has(item.id));
  const frequency = value.frequency ?? template.defaultFrequency;
  const paymentMonth = value.paymentMonth ?? getGuidedSetupCurrentMonthId();
  const paymentIndex = Math.max(
    0,
    guidedSetupMonthIds.indexOf(paymentMonth as (typeof guidedSetupMonthIds)[number]),
  );
  const scheduledValues = buildGuidedSetupMonthValues(
    value.amount,
    frequency,
    paymentMonth,
  );
  const resolvedBrand = resolveBrand(template.defaultItemName);
  const nextItem = {
    ...existing,
    category: template.categoryId,
    company:
      existing?.company?.trim() ||
      (resolvedBrand.recognized ? resolvedBrand.displayName : ""),
    description: existing?.description ?? "",
    frequency,
    id: existing?.id ?? template.itemId,
    monthlyValues: Object.fromEntries(
      guidedSetupMonthIds.map((monthId, monthIndex) => [
        monthId,
        existing && monthIndex < paymentIndex
          ? (existing.monthlyValues[monthId] ?? 0)
          : scheduledValues[monthId],
      ]),
    ),
    name: existing?.name ?? template.defaultItemName,
    recurring: true,
  };
  let inserted = false;
  const expenseItems = data.expenseItems.flatMap((item) => {
    if (!ids.has(item.id)) {
      return [item];
    }

    if (inserted) {
      return [];
    }

    inserted = true;
    return [nextItem];
  });

  if (!inserted) {
    expenseItems.push(nextItem);
  }

  return { ...data, expenseCategories, expenseItems };
}

export function skipGuidedSetupQuestion<T>(data: T): T {
  return data;
}
