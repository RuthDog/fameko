const currencyFormatter = new Intl.NumberFormat("sv-SE", {
  maximumFractionDigits: 0,
  useGrouping: true,
});

export const defaultCurrencyInputStep = 100;

export function parseCurrencyInput(value: string): number | null {
  const digits = value.replace(/[^0-9]/g, "");

  if (!digits) {
    return null;
  }

  const amount = Number(digits.replace(/^0+(?=\d)/, ""));
  return Number.isFinite(amount) ? amount : null;
}

export function formatCurrencyInput(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "";
  }

  return currencyFormatter.format(Math.max(0, Math.round(value))).replace(/\s/g, " ");
}
