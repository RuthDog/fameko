import type { ReactNode } from "react";

import { resolveBrand } from "../../shared/brand/brand-recognition.ts";

export function BrandLogo({
  className = "",
  displayName,
  fallback = null,
  size = 20,
}: {
  className?: string;
  displayName: string;
  fallback?: ReactNode;
  size?: number;
}) {
  if (fallback !== null) {
    return fallback;
  }

  const initial = displayName.trim().slice(0, 1).toLocaleUpperCase("sv-SE") || "•";

  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-[4px] bg-stone-200 text-[0.65em] font-bold text-stone-600 ${className}`}
      style={{ height: size, width: size }}
    >
      {initial}
    </span>
  );
}

export function RecognizedBrandLogo({
  className,
  fallback = null,
  name,
  size = 20,
}: {
  className?: string;
  fallback?: ReactNode;
  name: string;
  size?: number;
}) {
  const brand = resolveBrand(name);

  if (!brand.recognized) {
    return fallback;
  }

  return (
    <BrandLogo
      className={className}
      displayName={brand.displayName}
      fallback={fallback}
      size={size}
    />
  );
}
