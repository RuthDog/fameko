export type WorkspaceSaveOperationState =
  | "conflict"
  | "error"
  | "idle"
  | "saved"
  | "saving";

export type WorkspaceSaveStatus = "dirty" | "saved" | "saving";

export type WorkspaceSavePresentation = {
  label: string;
  status: WorkspaceSaveStatus;
  symbol: "●" | "✓" | "⟳";
};

export function hasUnsavedWorkspaceChanges(
  ready: boolean,
  savedSnapshot: string | null,
  currentSnapshot: string | null,
): boolean {
  return (
    ready &&
    savedSnapshot !== null &&
    currentSnapshot !== null &&
    currentSnapshot !== savedSnapshot
  );
}

export function getWorkspaceSavePresentation(
  hasUnsavedChanges: boolean,
  operationState: WorkspaceSaveOperationState,
): WorkspaceSavePresentation {
  if (operationState === "saving") {
    return {
      label: "Sparar...",
      status: "saving",
      symbol: "⟳",
    };
  }

  if (hasUnsavedChanges) {
    return {
      label: "Du har osparade ändringar",
      status: "dirty",
      symbol: "●",
    };
  }

  return {
    label: "Sparat i molnet",
    status: "saved",
    symbol: "✓",
  };
}

export function shouldConfirmWorkspaceNavigation(
  hasUnsavedChanges: boolean,
  currentUrl: string,
  destinationUrl: string,
): boolean {
  if (!hasUnsavedChanges) {
    return false;
  }

  const current = new URL(currentUrl);
  const destination = new URL(destinationUrl, current);

  return !(
    destination.origin === current.origin &&
    destination.pathname === current.pathname &&
    destination.search === current.search
  );
}
