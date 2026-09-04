import type { BankReportModel } from "./bank-report.ts";
import {
  bankReportDisclaimer,
  formatBankReportCurrency,
  formatBankReportGeneratedAt,
  formatBankReportPercentage,
  getBankReportDataQualityItems,
  getExecutiveSnapshot,
  getExecutiveSummaryParagraphs,
} from "./bank-report-presentation.ts";

export type BankReportPdfRow = {
  label: string;
  value: string;
};

export type BankReportPdfGroup = {
  note?: string;
  rows: BankReportPdfRow[];
  title: string;
};

export type BankReportPdfContent = {
  assets: BankReportPdfGroup[];
  cashFlow: BankReportPdfRow[];
  dataQuality: ReturnType<typeof getBankReportDataQualityItems>;
  debts: BankReportPdfGroup[];
  disclaimer: string;
  financialHealth: {
    statusLabel: string;
    strengths: string[];
    summary: string;
    watchItems: string[];
  };
  header: {
    generatedAt: string;
    household: string | null;
    planningYear: number;
    title: string;
  };
  incomes: Array<{
    amount: string;
    comment: string | null;
    metadata: string[];
    note: string;
    title: string;
  }>;
  majorExpenses: Array<{
    amount: string;
    name: string;
  }>;
  metrics: BankReportPdfRow[];
  snapshot: ReturnType<typeof getExecutiveSnapshot>;
  summary: string[];
};

function presentRows(
  rows: Array<BankReportPdfRow | null>,
): BankReportPdfRow[] {
  return rows.filter((row): row is BankReportPdfRow => row !== null);
}

export function createBankReportPdfContent(
  report: BankReportModel,
): BankReportPdfContent {
  const financialAssets = presentRows([
    report.savings.assets.liquidBuffer === null
      ? null
      : {
          label: "Likvida medel",
          value: formatBankReportCurrency(report.savings.assets.liquidBuffer),
        },
    report.savings.assets.investments === null
      ? null
      : {
          label: "Privata investeringar",
          value: formatBankReportCurrency(report.savings.assets.investments),
        },
    report.savings.assets.privatePension === null
      ? null
      : {
          label: "Privat pensionssparande",
          value: formatBankReportCurrency(report.savings.assets.privatePension),
        },
    report.savings.assets.otherFinancialAssets === null
      ? null
      : {
          label: "Övriga finansiella tillgångar",
          value: formatBankReportCurrency(report.savings.assets.otherFinancialAssets),
        },
    report.savings.financialAssetsTotal === null
      ? null
      : {
          label: "Totala privata finansiella tillgångar",
          value: formatBankReportCurrency(report.savings.financialAssetsTotal),
        },
  ]);
  const assets: BankReportPdfGroup[] = [];

  if (report.housing.propertyValue !== null) {
    assets.push({
      rows: [{
        label: "Marknadsvärde",
        value: formatBankReportCurrency(report.housing.propertyValue),
      }],
      title: "Bostad",
    });
  }

  if (report.car.hasData && report.car.carValue !== null) {
    assets.push({
      rows: [
        ...(report.car.carName
          ? [{ label: "Bil", value: report.car.carName }]
          : []),
        {
          label: "Bilvärde",
          value: formatBankReportCurrency(report.car.carValue),
        },
      ],
      title: "Bil",
    });
  }

  if (financialAssets.length) {
    assets.push({
      note: report.savings.assets.privatePension === null
        ? undefined
        : "Privat pension redovisas separat och ingår inte i likvida medel.",
      rows: financialAssets,
      title: "Finansiella tillgångar",
    });
  }

  const mortgageRows = presentRows([
    report.housing.totalMortgage === null
      ? null
      : {
          label: "Skuldbelopp",
          value: formatBankReportCurrency(report.housing.totalMortgage),
        },
    report.housing.averageInterestRate === null
      ? null
      : {
          label: "Ränta",
          value: formatBankReportPercentage(report.housing.averageInterestRate),
        },
    report.housing.loanToValue === null
      ? null
      : {
          label: "Belåningsgrad",
          value: formatBankReportPercentage(report.housing.loanToValue),
        },
    report.housing.annualInterestCost === null
      ? null
      : {
          label: "Beräknad årlig räntekostnad",
          value: formatBankReportCurrency(report.housing.annualInterestCost),
        },
    report.housing.monthlyAmortization === null
      ? null
      : {
          label: "Amortering per månad",
          value: formatBankReportCurrency(report.housing.monthlyAmortization),
        },
  ]);
  const carLoanRows = presentRows([
    report.car.carName ? { label: "Bil", value: report.car.carName } : null,
    report.car.loanStatus === "loanFree"
      ? { label: "Billån", value: "Lånefri" }
      : report.car.currentLoanBalance === null
        ? null
        : {
            label: "Skuldbelopp",
            value: formatBankReportCurrency(report.car.currentLoanBalance),
          },
    report.car.averageInterestRate === null
      ? null
      : {
          label: "Ränta",
          value: formatBankReportPercentage(report.car.averageInterestRate),
        },
    report.car.monthlyLoanCost === null || report.car.loanStatus === "loanFree"
      ? null
      : {
          label: "Månatlig lånebetalning",
          value: formatBankReportCurrency(report.car.monthlyLoanCost),
        },
    report.car.monthlyAmortization === null || report.car.loanStatus === "loanFree"
      ? null
      : {
          label: "Amortering per månad",
          value: formatBankReportCurrency(report.car.monthlyAmortization),
        },
  ]);
  const debts: BankReportPdfGroup[] = [];

  if (mortgageRows.length) {
    debts.push({
      note: report.housing.monthlyAmortization === null
        ? undefined
        : "Amortering redovisas som betalning och skuldminskning, inte som kostnad.",
      rows: mortgageRows,
      title: "Bolån",
    });
  }

  if (report.car.hasData && carLoanRows.length) {
    debts.push({
      note:
        report.car.monthlyAmortization !== null &&
        report.car.loanStatus !== "loanFree"
          ? "Amortering redovisas som betalning och skuldminskning, inte som kostnad."
          : undefined,
      rows: carLoanRows,
      title: "Billån",
    });
  }

  return {
    assets,
    cashFlow: presentRows([
      report.summary.annualIncome === null
        ? null
        : {
            label: "Årsinkomst",
            value: formatBankReportCurrency(report.summary.annualIncome),
          },
      report.summary.annualHouseholdCosts === null
        ? null
        : {
            label: "Årskostnader",
            value: formatBankReportCurrency(report.summary.annualHouseholdCosts),
          },
      report.summary.annualMargin === null
        ? null
        : {
            label: "Planerad årsmarginal",
            value: formatBankReportCurrency(report.summary.annualMargin),
          },
      report.summary.annualPlannedSavings === null
        ? null
        : {
            label: "Planerat sparande per år",
            value: formatBankReportCurrency(report.summary.annualPlannedSavings),
          },
      report.summary.savingsRate === null
        ? null
        : {
            label: "Sparkvot",
            value: formatBankReportPercentage(report.summary.savingsRate),
          },
    ]),
    dataQuality: getBankReportDataQualityItems(report),
    debts,
    disclaimer: bankReportDisclaimer,
    financialHealth: {
      statusLabel: report.financialHealth.statusLabel,
      strengths: report.financialHealth.strengths.slice(0, 3).map((item) => item.message),
      summary: report.financialHealth.summary,
      watchItems: report.financialHealth.watchItems.slice(0, 3).map((item) => item.message),
    },
    header: {
      generatedAt: formatBankReportGeneratedAt(report.document.generatedAt),
      household: report.summary.householdDisplayName,
      planningYear: report.document.planningYear,
      title: report.document.title,
    },
    incomes: report.income.items.map((income) => ({
      amount: formatBankReportCurrency(
        income.monthlyAmount === null ? income.annualAmount : income.monthlyAmount,
      ),
      comment: income.comment,
      metadata: [income.employer, income.employmentTypeLabel, income.occupation]
        .filter((value): value is string => Boolean(value)),
      note: income.monthlyAmount === null ? "Årsinkomst - varierande inkomst" : "per månad",
      title: income.displayName,
    })),
    majorExpenses: report.majorExpenses.map((expense) => ({
      amount: formatBankReportCurrency(expense.annualAmount),
      name: expense.name,
    })),
    metrics: presentRows([
      report.summary.annualIncome === null
        ? null
        : { label: "Årsinkomst", value: formatBankReportCurrency(report.summary.annualIncome) },
      report.summary.annualMargin === null
        ? null
        : { label: "Planerad årsmarginal", value: formatBankReportCurrency(report.summary.annualMargin) },
      report.summary.savingsRate === null
        ? null
        : { label: "Sparkvot", value: formatBankReportPercentage(report.summary.savingsRate) },
      report.housing.loanToValue === null
        ? null
        : { label: "Belåningsgrad", value: formatBankReportPercentage(report.housing.loanToValue) },
      report.summary.liquidAssets === null
        ? null
        : { label: "Likvida medel", value: formatBankReportCurrency(report.summary.liquidAssets) },
      report.summary.financialAssetsTotal === null
        ? null
        : {
            label: "Privata finansiella tillgångar",
            value: formatBankReportCurrency(report.summary.financialAssetsTotal),
          },
      { label: "Ekonomisk hälsa", value: report.financialHealth.statusLabel },
    ]),
    snapshot: getExecutiveSnapshot(report),
    summary: getExecutiveSummaryParagraphs(report),
  };
}
