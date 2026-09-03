export type FinancialHealthStatus =
  | "STABLE"
  | "GOOD_FOUNDATION"
  | "NEEDS_ATTENTION"
  | "VULNERABLE"
  | "INSUFFICIENT_DATA";

export type FinancialHealthDataCompleteness = "LOW" | "MEDIUM" | "HIGH";

export type FinancialHealthSource =
  | "cashFlow"
  | "savings"
  | "buffer"
  | "housing"
  | "car"
  | "debts"
  | "assets";

export type FinancialHealthObservation = {
  code: string;
  condition: string;
  message: string;
  metric: string;
  source: FinancialHealthSource;
  value: boolean | number | string | null;
};

export type FinancialHealthMetricUnit =
  | "currency"
  | "months"
  | "percent"
  | "count";

export type FinancialHealthMetric = {
  caveat?: string;
  code: string;
  label: string;
  source: FinancialHealthSource;
  unit: FinancialHealthMetricUnit;
  value: number | null;
};

export type FinancialHealthCompleteness = {
  availableSources: FinancialHealthSource[];
  level: FinancialHealthDataCompleteness;
  message: string;
};

export type FinancialHealthResult = {
  dataCompleteness: FinancialHealthCompleteness;
  metrics: FinancialHealthMetric[];
  missingInputs: FinancialHealthObservation[];
  status: FinancialHealthStatus;
  statusLabel: string;
  strengths: FinancialHealthObservation[];
  summary: string;
  watchItems: FinancialHealthObservation[];
};
