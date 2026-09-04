"use client";

import { useState } from "react";

const pdfErrorMessage = "PDF-filen kunde inte skapas just nu. Försök igen.";

function filenameFromDisposition(disposition: string | null, planningYear: number) {
  const match = disposition?.match(/filename="([^"]+)"/i);
  return match?.[1] ?? `fameko-ekonomisk-oversikt-${planningYear}.pdf`;
}

export function BankReportPdfAction({ planningYear }: { planningYear: number }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function downloadPdf() {
    setState("loading");

    try {
      const response = await fetch(
        `/app/api/planning-years/${planningYear}/bank-report.pdf`,
        {
          cache: "no-store",
          credentials: "same-origin",
        },
      );

      if (!response.ok) {
        throw new Error("PDF response was not successful");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filenameFromDisposition(
        response.headers.get("content-disposition"),
        planningYear,
      );
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        className="inline-flex min-h-10 items-center justify-center rounded-lg bg-stone-900 px-4 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-wait disabled:opacity-70"
        disabled={state === "loading"}
        onClick={downloadPdf}
        type="button"
      >
        {state === "loading" ? "Skapar PDF..." : "Ladda ner PDF"}
      </button>
      <p aria-live="polite" className="min-h-5 text-sm text-rose-700" role="status">
        {state === "error" ? pdfErrorMessage : ""}
      </p>
    </div>
  );
}
