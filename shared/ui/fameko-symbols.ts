export type FamekoMainSectionId =
  | "income"
  | "allocations"
  | "billAccount"
  | "mortgage"
  | "savings"
  | "debts"
  | "insurance"
  | "pets";

export const famekoMainSectionSymbols: Readonly<
  Record<FamekoMainSectionId, string>
> = {
  income: "💰",
  allocations: "🔄",
  billAccount: "📄",
  mortgage: "🏠",
  savings: "🌱",
  debts: "💳",
  insurance: "🛡",
  pets: "🐾",
};

export function getExpenseCategoryMainSectionId(
  categoryId: string,
): FamekoMainSectionId | null {
  if (categoryId === "lan-och-krediter") {
    return "debts";
  }

  if (categoryId === "forsakringar") {
    return "insurance";
  }

  if (categoryId === "husdjur") {
    return "pets";
  }

  return null;
}
