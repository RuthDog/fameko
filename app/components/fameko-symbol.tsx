import Image from "next/image";

import {
  famekoSymbols,
  type FamekoSymbolId,
} from "../../shared/ui/fameko-symbols.ts";

export function FamekoSymbol({
  className = "",
  size = 24,
  symbol,
}: {
  className?: string;
  size?: number;
  symbol: FamekoSymbolId;
}) {
  const definition = famekoSymbols[symbol];

  return (
    <span
      aria-hidden="true"
      className={`relative inline-grid shrink-0 place-items-center leading-none ${className}`}
      style={{ height: size, width: size }}
    >
      {definition.illustrationSrc ? (
        <Image
          alt=""
          className="object-contain"
          fill
          sizes={`${size}px`}
          src={definition.illustrationSrc}
          unoptimized
        />
      ) : (
        <span style={{ fontSize: Math.max(12, Math.round(size * 0.65)) }}>
          {definition.glyph}
        </span>
      )}
    </span>
  );
}
