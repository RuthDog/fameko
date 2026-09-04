import assert from "node:assert/strict";
import { accessSync, readFileSync } from "node:fs";
import test from "node:test";

const viewSource = readFileSync(
  new URL("../../app/app/bank-report-view.tsx", import.meta.url),
  "utf8",
);
const routeSource = readFileSync(
  new URL("../../app/app/ekonomisk-sammanstallning/page.tsx", import.meta.url),
  "utf8",
);
const workspaceSource = readFileSync(
  new URL("../../app/app/page.tsx", import.meta.url),
  "utf8",
);
const entryPointSource = readFileSync(
  new URL("../../app/app/bank-report-entry-point.tsx", import.meta.url),
  "utf8",
);
const presentationSource = readFileSync(
  new URL("./bank-report-presentation.ts", import.meta.url),
  "utf8",
);

test("the protected household overview route and Workspace entry point exist", () => {
  accessSync(new URL("../../app/app/ekonomisk-sammanstallning/page.tsx", import.meta.url));
  assert.match(routeSource, /export default function BankReportPreviewPage/);
  assert.match(workspaceSource, /<BankReportEntryPoint \/>/);
  assert.match(entryPointSource, /Hushållets ekonomiska översikt/);
  assert.match(entryPointSource, /Visa översikt/);
  assert.match(viewSource, /data-bank-report-view="true"/);
});

test("BankReportView receives only BankReportModel and contains no economic selectors", () => {
  assert.match(viewSource, /BankReportModel/);
  assert.doesNotMatch(viewSource, /PlanningData|HousingData|CarData|FinancialAssetsData/);
  assert.doesNotMatch(
    viewSource,
    /calculateHousing|calculateCar|evaluateFinancialHealth|getMajorHouseholdExpenses|getSavingsOverview/,
  );
  assert.match(routeSource, /buildBankReportModel\(planning\.data/);
});

test("the financial story follows the approved information hierarchy", () => {
  const orderedSections = [
    '<ExecutiveSummarySection report={report} />',
    '<FinancialHealthSection report={report} />',
    '<IncomeAndCashFlowSection report={report} />',
    '<AssetsSection report={report} />',
    '<DebtsSection report={report} />',
    '<MajorExpensesSection report={report} />',
    '<DataQualitySection report={report} />',
  ];
  let previousIndex = -1;

  for (const section of orderedSections) {
    const index = viewSource.indexOf(section);
    assert.ok(index > previousIndex, `${section} should follow the previous report section`);
    previousIndex = index;
  }

  for (const title of [
    "Sammanfattning",
    "Ekonomisk hälsa",
    "Inkomster och kassaflöde",
    "Tillgångar",
    "Skulder",
    "Största kostnader",
    "Underlag och datakvalitet",
  ]) {
    assert.match(viewSource, new RegExp(title));
  }
});

test("Executive Summary reuses structured report narrative and only prioritized metrics", () => {
  assert.match(viewSource, /data-executive-summary="true"/);
  assert.match(viewSource, /getExecutiveSummaryParagraphs\(report\)/);
  assert.match(viewSource, /getExecutiveSnapshot\(report\)/);
  assert.match(viewSource, /data-executive-snapshot="true"/);

  for (const metric of [
    "Årsinkomst",
    "Planerad årsmarginal",
    "Sparkvot",
    "Belåningsgrad",
    "Likvida medel",
    "Privata finansiella tillgångar",
    "Ekonomisk hälsa",
  ]) {
    assert.match(viewSource, new RegExp(metric));
  }

  assert.doesNotMatch(viewSource, /score/i);
  assert.doesNotMatch(viewSource, /Du bör|Du måste/);
});

test("income metadata and safe variable income presentation remain intact", () => {
  assert.match(viewSource, /income\.employer/);
  assert.match(viewSource, /income\.employmentTypeLabel/);
  assert.match(viewSource, /income\.occupation/);
  assert.match(viewSource, /income\.comment/);
  assert.match(viewSource, /income\.monthlyAmount === null/);
  assert.match(viewSource, /formatCurrency\(income\.annualAmount\)/);
  assert.match(viewSource, /Varierande inkomst/);
  assert.match(viewSource, /Hushållets kassaflödesbild/);
});

test("assets and debts regroup existing model values without inventing new totals", () => {
  assert.match(viewSource, /Marknadsvärde/);
  assert.match(viewSource, /Bilvärde/);
  assert.match(viewSource, /Totala privata finansiella tillgångar/);
  assert.match(viewSource, /Privat pensionssparande/);
  assert.match(viewSource, /ingår inte i likvida medel/);
  assert.match(viewSource, /Skuldbelopp/);
  assert.match(viewSource, /Beräknad årlig räntekostnad/);
  assert.match(viewSource, /Lånefri/);
  assert.match(
    viewSource,
    /Amortering redovisas som betalning och skuldminskning, inte som kostnad/,
  );
});

test("Major Expenses uses the model top three unchanged", () => {
  assert.match(viewSource, /report\.majorExpenses\.map/);
  assert.doesNotMatch(viewSource, /majorExpenses\.(sort|toSorted)/);
});

test("data quality uses calm model-backed coverage instead of technical levels", () => {
  assert.match(viewSource, /getBankReportDataQualityItems\(report\)/);
  assert.match(presentationSource, /report\.metadata\.missing/);
  assert.match(presentationSource, /"Inkomster"/);
  assert.match(presentationSource, /"Boende"/);
  assert.match(presentationSource, /"Sparande och tillgångar"/);
  assert.match(viewSource, /Vill du göra översikten mer komplett/);
  assert.doesNotMatch(viewSource, /Hög datatäckning|Begränsad datatäckning|LOW|MEDIUM|HIGH/);
  assert.doesNotMatch(viewSource, /Ej angivet/);
});

test("the view remains read-only, A4-inspired and prepared as four logical page blocks", () => {
  assert.match(viewSource, /max-w-\[960px\]/);
  assert.match(viewSource, /bg-\[#fffefa\]/);
  assert.match(routeSource, /overflow-x-hidden/);
  assert.match(viewSource, /sm:grid-cols-2/);

  for (const block of ["executive", "cashFlow", "balance", "appendix"]) {
    assert.match(viewSource, new RegExp(`ReportPageBlock id="${block}"`));
  }

  assert.doesNotMatch(viewSource, /PDF|Exportera|Ladda ner|contentEditable|onChange/);
});
