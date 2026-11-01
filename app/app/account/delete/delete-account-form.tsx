"use client";

import { useState } from "react";

const confirmationPhrase = "RADERA MITT KONTO";

export function DeleteAccountForm() {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function deleteAccount() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/app/api/account/delete", {
        body: JSON.stringify({ confirmation }),
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json()) as { error?: string; redirectTo?: string };
      if (response.ok && result.redirectTo) {
        window.location.assign(result.redirectTo);
        return;
      }
      setMessage(
        result.error === "shared_household"
          ? "Kontot kan inte raderas eftersom hushållet inte är ett ensamhushåll."
          : result.error === "reauthentication_required"
            ? "Din nya autentisering har löpt ut. Ladda om sidan och försök igen."
            : "Raderingen kunde inte slutföras säkert. Inga fler försök görs automatiskt.",
      );
    } catch {
      setMessage("Raderingen kunde inte slutföras säkert. Försök igen senare.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-7 border-t border-stone-200 pt-6">
      <label className="block text-sm font-semibold" htmlFor="delete-confirmation">
        Skriv {confirmationPhrase} för att bekräfta
      </label>
      <input
        autoComplete="off"
        className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 px-3 text-sm focus:border-stone-900 focus:outline-none"
        id="delete-confirmation"
        onChange={(event) => setConfirmation(event.target.value)}
        value={confirmation}
      />
      {message ? <p className="mt-3 text-sm text-rose-700" role="alert">{message}</p> : null}
      <button
        className="mt-5 min-h-11 w-full rounded-full bg-rose-700 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy || confirmation !== confirmationPhrase}
        onClick={() => void deleteAccount()}
        type="button"
      >
        {busy ? "Raderar säkert…" : "Radera mitt konto permanent"}
      </button>
    </div>
  );
}
