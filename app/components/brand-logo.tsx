"use client";

import { useState, type ReactNode } from "react";

import {
  buildLogoDevUrl,
  resolveBrand,
} from "../../shared/brand/brand-recognition.ts";

const logoDevPublishableKey =
  process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;

export function BrandLogo({
  className = "",
  displayName,
  domain,
  fallback = null,
  size = 20,
}: {
  className?: string;
  displayName: string;
  domain: string;
  fallback?: ReactNode;
  size?: number;
}) {
  const src = buildLogoDevUrl(domain, logoDevPublishableKey, size);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return fallback;
  }

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-[4px] ${className}`}
      style={{ height: size, width: size }}
    >
      {/* Logo.dev is a deliberately restricted logo CDN; a plain image keeps
          failures local to this enrichment instead of involving Next/Image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={`${displayName}-logotyp`}
        className="block h-full w-full object-contain"
        decoding="async"
        draggable={false}
        height={size}
        loading="lazy"
        onError={() => setFailedSrc(src)}
        referrerPolicy="origin"
        src={src}
        width={size}
      />
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
      domain={brand.domain}
      fallback={fallback}
      size={size}
    />
  );
}
