import type { ReactNode } from "react";

import type {
  BankReportModel,
  BankReportSectionId,
} from "../../shared/planning/bank-report.ts";
import {
  bankReportDisclaimer,
  formatBankReportCurrency as formatCurrency,
  formatBankReportGeneratedAt as formatGeneratedAt,
  formatBankReportPercentage as formatPercentage,
  getBankReportDataQualityItems,
  getExecutiveSnapshot,
  getExecutiveSummaryParagraphs,
} from "../../shared/planning/bank-report-presentation.ts";

function ReportPageBlock({
  children,
  id,
}: {
  children: ReactNode;
  id: "executive" | "cashFlow" | "balance" | "appendix";
}) {
  return (
    <div className="space-y-10 sm:space-y-12" data-report-page-block={id}>
      {children}
    </div>
  );
}

function ReportSection({
  children,
  id,
  title,
}: {
  children: ReactNode;
  id: BankReportSectionId;
  title: string;
}) {
  return (
    <section
      aria-labelledby={`bank-report-${id}`}
      className="border-t border-stone-200 pt-8 sm:pt-10"
    >
      <h2
        className="text-[13px] font-semibold uppercase tracking-[0.11em] text-stone-500"
        id={`bank-report-${id}`}
      >
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-stone-200 py-4 first:border-t-0 sm:min-h-[88px]">
      <p className="text-xs leading-5 text-stone-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-[-0.025em] text-stone-950 tabular-nums sm:text-xl">
        {value}
      </p>
    </div>
  );
}

type ReportRow = { label: string; value: string };

function ReportRows({ rows }: { rows: ReportRow[] }) {
  return (
    <dl className="divide-y divide-stone-100 border-y border-stone-200">
      {rows.map((row) => (
        <div
          className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-5 py-3.5"
          key={row.label}
        >
          <dt className="text-sm leading-6 text-stone-600">{row.label}</dt>
          <dd className="text-right text-sm font-semibold leading-6 text-stone-950 tabular-nums">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ExecutiveSummarySection({ report }: { report: BankReportModel }) {
  const summaryParagraphs = getExecutiveSummaryParagraphs(report);
  const snapshot = getExecutiveSnapshot(report);
  const metrics = [
    report.summary.annualIncome === null
      ? null
      : { label: "Årsinkomst", value: formatCurrency(report.summary.annualIncome) },
    report.summary.annualMargin === null
      ? null
      : { label: "Planerad årsmarginal", value: formatCurrency(report.summary.annualMargin) },
    report.summary.savingsRate === null
      ? null
      : { label: "Sparkvot", value: formatPercentage(report.summary.savingsRate) },
    report.housing.loanToValue === null
      ? null
      : { label: "Belåningsgrad", value: formatPercentage(report.housing.loanToValue) },
    report.summary.liquidAssets === null
      ? null
      : { label: "Likvida medel", value: formatCurrency(report.summary.liquidAssets) },
    report.summary.financialAssetsTotal === null
      ? null
      : {
          label: "Privata finansiella tillgångar",
          value: formatCurrency(report.summary.financialAssetsTotal),
        },
    { label: "Ekonomisk hälsa", value: report.financialHealth.statusLabel },
  ].filter((metric): metric is { label: string; value: string } => metric !== null);

  return (
    <ReportSection id="summary" title="Sammanfattning">
      <div
        className="max-w-3xl space-y-2 text-lg leading-8 tracking-[-0.012em] text-stone-700 sm:text-xl sm:leading-9"
        data-executive-summary="true"
      >
        {summaryParagraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      {snapshot.length ? (
        <ul
          className="mt-8 grid gap-x-10 gap-y-3 border-y border-stone-200 py-5 sm:grid-cols-2"
          data-executive-snapshot="true"
        >
          {snapshot.map((item) => (
            <li className="flex gap-2 text-sm leading-6 text-stone-700" key={item.code}>
              <span
                aria-hidden="true"
                className={item.tone === "positive" ? "text-[#71816d]" : "text-stone-500"}
              >
                {item.tone === "positive" ? "✓" : "●"}
              </span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-7 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <Metric key={metric.label} {...metric} />
        ))}
      </div>
    </ReportSection>
  );
}

function FinancialHealthSection({ report }: { report: BankReportModel }) {
  const strengths = report.financialHealth.strengths.slice(0, 3);
  const watchItems = report.financialHealth.watchItems.slice(0, 3);

  return (
    <ReportSection id="financialHealth" title="Ekonomisk hälsa">
      <div className="border-l-2 border-[#8b9b86] pl-4">
        <p className="text-xl font-semibold tracking-[-0.025em] text-stone-950">
          {report.financialHealth.statusLabel}
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
          {report.financialHealth.summary}
        </p>
      </div>
      <div className="mt-6 grid gap-7 sm:grid-cols-2 sm:gap-10">
        <div>
          <h3 className="text-sm font-semibold text-stone-950">Styrkor</h3>
          {strengths.length ? (
            <ul className="mt-3 space-y-2">
              {strengths.map((item) => (
                <li className="flex gap-2 text-sm leading-6 text-stone-600" key={item.code}>
                  <span aria-hidden="true" className="text-[#71816d]">✓</span>
                  <span>{item.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-stone-500">
              Inga tydliga styrkor kan ännu beskrivas från underlaget.
            </p>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-stone-950">Att hålla koll på</h3>
          {watchItems.length ? (
            <ul className="mt-3 space-y-2">
              {watchItems.map((item) => (
                <li className="flex gap-2 text-sm leading-6 text-stone-600" key={item.code}>
                  <span aria-hidden="true" className="text-stone-400">○</span>
                  <span>{item.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-stone-500">
              Inga särskilda delar behöver uppmärksammas utifrån underlaget.
            </p>
          )}
        </div>
      </div>
    </ReportSection>
  );
}

function IncomeAndCashFlowSection({ report }: { report: BankReportModel }) {
  const cashFlowRows: Array<ReportRow | null> = [
    report.summary.annualIncome === null
      ? null
      : { label: "Årsinkomst", value: formatCurrency(report.summary.annualIncome) },
    report.summary.annualHouseholdCosts === null
      ? null
      : { label: "Årskostnader", value: formatCurrency(report.summary.annualHouseholdCosts) },
    report.summary.annualMargin === null
      ? null
      : { label: "Planerad årsmarginal", value: formatCurrency(report.summary.annualMargin) },
    report.summary.annualPlannedSavings === null
      ? null
      : {
          label: "Planerat sparande per år",
          value: formatCurrency(report.summary.annualPlannedSavings),
        },
    report.summary.savingsRate === null
      ? null
      : { label: "Sparkvot", value: formatPercentage(report.summary.savingsRate) },
  ];

  return (
    <ReportSection id="income" title="Inkomster och kassaflöde">
      {report.income.items.length ? (
        <div className="divide-y divide-stone-200 border-y border-stone-200">
          {report.income.items.map((income) => (
            <article
              className="py-5 sm:grid sm:grid-cols-[minmax(0,1fr)_220px] sm:gap-8"
              key={income.incomeLineKey}
            >
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-stone-950">
                  {income.displayName}
                </h3>
                {[income.employer, income.employmentTypeLabel, income.occupation]
                  .filter((value): value is string => Boolean(value))
                  .map((value) => (
                    <p className="mt-1 text-sm leading-6 text-stone-600" key={value}>
                      {value}
                    </p>
                  ))}
                {income.comment ? (
                  <p className="mt-3 max-w-xl text-sm italic leading-6 text-stone-500">
                    {income.comment}
                  </p>
                ) : null}
              </div>
              <div className="mt-4 sm:mt-0 sm:text-right">
                {income.monthlyAmount === null ? (
                  <>
                    <p className="text-xs text-stone-500">Årsinkomst</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-stone-950">
                      {formatCurrency(income.annualAmount)}
                    </p>
                    <p className="mt-1 text-xs text-stone-400">Varierande inkomst</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold tabular-nums text-stone-950">
                      {formatCurrency(income.monthlyAmount)}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">per månad</p>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-stone-500">
          Inga inkomster är registrerade för planeringsåret.
        </p>
      )}

      <div className="mt-8">
        <h3 className="text-base font-semibold text-stone-950">Hushållets kassaflödesbild</h3>
        <div className="mt-3">
          <ReportRows rows={cashFlowRows.filter((row): row is ReportRow => row !== null)} />
        </div>
      </div>
    </ReportSection>
  );
}

function AssetsSection({ report }: { report: BankReportModel }) {
  const financialAssetRows: Array<ReportRow | null> = [
    report.savings.assets.liquidBuffer === null
      ? null
      : { label: "Likvida medel", value: formatCurrency(report.savings.assets.liquidBuffer) },
    report.savings.assets.investments === null
      ? null
      : {
          label: "Privata investeringar",
          value: formatCurrency(report.savings.assets.investments),
        },
    report.savings.assets.privatePension === null
      ? null
      : {
          label: "Privat pensionssparande",
          value: formatCurrency(report.savings.assets.privatePension),
        },
    report.savings.assets.otherFinancialAssets === null
      ? null
      : {
          label: "Övriga finansiella tillgångar",
          value: formatCurrency(report.savings.assets.otherFinancialAssets),
        },
    report.savings.financialAssetsTotal === null
      ? null
      : {
          label: "Totala privata finansiella tillgångar",
          value: formatCurrency(report.savings.financialAssetsTotal),
        },
  ];
  const financialAssets = financialAssetRows.filter(
    (row): row is ReportRow => row !== null,
  );
  const hasPropertyAsset = report.housing.propertyValue !== null;
  const hasCarAsset = report.car.carValue !== null;

  return (
    <ReportSection id="assets" title="Tillgångar">
      {hasPropertyAsset || hasCarAsset || financialAssets.length ? (
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-x-12 lg:gap-y-10">
          {hasPropertyAsset ? (
            <article>
              <h3 className="text-base font-semibold text-stone-950">Bostad</h3>
              <div className="mt-3">
                <ReportRows
                  rows={[
                    {
                      label: "Marknadsvärde",
                      value: formatCurrency(report.housing.propertyValue as number),
                    },
                  ]}
                />
              </div>
            </article>
          ) : null}
          {hasCarAsset ? (
            <article>
              <h3 className="text-base font-semibold text-stone-950">Bil</h3>
              <div className="mt-3">
                <ReportRows
                  rows={[
                    ...(report.car.carName
                      ? [{ label: "Bil", value: report.car.carName }]
                      : []),
                    {
                      label: "Bilvärde",
                      value: formatCurrency(report.car.carValue as number),
                    },
                  ]}
                />
              </div>
            </article>
          ) : null}
          {financialAssets.length ? (
            <article className="lg:col-span-2">
              <h3 className="text-base font-semibold text-stone-950">
                Finansiella tillgångar
              </h3>
              <div className="mt-3">
                <ReportRows rows={financialAssets} />
              </div>
              {report.savings.assets.privatePension !== null ? (
                <p className="mt-3 text-xs leading-5 text-stone-500">
                  Privat pension redovisas separat och ingår inte i likvida medel.
                </p>
              ) : null}
            </article>
          ) : null}
        </div>
      ) : (
        <p className="text-sm leading-6 text-stone-500">
          Inga tillgångsuppgifter är registrerade.
        </p>
      )}
    </ReportSection>
  );
}

function DebtsSection({ report }: { report: BankReportModel }) {
  const mortgageRows: Array<ReportRow | null> = [
    report.housing.totalMortgage === null
      ? null
      : { label: "Skuldbelopp", value: formatCurrency(report.housing.totalMortgage) },
    report.housing.averageInterestRate === null
      ? null
      : { label: "Ränta", value: formatPercentage(report.housing.averageInterestRate) },
    report.housing.loanToValue === null
      ? null
      : { label: "Belåningsgrad", value: formatPercentage(report.housing.loanToValue) },
    report.housing.annualInterestCost === null
      ? null
      : {
          label: "Beräknad årlig räntekostnad",
          value: formatCurrency(report.housing.annualInterestCost),
        },
    report.housing.monthlyAmortization === null
      ? null
      : {
          label: "Amortering per månad",
          value: formatCurrency(report.housing.monthlyAmortization),
        },
  ];
  const mortgage = mortgageRows.filter((row): row is ReportRow => row !== null);
  const carLoanRows: Array<ReportRow | null> = [
    report.car.carName ? { label: "Bil", value: report.car.carName } : null,
    report.car.loanStatus === "loanFree"
      ? { label: "Billån", value: "Lånefri" }
      : report.car.currentLoanBalance === null
        ? null
        : { label: "Skuldbelopp", value: formatCurrency(report.car.currentLoanBalance) },
    report.car.averageInterestRate === null
      ? null
      : { label: "Ränta", value: formatPercentage(report.car.averageInterestRate) },
    report.car.monthlyLoanCost === null || report.car.loanStatus === "loanFree"
      ? null
      : {
          label: "Månatlig lånebetalning",
          value: formatCurrency(report.car.monthlyLoanCost),
        },
    report.car.monthlyAmortization === null || report.car.loanStatus === "loanFree"
      ? null
      : {
          label: "Amortering per månad",
          value: formatCurrency(report.car.monthlyAmortization),
        },
  ];
  const carLoan = carLoanRows.filter((row): row is ReportRow => row !== null);

  return (
    <ReportSection id="debts" title="Skulder">
      {mortgage.length || carLoan.length ? (
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {mortgage.length ? (
            <article>
              <h3 className="text-base font-semibold text-stone-950">Bolån</h3>
              <div className="mt-3"><ReportRows rows={mortgage} /></div>
              {report.housing.monthlyAmortization !== null ? (
                <p className="mt-3 text-xs leading-5 text-stone-500">
                  Amortering redovisas som betalning och skuldminskning, inte som kostnad.
                </p>
              ) : null}
            </article>
          ) : null}
          {carLoan.length ? (
            <article>
              <h3 className="text-base font-semibold text-stone-950">Billån</h3>
              <div className="mt-3"><ReportRows rows={carLoan} /></div>
              {report.car.monthlyAmortization !== null && report.car.loanStatus !== "loanFree" ? (
                <p className="mt-3 text-xs leading-5 text-stone-500">
                  Amortering redovisas som betalning och skuldminskning, inte som kostnad.
                </p>
              ) : null}
            </article>
          ) : null}
        </div>
      ) : (
        <p className="text-sm leading-6 text-stone-500">
          Inga skulddata är registrerade i underlaget.
        </p>
      )}
    </ReportSection>
  );
}

function MajorExpensesSection({ report }: { report: BankReportModel }) {
  return (
    <ReportSection id="majorExpenses" title="Största kostnader">
      {report.majorExpenses.length ? (
        <ol className="divide-y divide-stone-100 border-y border-stone-200">
          {report.majorExpenses.map((expense, index) => (
            <li
              className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-baseline gap-3 py-4"
              key={expense.id}
            >
              <span className="text-xs text-stone-400">{index + 1}</span>
              <span className="text-sm font-medium text-stone-700">{expense.name}</span>
              <span className="text-right text-sm font-semibold tabular-nums text-stone-950">
                {formatCurrency(expense.annualAmount)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-stone-500">Inga planerade kostnader är registrerade.</p>
      )}
    </ReportSection>
  );
}

function DataQualitySection({ report }: { report: BankReportModel }) {
  const dataQualityItems = getBankReportDataQualityItems(report);

  return (
    <ReportSection id="dataQuality" title="Underlag och datakvalitet">
      <ul className="space-y-2">
        {dataQualityItems.map((item) => (
          <li className="flex gap-2 text-sm leading-6 text-stone-600" key={item.label}>
            <span
              aria-hidden="true"
              className={item.complete ? "text-[#71816d]" : "text-stone-400"}
            >
              {item.complete ? "✓" : "○"}
            </span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
      {dataQualityItems.some((item) => !item.complete) ? (
        <p className="mt-5 max-w-2xl text-sm leading-6 text-stone-500">
          Vill du göra översikten mer komplett kan du komplettera de uppgifter som saknas.
        </p>
      ) : null}
    </ReportSection>
  );
}

export function BankReportView({ report }: { report: BankReportModel }) {
  return (
    <article
      className="mx-auto max-w-[960px] bg-[#fffefa] px-5 py-8 text-stone-950 shadow-[0_24px_90px_rgba(28,25,23,0.08)] sm:px-10 sm:py-12 lg:px-16 lg:py-16"
      data-bank-report-view="true"
    >
      <header className="border-b-2 border-stone-800 pb-8 sm:pb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#657663]">
          Fameko
        </p>
        <h1 className="mt-4 max-w-3xl text-[30px] font-semibold leading-tight tracking-[-0.04em] sm:text-[40px]">
          {report.document.title}
        </h1>
        <dl className="mt-7 grid gap-x-10 gap-y-3 text-sm sm:grid-cols-2">
          {report.summary.householdDisplayName ? (
            <div>
              <dt className="text-xs text-stone-500">Hushåll</dt>
              <dd className="mt-1 font-medium text-stone-900">
                {report.summary.householdDisplayName}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-stone-500">Planeringsår</dt>
            <dd className="mt-1 font-medium text-stone-900">
              {report.document.planningYear}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Genererad</dt>
            <dd className="mt-1 font-medium text-stone-900">
              {formatGeneratedAt(report.document.generatedAt)}
            </dd>
          </div>
        </dl>
        <p className="mt-7 text-sm leading-6 text-stone-500">
          Underlaget bygger på de uppgifter som registrerats i Fameko.
        </p>
      </header>

      <div className="space-y-14 pt-10 sm:space-y-16 sm:pt-12">
        <ReportPageBlock id="executive">
          <ExecutiveSummarySection report={report} />
          <FinancialHealthSection report={report} />
        </ReportPageBlock>

        <ReportPageBlock id="cashFlow">
          <IncomeAndCashFlowSection report={report} />
        </ReportPageBlock>

        <ReportPageBlock id="balance">
          <AssetsSection report={report} />
          <DebtsSection report={report} />
        </ReportPageBlock>

        <ReportPageBlock id="appendix">
          <MajorExpensesSection report={report} />
          <DataQualitySection report={report} />
        </ReportPageBlock>
      </div>

      <footer className="mt-12 border-t border-stone-300 pt-7 sm:mt-16">
        <p className="max-w-3xl text-xs leading-5 text-stone-500">
          {bankReportDisclaimer}
        </p>
      </footer>
    </article>
  );
}
