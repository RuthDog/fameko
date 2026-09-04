import type { BankReportModel } from "./bank-report.ts";

export type ExecutiveSnapshotItem = {
  code: string;
  label: string;
  tone: "positive" | "watch";
};

export type BankReportDataQualityItem = {
  complete: boolean;
  label: string;
};

export const bankReportDisclaimer =
  "Denna översikt bygger på de uppgifter som användaren själv har registrerat i Fameko. Uppgifterna är inte verifierade av bank eller annan extern part.";

export function formatBankReportCurrency(value: number) {
  return `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(value)} kr`;
}

export function formatBankReportPercentage(value: number) {
  return `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(value)} %`;
}

export function formatBankReportGeneratedAt(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

const snapshotLabels: Record<string, string> = {
  HIGH_HOUSING_LTV: "Relativt hög belåningsgrad",
  LIMITED_LIQUID_BUFFER: "Begränsad likvid buffert",
  LOW_HOUSING_LTV: "Låg belåningsgrad",
  NEGATIVE_ANNUAL_MARGIN: "Negativ årsmarginal",
  POSITIVE_ANNUAL_MARGIN: "Positiv årsmarginal",
  PRIVATE_INVESTMENTS: "Privata investeringar",
  PRIVATE_PENSION_SAVINGS: "Privat pensionssparande",
  REGULAR_PLANNED_SAVINGS: "Regelbundet sparande",
  RESILIENT_LIQUID_BUFFER: "Buffert för flera månaders utgifter",
  SEVERAL_NEGATIVE_MONTHS: "Flera månader med negativt kassaflöde",
};

const snapshotPriority = [
  "POSITIVE_ANNUAL_MARGIN",
  "NEGATIVE_ANNUAL_MARGIN",
  "REGULAR_PLANNED_SAVINGS",
  "RESILIENT_LIQUID_BUFFER",
  "LIMITED_LIQUID_BUFFER",
  "HIGH_HOUSING_LTV",
  "LOW_HOUSING_LTV",
  "SEVERAL_NEGATIVE_MONTHS",
  "PRIVATE_INVESTMENTS",
  "PRIVATE_PENSION_SAVINGS",
] as const;

function observationCodes(report: BankReportModel) {
  return new Map<string, ExecutiveSnapshotItem["tone"]>([
    ...report.financialHealth.strengths.map(
      (item) => [item.code, "positive"] as const,
    ),
    ...report.financialHealth.watchItems.map(
      (item) => [item.code, "watch"] as const,
    ),
  ]);
}

export function getExecutiveSnapshot(
  report: BankReportModel,
): ExecutiveSnapshotItem[] {
  const observations = observationCodes(report);

  return snapshotPriority.flatMap((code) => {
    const tone = observations.get(code);
    const label = snapshotLabels[code];

    return tone && label ? [{ code, label, tone }] : [];
  }).slice(0, 4);
}

export function getExecutiveSummaryParagraphs(
  report: BankReportModel,
): string[] {
  const observations = observationCodes(report);
  const paragraphs: string[] = [];
  const hasPositiveMargin = observations.has("POSITIVE_ANNUAL_MARGIN");
  const hasNegativeMargin = observations.has("NEGATIVE_ANNUAL_MARGIN");
  const hasRegularSavings = observations.has("REGULAR_PLANNED_SAVINGS");

  if (hasPositiveMargin && hasRegularSavings) {
    paragraphs.push(
      "Hushållets planering visar positiv årsmarginal och regelbundet sparande.",
    );
  } else if (hasPositiveMargin) {
    paragraphs.push("Hushållets planering visar positiv årsmarginal.");
  } else if (hasNegativeMargin) {
    paragraphs.push(
      "Hushållets planerade utflöden är större än inkomsterna över året.",
    );
  } else if (hasRegularSavings) {
    paragraphs.push("Hushållets planering innehåller ett regelbundet sparande.");
  } else {
    paragraphs.push(report.summary.financialHealthSummary);
  }

  if (observations.has("HIGH_HOUSING_LTV")) {
    paragraphs.push("Boendets belåningsgrad är relativt hög.");
  } else if (observations.has("LOW_HOUSING_LTV")) {
    paragraphs.push("Boendets belåningsgrad är låg.");
  }

  if (
    observations.has("PRIVATE_INVESTMENTS") ||
    observations.has("PRIVATE_PENSION_SAVINGS")
  ) {
    paragraphs.push(
      "Hushållet har privata finansiella tillgångar som bidrar till den långsiktiga ekonomiska grunden.",
    );
  } else if (observations.has("RESILIENT_LIQUID_BUFFER")) {
    paragraphs.push(
      "Den privata bufferten täcker flera månaders planerade utgifter.",
    );
  }

  return paragraphs;
}

function missingMetadataMessage(
  field: BankReportModel["metadata"]["missing"][number]["field"],
) {
  return {
    householdDisplayName: "Hushållsnamn saknas",
    incomeComment: null,
    incomeEmployer: "Arbetsgivare saknas",
    incomeEmploymentType: "Anställningsform saknas",
    incomeOccupation: "Befattning saknas",
  }[field];
}

export function getBankReportDataQualityItems(
  report: BankReportModel,
): BankReportDataQualityItem[] {
  const items: BankReportDataQualityItem[] = [
    {
      complete: report.income.items.length > 0,
      label: report.income.items.length > 0 ? "Inkomster" : "Inkomster saknas",
    },
    {
      complete: report.housing.hasData,
      label: report.housing.hasData ? "Boende" : "Boendeuppgifter saknas",
    },
    {
      complete:
        report.savings.plannedAnnualAmount > 0 ||
        report.savings.financialAssetsTotal !== null,
      label:
        report.savings.plannedAnnualAmount > 0 ||
        report.savings.financialAssetsTotal !== null
          ? "Sparande och tillgångar"
          : "Sparande och finansiella tillgångar saknas",
    },
  ];

  if (report.car.hasData) {
    items.push({ complete: true, label: "Bil" });
  }

  for (const metadata of report.metadata.missing) {
    const message = missingMetadataMessage(metadata.field);
    if (message) {
      items.push({ complete: false, label: message });
    }
  }

  return items;
}
