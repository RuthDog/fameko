"use client";

import { useEffect, useRef } from "react";

import {
  getWorkspaceSavePresentation,
  shouldConfirmWorkspaceNavigation,
  type WorkspaceSaveOperationState,
} from "../../shared/workspace/save-experience.ts";

const leaveWorkspaceMessage = "Du har osparade ändringar.\n\nVill du lämna ändå?";

const statusStyles = {
  dirty: {
    symbol: "text-amber-600",
    text: "text-stone-600",
  },
  saved: {
    symbol: "text-emerald-700",
    text: "text-stone-500",
  },
  saving: {
    symbol: "text-stone-500",
    text: "text-stone-600",
  },
} as const;

function useUnsavedChangesGuard(hasUnsavedChanges: boolean) {
  const allowNextUnload = useRef(false);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (allowNextUnload.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        !(event.target instanceof Element)
      ) {
        return;
      }

      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.download || (link.target && link.target !== "_self")) {
        return;
      }

      if (
        !shouldConfirmWorkspaceNavigation(
          hasUnsavedChanges,
          window.location.href,
          link.href,
        )
      ) {
        return;
      }

      if (!window.confirm(leaveWorkspaceMessage)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      allowNextUnload.current = true;
      window.setTimeout(() => {
        allowNextUnload.current = false;
      }, 0);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasUnsavedChanges]);
}

export function WorkspaceSaveStatusBar({
  hasUnsavedChanges,
  message,
  operationState,
  ready = true,
}: {
  hasUnsavedChanges: boolean;
  message?: string;
  operationState: WorkspaceSaveOperationState;
  ready?: boolean;
}) {
  useUnsavedChangesGuard(hasUnsavedChanges);

  if (!ready) {
    return null;
  }

  const presentation = getWorkspaceSavePresentation(hasUnsavedChanges, operationState);
  const styles = statusStyles[presentation.status];
  const exceptionalMessage =
    operationState === "conflict" || operationState === "error" ? message : undefined;

  return (
    <div className="border-t border-stone-200/60 bg-[#faf9f6]/80">
      <div
        aria-atomic="true"
        aria-live="polite"
        className="mx-auto flex h-8 w-full max-w-[1560px] items-center gap-2 px-4 text-[11px] transition-colors duration-300 sm:px-6 lg:px-8"
        role="status"
      >
        <span aria-hidden="true" className={`shrink-0 font-semibold ${styles.symbol}`}>
          {presentation.symbol}
        </span>
        <span className={`shrink-0 font-medium ${styles.text}`}>{presentation.label}</span>
        {exceptionalMessage ? (
          <span className="min-w-0 truncate text-rose-700">· {exceptionalMessage}</span>
        ) : null}
      </div>
    </div>
  );
}

export function WorkspaceSaveButton({
  disabled,
  hasUnsavedChanges,
  onSave,
  operationState,
}: {
  disabled: boolean;
  hasUnsavedChanges: boolean;
  onSave: () => void;
  operationState: WorkspaceSaveOperationState;
}) {
  const presentation = getWorkspaceSavePresentation(hasUnsavedChanges, operationState);
  const isDirty = presentation.status === "dirty";
  const isSaving = presentation.status === "saving";

  return (
    <button
      className={`min-h-9 rounded-lg px-4 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-white ${
        isDirty
          ? "bg-stone-950 text-white shadow-[0_5px_16px_rgba(28,25,23,0.16)] hover:bg-stone-800"
          : "bg-stone-900 text-white hover:bg-stone-700"
      }`}
      disabled={disabled}
      onClick={onSave}
      type="button"
    >
      {isSaving ? "Sparar..." : isDirty ? "● Spara" : "Spara"}
    </button>
  );
}
