"use client";

import { useState } from "react";

export function AccountExportButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function exportAccountData() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/app/api/account/export", {
        body: "{}",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      if (!response.ok) {
        setMessage("Exporten kunde inte skapas säkert.");
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "fameko-export.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage("Exporten kunde inte skapas säkert.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-7">
      <button
        className="min-h-11 w-full rounded-full bg-[#1d252d] px-4 font-semibold text-white disabled:opacity-50"
        disabled={busy}
        onClick={() => void exportAccountData()}
        type="button"
      >
        {busy ? "Förbereder export…" : "Hämta Fameko-export"}
      </button>
      {message ? <p className="mt-3 text-sm text-rose-700" role="alert">{message}</p> : null}
    </div>
  );
}
