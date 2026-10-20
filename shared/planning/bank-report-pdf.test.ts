import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PDFDocument, StandardFonts } from "pdf-lib";

import {
  bankReportPdfHousingFieldNames,
  bankReportPdfPrivacyInstruction,
  createBankReportFilename,
  getBankReportPdfIncomeFieldNames,
  renderBankReportPdf,
} from "../../server/planning/bank-report-pdf.ts";
import {
  createBankReportPdfDownloadResponse,
} from "../../server/planning/bank-report-pdf-http.ts";
import { createBankReportPdfContent } from "./bank-report-pdf-content.ts";
import type { BankReportModel } from "./bank-report.ts";

const rendererSource = readFileSync(
  new URL("../../server/planning/bank-report-pdf.ts", import.meta.url),
  "utf8",
);
const routeSource = readFileSync(
  new URL("../../app/app/api/planning-years/[year]/bank-report.pdf/route.ts", import.meta.url),
  "utf8",
);
const httpSource = readFileSync(
  new URL("../../server/planning/bank-report-pdf-http.ts", import.meta.url),
  "utf8",
);
const actionSource = readFileSync(
  new URL("../../app/app/bank-report-pdf-action.tsx", import.meta.url),
  "utf8",
);

function createReport(): BankReportModel {
  return {
    car: {
      annualInsurance: 7_200,
      annualPlannedCosts: 18_000,
      annualService: 6_000,
      averageInterestRate: 4.2,
      carName: "Volvo XC40",
      carValue: 280_000,
      currentLoanBalance: 120_000,
      hasData: true,
      loanStatus: "withLoan",
      monthlyAmortization: 2_000,
      monthlyInsurance: 600,
      monthlyInterestCost: 420,
      monthlyLoanCost: 2_420,
      monthlyService: 500,
    },
    document: {
      currency: "SEK",
      generatedAt: "2026-09-04T08:15:00.000Z",
      locale: "sv-SE",
      planningYear: 2026,
      reportVersion: 1,
      title: "Hushållets ekonomiska översikt",
    },
    financialHealth: {
      completeness: "HIGH",
      missingInputs: [],
      status: "GOOD_FOUNDATION",
      statusLabel: "God grund",
      strengths: [{
        code: "POSITIVE_ANNUAL_MARGIN",
        condition: "positive",
        message: "Hushållet har positiv planerad årsmarginal.",
        metric: "annualMargin",
        source: "cashFlow",
        value: 96_000,
      }, {
        code: "REGULAR_PLANNED_SAVINGS",
        condition: "regular",
        message: "Planeringen innehåller regelbundet sparande.",
        metric: "savings",
        source: "savings",
        value: true,
      }],
      summary: "Hushållet har en god ekonomisk grund i den aktuella planeringen.",
      watchItems: [{
        code: "HIGH_HOUSING_LTV",
        condition: "high",
        message: "Boendets belåningsgrad är relativt hög.",
        metric: "loanToValue",
        source: "housing",
        value: 76.7,
      }],
    },
    housing: {
      annualInterestCost: 78_000,
      annualPlannedCosts: 210_000,
      averageInterestRate: 3.25,
      hasData: true,
      loanToValue: 76.7,
      monthlyAmortization: 4_000,
      monthlyInterestCost: 6_500,
      monthlyMortgageCost: 10_500,
      propertyValue: 3_000_000,
      totalMortgage: 2_300_000,
      valuationDate: "2026-06-01",
    },
    income: {
      annualAmount: 900_000,
      averageMonthlyAmount: 75_000,
      items: [{
        annualAmount: 540_000,
        displayName: "Lön 1",
        incomeLineKey: "salaryOne",
        monthlyAmount: 45_000,
        monthlyAmounts: [],
      }, {
        annualAmount: 360_000,
        displayName: "Lön 2",
        incomeLineKey: "salaryTwo",
        monthlyAmount: null,
        monthlyAmounts: [],
      }],
      monthlyAmounts: [],
    },
    majorExpenses: [{
      annualAmount: 120_000,
      id: "food",
      name: "Mat",
      percentage: 28,
      source: { categoryId: "mat", type: "planningData" },
    }, {
      annualAmount: 78_000,
      id: "interest",
      name: "Bolåneränta",
      percentage: 18,
      source: { field: "annualInterestCost", type: "housingData" },
    }, {
      annualAmount: 48_000,
      id: "insurance",
      name: "Försäkringar",
      percentage: 11,
      source: { categoryId: "forsakringar", type: "planningData" },
    }],
    metadata: {
      adultCount: 2,
      childCount: 2,
      householdDisplayName: "Familjen Åström",
      missing: [],
    },
    savings: {
      assets: {
        investments: 240_000,
        liquidBuffer: 150_000,
        otherFinancialAssets: 35_000,
        privatePension: 420_000,
      },
      averageMonthlyAmount: 8_000,
      financialAssetsTotal: 845_000,
      goals: [],
      plannedAnnualAmount: 96_000,
      savingsRate: 10.7,
    },
    sectionOrder: [
      "summary",
      "financialHealth",
      "income",
      "assets",
      "debts",
      "majorExpenses",
      "dataQuality",
    ],
    sourceDetails: { planningItems: [] },
    summary: {
      annualHouseholdCosts: 708_000,
      annualIncome: 900_000,
      annualMargin: 96_000,
      annualPlannedSavings: 96_000,
      financialAssetsTotal: 845_000,
      financialHealthStatus: "GOOD_FOUNDATION",
      financialHealthSummary: "God grund.",
      householdDisplayName: "Familjen Åström",
      liquidAssets: 150_000,
      savingsRate: 10.7,
    },
  };
}

const housingFieldNames = Object.values(bankReportPdfHousingFieldNames);
const salaryOneFieldNames = Object.values(getBankReportPdfIncomeFieldNames("salaryOne"));
const salaryTwoFieldNames = Object.values(getBankReportPdfIncomeFieldNames("salaryTwo"));
const expectedFormFieldNames = [
  ...housingFieldNames,
  ...salaryOneFieldNames,
  ...salaryTwoFieldNames,
].sort();

function widgetPageIndex(document: PDFDocument, fieldName: string) {
  const widget = document.getForm().getTextField(fieldName).acroField.getWidgets()[0];
  const pageReference = widget?.P()?.toString();
  return document.getPages().findIndex((page) => page.ref.toString() === pageReference);
}

test("PDF is a valid four-page A4 document", async () => {
  const bytes = await renderBankReportPdf(createReport());
  assert.equal(new TextDecoder("latin1").decode(bytes.slice(0, 8)).startsWith("%PDF-"), true);
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(), 4);
  for (const page of document.getPages()) {
    assert.ok(Math.abs(page.getWidth() - 595.28) < 0.1);
    assert.ok(Math.abs(page.getHeight() - 841.89) < 0.1);
  }
});

test("PDF contains empty, writable and printable local-only AcroForm fields", async () => {
  const document = await PDFDocument.load(await renderBankReportPdf(createReport()));
  const form = document.getForm();

  assert.deepEqual(
    form.getFields().map((field) => field.getName()).sort(),
    expectedFormFieldNames,
  );

  for (const fieldName of expectedFormFieldNames) {
    const field = form.getTextField(fieldName);
    assert.equal(field.getText() ?? "", "");
    assert.equal(field.isReadOnly(), false);

    const widgets = field.acroField.getWidgets();
    assert.equal(widgets.length, 1);
    const widget = widgets[0];
    assert.ok(widget);
    assert.equal(widget.hasFlag(4), true, `${fieldName} must have the PDF Print flag`);
    assert.ok(widget.getAppearances()?.normal, `${fieldName} must have a normal appearance stream`);
    const rectangle = widget.getRectangle();
    assert.ok(rectangle.width > 0 && rectangle.height > 0);
    assert.ok(rectangle.x >= 0 && rectangle.y >= 0);
    assert.ok(rectangle.x + rectangle.width <= 595.28);
    assert.ok(rectangle.y + rectangle.height <= 841.89);
  }

  for (const fieldName of [...salaryOneFieldNames, ...salaryTwoFieldNames]) {
    assert.equal(widgetPageIndex(document, fieldName), 1);
  }
  for (const fieldName of housingFieldNames) {
    assert.equal(widgetPageIndex(document, fieldName), 2);
  }
});

test("only stable employment income lines receive employment document fields", async () => {
  const report = createReport();
  report.income.items.push({
    annualAmount: 24_000,
    displayName: "Bidrag",
    incomeLineKey: "benefits",
    monthlyAmount: 2_000,
    monthlyAmounts: [],
  }, {
    annualAmount: 12_000,
    displayName: "Övrig inkomst",
    incomeLineKey: "other",
    monthlyAmount: 1_000,
    monthlyAmounts: [],
  });

  const document = await PDFDocument.load(await renderBankReportPdf(report));
  const names = document.getForm().getFields().map((field) => field.getName()).sort();
  assert.deepEqual(names, expectedFormFieldNames);
  assert.equal(names.some((name) => name.includes("benefits") || name.includes("other")), false);
});

test("filled local-only fields retain values and appearances after save and reopen", async () => {
  const document = await PDFDocument.load(await renderBankReportPdf(createReport()));
  const form = document.getForm();
  const values = new Map<string, string>([
    [bankReportPdfHousingFieldNames.address, "Exempelgatan 1"],
    [bankReportPdfHousingFieldNames.postalCode, "123 45"],
    [bankReportPdfHousingFieldNames.city, "Exempelstad"],
    [bankReportPdfHousingFieldNames.propertyDesignation, "Exemplet 1:2"],
    [getBankReportPdfIncomeFieldNames("salaryOne").employer, "Exempelbolaget AB"],
    [getBankReportPdfIncomeFieldNames("salaryOne").employmentType, "Tillsvidare"],
    [getBankReportPdfIncomeFieldNames("salaryOne").jobTitle, "Analytiker"],
  ]);

  for (const [fieldName, value] of values) {
    form.getTextField(fieldName).setText(value);
  }
  form.updateFieldAppearances(await document.embedFont(StandardFonts.Helvetica));

  const reopened = await PDFDocument.load(await document.save());
  for (const [fieldName, value] of values) {
    const field = reopened.getForm().getTextField(fieldName);
    assert.equal(field.getText(), value);
    assert.ok(field.acroField.getWidgets()[0]?.getAppearances()?.normal);
  }
});

test("privacy instruction and renderer remain local-only with no persistence side effects", () => {
  assert.equal(
    bankReportPdfPrivacyInstruction,
    "Du kan komplettera vissa uppgifter direkt i PDF-filen. Dessa uppgifter sparas inte i Fameko.",
  );
  assert.doesNotMatch(
    rendererSource,
    /localStorage|sessionStorage|indexedDB|fetch\(|INSERT|UPDATE|DELETE|analytics/i,
  );
  assert.doesNotMatch(routeSource, /export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)\b/);
});

test("PDF renderer consumes BankReportModel presentation only", () => {
  assert.match(rendererSource, /BankReportModel/);
  assert.match(rendererSource, /createBankReportPdfContent/);
  assert.doesNotMatch(rendererSource, /PlanningData|HousingData|CarData|evaluateFinancialHealth/);
});

test("endpoint uses authenticated household scope and selected path year", () => {
  assert.match(routeSource, /requirePlanningAuthorization\(request\)/);
  assert.match(routeSource, /authorization\.context\.household\.id,\s*year/);
  assert.match(routeSource, /buildBankReportModel/);
  assert.doesNotMatch(routeSource, /searchParams|householdId\s*=/);
});

test("full report content contains the approved summary and snapshot", () => {
  const content = createBankReportPdfContent(createReport());
  assert.match(content.summary.join(" "), /positiv årsmarginal/);
  assert.deepEqual(content.snapshot.slice(0, 2).map((item) => item.code), [
    "POSITIVE_ANNUAL_MARGIN",
    "REGULAR_PLANNED_SAVINGS",
  ]);
  assert.equal("address" in content.header, false);
  assert.equal(content.header.householdSize, "2 vuxna, 2 barn");
});

test("missing car data does not invent a car asset or debt", () => {
  const report = createReport();
  report.car = { ...report.car, carValue: null, hasData: false, loanStatus: "unknown" };
  const content = createBankReportPdfContent(report);
  assert.equal(content.assets.some((group) => group.title === "Bil"), false);
  assert.equal(content.debts.some((group) => group.title === "Billån"), false);
});

test("retired document metadata is not presented as a data-quality gap", () => {
  const report = createReport();
  assert.equal(
    createBankReportPdfContent(report).dataQuality.some((item) => /Arbetsgivare|Befattning/.test(item.label)),
    false,
  );
});

test("variable income uses the safe annual amount", () => {
  const income = createBankReportPdfContent(createReport()).incomes[1];
  assert.equal(income.amount, "360 000 kr");
  assert.equal(income.note, "Årsinkomst - varierande inkomst");
});

test("private pension is separate from liquid assets", () => {
  const group = createBankReportPdfContent(createReport()).assets.find(
    (item) => item.title === "Finansiella tillgångar",
  );
  assert.match(group?.note ?? "", /ingår inte i likvida medel/);
  assert.ok(group?.rows.some((row) => row.label === "Privat pensionssparande"));
});

test("amortization is identified as payment and debt reduction, not cost", () => {
  const content = createBankReportPdfContent(createReport());
  assert.ok(content.debts.every((group) => !group.note || group.note.includes("inte som kostnad")));
  assert.equal(content.majorExpenses.some((item) => /amortering/i.test(item.name)), false);
});

test("PDF content exposes no numerical financial-health score", () => {
  const content = createBankReportPdfContent(createReport());
  assert.equal("score" in content.financialHealth, false);
  assert.equal(JSON.stringify(content.financialHealth).includes("100/100"), false);
});

test("major expenses match the exact BankReportModel top three", () => {
  const report = createReport();
  const content = createBankReportPdfContent(report);
  assert.deepEqual(content.majorExpenses.map((item) => item.name), report.majorExpenses.map((item) => item.name));
  assert.deepEqual(content.majorExpenses.map((item) => item.amount), ["120 000 kr", "78 000 kr", "48 000 kr"]);
});

test("PDF includes the approved source disclaimer", () => {
  assert.match(createBankReportPdfContent(createReport()).disclaimer, /inte verifierade av bank/);
});

test("filename is readable, sanitized and year-specific", () => {
  assert.equal(
    createBankReportFilename(createReport()),
    "familjen-astrom-ekonomisk-oversikt-2026.pdf",
  );
});

test("download action provides calm error handling and same-origin relative API", () => {
  assert.match(actionSource, /PDF-filen kunde inte skapas just nu\. Försök igen\./);
  assert.match(actionSource, /`\/app\/api\/planning-years\/\$\{planningYear\}\/bank-report\.pdf`/);
  assert.doesNotMatch(actionSource, /localhost|fameko\.se|:3000|:3001/);
});

test("endpoint is on-demand, uncached and returns an attachment", () => {
  assert.match(httpSource, /private, no-store/);
  assert.match(httpSource, /Content-Disposition/);
  assert.match(httpSource, /application\/pdf/);
  assert.doesNotMatch(`${routeSource}${httpSource}`, /R2|INSERT|UPDATE|cache\.put/);
});

test("download response is a valid uncached PDF attachment", async () => {
  const response = await createBankReportPdfDownloadResponse(createReport());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(response.headers.get("content-disposition") ?? "", /attachment/);
  assert.equal(
    new TextDecoder("latin1").decode((await response.arrayBuffer()).slice(0, 5)),
    "%PDF-",
  );
});

test("renderer failure returns the calm PDF error without leaking internals", async () => {
  const response = await createBankReportPdfDownloadResponse(
    createReport(),
    async () => { throw new Error("sensitive renderer detail"); },
  );
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    message: "PDF-filen kunde inte skapas just nu. Försök igen.",
  });
});

test("route still relies on app-wide Access authorization before generation", () => {
  assert.match(routeSource, /requirePlanningAuthorization\(request\)/);
  assert.match(routeSource, /if \("response" in authorization\)/);
});
