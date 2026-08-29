export type CarPreviewEconomics = {
  loanPayment: number;
  monthlyCost: number;
  monthlyIncome: number;
};

export type SavingsPreviewEconomics = {
  averageMonthlySavings: number;
  monthsWithSavings: number;
  savingsRate: number | null;
  totalPlannedSavings: number;
};

export function getCarPreviewSummary({ monthlyCost, monthlyIncome }: CarPreviewEconomics) {
  if (monthlyCost <= 0) {
    return "Det finns inga planerade bilkostnader den här månaden.";
  }

  if (monthlyIncome <= 0) {
    return "Bilkostnaden finns med i årsplaneringen.";
  }

  if (monthlyCost / monthlyIncome <= 0.15) {
    return "Bilkostnaden är stabil i månadens ekonomi.";
  }

  return "Bilkostnaden tar en större del av månadens ekonomi.";
}

export function calculateSavingsPreview(
  monthlySavings: readonly number[],
  monthlyIncome: readonly number[],
): SavingsPreviewEconomics {
  const totalPlannedSavings = monthlySavings.reduce((total, amount) => total + amount, 0);
  const totalIncome = monthlyIncome.reduce((total, amount) => total + amount, 0);

  return {
    averageMonthlySavings:
      monthlySavings.length === 0 ? 0 : totalPlannedSavings / monthlySavings.length,
    monthsWithSavings: monthlySavings.filter((amount) => amount > 0).length,
    savingsRate: totalIncome > 0 ? (totalPlannedSavings / totalIncome) * 100 : null,
    totalPlannedSavings,
  };
}

export function getSavingsPreviewSummary(
  economics: SavingsPreviewEconomics,
  monthCount: number,
) {
  if (economics.totalPlannedSavings <= 0) {
    return "Det finns inget planerat sparande ännu.";
  }

  if (monthCount > 0 && economics.monthsWithSavings === monthCount) {
    return "Du sparar regelbundet varje månad.";
  }

  if (economics.savingsRate !== null && economics.savingsRate >= 20) {
    return "Ditt planerade sparande är starkt.";
  }

  return "Du har ett planerat sparande under året.";
}
