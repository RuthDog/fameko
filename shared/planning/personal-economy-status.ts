import {
  getCarLoanMode,
  type CarData,
  type CarLoanMode,
} from "./car.ts";
import {
  calculateHousingEconomics,
  type HousingData,
} from "./housing.ts";
import type { SavingsPreviewEconomics } from "./personal-economy.ts";

export type PersonalEconomyStatusTone = "attention" | "review" | "stable" | "unknown";

export type PersonalEconomyStatus = {
  label: string;
  message: string;
  tone: PersonalEconomyStatusTone;
};

const missingHousingStatus: PersonalEconomyStatus = {
  label: "Uppgifter saknas",
  message: "Fyll i bostadsvärde och bolån för att se boendets status.",
  tone: "unknown",
};

export function getHousingPreviewStatus(
  data: HousingData | undefined,
): PersonalEconomyStatus {
  if (!data) {
    return missingHousingStatus;
  }

  const { loanToValue } = calculateHousingEconomics(data);
  if (loanToValue === null) {
    return missingHousingStatus;
  }

  const hasMortgage = (data.totalMortgage ?? 0) > 0;
  const hasNoAmortization = hasMortgage && data.monthlyAmortization === 0;
  const shouldReview =
    loanToValue > 85 ||
    (data.averageInterestRate !== null && data.averageInterestRate >= 6) ||
    (loanToValue > 75 && hasNoAmortization);

  if (shouldReview) {
    return {
      label: "Bör ses över",
      message: "Boendet har ett nyckeltal som bör ses över.",
      tone: "review",
    };
  }

  const needsAttention =
    loanToValue > 75 ||
    (data.averageInterestRate !== null && data.averageInterestRate >= 4.5) ||
    hasNoAmortization;

  if (needsAttention) {
    return {
      label: "Behöver lite uppmärksamhet",
      message: "Boendet är i grunden stabilt men har något att följa.",
      tone: "attention",
    };
  }

  return {
    label: "Stabilt",
    message: "Boendets viktigaste nyckeltal ser stabila ut.",
    tone: "stable",
  };
}

export function getAnnualCarOperatingCost(data: CarData | undefined): number | null {
  if (data?.annualInsurance === null || data?.annualInsurance === undefined) {
    return null;
  }

  if (data.annualService === null) {
    return null;
  }

  return data.annualInsurance + data.annualService;
}

export function getCarPreviewStatus(data: CarData | undefined): PersonalEconomyStatus {
  const loanMode: CarLoanMode = getCarLoanMode(data);

  if (loanMode === "unknown") {
    return {
      label: "Uppgifter saknas",
      message: "Komplettera bilen för att se dess ekonomiska status.",
      tone: "unknown",
    };
  }

  if (loanMode === "loanFree") {
    return {
      label: "Lånefri",
      message: "Bilen ser stabil ut utan ett aktivt billån.",
      tone: "stable",
    };
  }

  const loanExceedsValue =
    data?.carValue !== null &&
    data?.carValue !== undefined &&
    data.carValue > 0 &&
    (data.currentLoanBalance ?? 0) > data.carValue;
  const highInterest =
    data?.averageInterestRate !== null &&
    data?.averageInterestRate !== undefined &&
    data.averageInterestRate >= 7;

  if (loanExceedsValue || highInterest) {
    return {
      label: "Bör ses över",
      message: "Billånet har ett nyckeltal som bör ses över.",
      tone: "review",
    };
  }

  return {
    label: "Billån",
    message: "Bilen har ett aktivt billån att fortsätta följa.",
    tone: "attention",
  };
}

export function getSavingsPreviewStatus(
  economics: SavingsPreviewEconomics,
): PersonalEconomyStatus {
  if (economics.savingsRate === null) {
    return {
      label: "Uppgifter saknas",
      message: "Lägg till inkomster för att se sparandets status.",
      tone: "unknown",
    };
  }

  if (economics.savingsRate >= 20) {
    return {
      label: "Fortsätt så",
      message: "Sparandet har en stark nivå i planeringen.",
      tone: "stable",
    };
  }

  if (economics.savingsRate >= 10) {
    return {
      label: "Stabilt",
      message: "Sparandet ser stabilt ut i förhållande till inkomsten.",
      tone: "stable",
    };
  }

  if (economics.savingsRate > 0) {
    return {
      label: "Behöver lite uppmärksamhet",
      message: "Sparandet finns på plats men kan stärkas.",
      tone: "attention",
    };
  }

  return {
    label: "Bör ses över",
    message: "Det finns inget planerat sparande ännu.",
    tone: "review",
  };
}
