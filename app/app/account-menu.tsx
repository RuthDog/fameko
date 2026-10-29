"use client";

import { useEffect, useRef, useState } from "react";

import { signOutAction } from "../auth/sign-out/actions.ts";

type SessionSummary = {
  email: string | null;
};

type AccountMenuProps = {
  hasUnsavedChanges: boolean;
  onSave: () => Promise<boolean>;
};

export function AccountMenu({ hasUnsavedChanges, onSave }: AccountMenuProps) {
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSessionSummary() {
      try {
        const response = await fetch("/app/api/session", {
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        if (!response.ok || cancelled) return;
        const summary = (await response.json()) as SessionSummary;
        if (!cancelled) setEmail(summary.email);
      } catch {
        // The menu remains usable without exposing session failure details.
      }
    }

    void loadSessionSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  async function beginLogout() {
    setMenuOpen(false);
    setMessage("");
    if (hasUnsavedChanges) {
      setLogoutDialogOpen(true);
      return;
    }
    setBusy(true);
    await signOutAction();
  }

  async function saveAndLogout() {
    setBusy(true);
    setMessage("");
    const saved = await onSave();
    if (!saved) {
      setBusy(false);
      setMessage("Ändringarna kunde inte sparas. Du är fortfarande inloggad.");
      return;
    }
    await signOutAction();
  }

  async function logoutWithoutSaving() {
    setBusy(true);
    setMessage("");
    await signOutAction();
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="inline-flex min-h-10 items-center rounded-full border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-700 hover:border-stone-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          Konto
        </button>
        {menuOpen ? (
          <div
            aria-label="Kontomeny"
            className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-stone-200 bg-white p-3 shadow-xl"
            role="menu"
          >
            <p className="truncate px-2 py-2 text-sm text-stone-600">
              {email ?? "Inloggat konto"}
            </p>
            <button
              className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-stone-900 hover:bg-stone-100"
              onClick={() => void beginLogout()}
              role="menuitem"
              type="button"
            >
              Logga ut
            </button>
          </div>
        ) : null}
      </div>

      {logoutDialogOpen ? (
        <div
          aria-labelledby="logout-title"
          aria-modal="true"
          className="fixed inset-0 z-[100] grid place-items-center bg-stone-950/35 px-4"
          role="dialog"
        >
          <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
              Osparade ändringar
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-950" id="logout-title">
              Vill du spara innan du loggar ut?
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Om du loggar ut utan att spara lämnas ändringarna i den här fliken.
            </p>
            {message ? (
              <p className="mt-3 text-sm font-medium text-rose-700" role="alert">
                {message}
              </p>
            ) : null}
            <div className="mt-6 grid gap-2">
              <button
                className="min-h-11 rounded-full bg-[#1d252d] px-4 font-semibold text-white disabled:opacity-50"
                disabled={busy}
                onClick={() => void saveAndLogout()}
                type="button"
              >
                Spara och logga ut
              </button>
              <button
                className="min-h-11 rounded-full border border-stone-300 px-4 font-semibold text-stone-900 disabled:opacity-50"
                disabled={busy}
                onClick={() => setLogoutDialogOpen(false)}
                type="button"
              >
                Fortsätt redigera
              </button>
              <button
                className="min-h-11 rounded-full px-4 font-semibold text-rose-700 disabled:opacity-50"
                disabled={busy}
                onClick={() => void logoutWithoutSaving()}
                type="button"
              >
                Logga ut utan att spara
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
