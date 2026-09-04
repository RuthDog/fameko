import type { BankReportModel } from "../../shared/planning/bank-report.ts";
import {
  createBankReportFilename,
  renderBankReportPdf,
} from "./bank-report-pdf.ts";

export const bankReportPdfErrorMessage =
  "PDF-filen kunde inte skapas just nu. Försök igen.";

export function createBankReportPdfErrorResponse() {
  return Response.json(
    { message: bankReportPdfErrorMessage },
    {
      headers: { "Cache-Control": "private, no-store" },
      status: 500,
    },
  );
}

export async function createBankReportPdfDownloadResponse(
  report: BankReportModel,
  renderer: (model: BankReportModel) => Promise<Uint8Array> = renderBankReportPdf,
) {
  try {
    const pdf = await renderer(report);
    return new Response(Uint8Array.from(pdf).buffer, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${createBankReportFilename(report)}"`,
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
      status: 200,
    });
  } catch {
    return createBankReportPdfErrorResponse();
  }
}
