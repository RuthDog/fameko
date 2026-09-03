export type FinancialAssetsData = {
  investments: number | null;
  liquidSavings: number | null;
  otherFinancialAssets: number | null;
  privatePension: number | null;
};

const financialAssetKeys: (keyof FinancialAssetsData)[] = [
  "investments",
  "liquidSavings",
  "otherFinancialAssets",
  "privatePension",
];
const maxFinancialAssetAmount = 1_000_000_000_000;

export const emptyFinancialAssetsData: FinancialAssetsData = {
  investments: null,
  liquidSavings: null,
  otherFinancialAssets: null,
  privatePension: null,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNullableAmount(value: unknown) {
  return (
    value === null ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= maxFinancialAssetAmount)
  );
}

export function isFinancialAssetsData(
  value: unknown,
): value is FinancialAssetsData {
  if (!isObject(value)) {
    return false;
  }

  const keys = Object.keys(value);
  if (
    keys.length !== financialAssetKeys.length ||
    !keys.every((key) =>
      financialAssetKeys.includes(key as keyof FinancialAssetsData),
    )
  ) {
    return false;
  }

  return financialAssetKeys.every((key) => isNullableAmount(value[key]));
}
