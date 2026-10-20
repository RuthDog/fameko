"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { isCarData, type CarData } from "../../shared/planning/car.ts";
import {
  isFinancialAssetsData,
  type FinancialAssetsData,
} from "../../shared/planning/financial-assets.ts";
import { isHousingData, type HousingData } from "../../shared/planning/housing.ts";
import {
  isCurrentHouseholdProfile,
  type HouseholdProfile,
} from "../../shared/planning/household.ts";
import { currentPlanningYear } from "../../shared/planning/seed-planning-data.ts";
import { migrateLegacySavingsStructure } from "../../shared/planning/savings.ts";
import { readStoredActivePlanningYear } from "../../shared/planning/year-management.ts";
import {
  hasUnsavedWorkspaceChanges,
  type WorkspaceSaveOperationState,
} from "../../shared/workspace/save-experience.ts";

type DetailIncome = {
  id: string;
  monthlyValues: Record<string, number>;
  name: string;
  recurring: boolean;
};

export type DetailExpenseItem = {
  category: string;
  company?: string;
  description?: string;
  frequency?: string;
  id: string;
  monthlyValues: Record<string, number>;
  name: string;
  recurring: boolean;
};

export type DetailPlanningData = {
  allocationOverrides?: Record<string, Partial<Record<string, number>>>;
  areaItemValues?: Record<string, Partial<Record<string, number>>>;
  carData?: CarData;
  expenseCategories: Array<{ id: string; name: string; order: number }>;
  expenseItems: DetailExpenseItem[];
  financialAssetsData?: FinancialAssetsData;
  housingData?: HousingData;
  householdProfile?: HouseholdProfile;
  incomeLineValues?: Partial<Record<string, Partial<Record<string, number>>>>;
  incomes: DetailIncome[];
  labels?: {
    areaItems?: Record<string, string>;
    expenseCategories?: Record<string, string>;
    expenseItems?: Record<string, string>;
    incomeLines?: Record<string, string>;
    [key: string]: unknown;
  };
  openingBalance: number;
  version: 3;
  [key: string]: unknown;
};

type CloudPlanningYear = {
  data: DetailPlanningData;
  revision: number;
  schemaVersion: number;
  sessionContextId: string;
  updatedAt: string;
  year: number;
};

class PlanningDetailApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function isPlanningSessionChange(error: unknown): error is PlanningDetailApiError {
  return (
    error instanceof PlanningDetailApiError &&
    error.status === 409 &&
    error.message.toLocaleLowerCase("sv").includes("session")
  );
}

export type DetailLoadState = "error" | "loading" | "ready";
export type DetailSaveState = WorkspaceSaveOperationState;

function isDetailPlanningData(value: unknown): value is DetailPlanningData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const data = value as Partial<DetailPlanningData>;
  return (
    data.version === 3 &&
    typeof data.openingBalance === "number" &&
    Array.isArray(data.incomes) &&
    Array.isArray(data.expenseCategories) &&
    Array.isArray(data.expenseItems) &&
    (data.housingData === undefined || isHousingData(data.housingData)) &&
    (data.carData === undefined || isCarData(data.carData)) &&
    (data.financialAssetsData === undefined ||
      isFinancialAssetsData(data.financialAssetsData)) &&
    isCurrentHouseholdProfile(data.householdProfile) &&
    !("incomeMetadata" in data)
  );
}

async function parsePlanningYearResponse(
  response: Response,
  expectedYear: number,
): Promise<CloudPlanningYear> {
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : "Ekonomin kunde inte hämtas just nu.";
    throw new PlanningDetailApiError(message, response.status);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Servern skickade ett ogiltigt svar.");
  }

  const result = body as Record<string, unknown>;
  if (
    !isDetailPlanningData(result.data) ||
    result.schemaVersion !== 3 ||
    !Number.isInteger(result.revision) ||
    (result.revision as number) < 1 ||
    result.year !== expectedYear ||
    typeof result.sessionContextId !== "string" ||
    !/^[a-f0-9]{64}$/.test(result.sessionContextId) ||
    typeof result.updatedAt !== "string"
  ) {
    throw new Error("Servern skickade ett ogiltigt svar.");
  }

  const planningYear = result as CloudPlanningYear;
  return {
    ...planningYear,
    data: migrateLegacySavingsStructure(planningYear.data),
  };
}

async function loadPlanningYear(
  year: number,
  expectedSessionContextId?: string,
): Promise<CloudPlanningYear> {
  const response = await fetch(`/app/api/planning-years/${year}`, {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (response.status === 404) {
    throw new Error("Öppna Workspace först så att ditt planeringsår kan skapas.");
  }

  const result = await parsePlanningYearResponse(response, year);
  if (
    expectedSessionContextId !== undefined &&
    result.sessionContextId !== expectedSessionContextId
  ) {
    throw new PlanningDetailApiError("Din inloggade session har ändrats.", 409);
  }

  return result;
}

async function savePlanningYear(
  data: DetailPlanningData,
  expectedRevision: number,
  year: number,
  sessionContextId: string,
): Promise<CloudPlanningYear> {
  const response = await fetch(`/app/api/planning-years/${year}`, {
    body: JSON.stringify({ data, expectedRevision }),
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Fameko-Planning-Session": sessionContextId,
    },
    method: "PUT",
  });
  const saved = await parsePlanningYearResponse(response, year);
  if (saved.sessionContextId !== sessionContextId) {
    throw new PlanningDetailApiError("Din inloggade session har ändrats.", 409);
  }

  const verified = await loadPlanningYear(year, sessionContextId);

  if (
    verified.revision !== saved.revision ||
    JSON.stringify(verified.data) !== JSON.stringify(saved.data) ||
    JSON.stringify(verified.data) !== JSON.stringify(data)
  ) {
    throw new Error("Ekonomin ändrades innan sparningen kunde verifieras.");
  }

  return verified;
}

export function usePlanningDetail() {
  const [data, setData] = useState<DetailPlanningData | null>(null);
  const [loadState, setLoadState] = useState<DetailLoadState>("loading");
  const [message, setMessage] = useState("Hämtar din ekonomi…");
  const [revision, setRevision] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<DetailSaveState>("idle");
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [planningYear, setPlanningYear] = useState(currentPlanningYear);
  const [sessionContextId, setSessionContextId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const activeYear = readStoredActivePlanningYear(
          window.localStorage,
          currentPlanningYear,
        );
        const loadedPlanningYear = await loadPlanningYear(activeYear);
        if (cancelled) {
          return;
        }

        setPlanningYear(activeYear);
        setData(loadedPlanningYear.data);
        setRevision(loadedPlanningYear.revision);
        setSessionContextId(loadedPlanningYear.sessionContextId);
        setSavedSnapshot(JSON.stringify(loadedPlanningYear.data));
        setLoadState("ready");
        setMessage("");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLoadState("error");
        setMessage(error instanceof Error ? error.message : "Din ekonomi kunde inte hämtas.");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionContextId) {
      return;
    }

    const expectedSessionContextId = sessionContextId;
    let checking = false;
    let cancelled = false;

    async function verifyActiveSession() {
      if (checking || document.visibilityState === "hidden") {
        return;
      }

      checking = true;
      setLoadState("loading");
      setMessage("Verifierar din session…");

      try {
        await loadPlanningYear(planningYear, expectedSessionContextId);
        if (!cancelled) {
          setLoadState("ready");
          setMessage("");
        }
      } catch (error) {
        if (!cancelled) {
          setLoadState("error");
          setMessage(
            error instanceof PlanningDetailApiError && error.status === 409
              ? "Den inloggade användaren har ändrats. Ekonomin är dold och kan inte sparas i den här fliken."
              : "Sessionen kunde inte verifieras. Ekonomin hålls dold.",
          );
        }
      } finally {
        checking = false;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void verifyActiveSession();
      }
    }

    window.addEventListener("focus", verifyActiveSession);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", verifyActiveSession);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [planningYear, sessionContextId]);

  const currentSnapshot = useMemo(() => (data ? JSON.stringify(data) : null), [data]);
  const hasChanges = hasUnsavedWorkspaceChanges(
    loadState === "ready",
    savedSnapshot,
    currentSnapshot,
  );

  const updateData = useCallback((updater: (current: DetailPlanningData) => DetailPlanningData) => {
    setData((current) => (current ? updater(current) : current));
    setSaveState("idle");
    setMessage("");
  }, []);

  const save = useCallback(async () => {
    if (
      !data ||
      revision === null ||
      !sessionContextId ||
      loadState !== "ready" ||
      !hasChanges ||
      saveState === "saving"
    ) {
      return;
    }

    setSaveState("saving");
    setMessage("Sparar…");

    try {
      const saved = await savePlanningYear(
        data,
        revision,
        planningYear,
        sessionContextId,
      );
      setData(saved.data);
      setRevision(saved.revision);
      setSavedSnapshot(JSON.stringify(saved.data));
      setSaveState("saved");
      setMessage("Sparat i molnet");
    } catch (error) {
      if (isPlanningSessionChange(error)) {
        setLoadState("error");
        setSaveState("error");
        setMessage(
          "Den inloggade användaren har ändrats. Ekonomin är dold och sparningen stoppades.",
        );
        return;
      }

      const conflict = error instanceof PlanningDetailApiError && error.status === 409;
      setSaveState(conflict ? "conflict" : "error");
      setMessage(
        conflict
          ? "Nyare data finns i molnet. Ladda om sidan innan du sparar igen."
          : "Det gick inte att spara. Dina ändringar finns kvar i den öppna fliken.",
      );
    }
  }, [data, hasChanges, loadState, planningYear, revision, saveState, sessionContextId]);

  return {
    data,
    hasChanges,
    loadState,
    message,
    planningYear,
    save,
    saveState,
    updateData,
  };
}
