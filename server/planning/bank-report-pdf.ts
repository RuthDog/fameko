import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";

import {
  createBankReportPdfContent,
  type BankReportPdfContent,
  type BankReportPdfGroup,
  type BankReportPdfRow,
} from "../../shared/planning/bank-report-pdf-content.ts";
import type { BankReportModel } from "../../shared/planning/bank-report.ts";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;
const CONTENT_TOP = A4_HEIGHT - MARGIN;
const CONTENT_BOTTOM = 54;

const palette = {
  accent: rgb(0.39, 0.46, 0.38),
  dark: rgb(0.11, 0.1, 0.09),
  divider: rgb(0.84, 0.82, 0.78),
  muted: rgb(0.39, 0.37, 0.34),
  paper: rgb(0.998, 0.996, 0.984),
  soft: rgb(0.95, 0.94, 0.91),
  watch: rgb(0.45, 0.42, 0.36),
};

type FontSet = {
  bold: PDFFont;
  regular: PDFFont;
};

type DrawTextOptions = {
  color?: RGB;
  font?: PDFFont;
  lineHeight?: number;
  maxWidth?: number;
  size?: number;
};

function safePdfText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7e\u00a1-\u00ff]/g, "");
}

function splitLongWord(word: string, maxWidth: number, font: PDFFont, size: number) {
  const chunks: string[] = [];
  let chunk = "";

  for (const character of word) {
    const candidate = `${chunk}${character}`;
    if (chunk && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      chunks.push(chunk);
      chunk = character;
    } else {
      chunk = candidate;
    }
  }

  if (chunk) {
    chunks.push(chunk);
  }

  return chunks;
}

function wrapText(value: string, maxWidth: number, font: PDFFont, size: number) {
  const words = safePdfText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const rawWord of words) {
    const parts = font.widthOfTextAtSize(rawWord, size) > maxWidth
      ? splitLongWord(rawWord, maxWidth, font, size)
      : [rawWord];

    for (const word of parts) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
  }

  if (line || lines.length === 0) {
    lines.push(line);
  }

  return lines;
}

class PdfLayout {
  readonly pages: PDFPage[] = [];
  readonly fonts: FontSet;
  private readonly document: PDFDocument;
  private page: PDFPage;
  private y = CONTENT_TOP;

  constructor(document: PDFDocument, fonts: FontSet) {
    this.document = document;
    this.fonts = fonts;
    this.page = this.addPage();
  }

  private addPage() {
    const page = this.document.addPage([A4_WIDTH, A4_HEIGHT]);
    page.drawRectangle({
      color: palette.paper,
      height: A4_HEIGHT,
      width: A4_WIDTH,
      x: 0,
      y: 0,
    });
    this.pages.push(page);
    this.page = page;
    this.y = CONTENT_TOP;
    return page;
  }

  newLogicalPage(title: string) {
    if (this.pages.length > 0 && this.y < CONTENT_TOP) {
      this.addPage();
    }
    this.page.drawText("FAMEKO", {
      color: palette.accent,
      font: this.fonts.bold,
      size: 8,
      x: MARGIN,
      y: this.y,
    });
    this.page.drawText(safePdfText(title), {
      color: palette.muted,
      font: this.fonts.regular,
      size: 8,
      x: A4_WIDTH - MARGIN - this.fonts.regular.widthOfTextAtSize(safePdfText(title), 8),
      y: this.y,
    });
    this.y -= 25;
  }

  ensureSpace(height: number) {
    if (this.y - height < CONTENT_BOTTOM) {
      this.addPage();
      this.page.drawText("FAMEKO", {
        color: palette.accent,
        font: this.fonts.bold,
        size: 8,
        x: MARGIN,
        y: this.y,
      });
      this.y -= 25;
    }
  }

  gap(height: number) {
    this.y -= height;
  }

  line(color = palette.divider, thickness = 0.6) {
    this.ensureSpace(8);
    this.page.drawLine({
      color,
      end: { x: A4_WIDTH - MARGIN, y: this.y },
      start: { x: MARGIN, y: this.y },
      thickness,
    });
    this.y -= 8;
  }

  text(value: string, options: DrawTextOptions = {}) {
    const font = options.font ?? this.fonts.regular;
    const size = options.size ?? 10;
    const lineHeight = options.lineHeight ?? size * 1.42;
    const maxWidth = options.maxWidth ?? CONTENT_WIDTH;
    const lines = wrapText(value, maxWidth, font, size);
    const height = Math.max(lineHeight, lines.length * lineHeight);
    this.ensureSpace(height);

    for (const line of lines) {
      this.page.drawText(line, {
        color: options.color ?? palette.dark,
        font,
        size,
        x: MARGIN,
        y: this.y,
      });
      this.y -= lineHeight;
    }

    return lines.length;
  }

  sectionTitle(title: string) {
    this.ensureSpace(37);
    this.line();
    this.page.drawText(safePdfText(title.toLocaleUpperCase("sv-SE")), {
      color: palette.muted,
      font: this.fonts.bold,
      size: 8,
      x: MARGIN,
      y: this.y,
    });
    this.y -= 25;
  }

  subheading(title: string) {
    this.ensureSpace(24);
    this.page.drawText(safePdfText(title), {
      color: palette.dark,
      font: this.fonts.bold,
      size: 12,
      x: MARGIN,
      y: this.y,
    });
    this.y -= 19;
  }

  private rowHeight(row: BankReportPdfRow) {
    const labelLines = wrapText(row.label, CONTENT_WIDTH - 170, this.fonts.regular, 9.5);
    const valueLines = wrapText(row.value, 150, this.fonts.bold, 9.5);
    return Math.max(22, Math.max(labelLines.length, valueLines.length) * 12.5 + 9);
  }

  row(row: BankReportPdfRow, index = 0) {
    const rowHeight = this.rowHeight(row);
    this.ensureSpace(rowHeight);
    if (index > 0) {
      this.page.drawLine({
        color: palette.divider,
        end: { x: A4_WIDTH - MARGIN, y: this.y + 7 },
        start: { x: MARGIN, y: this.y + 7 },
        thickness: 0.35,
      });
    }
    wrapText(row.label, CONTENT_WIDTH - 170, this.fonts.regular, 9.5)
      .forEach((line, lineIndex) => {
        this.page.drawText(line, {
          color: palette.muted,
          font: this.fonts.regular,
          size: 9.5,
          x: MARGIN,
          y: this.y - lineIndex * 12.5,
        });
      });
    wrapText(row.value, 150, this.fonts.bold, 9.5)
      .forEach((line, lineIndex) => {
        this.page.drawText(line, {
          color: palette.dark,
          font: this.fonts.bold,
          size: 9.5,
          x: A4_WIDTH - MARGIN - this.fonts.bold.widthOfTextAtSize(line, 9.5),
          y: this.y - lineIndex * 12.5,
        });
      });
    this.y -= rowHeight;
  }

  listItem(value: string, tone: "positive" | "watch" | "neutral" = "neutral") {
    const font = this.fonts.regular;
    const size = 9.5;
    const maxWidth = CONTENT_WIDTH - 22;
    const lines = wrapText(value, maxWidth, font, size);
    const lineHeight = 13.5;
    this.ensureSpace(lines.length * lineHeight + 5);
    const markerY = this.y + 3;

    if (tone === "positive") {
      this.page.drawCircle({ color: palette.accent, size: 4, x: MARGIN + 4, y: markerY });
      this.page.drawLine({
        color: palette.paper,
        end: { x: MARGIN + 6.6, y: markerY + 2.2 },
        start: { x: MARGIN + 2.2, y: markerY - 0.2 },
        thickness: 0.9,
      });
    } else if (tone === "watch") {
      this.page.drawCircle({ borderColor: palette.watch, borderWidth: 0.9, size: 3.7, x: MARGIN + 4, y: markerY });
    } else {
      this.page.drawCircle({ color: palette.muted, size: 1.7, x: MARGIN + 4, y: markerY });
    }

    for (const line of lines) {
      this.page.drawText(line, {
        color: palette.muted,
        font,
        size,
        x: MARGIN + 18,
        y: this.y,
      });
      this.y -= lineHeight;
    }
    this.y -= 4;
  }

  metricGrid(rows: BankReportPdfRow[]) {
    const columnGap = 12;
    const columnWidth = (CONTENT_WIDTH - columnGap) / 2;
    const cardHeight = 39;
    const rowCount = Math.ceil(rows.length / 2);
    this.ensureSpace(rowCount * (cardHeight + 7));

    rows.forEach((row, index) => {
      const column = index % 2;
      const gridRow = Math.floor(index / 2);
      const x = MARGIN + column * (columnWidth + columnGap);
      const y = this.y - gridRow * (cardHeight + 7) - cardHeight;
      this.page.drawRectangle({
        color: palette.soft,
        height: cardHeight,
        width: columnWidth,
        x,
        y,
      });
      this.page.drawText(safePdfText(row.label), {
        color: palette.muted,
        font: this.fonts.regular,
        size: 7.7,
        x: x + 10,
        y: y + 24,
      });
      this.page.drawText(safePdfText(row.value), {
        color: palette.dark,
        font: this.fonts.bold,
        size: 11,
        x: x + 10,
        y: y + 9,
      });
    });
    this.y -= rowCount * (cardHeight + 7);
  }

  group(group: BankReportPdfGroup) {
    const noteLines = group.note
      ? wrapText(group.note, CONTENT_WIDTH, this.fonts.regular, 8).length
      : 0;
    this.ensureSpace(
      24 +
      group.rows.reduce((height, row) => height + this.rowHeight(row), 0) +
      noteLines * 11 +
      7,
    );
    this.subheading(group.title);
    group.rows.forEach((row, index) => this.row(row, index));
    if (group.note) {
      this.text(group.note, {
        color: palette.muted,
        lineHeight: 11,
        size: 8,
      });
    }
    this.gap(7);
  }

  finishFooters(content: BankReportPdfContent) {
    const total = this.pages.length;
    const title = safePdfText(content.header.title);

    this.pages.forEach((page, index) => {
      page.drawLine({
        color: palette.divider,
        end: { x: A4_WIDTH - MARGIN, y: 39 },
        start: { x: MARGIN, y: 39 },
        thickness: 0.45,
      });
      page.drawText(`Fameko - ${title} - ${content.header.planningYear}`, {
        color: palette.muted,
        font: this.fonts.regular,
        size: 7.5,
        x: MARGIN,
        y: 25,
      });
      const pageNumber = `Sida ${index + 1} av ${total}`;
      page.drawText(pageNumber, {
        color: palette.muted,
        font: this.fonts.regular,
        size: 7.5,
        x: A4_WIDTH - MARGIN - this.fonts.regular.widthOfTextAtSize(pageNumber, 7.5),
        y: 25,
      });
    });
  }
}

function drawFirstPage(layout: PdfLayout, content: BankReportPdfContent) {
  layout.text("FAMEKO", { color: palette.accent, font: layout.fonts.bold, size: 9 });
  layout.gap(8);
  layout.text(content.header.title, {
    font: layout.fonts.bold,
    lineHeight: 30,
    size: 25,
  });
  layout.gap(10);
  if (content.header.household) {
    layout.text(`Hushåll: ${content.header.household}`, { color: palette.muted, size: 9.5 });
  }
  layout.text(`Planeringsår: ${content.header.planningYear}`, { color: palette.muted, size: 9.5 });
  layout.text(`Genererad: ${content.header.generatedAt}`, { color: palette.muted, size: 9.5 });
  layout.gap(6);
  layout.text("Underlaget bygger på de uppgifter som registrerats i Fameko.", {
    color: palette.muted,
    size: 8.5,
  });

  layout.sectionTitle("Sammanfattning");
  for (const paragraph of content.summary) {
    layout.text(paragraph, { lineHeight: 16, size: 11.5 });
    layout.gap(3);
  }
  if (content.snapshot.length) {
    layout.gap(5);
    content.snapshot.forEach((item) => layout.listItem(item.label, item.tone));
  }
  layout.gap(5);
  layout.metricGrid(content.metrics);

  layout.sectionTitle("Ekonomisk hälsa");
  layout.text(content.financialHealth.statusLabel, { font: layout.fonts.bold, size: 13 });
  layout.text(content.financialHealth.summary, { color: palette.muted, size: 9 });
  layout.gap(4);
  if (content.financialHealth.strengths.length) {
    layout.text("Styrkor", { font: layout.fonts.bold, size: 9 });
    content.financialHealth.strengths.forEach((item) => layout.listItem(item, "positive"));
  }
  if (content.financialHealth.watchItems.length) {
    layout.text("Att hålla koll på", { font: layout.fonts.bold, size: 9 });
    content.financialHealth.watchItems.forEach((item) => layout.listItem(item, "watch"));
  }
}

function drawIncomePage(layout: PdfLayout, content: BankReportPdfContent) {
  layout.newLogicalPage("Inkomster och kassaflöde");
  layout.sectionTitle("Inkomster");
  if (!content.incomes.length) {
    layout.text("Inga inkomster är registrerade för planeringsåret.", { color: palette.muted });
  }
  for (const income of content.incomes) {
    const estimate = 48 + income.metadata.length * 13 + (income.comment ? 28 : 0);
    layout.ensureSpace(estimate);
    layout.subheading(income.title);
    income.metadata.forEach((value) => layout.text(value, { color: palette.muted, size: 9 }));
    if (income.comment) {
      layout.text(income.comment, { color: palette.muted, lineHeight: 12, size: 8.5 });
    }
    layout.row({ label: income.note, value: income.amount });
    layout.gap(10);
  }
  layout.sectionTitle("Hushållets kassaflödesbild");
  content.cashFlow.forEach((row, index) => layout.row(row, index));
}

function drawBalancePage(layout: PdfLayout, content: BankReportPdfContent) {
  layout.newLogicalPage("Tillgångar och skulder");
  layout.sectionTitle("Tillgångar");
  if (content.assets.length) {
    content.assets.forEach((group) => layout.group(group));
  } else {
    layout.text("Inga tillgångsuppgifter är registrerade.", { color: palette.muted });
  }
  layout.sectionTitle("Skulder");
  if (content.debts.length) {
    content.debts.forEach((group) => layout.group(group));
  } else {
    layout.text("Inga skulddata är registrerade i underlaget.", { color: palette.muted });
  }
}

function drawAppendixPage(layout: PdfLayout, content: BankReportPdfContent) {
  layout.newLogicalPage("Kostnader och underlag");
  layout.sectionTitle("Största kostnader");
  if (content.majorExpenses.length) {
    content.majorExpenses.forEach((expense, index) => layout.row({
      label: `${index + 1}. ${expense.name}`,
      value: expense.amount,
    }, index));
  } else {
    layout.text("Inga planerade kostnader är registrerade.", { color: palette.muted });
  }
  layout.gap(14);
  layout.sectionTitle("Underlag och datakvalitet");
  content.dataQuality.forEach((item) => {
    layout.listItem(item.label, item.complete ? "positive" : "watch");
  });
  if (content.dataQuality.some((item) => !item.complete)) {
    layout.gap(4);
    layout.text(
      "Vill du göra översikten mer komplett kan du komplettera de uppgifter som saknas.",
      { color: palette.muted, size: 9 },
    );
  }
  layout.gap(24);
  layout.sectionTitle("Om underlaget");
  layout.text(content.disclaimer, { color: palette.muted, lineHeight: 13, size: 9 });
}

export function createBankReportFilename(report: BankReportModel) {
  const household = report.summary.householdDisplayName
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sv-SE")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  const prefix = household || "fameko";
  return `${prefix}-ekonomisk-oversikt-${report.document.planningYear}.pdf`;
}

export async function renderBankReportPdf(report: BankReportModel) {
  const content = createBankReportPdfContent(report);
  const document = await PDFDocument.create();
  const fonts = {
    bold: await document.embedFont(StandardFonts.HelveticaBold),
    regular: await document.embedFont(StandardFonts.Helvetica),
  };
  const layout = new PdfLayout(document, fonts);

  document.setTitle(content.header.title);
  document.setAuthor("Fameko");
  document.setSubject(`Ekonomisk översikt ${content.header.planningYear}`);
  document.setCreator("Fameko");
  document.setProducer("Fameko");
  document.setCreationDate(new Date(report.document.generatedAt));
  document.setModificationDate(new Date(report.document.generatedAt));

  drawFirstPage(layout, content);
  drawIncomePage(layout, content);
  drawBalancePage(layout, content);
  drawAppendixPage(layout, content);
  layout.finishFooters(content);

  return document.save({ addDefaultPage: false, useObjectStreams: true });
}
