export type FamekoSymbolId =
  | "income"
  | "allocations"
  | "billAccount"
  | "mortgage"
  | "savings"
  | "housing"
  | "car"
  | "food"
  | "broadband"
  | "debts"
  | "insurance"
  | "pets"
  | "other";

export type FamekoMainSectionId = Extract<
  FamekoSymbolId,
  | "income"
  | "allocations"
  | "billAccount"
  | "mortgage"
  | "savings"
  | "debts"
  | "insurance"
  | "pets"
>;

export type FamekoSymbolDefinition = Readonly<{
  illustrationSrc?: string;
  glyph?: string;
}>;

export const famekoSymbols: Readonly<
  Record<FamekoSymbolId, FamekoSymbolDefinition>
> = {
  income: { illustrationSrc: "/images/mobile-insights/income.webp" },
  allocations: { illustrationSrc: "/images/mobile-insights/allocations.png" },
  billAccount: { illustrationSrc: "/images/mobile-insights/bills.webp" },
  mortgage: { illustrationSrc: "/images/mobile-insights/mortgage.png" },
  savings: { illustrationSrc: "/images/mobile-insights/savings.webp" },
  housing: { glyph: "🏠" },
  car: { glyph: "🚗" },
  food: { glyph: "🍽️" },
  broadband: { glyph: "📺" },
  debts: { glyph: "💳" },
  insurance: { glyph: "🛡️" },
  pets: { glyph: "🐾" },
  other: { glyph: "•••" },
};

const expenseCategorySymbols: Readonly<Record<string, FamekoSymbolId>> = {
  bil: "car",
  boende: "housing",
  forsakringar: "insurance",
  husdjur: "pets",
  "lan-och-krediter": "debts",
  mat: "food",
  ovrigt: "other",
  sparande: "savings",
  streaming: "broadband",
};

export function getExpenseCategorySymbolId(categoryId: string): FamekoSymbolId {
  return expenseCategorySymbols[categoryId] ?? "other";
}
