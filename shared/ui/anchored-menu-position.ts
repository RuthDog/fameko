export type MenuRectangle = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

export type MenuSize = {
  height: number;
  width: number;
};

export type ViewportSize = {
  height: number;
  width: number;
};

export type AnchoredMenuPosition = {
  left: number;
  opensUpward: boolean;
  top: number;
};

export function getAnchoredMenuPosition(
  anchor: MenuRectangle,
  menu: MenuSize,
  viewport: ViewportSize,
  gap = 6,
  padding = 8,
): AnchoredMenuPosition {
  const preferredLeft = anchor.right + gap;
  const fallbackLeft = anchor.left - menu.width - gap;
  const left = Math.min(
    Math.max(
      preferredLeft + menu.width <= viewport.width - padding
        ? preferredLeft
        : fallbackLeft,
      padding,
    ),
    Math.max(padding, viewport.width - menu.width - padding),
  );

  const preferredTop = anchor.bottom + gap;
  const opensUpward = preferredTop + menu.height > viewport.height - padding;
  const fallbackTop = anchor.top - menu.height - gap;
  const top = Math.min(
    Math.max(opensUpward ? fallbackTop : preferredTop, padding),
    Math.max(padding, viewport.height - menu.height - padding),
  );

  return { left, opensUpward, top };
}
