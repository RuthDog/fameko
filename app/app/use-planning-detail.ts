"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { isCarData, type CarData } from "../../shared/planning/car.ts";
import { isHousingData, type HousingData } from "../../shared/planning/housing.ts";
import { currentPlanningYear } from "../../shared/planning/seed-planning-data.ts";
import { migrateLegacySavingsStructure } from "../../shared/planning/savings.ts";

type DetailIncome = {
  id: string;
  monthlyValues: Record<string, number>;
  name: string;
  recurring: boolean;
};

export type DetailExpenseItem = {
  category: string;
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
  housingData?: HousingData;
  incomeLineValues?: Partial<Record<string, Partial<Record<string, number>>>>;
  incomes: DetailIncome[];
  labels?: {
    areaItems?: Record<string, string>;
    expenseCategories?: Record<string, string>;
    expenseItems?: Record<string, string>;
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

export type DetailLoadState = "error" | "loading" | "ready";
export type DetailSaveState = "conflict" | "error" | "idle" | "saved" | "saving";

const storageKey = "fameko.planning-data.v3";

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
    (data.carData === undefined || isCarData(data.carData))
  );
}

async function parsePlanningYearResponse(response: Response): Promise<CloudPlanningYear> {
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
    result.year !== currentPlanningYear ||
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

async function loadPlanningYear(): Promise<CloudPlanningYear> {
  const response = await fetch(`/app/api/planning-years/${currentPlanningYear}`, {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (response.status === 404) {
    throw new Error("Öppna Workspace först så att ditt planeringsår kan skapas.");
  }

  return parsePlanningYearResponse(response);
}

async function savePlanningYear(
  data: DetailPlanningData,
  expectedRevision: number,
): Promise<CloudPlanningYear> {
  const response = await fetch(`/app/api/planning-years/${currentPlanningYear}`, {
    body: JSON.stringify({ data, expectedRevision }),
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });
  const saved = await parsePlanningYearResponse(response);
  const verified = await loadPlanningYear();

  if (
    verified.revision !== saved.revision ||
    JSON.stringify(verified.data) !== JSON.stringify(saved.data)
  ) {
    throw new Error("Ekonomin ändrades innan sparningen kunde verifieras.");
  }

  return verified;
}

function cachePlanningData(data: DetailPlanningData) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    // Cloud Save is authoritative; the optional local cache must never block the page.
  }
}

export function usePlanningDetail() {
  const [data, setData] = useState<DetailPlanningData | null>(null);
  const [loadState, setLoadState] = useState<DetailLoadState>("loading");
  const [message, setMessage] = useState("Hämtar din ekonomi…");
  const [revision, setRevision] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<DetailSaveState>("idle");
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const planningYear = await loadPlanningYear();
        if (cancelled) {
          return;
        }

        setData(planningYear.data);
        setRevision(planningYear.revision);
        setSavedSnapshot(JSON.stringify(planningYear.data));
        setLoadState("ready");
        setMessage("");
        cachePlanningData(planningYear.data);
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

  const currentSnapshot = useMemo(() => (data ? JSON.stringify(data) : null), [data]);
  const hasChanges =
    loadState === "ready" &&
    savedSnapshot !== null &&
    currentSnapshot !== null &&
    currentSnapshot !== savedSnapshot;

  const updateData = useCallback((updater: (current: DetailPlanningData) => DetailPlanningData) => {
    setData((current) => (current ? updater(current) : current));
    setSaveState("idle");
    setMessage("");
  }, []);

  const save = useCallback(async () => {
    if (!data || revision === null || !hasChanges || saveState === "saving") {
      return;
    }

    setSaveState("saving");
    setMessage("Sparar…");

    try {
      const saved = await savePlanningYear(data, revision);
      setData(saved.data);
      setRevision(saved.revision);
      setSavedSnapshot(JSON.stringify(saved.data));
      setSaveState("saved");
      setMessage("Sparat i molnet");
      cachePlanningData(saved.data);
    } catch (error) {
      const conflict = error instanceof PlanningDetailApiError && error.status === 409;
      setSaveState(conflict ? "conflict" : "error");
      setMessage(
        conflict
          ? "Nyare data finns i molnet. Ladda om sidan innan du sparar igen."
          : "Det gick inte att spara. Dina ändringar finns kvar på den här enheten.",
      );
    }
  }, [data, hasChanges, revision, saveState]);

  return {
    data,
    hasChanges,
    loadState,
    message,
    save,
    saveState,
    updateData,
  };
}
