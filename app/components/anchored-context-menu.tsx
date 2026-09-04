"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { getAnchoredMenuPosition } from "../../shared/ui/anchored-menu-position.ts";

export type AnchoredContextMenuItem = {
  disabled?: boolean;
  disabledReason?: string;
  label: string;
  onSelect: () => void;
  tone?: "default" | "destructive";
};

type MenuPosition = ReturnType<typeof getAnchoredMenuPosition>;

export function AnchoredContextMenu({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: AnchoredContextMenuItem[];
}) {
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const closeMenu = useCallback((restoreFocus = true) => {
    setOpen(false);
    setPosition(null);

    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  function calculatePosition(menuWidth: number, menuHeight: number) {
    const anchor = triggerRef.current?.getBoundingClientRect();

    if (!anchor) {
      return null;
    }

    return getAnchoredMenuPosition(
      anchor,
      { height: menuHeight, width: menuWidth },
      { height: window.innerHeight, width: window.innerWidth },
    );
  }

  function openMenu() {
    const initialPosition = calculatePosition(144, Math.max(40, items.length * 40 + 8));

    if (!initialPosition) {
      return;
    }

    setPosition(initialPosition);
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open || !menuRef.current) {
      return;
    }

    const menu = menuRef.current;
    const measuredPosition = calculatePosition(menu.offsetWidth, menu.offsetHeight);

    if (measuredPosition) {
      setPosition(measuredPosition);
    }

    menu.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeFromOutside(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        !menuRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        closeMenu();
      }
    }

    function closeFromViewportChange() {
      closeMenu();
    }

    document.addEventListener("pointerdown", closeFromOutside);
    window.addEventListener("resize", closeFromViewportChange);
    window.addEventListener("scroll", closeFromViewportChange, true);

    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      window.removeEventListener("resize", closeFromViewportChange);
      window.removeEventListener("scroll", closeFromViewportChange, true);
    };
  }, [closeMenu, open]);

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const menuItems = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? [],
    );
    const currentIndex = menuItems.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (currentIndex + direction + menuItems.length) % menuItems.length;
      menuItems[nextIndex]?.focus();
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      menuItems[event.key === "Home" ? 0 : menuItems.length - 1]?.focus();
    }
  }

  return (
    <>
      <button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
        onClick={() => (open ? closeMenu() : openMenu())}
        ref={triggerRef}
        title="Fler alternativ"
        type="button"
      >
        ...
      </button>
      {open && position
        ? createPortal(
            <div
              aria-label={ariaLabel}
              className="fixed z-40 max-h-[calc(100vh-16px)] w-36 max-w-[calc(100vw-16px)] overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 text-sm text-stone-700 shadow-[0_12px_32px_rgba(28,25,23,0.14)]"
              data-opens-upward={position.opensUpward || undefined}
              id={menuId}
              onKeyDown={handleMenuKeyDown}
              ref={menuRef}
              role="menu"
              style={{ left: position.left, top: position.top }}
            >
              {items.map((item) => (
                <button
                  aria-label={
                    item.disabledReason
                      ? `${item.label}: ${item.disabledReason}`
                      : item.label
                  }
                  className={`block min-h-10 w-full px-3 text-left transition disabled:cursor-not-allowed disabled:text-stone-300 ${
                    item.tone === "destructive" && !item.disabled
                      ? "text-rose-700 hover:bg-rose-50"
                      : "enabled:hover:bg-stone-50 enabled:hover:text-stone-950"
                  }`}
                  disabled={item.disabled}
                  key={item.label}
                  onClick={() => {
                    closeMenu(false);
                    item.onSelect();
                  }}
                  role="menuitem"
                  title={item.disabledReason}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
